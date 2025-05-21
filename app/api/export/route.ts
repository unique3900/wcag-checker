import { type NextRequest, NextResponse } from "next/server"
import { exportToExcel } from "@/lib/actions"
import * as fs from 'fs/promises'

export async function GET(request: NextRequest) {
  try {
    // Extract query parameters from the request
    const searchParams = request.nextUrl.searchParams;
    
    // Parse query parameters
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'severity';
    const exportAll = searchParams.has('exportAll') ? true : false;
    
    // Handle array parameters (severityFilters and complianceFilters)
    const severityFilters = searchParams.getAll('severityFilters');
    const complianceFilters = searchParams.getAll('complianceFilters');
    
    // Pass the parameters to the exportToExcel function
    const result = await exportToExcel({
      search,
      sortBy,
      exportAll,
      severityFilters,
      complianceFilters
    });

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
