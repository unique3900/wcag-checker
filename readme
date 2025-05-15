<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>WCAG Accessibility Checker</title>
</head>
<body>

  <h1>WCAG Accessibility Checker</h1>

  <p>A lightweight web accessibility checker that analyzes websites for WCAG compliance using <code>puppeteer-core</code> and <code>@sparticuz/chromium</code>.</p>

  <h2>Features</h2>
  <ul>
    <li>Lightweight implementation with bundle size under 50MB</li>
    <li>Serverless compatible with @sparticuz/chromium</li>
    <li>Comprehensive WCAG accessibility testing</li>
    <li>Screenshot capture of accessibility issues</li>
    <li>Export results to Excel</li>
    <li>Detailed reporting and issue prioritization</li>
  </ul>

  <h2>Getting Started</h2>

  <h3>Prerequisites</h3>
  <ul>
    <li>Node.js 18.x or later</li>
    <li>npm or yarn</li>
  </ul>

  <h3>Installation</h3>
  <ol>
    <li>Clone the repository
      <pre><code>git clone https://github.com/yourusername/wcag-checker.git
cd wcag-checker</code></pre>
    </li>
    <li>Install dependencies
      <pre><code>npm install
# or
yarn install</code></pre>
    </li>
    <li>Run the development server
      <pre><code>npm run dev
# or
yarn dev</code></pre>
    </li>
    <li>Open <a href="http://localhost:3000">http://localhost:3000</a> in your browser</li>
  </ol>

  <h2>Using in Production (Serverless)</h2>
  <p>This tool is optimized for serverless environments using <code>@sparticuz/chromium</code> and <code>puppeteer-core</code>. The implementation automatically detects the environment and uses the appropriate browser configuration.</p>
  <p>For AWS Lambda or other serverless deployments, no additional configuration is needed as the code automatically uses the lightweight Chromium build.</p>

  <h2>Compliance Standards</h2>
  <p>The tool supports the following compliance standards:</p>
  <ul>
    <li>WCAG 2.0/2.1 Level A</li>
    <li>WCAG 2.0/2.1 Level AA</li>
    <li>WCAG 2.0/2.1 Level AAA</li>
    <li>Section 508</li>
    <li>Best Practices</li>
  </ul>

  <h2>Implementation Details</h2>
  <ul>
    <li>Uses <code>puppeteer-core</code> instead of full Puppeteer to reduce bundle size</li>
    <li>Implements <code>@sparticuz/chromium</code> for serverless environments</li>
    <li>Automatically detects the runtime environment to use the appropriate browser configuration</li>
    <li>Combines results from multiple analysis methods for comprehensive testing</li>
  </ul>

  <h2>Bundle Size Optimization</h2>
  <p>The implementation is optimized to keep the bundle size under 50MB by:</p>
  <ol>
    <li>Using <code>puppeteer-core</code> instead of full Puppeteer</li>
    <li>Using <code>@sparticuz/chromium</code> which is a lightweight Chromium build</li>
    <li>Loading browser only when needed</li>
    <li>Avoiding large dependencies</li>
  </ol>

  <h2>License</h2>
  <p>MIT</p>

</body>
</html>
