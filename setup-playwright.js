const { execSync } = require('child_process');

console.log('Installing Playwright dependencies...');

try {
  // Install Playwright browsers
  execSync('pnpx playwright install chromium', { stdio: 'inherit' });
  console.log('Playwright dependencies installed successfully!');
} catch (error) {
  console.error('Failed to install Playwright dependencies:', error);
  process.exit(1);
} 