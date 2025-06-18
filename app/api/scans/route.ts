import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { analyzeAccessibility as simpleAnalyze } from "@/lib/simple-checker"
import { analyzeAccessibility as playwrightAnalyze } from "@/lib/playwright-axe"
import { analyzeAccessibility as htmlAnalyze } from "@/lib/html-validator"
import type { ComplianceOptions } from "@/lib/types"

export async function POST(request: Request) {
  try {
    const { projectId, url, complianceOptions, scanId } = await request.json()

    if (!projectId || !url) {
      return NextResponse.json(
        { error: "Project ID and URL are required" },
        { status: 400 }
      )
    }

    // Start a transaction to ensure atomicity
    const scan = await prisma.$transaction(async (tx) => {
      let scan
      
      if (scanId) {
        // This is a rescan - update existing scan
        scan = await tx.scan.update({
          where: { id: scanId },
          data: {
            status: "in_progress",
            url,
            startedAt: new Date(),
            completedAt: null,
            error: null,
            totalIssues: null,
            criticalIssues: null,
            seriousIssues: null,
            moderateIssues: null,
            minorIssues: null,
            analysisMethod: null
          }
        })

        // Delete existing results for this scan
        await tx.result.deleteMany({
          where: { scanId }
        })
      } else {
        // Create new scan record
        scan = await tx.scan.create({
          data: {
            projectId,
            url,
            status: "in_progress",
            startedAt: new Date()
          }
        })
      }

      return scan
    })

    // Process the scan asynchronously
    processScan(scan.id, url, complianceOptions, !!scanId).catch(error => {
      console.error(`Error processing scan ${scan.id}:`, error)
    })

    return NextResponse.json({ 
      success: true, 
      message: "Scan started successfully",
      scan 
    })
  } catch (error) {
    console.error("Error starting scan:", error)
    return NextResponse.json(
      { error: "Failed to start scan" },
      { status: 500 }
    )
  }
}

async function processScan(scanId: string, url: string, complianceOptions: ComplianceOptions, isRescan: boolean = false) {
  try {
    // Update scan status to in_progress
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: "in_progress" }
    })

    // Validate URL exists and is accessible
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (!response.ok) {
        throw new Error(`URL returned status ${response.status}`)
      }
    } catch (error) {
      throw new Error(`Failed to access URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Determine which analysis method to use
    let analysisResult
    let analysisMethod = "simple"

    try {
      // Try playwright-axe first for better accuracy
      analysisResult = await playwrightAnalyze(url, complianceOptions)
      analysisMethod = "playwright-axe"
    } catch (error) {
      console.warn("Playwright analysis failed, falling back to simple checker:", error)
      try {
        // Fall back to simple checker
        analysisResult = await simpleAnalyze(url, complianceOptions)
        analysisMethod = "simple"
      } catch (error) {
        console.warn("Simple analysis failed, falling back to HTML validator:", error)
        // Last resort: HTML validator
        analysisResult = await htmlAnalyze(url, complianceOptions)
        analysisMethod = "html-validator"
      }
    }

    // Start a transaction to ensure atomicity of results update
    await prisma.$transaction(async (tx) => {
      // Save results to database
      if (analysisResult.results.length > 0) {
        await tx.result.createMany({
          data: analysisResult.results.map(result => ({
            scanId,
            url: result.url,
            message: result.message,
            element: result.element,
            severity: result.severity,
            impact: result.impact,
            help: result.help,
            tags: result.tags,
            elementPath: result.elementPath,
            details: result.details || {},
            createdAt: new Date()
          }))
        })
      }

      // Update scan status to completed with summary data
      await tx.scan.update({
        where: { id: scanId },
        data: { 
          status: "completed",
          completedAt: new Date(),
          totalIssues: analysisResult.summary.total,
          criticalIssues: analysisResult.summary.critical,
          seriousIssues: analysisResult.summary.serious,
          moderateIssues: analysisResult.summary.moderate,
          minorIssues: analysisResult.summary.minor,
          analysisMethod
        }
      })
    })

    console.log(`Scan ${scanId} completed successfully`)
  } catch (error) {
    console.error(`Error processing scan ${scanId}:`, error)
    
    // Update scan status to failed
    await prisma.scan.update({
      where: { id: scanId },
      data: { 
        status: "failed",
        completedAt: new Date(),
        error: error instanceof Error ? error.message : "Unknown error"
      }
    })
    
    throw error
  }
}

async function handleRescanDiff(scanId: string, newResults: any[]) {
  console.log(`Handling rescan diff for scan ${scanId} with ${newResults.length} new results`)
  
  try {
    // Get existing results for this scan
    const existingResults = await prisma.result.findMany({
      where: { scanId }
    })
    
    console.log(`Found ${existingResults.length} existing results for scan ${scanId}`)
    
    // Create unique keys for comparison
    // We'll use a combination of url + message + element + severity as the unique identifier
    const createKey = (result: any) => `${result.url}|${result.message}|${result.element || ''}|${result.severity}`
    
    // Create maps for efficient comparison
    const existingMap = new Map<string, any>()
    existingResults.forEach(result => {
      const key = createKey(result)
      existingMap.set(key, result)
    })
    
    const newMap = new Map<string, any>()
    newResults.forEach(result => {
      const key = createKey(result)
      newMap.set(key, result)
    })
    
    // Find issues to add (in new results but not in existing)
    const toAdd: any[] = []
    newMap.forEach((result, key) => {
      if (!existingMap.has(key)) {
        toAdd.push(result)
      }
    })
    
    // Find issues to remove (in existing but not in new results)
    const toRemove: string[] = []
    existingMap.forEach((result, key) => {
      if (!newMap.has(key)) {
        toRemove.push(result.id)
      }
    })
    
    // Find issues to update (exist in both but may have changed details)
    const toUpdate: { id: string, updates: any }[] = []
    existingMap.forEach((existingResult, key) => {
      if (newMap.has(key)) {
        const newResult = newMap.get(key)!
        
        // Check if any important fields have changed
        const fieldsToCheck = ['help', 'impact', 'tags', 'elementPath', 'details']
        let hasChanges = false
        const updates: any = {}
        
        for (const field of fieldsToCheck) {
          if (JSON.stringify(existingResult[field]) !== JSON.stringify(newResult[field])) {
            updates[field] = newResult[field]
            hasChanges = true
          }
        }
        
        if (hasChanges) {
          updates.updatedAt = new Date()
          toUpdate.push({ id: existingResult.id, updates })
        }
      }
    })
    
    console.log(`Rescan diff summary:`)
    console.log(`- Issues to add: ${toAdd.length}`)
    console.log(`- Issues to remove: ${toRemove.length}`)
    console.log(`- Issues to update: ${toUpdate.length}`)
    
    // Perform database operations in transaction
    await prisma.$transaction(async (tx) => {
      // Remove resolved issues
      if (toRemove.length > 0) {
        await tx.result.deleteMany({
          where: {
            id: { in: toRemove }
          }
        })
        console.log(`Removed ${toRemove.length} resolved issues`)
      }
      
      // Add new issues
      if (toAdd.length > 0) {
        await tx.result.createMany({
          data: toAdd.map(result => ({
            scanId,
            url: result.url,
            message: result.message,
            element: result.element,
            severity: result.severity,
            impact: result.impact,
            help: result.help,
            tags: result.tags,
            elementPath: result.elementPath,
            details: result.details || {},
            createdAt: new Date(result.createdAt)
          }))
        })
        console.log(`Added ${toAdd.length} new issues`)
      }
      
      // Update existing issues with changes
      for (const update of toUpdate) {
        await tx.result.update({
          where: { id: update.id },
          data: update.updates
        })
      }
      if (toUpdate.length > 0) {
        console.log(`Updated ${toUpdate.length} existing issues`)
      }
    })
    
    console.log(`Rescan diff completed successfully for scan ${scanId}`)
    
  } catch (error) {
    console.error(`Error handling rescan diff for scan ${scanId}:`, error)
    throw error
  }
} 