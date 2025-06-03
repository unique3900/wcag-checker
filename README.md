# WCAG Accessibility Checker

A lightweight web accessibility checker that analyzes websites for WCAG compliance using `puppeteer-core` and `@sparticuz/chromium`.

## Features

- 🔍 **Comprehensive WCAG Testing**: Analyze websites for accessibility compliance
- 📋 **Enhanced Clipboard**: Copy table data and individual issues to clipboard
- 📄 **Improved PDF Export**: Professional reports with proper image display
- 📊 **Excel Export**: Detailed spreadsheet reports with color-coding
- 🖼️ **Image Extraction**: Automatically displays images from accessibility issues
- 📸 **Screenshot Capture**: Visual inspection of problematic elements
- 🎯 **Issue Prioritization**: Filter by severity and compliance standards
- ⚡ **Lightweight**: Bundle size under 50MB with serverless compatibility

## Getting Started

### Prerequisites
- Node.js 18.x or later
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd wcag-checker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

## Using the Application

### 1. Add URLs for Analysis
- Navigate to the "Add URLs" tab
- Enter the website URLs you want to analyze
- Select compliance options (WCAG level, Section 508, etc.)
- Click "Analyze URLs"

### 2. View Results
- Switch to the "Results" tab
- Browse accessibility issues found on your websites
- Use filters to narrow down by severity or compliance standard
- Search for specific issues

### 3. Copy Data
- **Copy Individual Issues**: Use "Copy Prompt" button for specific issues
- **Copy Entire Table**: Click "Copy Table" button to copy all visible results
- **Paste Anywhere**: Use Ctrl+V to paste copied data into spreadsheets, documents, etc.

### 4. Export Reports
- **Excel Export**: Click "Export Report" → "Export as Excel" for detailed spreadsheet
- **PDF Export**: Click "Export Report" → "Export as PDF" for formatted report
- **Enhanced PDF**: 
  - Images are displayed at proper sizes
  - Issue numbering for easy reference
  - Color-coded severity levels
  - Professional formatting

### 5. View Images and Screenshots
- **Image Issues**: For accessibility issues related to images, the PDF will display the actual images
- **Element Screenshots**: Click "View Issue" for contrast and visual issues to capture screenshots
- **Image Extraction**: System automatically extracts images from HTML elements

## Key Enhancements

### 📋 Enhanced Clipboard Features
- **Copy Table Data**: Click "Copy Table" to copy all accessibility results to clipboard in tab-separated format
- **Element Copying**: Copy individual issue details and HTML elements
- **Cross-browser Support**: Works with modern clipboard API and fallback for older browsers

### 📄 Improved PDF Export
- **Full-size Images**: Images are displayed at proper sizes (300px max width, auto height)
- **Image Extraction**: Automatically extracts and displays images from HTML elements
- **Better Formatting**: Enhanced styling with proper spacing and typography
- **Image Fallback**: Shows image URLs when images can't be loaded
- **Visual Issue Detection**: Special handling for image-related accessibility issues

### 🔍 Enhanced Reporting
- **Issue Numbering**: Clear numbering of issues in PDF reports
- **Rich Metadata**: Includes detection dates, element paths, and help URLs
- **Color-coded Severity**: Visual severity indicators in both Excel and PDF
- **Screenshot Instructions**: Clear guidance on capturing element screenshots

## Compliance Standards

The tool supports the following compliance standards:
- WCAG 2.0/2.1 Level A
- WCAG 2.0/2.1 Level AA  
- WCAG 2.0/2.1 Level AAA
- Section 508
- Best Practices

## Implementation Details

- Uses `puppeteer-core` instead of full Puppeteer to reduce bundle size
- Implements `@sparticuz/chromium` for serverless environments
- Automatically detects the runtime environment to use the appropriate browser configuration
- Combines results from multiple analysis methods for comprehensive testing
- Enhanced PDF generation with proper image sizing and formatting

## Bundle Size Optimization

The implementation is optimized to keep the bundle size under 50MB by:
1. Using `puppeteer-core` instead of full Puppeteer
2. Using `@sparticuz/chromium` which is a lightweight Chromium build
3. Loading browser only when needed
4. Avoiding large dependencies

## PDF Export Features

### Image Display
- **Auto-extraction**: Automatically finds and displays images from HTML elements
- **Proper Sizing**: Images sized at 300px max width with maintained aspect ratio
- **Fallback Display**: Shows image URLs when images can't be loaded
- **Error Handling**: Graceful handling of broken or inaccessible images

### Report Quality
- **Professional Layout**: Clean, organized formatting with proper spacing
- **Color Coding**: Severity levels highlighted with consistent colors
- **Rich Metadata**: Comprehensive issue information including remediation guidance
- **Print Friendly**: Optimized for both screen viewing and printing

### Screenshots
- **Dynamic Capture**: Use "View Issue" button in application to capture element screenshots
- **Context Preservation**: Screenshots show the exact problematic element
- **Integration Guide**: PDF includes instructions for capturing screenshots

## Performance

- **Fast Export**: Optimized PDF generation with proper image handling
- **Memory Efficient**: Proper cleanup of resources and image objects
- **Cross-platform**: Works on Windows, macOS, and Linux
- **Browser Compatible**: Supports all modern browsers

## License

MIT
