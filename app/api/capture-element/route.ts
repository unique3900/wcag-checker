import { NextRequest, NextResponse } from "next/server"
import { chromium, Browser, Page } from "playwright-core"

export async function POST(request: NextRequest) {
  let browser: Browser | null = null
  
  try {
    const { url, elementPath, element } = await request.json()

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Launch browser
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    })
    
    const context = await browser.newContext()
    const page = await context.newPage()

    // Set viewport for consistent screenshots
    await page.setViewportSize({ width: 1280, height: 720 })

    // Navigate to the URL
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 })

    let screenshot: Buffer

    // Try to find the element using different strategies
    try {
      let elementHandle = null

      // Strategy 1: Use element path if available
      if (elementPath) {
        try {
          elementHandle = await page.$(elementPath)
        } catch (e) {
          console.warn('Failed to find element by path:', elementPath)
        }
      }

      // Strategy 2: Try to parse and locate the element from HTML
      if (!elementHandle && element) {
        try {
          // Extract attributes from the element HTML to create a selector
          const selector = createSelectorFromElement(element)
          if (selector) {
            elementHandle = await page.$(selector)
          }
        } catch (e) {
          console.warn('Failed to find element by generated selector')
        }
      }

      // Strategy 3: Take full page screenshot if element not found
      if (elementHandle) {
        // Take screenshot of the specific element
        screenshot = await elementHandle.screenshot({ 
          type: 'png',
          timeout: 10000 
        })
      } else {
        // Fallback: take full page screenshot
        screenshot = await page.screenshot({ 
          type: 'png', 
          fullPage: true,
          timeout: 10000 
        })
      }

    } catch (screenshotError) {
      console.error('Error taking screenshot:', screenshotError)
      // Final fallback: take a simple viewport screenshot
      screenshot = await page.screenshot({ 
        type: 'png',
        timeout: 10000 
      })
    }

    return new NextResponse(screenshot, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache',
      },
    })

  } catch (error) {
    console.error('Error capturing element screenshot:', error)
    return NextResponse.json(
      { error: "Failed to capture screenshot" },
      { status: 500 }
    )
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        console.warn('Error closing browser:', closeError)
      }
    }
  }
}

// Helper function to create a CSS selector from element HTML
function createSelectorFromElement(elementHtml: string): string | null {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(elementHtml, 'text/html')
    const element = doc.body.firstElementChild

    if (!element) return null

    const tagName = element.tagName.toLowerCase()
    let selector = tagName

    // Add ID if available
    const id = element.getAttribute('id')
    if (id) {
      return `#${id}`
    }

    // Add class if available
    const className = element.getAttribute('class')
    if (className) {
      const classes = className.split(' ').filter(c => c.trim())
      if (classes.length > 0) {
        selector += '.' + classes.join('.')
      }
    }

    // Add specific attributes for better targeting
    const src = element.getAttribute('src')
    if (src && tagName === 'img') {
      // For images, try to match by src (partial match for relative URLs)
      const srcPath = new URL(src, 'http://example.com').pathname
      selector = `img[src*="${srcPath.split('/').pop()}"]`
    }

    const href = element.getAttribute('href')
    if (href && tagName === 'a') {
      selector += `[href="${href}"]`
    }

    const type = element.getAttribute('type')
    if (type && (tagName === 'input' || tagName === 'button')) {
      selector += `[type="${type}"]`
    }

    // Add text content for better matching (first few words)
    const textContent = element.textContent?.trim()
    if (textContent && textContent.length > 0 && textContent.length < 50) {
      selector += `:has-text("${textContent.substring(0, 20)}")`
    }

    return selector

  } catch (error) {
    console.error('Error creating selector from element:', error)
    return null
  }
} 