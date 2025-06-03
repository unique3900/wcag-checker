import { JSDOM } from "jsdom"
import type { ComplianceOptions, AccessibilityResult } from "./types"

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
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`)
    }

    const html = await response.text()

    // Parse the HTML with JSDOM
    const dom = new JSDOM(html)
    const document = dom.window.document

    // Collect accessibility issues
    const issues: AccessibilityResult[] = []

    // Check for basic accessibility issues
    issues.push(...checkImagesWithoutAlt(document, url))
    issues.push(...checkHeadingStructure(document, url))
    issues.push(...checkFormLabels(document, url))
    issues.push(...checkLinkText(document, url))

    // Add additional checks based on compliance options
    if (complianceOptions.wcagLevel === "aa" || complianceOptions.wcagLevel === "aaa") {
      issues.push(...checkColorContrast(document, url))
      issues.push(...checkARIAAttributes(document, url))
    }

    if (complianceOptions.wcagLevel === "aaa") {
      issues.push(...checkTextSpacing(document, url))
    }

    if (complianceOptions.section508) {
      issues.push(...checkKeyboardAccessibility(document, url))
    }

    // Check for basic HTML validation issues
    issues.push(...checkBasicHtmlIssues(document, url))

    // Generate summary
    const summary = {
      critical: issues.filter((r) => r.severity === "critical").length,
      serious: issues.filter((r) => r.severity === "serious").length,
      moderate: issues.filter((r) => r.severity === "moderate").length,
      minor: issues.filter((r) => r.severity === "minor").length,
      total: issues.length,
      urlsAnalyzed: 1,
    }

    return {
      results: issues,
      summary,
    }
  } catch (error) {
    console.error(`Error analyzing ${url}:`, error)
    throw new Error(`Failed to analyze ${url}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Enhanced helper function to generate CSS selector paths
function generateElementPath(element: Element): string {
  const path: string[] = []
  let current: Element | null = element

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let selector = current.tagName.toLowerCase()

    // Add ID if present (most specific)
    if (current.id) {
      selector += `#${current.id}`
      path.unshift(selector)
      break // ID is unique, we can stop here
    }

    // Add classes if present
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.split(/\s+/).filter(cls => cls.length > 0)
      if (classes.length > 0) {
        selector += '.' + classes.join('.')
      }
    }

    // Add nth-child if there are siblings with the same tag
    if (current.parentElement) {
      const siblings = Array.from(current.parentElement.children).filter(
        sibling => sibling.tagName === current!.tagName
      )
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1
        selector += `:nth-child(${index})`
      }
    }

    path.unshift(selector)
    current = current.parentElement
  }

  return path.join(' > ')
}

// Helper functions for accessibility checks

function checkImagesWithoutAlt(document: Document, url: string): AccessibilityResult[] {
  const issues: AccessibilityResult[] = []
  const images = document.querySelectorAll("img")

  images.forEach((img, index) => {
    if (!img.hasAttribute("alt")) {
      issues.push({
        id: `img-no-alt-${index}`,
        url,
        message: "Image missing alt attribute",
        help: "Images must have alternate text",
        element: img.outerHTML,
        elementPath: generateElementPath(img),
        impact: "serious",
        severity: "serious",
        tags: ["wcag2a", "wcag2aa", "wcag2aaa", "section508"],
        createdAt: new Date().toISOString(),
      })
    } else if (img.getAttribute("alt") === "") {
      // Empty alt is only valid for decorative images
      const role = img.getAttribute("role")
      if (role !== "presentation" && role !== "none") {
        issues.push({
          id: `img-empty-alt-${index}`,
          url,
          message: "Image has empty alt attribute but is not marked as decorative",
          help: "Non-decorative images should have meaningful alt text",
          element: img.outerHTML,
          elementPath: generateElementPath(img),
          impact: "moderate",
          severity: "moderate",
          tags: ["wcag2a", "wcag2aa", "wcag2aaa", "best-practice"],
          createdAt: new Date().toISOString(),
        })
      }
    }
  })

  return issues
}

function checkHeadingStructure(document: Document, url: string): AccessibilityResult[] {
  const issues: AccessibilityResult[] = []
  const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6")
  let previousLevel = 0

  headings.forEach((heading, index) => {
    const level = Number.parseInt(heading.tagName.substring(1))

    // Check for skipped heading levels
    if (level - previousLevel > 1 && previousLevel !== 0) {
      issues.push({
        id: `heading-skip-${index}`,
        url,
        message: `Heading level skipped from h${previousLevel} to h${level}`,
        help: "Heading levels should only increase by one",
        element: heading.outerHTML,
        elementPath: generateElementPath(heading),
        impact: "moderate",
        severity: "moderate",
        tags: ["best-practice"],
        createdAt: new Date().toISOString(),
      })
    }

    previousLevel = level
  })

  // Check if there's an h1
  if (!document.querySelector("h1")) {
    issues.push({
      id: "missing-h1",
      url,
      message: "Document does not have a main heading (h1)",
      help: "Pages should contain a main heading to describe their content",
      element: "<body>...</body>",
      elementPath: "body",
      impact: "moderate",
      severity: "moderate",
      tags: ["best-practice"],
      createdAt: new Date().toISOString(),
    })
  }

  return issues
}

function checkFormLabels(document: Document, url: string): AccessibilityResult[] {
  const issues: AccessibilityResult[] = []
  const formControls = document.querySelectorAll("input, select, textarea")

  formControls.forEach((control, index) => {
    const id = control.getAttribute("id")
    const type = control.getAttribute("type")

    // Skip hidden inputs and buttons
    if (type === "hidden" || type === "button" || type === "submit" || type === "reset") {
      return
    }

    // Check if control has an id and a corresponding label
    if (!id || !document.querySelector(`label[for="${id}"]`)) {
      // Check if control is inside a label
      if (!control.closest("label")) {
        issues.push({
          id: `form-control-no-label-${index}`,
          url,
          message: "Form control does not have a label",
          help: "Form controls must have associated labels",
          element: control.outerHTML,
          elementPath: generateElementPath(control),
          impact: "critical",
          severity: "critical",
          tags: ["wcag2a", "wcag2aa", "wcag2aaa", "section508"],
          createdAt: new Date().toISOString(),
        })
      }
    }
  })

  return issues
}

function checkLinkText(document: Document, url: string): AccessibilityResult[] {
  const issues: AccessibilityResult[] = []
  const links = document.querySelectorAll("a")

  links.forEach((link, index) => {
    const text = link.textContent?.trim() || ""
    const ariaLabel = link.getAttribute("aria-label")
    const ariaLabelledBy = link.getAttribute("aria-labelledby")
    const title = link.getAttribute("title")

    // Check for empty links
    if (!text && !ariaLabel && !ariaLabelledBy && !title) {
      issues.push({
        id: `empty-link-${index}`,
        url,
        message: "Link has no text",
        help: "Links must have discernible text",
        element: link.outerHTML,
        elementPath: generateElementPath(link),
        impact: "serious",
        severity: "serious",
        tags: ["wcag2a", "wcag2aa", "wcag2aaa", "section508"],
        createdAt: new Date().toISOString(),
      })
    }

    // Check for generic link text
    if (["click here", "here", "more", "read more"].includes(text.toLowerCase()) && !ariaLabel && !ariaLabelledBy) {
      issues.push({
        id: `generic-link-${index}`,
        url,
        message: "Link has generic text",
        help: "Link text should be descriptive",
        element: link.outerHTML,
        elementPath: generateElementPath(link),
        impact: "moderate",
        severity: "moderate",
        tags: ["best-practice"],
        createdAt: new Date().toISOString(),
      })
    }
  })

  return issues
}

function checkColorContrast(document: Document, url: string): AccessibilityResult[] {
  // Note: Proper color contrast checking requires browser rendering
  // This is a simplified check that looks for potential inline style issues
  const issues: AccessibilityResult[] = []
  const elements = document.querySelectorAll('[style*="color"], [style*="background"]')

  elements.forEach((element, index) => {
    const style = element.getAttribute("style") || ""

    // This is a very simplified check - real contrast checking requires computing styles
    if (
      (style.includes("color") && style.includes("background")) ||
      (element.textContent?.trim() && (style.includes("color: #") || style.includes("background: #")))
    ) {
      issues.push({
        id: `potential-contrast-issue-${index}`,
        url,
        message: "Potential color contrast issue with inline styles",
        help: "Text elements must have sufficient color contrast",
        element: element.outerHTML,
        elementPath: generateElementPath(element),
        impact: "moderate",
        severity: "moderate",
        tags: ["wcag2aa", "wcag2aaa"],
        createdAt: new Date().toISOString(),
      })
    }
  })

  return issues
}

function checkARIAAttributes(document: Document, url: string): AccessibilityResult[] {
  const issues: AccessibilityResult[] = []
  const elementsWithRole = document.querySelectorAll("[role]")

  // Valid ARIA roles
  const validRoles = [
    "alert",
    "alertdialog",
    "application",
    "article",
    "banner",
    "button",
    "cell",
    "checkbox",
    "columnheader",
    "combobox",
    "complementary",
    "contentinfo",
    "definition",
    "dialog",
    "directory",
    "document",
    "feed",
    "figure",
    "form",
    "grid",
    "gridcell",
    "group",
    "heading",
    "img",
    "link",
    "list",
    "listbox",
    "listitem",
    "log",
    "main",
    "marquee",
    "math",
    "menu",
    "menubar",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "navigation",
    "none",
    "note",
    "option",
    "presentation",
    "progressbar",
    "radio",
    "radiogroup",
    "region",
    "row",
    "rowgroup",
    "rowheader",
    "scrollbar",
    "search",
    "searchbox",
    "separator",
    "slider",
    "spinbutton",
    "status",
    "switch",
    "tab",
    "table",
    "tablist",
    "tabpanel",
    "term",
    "textbox",
    "timer",
    "toolbar",
    "tooltip",
    "tree",
    "treegrid",
    "treeitem",
  ]

  elementsWithRole.forEach((element, index) => {
    const role = element.getAttribute("role")

    if (role && !validRoles.includes(role)) {
      issues.push({
        id: `invalid-role-${index}`,
        url,
        message: `Invalid ARIA role: ${role}`,
        help: "ARIA roles must be valid",
        element: element.outerHTML,
        elementPath: generateElementPath(element),
        impact: "moderate",
        severity: "moderate",
        tags: ["wcag2aa", "wcag2aaa"],
        createdAt: new Date().toISOString(),
      })
    }
  })

  return issues
}

function checkTextSpacing(document: Document, url: string): AccessibilityResult[] {
  const issues: AccessibilityResult[] = []
  const elementsWithLineHeight = document.querySelectorAll('[style*="line-height"]')

  elementsWithLineHeight.forEach((element, index) => {
    const style = element.getAttribute("style") || ""

    // Check for potentially restrictive line height
    if (style.includes("line-height: 1") || style.includes("line-height:1") || style.includes("line-height: 0")) {
      issues.push({
        id: `restrictive-line-height-${index}`,
        url,
        message: "Restrictive line height may cause readability issues",
        help: "Text spacing should be adjustable without loss of content",
        element: element.outerHTML,
        elementPath: generateElementPath(element),
        impact: "moderate",
        severity: "moderate",
        tags: ["wcag2aaa"],
        createdAt: new Date().toISOString(),
      })
    }
  })

  return issues
}

function checkKeyboardAccessibility(document: Document, url: string): AccessibilityResult[] {
  const issues: AccessibilityResult[] = []

  // Check for elements with click handlers but no keyboard equivalent
  const elementsWithOnClick = document.querySelectorAll("[onclick]")

  elementsWithOnClick.forEach((element, index) => {
    const tagName = element.tagName.toLowerCase()
    const role = element.getAttribute("role")
    const tabIndex = element.getAttribute("tabindex")

    // If it's not a naturally interactive element and doesn't have keyboard access
    if (!["a", "button", "input", "select", "textarea"].includes(tagName) && role !== "button" && !tabIndex) {
      issues.push({
        id: `keyboard-inaccessible-${index}`,
        url,
        message: "Element has click handler but may not be keyboard accessible",
        help: "Interactive elements must be accessible via keyboard",
        element: element.outerHTML,
        elementPath: generateElementPath(element),
        impact: "critical",
        severity: "critical",
        tags: ["section508", "wcag2a", "wcag2aa", "wcag2aaa"],
        createdAt: new Date().toISOString(),
      })
    }
  })

  // Check for positive tabindex which disrupts natural tab order
  const elementsWithPositiveTabIndex = document.querySelectorAll("[tabindex]")

  elementsWithPositiveTabIndex.forEach((element, index) => {
    const tabIndex = Number.parseInt(element.getAttribute("tabindex") || "0")

    if (tabIndex > 0) {
      issues.push({
        id: `positive-tabindex-${index}`,
        url,
        message: `Element has positive tabindex (${tabIndex}) which disrupts natural tab order`,
        help: "Avoid using positive tabindex values",
        element: element.outerHTML,
        elementPath: generateElementPath(element),
        impact: "moderate",
        severity: "moderate",
        tags: ["best-practice", "section508"],
        createdAt: new Date().toISOString(),
      })
    }
  })

  return issues
}

function checkBasicHtmlIssues(document: Document, url: string): AccessibilityResult[] {
  const issues: AccessibilityResult[] = []

  // Check for missing doctype
  const doctype = document.doctype
  if (!doctype) {
    issues.push({
      id: "missing-doctype",
      url,
      message: "Missing DOCTYPE declaration",
      help: "Include a proper DOCTYPE declaration for better accessibility",
      element: "<html>...</html>",
      elementPath: "html",
      impact: "minor",
      severity: "minor",
      tags: ["best-practice"],
      createdAt: new Date().toISOString(),
    })
  }

  // Check for missing language attribute
  const html = document.documentElement
  if (!html.hasAttribute("lang")) {
    issues.push({
      id: "missing-lang",
      url,
      message: "Missing language attribute on HTML element",
      help: "Specify the document language using the lang attribute",
      element: html.outerHTML.substring(0, 100) + "...",
      elementPath: "html",
      impact: "serious",
      severity: "serious",
      tags: ["wcag2a", "wcag2aa", "wcag2aaa"],
      createdAt: new Date().toISOString(),
    })
  }

  // Check for missing title
  if (!document.title) {
    issues.push({
      id: "missing-title",
      url,
      message: "Missing document title",
      help: "Provide a descriptive title for the document",
      element: "<head>...</head>",
      elementPath: "head",
      impact: "serious",
      severity: "serious",
      tags: ["wcag2a", "wcag2aa", "wcag2aaa"],
      createdAt: new Date().toISOString(),
    })
  }

  // Check for duplicate IDs
  const idMap = new Map<string, Element[]>()
  const elementsWithId = document.querySelectorAll("[id]")

  elementsWithId.forEach((element) => {
    const id = element.getAttribute("id") || ""
    if (!idMap.has(id)) {
      idMap.set(id, [])
    }
    idMap.get(id)!.push(element)
  })

  idMap.forEach((elements, id) => {
    if (elements.length > 1) {
      elements.forEach((element, index) => {
        issues.push({
          id: `duplicate-id-${id}-${index}`,
          url,
          message: `Duplicate ID: "${id}" appears ${elements.length} times`,
          help: "IDs must be unique within the document",
          element: element.outerHTML,
          elementPath: generateElementPath(element),
          impact: "serious",
          severity: "serious",
          tags: ["wcag2a", "wcag2aa", "wcag2aaa"],
          createdAt: new Date().toISOString(),
        })
      })
    }
  })

  return issues
}
