import type { ComplianceOptions, AccessibilityResult } from "./types"
import * as cheerio from 'cheerio'
import fetch from 'node-fetch'

export async function analyzeAccessibility(
  url: string,
  complianceOptions: ComplianceOptions,
): Promise<{
  results: AccessibilityResult[]
  summary: {
    critical: number
    serious: number
    moderate: number
    minor: number
    total: number
    urlsAnalyzed: number
  }
}> {
  try {
    // Fetch the HTML content
    const response = await fetch(url)
    const html = await response.text()

    // Parse HTML with cheerio
    const $ = cheerio.load(html)
    
    const results: AccessibilityResult[] = []
    
    // Check for missing alt text on images
    $('img').each((i, el) => {
      const alt = $(el).attr('alt')
      if (alt === undefined || alt === '') {
        results.push({
          id: `simple-missing-alt-${i}`,
          url,
          message: 'Image is missing alt text',
          help: 'Images must have alternative text to convey their purpose to screen reader users',
          element: $.html(el),
          impact: 'serious',
          severity: 'serious',
          tags: ['wcag2a', 'wcag111'],
          createdAt: new Date().toISOString(),
        })
      }
    })

    // Check for empty links
    $('a').each((i, el) => {
      const text = $(el).text().trim()
      const hasImgWithAlt = $(el).find('img[alt]').length > 0
      const ariaLabel = $(el).attr('aria-label')
      
      if (!text && !hasImgWithAlt && !ariaLabel) {
        results.push({
          id: `simple-empty-link-${i}`,
          url,
          message: 'Link has no accessible text',
          help: 'Links must have accessible text to convey their purpose',
          element: $.html(el),
          impact: 'serious',
          severity: 'serious',
          tags: ['wcag2a', 'wcag244'],
          createdAt: new Date().toISOString(),
        })
      }
    })

    // Check for heading structure
    const headings = $('h1, h2, h3, h4, h5, h6').toArray()
    let previousLevel = 0
    
    headings.forEach((el, i) => {
      const level = parseInt(el.tagName.substring(1))
      
      // First heading should be h1
      if (i === 0 && level !== 1) {
        results.push({
          id: `simple-heading-first-${i}`,
          url,
          message: 'First heading is not an h1',
          help: 'The first heading on a page should be an h1 to properly structure the document',
          element: $.html(el),
          impact: 'moderate',
          severity: 'moderate',
          tags: ['wcag2a', 'wcag131'],
          createdAt: new Date().toISOString(),
        })
      }
      
      // Skipped heading level
      if (level > previousLevel + 1) {
        results.push({
          id: `simple-heading-skip-${i}`,
          url,
          message: `Skipped heading level: h${previousLevel} to h${level}`,
          help: 'Heading levels should not be skipped to ensure proper document structure',
          element: $.html(el),
          impact: 'moderate',
          severity: 'moderate',
          tags: ['wcag2a', 'wcag131'],
        createdAt: new Date().toISOString(),
      })
    }

      previousLevel = level
    })
    
    // Check for form inputs without labels
    $('input, select, textarea').each((i, el) => {
      const id = $(el).attr('id')
      const ariaLabel = $(el).attr('aria-label')
      const ariaLabelledBy = $(el).attr('aria-labelledby')
      const type = $(el).attr('type')
      
      // Skip hidden inputs and buttons
      if (type === 'hidden' || type === 'button' || type === 'submit' || type === 'reset') {
        return
      }
      
      // Check if there's a label associated with this input
      const hasLabel = id ? $(`label[for="${id}"]`).length > 0 : false
      
      if (!hasLabel && !ariaLabel && !ariaLabelledBy) {
        results.push({
          id: `simple-missing-label-${i}`,
          url,
          message: 'Form control has no associated label',
          help: 'Form controls must have labels to be accessible to screen reader users',
          element: $.html(el),
          impact: 'serious',
          severity: 'serious',
          tags: ['wcag2a', 'wcag111'],
          createdAt: new Date().toISOString(),
        })
      }
    })

    // Generate summary
    const summary = {
      critical: results.filter((r) => r.severity === "critical").length,
      serious: results.filter((r) => r.severity === "serious").length,
      moderate: results.filter((r) => r.severity === "moderate").length,
      minor: results.filter((r) => r.severity === "minor").length,
      total: results.length,
      urlsAnalyzed: 1,
    }

    return {
      results,
      summary,
    }
  } catch (error) {
    console.error(`Error analyzing ${url}:`, error)
    throw new Error(`Failed to analyze ${url}: ${error instanceof Error ? error.message : String(error)}`)
  }
}
