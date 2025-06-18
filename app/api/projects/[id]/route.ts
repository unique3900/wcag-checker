import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(
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
          },
          include: {
            results: true
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

    return NextResponse.json(project)
  } catch (error) {
    console.error("Error fetching project:", error)
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { name, urls } = await request.json()

    // Start a transaction to ensure atomicity
    const project = await prisma.$transaction(async (tx) => {
      // Get current project data
      const currentProject = await tx.project.findUnique({
        where: { id },
        include: {
          urls: true,
          scans: {
            include: {
              results: true
            }
          }
        }
      })

      if (!currentProject) {
        throw new Error("Project not found")
      }

      // If URLs are being updated, handle cleanup
      if (urls) {
        // Find URLs to remove
        const currentUrls = currentProject.urls.map(u => u.url)
        const urlsToRemove = currentUrls.filter(url => !urls.includes(url))

        if (urlsToRemove.length > 0) {
          // Find scans for removed URLs
          const scansToRemove = currentProject.scans.filter(scan => 
            urlsToRemove.includes(scan.url)
          )

          // Delete results for these scans
          if (scansToRemove.length > 0) {
            await tx.result.deleteMany({
              where: {
                scanId: {
                  in: scansToRemove.map(scan => scan.id)
                }
              }
            })
          }

          // Delete the scans
          await tx.scan.deleteMany({
            where: {
              id: {
                in: scansToRemove.map(scan => scan.id)
              }
            }
          })

          // Delete the URLs
          await tx.url.deleteMany({
            where: {
              projectId: id,
              url: {
                in: urlsToRemove
              }
            }
          })
        }

        // Add new URLs
        const newUrls = urls.filter((url: string) => !currentUrls.includes(url))
        if (newUrls.length > 0) {
          await tx.url.createMany({
            data: newUrls.map((url: string) => ({
              projectId: id,
              url
            }))
          })
        }
      }

      // Update project name if provided
      if (name) {
        return await tx.project.update({
          where: { id },
          data: { name },
          include: {
            urls: true,
            scans: {
              orderBy: {
                createdAt: 'desc'
              },
              include: {
                results: true
              }
            }
          }
        })
      }

      // If only URLs were updated, return updated project
      return await tx.project.findUnique({
        where: { id },
        include: {
          urls: true,
          scans: {
            orderBy: {
              createdAt: 'desc'
            },
            include: {
              results: true
            }
          }
        }
      })
    })

    return NextResponse.json(project)
  } catch (error) {
    console.error("Error updating project:", error)
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    await prisma.project.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting project:", error)
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    )
  }
} 