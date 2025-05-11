import { chromium, Browser, Page } from "playwright-core"
import type { ComplianceOptions, AccessibilityResult } from "./types"
import * as fs from 'fs/promises'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

// Declare the axe property on the Window interface
declare global {
  interface Window {
    axe: any;
  }
}

const execAsync = promisify(exec)

// Function to ensure browsers are installed
async function ensureBrowsersInstalled() {
  try {
    // Check if browser is already installed
    await chromium.launch({ headless: true })
    return true
  } catch (error) {
    console.log('Chromium not found, attempting to install browsers...')
    try {
      // Install browsers
      await execAsync('npx playwright install chromium')
      return true
    } catch (installError) {
      console.error('Failed to install browsers:', installError)
      return false
    }
  }
}

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
  screenshots?: string[]
}> {
  let browser: Browser | null = null
  let page: Page | null = null
  const screenshots: string[] = []

  try {
    // Ensure browsers are installed
    const browsersInstalled = await ensureBrowsersInstalled()
    if (!browsersInstalled) {
      throw new Error('Playwright browsers are not installed. Please run: npx playwright install')
    }

    // Launch browser with more options for stability
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    })
    
    const context = await browser.newContext()
    page = await context.newPage()

    // Set a reasonable timeout
    page.setDefaultTimeout(60000)

    // Navigate to the URL with more robust error handling
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 })
    } catch (navigationError) {
      console.warn(`Navigation issue for ${url}, continuing with analysis:`, navigationError)
      // Try to continue even if navigation had issues
    }

    // Inject axe-core
    try {
      await page.addScriptTag({
        url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js",
      })
    } catch (scriptError) {
      throw new Error(`Failed to inject axe-core script: ${scriptError}`)
    }

    // Configure axe based on compliance options
    const axeTags = getAxeTags(complianceOptions)

    // Run axe analysis
    const axeResults = await page.evaluate(
      ({ tags }) => {
        return new Promise((resolve) => {
          // @ts-ignore - axe is injected via script tag
          if (typeof window.axe === 'undefined') {
            resolve({ violations: [] })
            return
          }
          
          window.axe.run(
            document,
            {
              runOnly: {
                type: "tag",
                values: tags,
              },
            },
            (err: any, results: any) => {
              if (err) {
                console.error('Axe evaluation error:', err)
                resolve({ violations: [] })
                return
              }
              resolve(results)
            },
          )
        })
      },
      { tags: axeTags },
    )

    // Process results
    const processedResults = processAxeResults(axeResults, url)
    
    // Perform additional DOM-based analysis
    const domResults = await performDOMAnalysis(page, url)
    
    // Perform color contrast analysis
    const contrastResults = await performContrastAnalysis(page, url)
    
    // Perform sensory characteristics analysis
    const sensoryResults = await performSensoryAnalysis(page, url)
    
    // Capture screenshots of issues if enabled
    if (complianceOptions.captureScreenshots) {
      try {
        const screenshotDir = path.join(process.cwd(), 'screenshots')
        await fs.mkdir(screenshotDir, { recursive: true })
        
        // Take full page screenshot
        const fullPageScreenshot = path.join(screenshotDir, `full-page-${Date.now()}.png`)
        await page.screenshot({ path: fullPageScreenshot, fullPage: true })
        screenshots.push(fullPageScreenshot)
        
        // Take screenshots of elements with issues
        for (const result of [...processedResults, ...domResults, ...contrastResults, ...sensoryResults]) {
          try {
            if (result.element) {
              const elementHandle = await page.$(result.element);
              if (elementHandle) {
                const elementScreenshot = path.join(screenshotDir, `issue-${result.id}-${Date.now()}.png`);
                await elementHandle.screenshot({ path: elementScreenshot });
                screenshots.push(elementScreenshot);
                
                // Add screenshot path to the result
                result.screenshotPath = elementScreenshot;
              }
            }
          } catch (error) {
            console.warn(`Failed to capture screenshot for element ${result.id}:`, error);
          }
        }
      } catch (screenshotError) {
        console.warn('Failed to capture screenshots:', screenshotError)
      }
    }
    
    // Combine all results
    const allResults = [...processedResults, ...domResults, ...contrastResults, ...sensoryResults];

    // Generate summary
    const summary = {
      critical: allResults.filter((r) => r.severity === "critical").length,
      serious: allResults.filter((r) => r.severity === "serious").length,
      moderate: allResults.filter((r) => r.severity === "moderate").length,
      minor: allResults.filter((r) => r.severity === "minor").length,
      total: allResults.length,
      urlsAnalyzed: 1,
    }

    return {
      results: allResults,
      summary,
      screenshots: complianceOptions.captureScreenshots ? screenshots : undefined,
    }
  } catch (error) {
    console.error(`Error analyzing ${url}:`, error)
    throw new Error(`Failed to analyze ${url}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    // Close browser
    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        console.warn('Error closing browser:', closeError)
      }
    }
  }
}

function processAxeResults(results: any, url: string): AccessibilityResult[] {
  const violations = results.violations || []

  return violations.flatMap((violation: any) => {
    return violation.nodes.map((node: any, index: number) => {
      // Map axe impact to severity
      let severity
      switch (violation.impact) {
        case "critical":
          severity = "critical"
          break
        case "serious":
          severity = "serious"
          break
        case "moderate":
          severity = "moderate"
          break
        case "minor":
          severity = "minor"
          break
        default:
          severity = "moderate"
      }

      return {
        id: `${violation.id}-${index}`,
        url,
        message: violation.description,
        help: violation.help,
        element: node.html,
        impact: violation.impact,
        severity,
        tags: violation.tags,
        createdAt: new Date().toISOString(),
      }
    })
  })
}

function getAxeTags(complianceOptions: ComplianceOptions): string[] {
  const tags = []

  // Add WCAG tags based on level
  const level = complianceOptions.wcagLevel
  if (level === "a" || level === "aa" || level === "aaa") {
    tags.push("wcag2a")
  }
  if (level === "aa" || level === "aaa") {
    tags.push("wcag2aa")
  }
  if (level === "aaa") {
    tags.push("wcag2aaa")
  }

  // Add other compliance standards
  if (complianceOptions.section508) {
    tags.push("section508")
  }
  if (complianceOptions.bestPractices) {
    tags.push("best-practice")
  }
  if (complianceOptions.experimental) {
    tags.push("experimental")
  }

  return tags
}

/**
 * Performs DOM-based analysis to find accessibility issues
 */
async function performDOMAnalysis(page: Page, url: string): Promise<AccessibilityResult[]> {
  const results: AccessibilityResult[] = []
  
  // Check for missing alt text on images
  const missingAltResults = await page.evaluate(() => {
    const issues: any[] = []
    const images = document.querySelectorAll('img:not([alt]), img[alt=""]')
    
    images.forEach((img, index) => {
      issues.push({
        element: img.outerHTML,
        path: getElementPath(img),
      })
    })
    
    function getElementPath(element: Element): string {
      if (!element || !element.parentElement) return ''
      
      let path = ''
      let current = element
      
      while (current && current.parentElement) {
        let tag = current.tagName.toLowerCase()
        let siblings = Array.from(current.parentElement.children).filter(c => c.tagName === current.tagName)
        
        if (siblings.length > 1) {
          let index = siblings.indexOf(current) + 1
          tag += `:nth-of-type(${index})`
        }
        
        path = tag + (path ? ' > ' + path : '')
        current = current.parentElement
      }
      
      return path
    }
    
    return issues
  })
  
  missingAltResults.forEach((issue, index) => {
    results.push({
      id: `missing-alt-${index}`,
      url,
      message: 'Image is missing alt text',
      help: 'Images must have alternative text to convey their purpose to screen reader users',
      element: issue.element,
      elementPath: issue.path,
      impact: 'serious',
      severity: 'serious',
      tags: ['wcag2a', 'wcag111'],
      createdAt: new Date().toISOString(),
    })
  })
  
  // Check for empty links and buttons
  const emptyInteractiveResults = await page.evaluate(() => {
    const issues: any[] = []
    
    // Empty links
    document.querySelectorAll('a').forEach((link, index) => {
      if (!link.textContent?.trim() && !link.querySelector('img[alt]') && !link.getAttribute('aria-label')) {
        issues.push({
          element: link.outerHTML,
          path: getElementPath(link),
          type: 'link'
        })
      }
    })
    
    // Empty buttons
    document.querySelectorAll('button').forEach((button, index) => {
      if (!button.textContent?.trim() && !button.querySelector('img[alt]') && !button.getAttribute('aria-label')) {
        issues.push({
          element: button.outerHTML,
          path: getElementPath(button),
          type: 'button'
        })
      }
    })
    
    function getElementPath(element: Element): string {
      if (!element || !element.parentElement) return ''
      
      let path = ''
      let current = element
      
      while (current && current.parentElement) {
        let tag = current.tagName.toLowerCase()
        let siblings = Array.from(current.parentElement.children).filter(c => c.tagName === current.tagName)
        
        if (siblings.length > 1) {
          let index = siblings.indexOf(current) + 1
          tag += `:nth-of-type(${index})`
        }
        
        path = tag + (path ? ' > ' + path : '')
        current = current.parentElement
      }
      
      return path
    }
    
    return issues
  })
  
  emptyInteractiveResults.forEach((issue, index) => {
    results.push({
      id: `empty-${issue.type}-${index}`,
      url,
      message: `${issue.type.charAt(0).toUpperCase() + issue.type.slice(1)} has no accessible text`,
      help: `${issue.type.charAt(0).toUpperCase() + issue.type.slice(1)}s must have accessible text to convey their purpose`,
      element: issue.element,
      elementPath: issue.path,
      impact: 'serious',
      severity: 'serious',
      tags: ['wcag2a', 'wcag244'],
      createdAt: new Date().toISOString(),
    })
  })
  
  // Check for proper heading structure
  const headingResults = await page.evaluate(() => {
    const issues: any[] = []
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    
    // Check for skipped heading levels
    let previousLevel = 0
    
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.substring(1))
      
      // First heading should be h1
      if (index === 0 && level !== 1) {
        issues.push({
          element: heading.outerHTML,
          path: getElementPath(heading),
          message: 'First heading is not an h1'
        })
      }
      
      // Skipped heading level
      if (level > previousLevel + 1) {
        issues.push({
          element: heading.outerHTML,
          path: getElementPath(heading),
          message: `Skipped heading level: h${previousLevel} to h${level}`
        })
      }
      
      previousLevel = level
    })
    
    function getElementPath(element: Element): string {
      if (!element || !element.parentElement) return ''
      
      let path = ''
      let current = element
      
      while (current && current.parentElement) {
        let tag = current.tagName.toLowerCase()
        let siblings = Array.from(current.parentElement.children).filter(c => c.tagName === current.tagName)
        
        if (siblings.length > 1) {
          let index = siblings.indexOf(current) + 1
          tag += `:nth-of-type(${index})`
        }
        
        path = tag + (path ? ' > ' + path : '')
        current = current.parentElement
      }
      
      return path
    }
    
    return issues
  })
  
  headingResults.forEach((issue, index) => {
    results.push({
      id: `heading-structure-${index}`,
      url,
      message: issue.message,
      help: 'Heading levels should not be skipped to ensure proper document structure',
      element: issue.element,
      elementPath: issue.path,
      impact: 'moderate',
      severity: 'moderate',
      tags: ['wcag2a', 'wcag131'],
      createdAt: new Date().toISOString(),
    })
  })
  
  return results
}

/**
 * Performs color contrast analysis
 */
async function performContrastAnalysis(page: Page, url: string): Promise<AccessibilityResult[]> {
  const results: AccessibilityResult[] = []
  
  const contrastIssues = await page.evaluate(() => {
    const issues: any[] = []
    const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, button, label, li')
    
    textElements.forEach((element, index) => {
      const style = window.getComputedStyle(element)
      const textColor = style.color
      const backgroundColor = getBackgroundColor(element)
      
      if (textColor && backgroundColor) {
        const contrast = calculateContrast(parseColor(textColor), parseColor(backgroundColor))
        
        // WCAG AA requires 4.5:1 for normal text and 3:1 for large text
        const fontSize = parseFloat(style.fontSize)
        const isBold = parseInt(style.fontWeight) >= 700
        const isLargeText = (fontSize >= 18) || (fontSize >= 14 && isBold)
        
        const minContrast = isLargeText ? 3 : 4.5
        
        if (contrast < minContrast) {
          issues.push({
            element: element.outerHTML,
            path: getElementPath(element),
            textColor,
            backgroundColor,
            contrast,
            required: minContrast,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight
          })
        }
      }
    })
    
    function getBackgroundColor(element: Element): string | null {
      const style = window.getComputedStyle(element)
      
      // If the element has a background color with alpha > 0, use it
      if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') {
        return style.backgroundColor
      }
      
      // Otherwise, check parent elements
      if (element.parentElement) {
        return getBackgroundColor(element.parentElement)
      }
      
      // Default to white if no background color is found
      return 'rgb(255, 255, 255)'
    }
    
    function parseColor(color: string): number[] {
      // Handle rgb/rgba format
      if (color.startsWith('rgb')) {
        const values = color.match(/\d+/g)?.map(Number) || []
        return values.slice(0, 3) // Return only RGB values
      }
      
      // Handle hex format
      if (color.startsWith('#')) {
        if (color.length === 4) {
          // Convert #rgb to #rrggbb
          const r = parseInt(color[1] + color[1], 16)
          const g = parseInt(color[2] + color[2], 16)
          const b = parseInt(color[3] + color[3], 16)
          return [r, g, b]
        } else {
          const r = parseInt(color.slice(1, 3), 16)
          const g = parseInt(color.slice(3, 5), 16)
          const b = parseInt(color.slice(5, 7), 16)
          return [r, g, b]
        }
      }
      
      // Default to black if color format is not recognized
      return [0, 0, 0]
    }
    
    function calculateContrast(rgb1: number[], rgb2: number[]): number {
      // Calculate relative luminance
      const luminance1 = calculateLuminance(rgb1)
      const luminance2 = calculateLuminance(rgb2)
      
      // Calculate contrast ratio
      const lighter = Math.max(luminance1, luminance2)
      const darker = Math.min(luminance1, luminance2)
      
      return (lighter + 0.05) / (darker + 0.05)
    }
    
    function calculateLuminance(rgb: number[]): number {
      // Convert RGB to sRGB
      const sRGB = rgb.map(val => {
        val = val / 255
        return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
      })
      
      // Calculate luminance
      return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2]
    }
    
    function getElementPath(element: Element): string {
      if (!element || !element.parentElement) return ''
      
      let path = ''
      let current = element
      
      while (current && current.parentElement) {
        let tag = current.tagName.toLowerCase()
        let siblings = Array.from(current.parentElement.children).filter(c => c.tagName === current.tagName)
        
        if (siblings.length > 1) {
          let index = siblings.indexOf(current) + 1
          tag += `:nth-of-type(${index})`
        }
        
        path = tag + (path ? ' > ' + path : '')
        current = current.parentElement
      }
      
      return path
    }
    
    return issues
  })
  
  contrastIssues.forEach((issue, index) => {
    results.push({
      id: `contrast-${index}`,
      url,
      message: `Insufficient color contrast: ${issue.contrast.toFixed(2)}:1 (required: ${issue.required}:1)`,
      help: 'Text elements must have sufficient color contrast against their background',
      element: issue.element,
      elementPath: issue.path,
      impact: 'serious',
      severity: 'serious',
      tags: ['wcag2aa', 'wcag143'],
      details: {
        textColor: issue.textColor,
        backgroundColor: issue.backgroundColor,
        contrast: issue.contrast,
        required: issue.required,
        fontSize: issue.fontSize,
        fontWeight: issue.fontWeight
      },
      createdAt: new Date().toISOString(),
    })
  })
  
  return results
}

/**
 * Performs analysis for sensory characteristics and meaningful sequence
 */
async function performSensoryAnalysis(page: Page, url: string): Promise<AccessibilityResult[]> {
  const results: AccessibilityResult[] = []
  
  // Check for content that relies on sensory characteristics
  const sensoryIssues = await page.evaluate(() => {
    const issues: any[] = []
    const allText = document.body.innerText.toLowerCase()
    
    // Look for phrases that suggest reliance on sensory characteristics
    const sensoryPhrases = [
      'click the button on the right',
      'click the red button',
      'the blue link',
      'the green section',
      'the box on the left',
      'above',
      'below',
      'to the left',
      'to the right',
      'click the round button'
    ]
    
    // Find elements containing these phrases
    const textElements = document.querySelectorAll('p, li, div, span, a, button, h1, h2, h3, h4, h5, h6')
    
    textElements.forEach(element => {
      const text = element.textContent?.toLowerCase() || ''
      
      for (const phrase of sensoryPhrases) {
        if (text.includes(phrase)) {
          issues.push({
            element: element.outerHTML,
            path: getElementPath(element),
            text: element.textContent,
            phrase
          })
          break // Only report once per element
        }
      }
    })
    
    function getElementPath(element: Element): string {
      if (!element || !element.parentElement) return ''
      
      let path = ''
      let current = element
      
      while (current && current.parentElement) {
        let tag = current.tagName.toLowerCase()
        let siblings = Array.from(current.parentElement.children).filter(c => c.tagName === current.tagName)
        
        if (siblings.length > 1) {
          let index = siblings.indexOf(current) + 1
          tag += `:nth-of-type(${index})`
        }
        
        path = tag + (path ? ' > ' + path : '')
        current = current.parentElement
      }
      
      return path
    }
    
    return issues
  })
  
  sensoryIssues.forEach((issue, index) => {
    results.push({
      id: `sensory-${index}`,
      url,
      message: `Content may rely on sensory characteristics: "${issue.phrase}"`,
      help: 'Instructions should not rely solely on sensory characteristics like shape, size, color, or location',
      element: issue.element,
      elementPath: issue.path,
      impact: 'moderate',
      severity: 'moderate',
      tags: ['wcag2a', 'wcag125'],
      details: {
        text: issue.text,
        phrase: issue.phrase
      },
      createdAt: new Date().toISOString(),
    })
  })
  
  // Check for meaningful sequence issues (complex)
  // This is a simplified check that looks for potential CSS that might disrupt reading order
  const sequenceIssues = await page.evaluate(() => {
    const issues: any[] = []
    
    // Look for elements with absolute or fixed positioning that contain text
    const positionedElements = document.querySelectorAll('*')
    
    positionedElements.forEach(element => {
      const style = window.getComputedStyle(element)
      
      if ((style.position === 'absolute' || style.position === 'fixed') && 
          element.textContent?.trim() && 
          element.children.length > 0) {
        
        // Check if this element contains meaningful text content
        if (element.textContent.trim().length > 20) {
          issues.push({
            element: element.outerHTML,
            path: getElementPath(element),
            position: style.position,
            zIndex: style.zIndex
          })
        }
      }
    })
    
    function getElementPath(element: Element): string {
      if (!element || !element.parentElement) return ''
      
      let path = ''
      let current = element
      
      while (current && current.parentElement) {
        let tag = current.tagName.toLowerCase()
        let siblings = Array.from(current.parentElement.children).filter(c => c.tagName === current.tagName)
        
        if (siblings.length > 1) {
          let index = siblings.indexOf(current) + 1
          tag += `:nth-of-type(${index})`
        }
        
        path = tag + (path ? ' > ' + path : '')
        current = current.parentElement
      }
      
      return path
    }
    
    return issues
  })
  
  sequenceIssues.forEach((issue, index) => {
    results.push({
      id: `sequence-${index}`,
      url,
      message: `Positioned content may disrupt reading order (${issue.position} positioning)`,
      help: 'Content should maintain a meaningful sequence when linearized',
      element: issue.element,
      elementPath: issue.path,
      impact: 'moderate',
      severity: 'moderate',
      tags: ['wcag2a', 'wcag131'],
      details: {
        position: issue.position,
        zIndex: issue.zIndex
      },
      createdAt: new Date().toISOString(),
    })
  })
  
  return results
}
