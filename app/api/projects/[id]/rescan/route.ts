import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        urls: true,
        scans: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })
    
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    if (!project.urls.length) {
      return NextResponse.json(
        { error: "Project has no URLs to scan" },
        { status: 400 }
      )
    }

    // Check for existing pending scans
    const pendingScans = project.scans.filter(scan => 
      scan.status === 'pending' || scan.status === 'in_progress'
    )
    
    if (pendingScans.length > 0) {
      return NextResponse.json(
        { error: "Cannot rescan while there are pending or in-progress scans. Please wait for them to complete." },
        { status: 409 }
      )
    }

    // Start a transaction to ensure atomicity
    const scans = await prisma.$transaction(async (tx) => {
      // Find or create scans for each URL
      const scanPromises = project.urls.map(async (urlRecord) => {
        // Find the latest scan for this URL
        const existingScan = project.scans.find(scan => scan.url === urlRecord.url)
        
        if (existingScan) {
          // Update existing scan for rescan
          const updatedScan = await tx.scan.update({
            where: { id: existingScan.id },
            data: {
              status: "pending",
              startedAt: null,
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
          return updatedScan
        } else {
          // Create new scan if none exists
          return await tx.scan.create({
            data: {
              projectId: project.id,
              url: urlRecord.url,
              status: "pending"
            }
          })
        }
      })

      return await Promise.all(scanPromises)
    })

    // Trigger scan processing asynchronously
    setTimeout(async () => {
      try {
        for (const scan of scans) {
          const scanData = {
            projectId: project.id,
            url: scan.url,
            scanId: scan.id,
            complianceOptions: project.complianceOptions || {
              wcagLevel: "aa",
              section508: false,
              bestPractices: true,
              experimental: false
            }
          }
          
          await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/scans`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(scanData)
          })
        }
      } catch (error) {
        console.error(`Failed to trigger scans:`, error)
      }
    }, 100)

    await prisma.project.update({
      where: { id },
      data: {
        updatedAt: new Date()
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: `Started rescanning ${scans.length} URLs`,
      scans
    })
  } catch (error) {
    console.error("Error rescanning project:", error)
    return NextResponse.json(
      { error: "Failed to rescan project" },
      { status: 500 }
    )
  }
} 