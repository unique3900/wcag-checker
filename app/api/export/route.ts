import { type NextRequest, NextResponse } from "next/server"
import { exportToExcel } from "@/lib/actions"
import * as fs from 'fs/promises'

export async function GET(request: NextRequest) {
  try {
    const result = await exportToExcel()

    if (!result.success || !result.filePath) {
      return NextResponse.json({ error: "Failed to generate Excel file" }, { status: 500 })
    }

    // Read the file
    const fileBuffer = await fs.readFile(result.filePath)
    
    // Return the file as a downloadable attachment
    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    })
    
  } catch (error) {
    console.error("Error in export API:", error)
    return NextResponse.json({ error: "Failed to export results to Excel" }, { status: 500 })
  }
}
