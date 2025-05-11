import { type NextRequest, NextResponse } from "next/server"
import { getAccessibilityResults } from "@/lib/actions"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = Number.parseInt(searchParams.get("page") || "1")
    const pageSize = Number.parseInt(searchParams.get("pageSize") || "10")
    const sortBy = searchParams.get("sortBy") || "severity"
    const search = searchParams.get("search") || ""

    const results = await getAccessibilityResults({
      page,
      pageSize,
      sortBy,
      search,
    })

    return NextResponse.json(results)
  } catch (error) {
    console.error("Error in results API:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch accessibility results",
      },
      { status: 500 },
    )
  }
}
