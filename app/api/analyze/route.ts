import { type NextRequest, NextResponse } from "next/server"
import { addUrlsForAnalysis } from "@/lib/actions"
import type { ComplianceOptions } from "@/lib/types"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
      return NextResponse.json({ error: "Invalid request. Please provide an array of URLs." }, { status: 400 })
    }

    const complianceOptions: ComplianceOptions = {
      wcagLevel: body.wcagLevel || "aa",
      section508: body.section508 || false,
      bestPractices: body.bestPractices !== undefined ? body.bestPractices : true,
      experimental: body.experimental || false,
    }

    const result = await addUrlsForAnalysis(body.urls, complianceOptions)

    return NextResponse.json({
      success: true,
      message: `Analyzed ${result.count} URLs`,
      count: result.count,
    })
  } catch (error) {
    console.error("Error in analyze API:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process URLs for analysis",
      },
      { status: 500 },
    )
  }
}
