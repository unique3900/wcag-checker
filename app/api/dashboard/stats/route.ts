import { NextResponse } from 'next/server'
import { prisma } from "@/lib/db"

// Function to calculate estimated fix time based on issue count and severity
function calculateEstimatedTime(
  critical: number,
  serious: number,
  moderate: number,
  minor: number
): string {
  // Base time in minutes by severity
  const timeInMinutes = 
    critical * 120 +  // 2 hours each
    serious * 90 +    // 1.5 hours each
    moderate * 45 +   // 45 minutes each
    minor * 15        // 15 minutes each
  
  // Convert to readable format
  if (timeInMinutes < 60) {
    return `${Math.round(timeInMinutes)}m`
  } else if (timeInMinutes < 480) { // Less than 8 hours
    const hours = Math.floor(timeInMinutes / 60)
    const minutes = Math.round(timeInMinutes % 60)
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  } else {
    const days = Math.floor(timeInMinutes / 480) // 8 hours per day
    const remainingHours = Math.floor((timeInMinutes % 480) / 60)
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }
}

export async function GET() {
  try {
    // Get all completed scans with their results
    const scans = await prisma.scan.findMany({
      where: {
        status: 'completed'
      },
      include: {
        results: true
      }
    })

    // Calculate total issues by severity
    const totalIssues = scans.reduce((acc, scan) => acc + (scan.totalIssues || 0), 0)
    const criticalIssues = scans.reduce((acc, scan) => acc + (scan.criticalIssues || 0), 0)
    const seriousIssues = scans.reduce((acc, scan) => acc + (scan.seriousIssues || 0), 0)
    const moderateIssues = scans.reduce((acc, scan) => acc + (scan.moderateIssues || 0), 0)
    const minorIssues = scans.reduce((acc, scan) => acc + (scan.minorIssues || 0), 0)

    // Get project counts
    const totalProjects = await prisma.project.count()
    const totalScans = scans.length

    // Calculate average issues per project
    const averageIssuesPerProject = totalProjects > 0 ? totalIssues / totalProjects : 0

    // Calculate total estimated fix time
    const totalEstimatedTime = calculateTotalEstimatedTime(scans)

    // Get last scan date
    const lastScan = await prisma.scan.findFirst({
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      totalProjects,
      totalScans,
      totalIssues,
      criticalIssues,
      seriousIssues,
      moderateIssues,
      minorIssues,
      totalEstimatedTime,
      averageIssuesPerProject,
      lastScanDate: lastScan?.createdAt || null
    })
  } catch (error) {
    console.error("Error fetching dashboard stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    )
  }
}

function calculateTotalEstimatedTime(scans: any[]): string {
  const totalMinutes = scans.reduce((acc, scan) => {
    const scanMinutes = scan.results.reduce((resultAcc: number, result: any) => {
      const estimatedTime = result.details?.estimatedFixTime || '0m'
      const minutes = parseEstimatedTime(estimatedTime)
      return resultAcc + minutes
    }, 0)
    return acc + scanMinutes
  }, 0)

  return formatEstimatedTime(totalMinutes)
}

function parseEstimatedTime(timeStr: string): number {
  const hours = timeStr.match(/(\d+)h/) ? parseInt(timeStr.match(/(\d+)h/)![1]) : 0
  const minutes = timeStr.match(/(\d+)m/) ? parseInt(timeStr.match(/(\d+)m/)![1]) : 0
  return hours * 60 + minutes
}

function formatEstimatedTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
} 