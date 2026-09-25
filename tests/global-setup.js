// @ts-check
/**
 * Playwright global setup: creates the screenshots directory if it doesn't exist.
 */
const fs = require('fs');
const path = require('path');

module.exports = async function globalSetup() {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
};
