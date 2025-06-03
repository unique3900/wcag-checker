import { NextRequest, NextResponse } from "next/server"
import { getAccessibilityResults } from "@/lib/actions"
import ExcelJS from "exceljs"
import { chromium } from "playwright-core"

export async function POST(request: NextRequest) {
  try {
    const { format, data, includeScreenshots, organizeBySeverity } = await request.json()
    
    // Use the data passed from frontend instead of fetching again
    if (!data || !data.results || !data.summary) {
      return NextResponse.json({ error: "No data provided for export" }, { status: 400 })
    }

    const { results, summary } = data

    if (format === "pdf") {
      return await generatePDFReport(results, summary, includeScreenshots, organizeBySeverity)
    } else {
      return await generateExcelReport(results, summary, includeScreenshots, organizeBySeverity)
    }
  } catch (error) {
    console.error("Export error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    )
  }
}

async function generateExcelReport(results: any[], summary: any, includeScreenshots: boolean, organizeBySeverity: boolean) {
  const workbook = new ExcelJS.Workbook()
  
  // Add metadata
  workbook.creator = "WCAG Accessibility Checker"
  workbook.created = new Date()
  workbook.title = "Accessibility Report"
  workbook.description = "Comprehensive accessibility analysis report"

  // Create summary worksheet
  const summarySheet = workbook.addWorksheet("Summary")
  
  // Add title and summary
  summarySheet.mergeCells("A1:F1")
  const titleCell = summarySheet.getCell("A1")
  titleCell.value = "Accessibility Report Summary"
  titleCell.font = { size: 18, bold: true, color: { argb: "FF000080" } }
  titleCell.alignment = { horizontal: "center", vertical: "middle" }
  
  // Add summary data
  summarySheet.addRow([])
  summarySheet.addRow(["Report Generated:", new Date().toLocaleDateString()])
  summarySheet.addRow(["Total Issues:", summary?.total || 0])
  summarySheet.addRow(["URLs Analyzed:", summary?.urlsAnalyzed || 0])
  summarySheet.addRow([])
  
  // Add severity breakdown
  summarySheet.addRow(["Severity Breakdown:"])
  summarySheet.addRow(["Critical:", summary?.critical || 0])
  summarySheet.addRow(["Serious:", summary?.serious || 0])
  summarySheet.addRow(["Moderate:", summary?.moderate || 0])
  summarySheet.addRow(["Minor:", summary?.minor || 0])

  if (organizeBySeverity) {
    // Create separate sheets for each severity level
    const severityLevels = ["critical", "serious", "moderate", "minor"]
    
    for (const severity of severityLevels) {
      const severityResults = results.filter(r => r.severity.toLowerCase() === severity)
      
      if (severityResults.length > 0) {
        const sheet = workbook.addWorksheet(`${severity.charAt(0).toUpperCase() + severity.slice(1)} Issues`)
        await addResultsToSheet(sheet, severityResults, severity, includeScreenshots)
      }
    }
  } else {
    // Create a single sheet with all results
    const allIssuesSheet = workbook.addWorksheet("All Issues")
    await addResultsToSheet(allIssuesSheet, results, "all", includeScreenshots)
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="accessibility-report-${new Date().toISOString().split('T')[0]}.xlsx"`,
    },
  })
}

async function addResultsToSheet(sheet: ExcelJS.Worksheet, results: any[], severity: string, includeScreenshots: boolean) {
  // Add headers
  const headers = ["URL", "Issue", "Severity", "Element", "Help", "Compliance Tags", "Created At"]
  if (includeScreenshots) {
    headers.push("Screenshot Info")
  }
  
  const headerRow = sheet.addRow(headers)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: getSeverityColor(severity) },
    }
    cell.alignment = { horizontal: "center", vertical: "middle" }
  })

  // Add data rows
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    
    // Prepare row data
    const rowData = [
      result.url || "N/A",
      result.message || "N/A",
      result.severity || "N/A",
      result.element ? (result.element.length > 200 ? result.element.substring(0, 200) + "..." : result.element) : "N/A",
      result.help || "N/A",
      result.tags ? result.tags.join(", ") : "N/A",
      result.createdAt ? new Date(result.createdAt).toLocaleDateString() : "N/A",
    ]

    if (includeScreenshots) {
      // Add screenshot info
      const screenshotInfo = result.screenshotPath ? "Screenshot captured" : "Use 'View Issue' button in app to capture screenshot"
      rowData.push(screenshotInfo)
    }

    const row = sheet.addRow(rowData)

    // Color code by severity
    row.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: getSeverityColor(result.severity, true) },
      }
      // Wrap text for better readability
      cell.alignment = { wrapText: true, vertical: "top" }
    })

    // Set row height to accommodate wrapped text
    row.height = 60
  }

  // Auto-fit columns
  sheet.columns.forEach((column, index) => {
    if (index === 0) { // URL column
      column.width = 40
    } else if (index === 1) { // Issue column
      column.width = 50
    } else if (index === 3) { // Element column
      column.width = 60
    } else if (index === 4) { // Help column
      column.width = 50
    } else {
      column.width = 20
    }
  })
}

async function generatePDFReport(results: any[], summary: any, includeScreenshots: boolean, organizeBySeverity: boolean) {
  let browser = null
  
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const page = await context.newPage()

    // Generate HTML content for PDF
    const htmlContent = generateReportHTML(results, summary, includeScreenshots, organizeBySeverity)
    
    await page.setContent(htmlContent, { waitUntil: "networkidle" })
    
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm",
      },
    })

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="accessibility-report-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

function generateReportHTML(results: any[], summary: any, includeScreenshots: boolean, organizeBySeverity: boolean): string {
  const severityLevels = ["critical", "serious", "moderate", "minor"]
  
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Accessibility Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; line-height: 1.6; }
            .header { text-align: center; margin-bottom: 30px; }
            .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
            .severity-critical { background-color: #fee2e2; border-left: 4px solid #dc2626; }
            .severity-serious { background-color: #fed7aa; border-left: 4px solid #ea580c; }
            .severity-moderate { background-color: #fef3c7; border-left: 4px solid #d97706; }
            .severity-minor { background-color: #dbeafe; border-left: 4px solid #2563eb; }
            .issue { margin-bottom: 25px; padding: 20px; border-radius: 8px; page-break-inside: avoid; }
            .issue-title { font-weight: bold; margin-bottom: 15px; font-size: 1.1em; }
            .issue-details { font-size: 0.95em; color: #333; margin-bottom: 15px; }
            .issue-details strong { color: #000; }
            .element-code { 
                background: #f8f8f8; 
                padding: 12px; 
                border-radius: 6px; 
                font-family: 'Courier New', monospace; 
                font-size: 0.85em; 
                margin: 12px 0; 
                border: 1px solid #e0e0e0;
                word-wrap: break-word;
                white-space: pre-wrap;
            }
            .page-break { page-break-before: always; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .screenshot-container { 
                margin: 15px 0; 
                padding: 15px; 
                background: #f0f8ff; 
                border-radius: 6px; 
                border: 1px solid #b0d4ff;
            }
            .screenshot-image { 
                max-width: 100%; 
                height: auto; 
                border: 1px solid #ccc; 
                border-radius: 4px; 
                margin-top: 10px;
                display: block;
            }
            .image-info {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                padding: 10px;
                border-radius: 4px;
                margin: 10px 0;
                font-size: 0.9em;
            }
            .extracted-image {
                max-width: 300px;
                max-height: 200px;
                border: 1px solid #ddd;
                border-radius: 4px;
                margin: 10px 0;
            }
            h1, h2 { color: #333; }
            h2 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>WCAG Accessibility Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        </div>
        
        <div class="summary">
            <h2>Executive Summary</h2>
            <table>
                <tr><td><strong>Total Issues Found</strong></td><td>${summary?.total || 0}</td></tr>
                <tr><td><strong>URLs Analyzed</strong></td><td>${summary?.urlsAnalyzed || 0}</td></tr>
                <tr><td><strong>Critical Issues</strong></td><td style="color: #dc2626; font-weight: bold;">${summary?.critical || 0}</td></tr>
                <tr><td><strong>Serious Issues</strong></td><td style="color: #ea580c; font-weight: bold;">${summary?.serious || 0}</td></tr>
                <tr><td><strong>Moderate Issues</strong></td><td style="color: #d97706; font-weight: bold;">${summary?.moderate || 0}</td></tr>
                <tr><td><strong>Minor Issues</strong></td><td style="color: #2563eb; font-weight: bold;">${summary?.minor || 0}</td></tr>
            </table>
        </div>
  `

  if (organizeBySeverity) {
    for (const severity of severityLevels) {
      const severityResults = results.filter(r => r.severity.toLowerCase() === severity)
      
      if (severityResults.length > 0) {
        html += `
          <div class="page-break">
            <h2>${severity.charAt(0).toUpperCase() + severity.slice(1)} Issues (${severityResults.length})</h2>
        `
        
        severityResults.forEach((result, index) => {
          // Extract image URL from element if it's an image-related issue
          const imageUrl = extractImageFromElement(result.element)
          const isImageIssue = result.message?.toLowerCase().includes('alt') || 
                              result.message?.toLowerCase().includes('image') ||
                              result.element?.toLowerCase().includes('<img')
          
          html += `
            <div class="issue severity-${severity}">
              <div class="issue-title">Issue ${index + 1}: ${result.message || 'N/A'}</div>
              <div class="issue-details">
                <strong>URL:</strong> ${result.url || 'N/A'}<br>
                <strong>Severity Level:</strong> ${result.severity || 'N/A'}<br>
                <strong>Remediation Guidance:</strong> ${result.help || 'N/A'}<br>
                <strong>WCAG Compliance:</strong> ${result.tags?.join(", ") || "N/A"}<br>
                <strong>Detection Date:</strong> ${result.createdAt ? new Date(result.createdAt).toLocaleDateString() : 'N/A'}<br>
                ${(result as any).elementPath ? `<strong>Element Path:</strong> ${(result as any).elementPath}<br>` : ''}
                ${result.helpUrl ? `<strong>Learn More:</strong> <a href="${result.helpUrl}" target="_blank">${result.helpUrl}</a><br>` : ''}
              </div>
              
              ${isImageIssue && imageUrl ? `
                <div class="image-info">
                  <strong>🖼️ Image Found in Element:</strong><br>
                  <img src="${imageUrl}" alt="Element image" class="extracted-image" 
                       onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                  <div style="display: none; padding: 10px; background: #f8f8f8; border-radius: 4px; margin-top: 5px;">
                    <strong>Image URL:</strong> ${imageUrl}<br>
                    <em>Note: Image may not display if URL is inaccessible or requires authentication.</em>
                  </div>
                </div>
              ` : ''}
              
              <div class="element-code">
                <strong>HTML Element:</strong><br>
                ${escapeHtml(result.element || 'N/A')}
              </div>
              
              ${includeScreenshots ? `
                <div class="screenshot-container">
                  <strong>📸 Screenshot Capture:</strong><br>
                  <em>To capture a screenshot of this specific element:</em>
                  <ol style="margin: 10px 0; padding-left: 20px;">
                    <li>Open the WCAG Checker application</li>
                    <li>Navigate to the Results table</li>
                    <li>Find this issue and click "View Issue" button</li>
                    <li>The system will capture a screenshot of the problematic element</li>
                  </ol>
                  <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
                    <strong>Note:</strong> Screenshots are captured dynamically and are not embedded in this PDF report. 
                    Use the web application for visual inspection of accessibility issues.
                  </p>
                </div>
              ` : ''}
            </div>
          `
        })
        
        html += `</div>`
      }
    }
  } else {
    html += `<h2>All Issues (${results.length})</h2>`
    
    results.forEach((result, index) => {
      const imageUrl = extractImageFromElement(result.element)
      const isImageIssue = result.message?.toLowerCase().includes('alt') || 
                          result.message?.toLowerCase().includes('image') ||
                          result.element?.toLowerCase().includes('<img')
      
      html += `
        <div class="issue severity-${result.severity}">
          <div class="issue-title">Issue ${index + 1}: ${result.message}</div>
          <div class="issue-details">
            <strong>URL:</strong> ${result.url}<br>
            <strong>Severity:</strong> ${result.severity}<br>
            <strong>Help:</strong> ${result.help}<br>
            <strong>Compliance:</strong> ${result.tags?.join(", ") || "N/A"}<br>
            <strong>Date:</strong> ${new Date(result.createdAt).toLocaleDateString()}
          </div>
          
          ${isImageIssue && imageUrl ? `
            <div class="image-info">
              <strong>🖼️ Image Found:</strong><br>
              <img src="${imageUrl}" alt="Element image" class="extracted-image" 
                   onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
              <div style="display: none; padding: 10px; background: #f8f8f8; border-radius: 4px; margin-top: 5px;">
                <strong>Image URL:</strong> ${imageUrl}
              </div>
            </div>
          ` : ''}
          
          <div class="element-code">
            <strong>Element:</strong><br>
            ${escapeHtml(result.element)}
          </div>
        </div>
      `
    })
  }

  html += `
        <div style="margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; font-size: 0.9em;">
          <h3>Report Information</h3>
          <p><strong>Generated by:</strong> WCAG Accessibility Checker</p>
          <p><strong>Report Type:</strong> ${organizeBySeverity ? 'Organized by Severity' : 'Complete Issues List'}</p>
          <p><strong>Screenshots:</strong> ${includeScreenshots ? 'Enabled (use web application to view)' : 'Disabled'}</p>
          <p><strong>Standards:</strong> WCAG 2.0/2.1 Guidelines, Section 508, Best Practices</p>
        </div>
    </body>
    </html>
  `

  return html
}

// Helper function to extract image URL from HTML element
function extractImageFromElement(elementHtml: string): string | null {
  if (!elementHtml) return null
  
  try {
    // Look for img tags and extract src attribute
    const imgMatch = elementHtml.match(/<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/i)
    if (imgMatch) {
      return imgMatch[1]
    }
    
    // Look for background-image in style attribute
    const bgMatch = elementHtml.match(/background-image\s*:\s*url\s*\(\s*["']?([^"')]+)["']?\s*\)/i)
    if (bgMatch) {
      return bgMatch[1]
    }
    
    return null
  } catch (error) {
    return null
  }
}

// Helper function to escape HTML
function escapeHtml(text: string): string {
  if (!text) return ''
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getSeverityColor(severity: string, light: boolean = false): string {
  const colors = {
    critical: light ? "FFFFE2E2" : "FFDC2626",
    serious: light ? "FFFED7AA" : "FFEA580C", 
    moderate: light ? "FFFEF3C7" : "FFD97706",
    minor: light ? "FFDBEAFE" : "FF2563EB",
    all: light ? "FFF5F5F5" : "FF6B7280",
  }
  return colors[severity as keyof typeof colors] || colors.all
} 