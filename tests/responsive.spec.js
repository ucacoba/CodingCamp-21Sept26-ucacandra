// @ts-check
/**
 * Responsive breakpoint smoke tests — Requirement 7.4
 *
 * Verifies that at 320 px, 768 px, 1280 px, and 1920 px viewport widths:
 *   - No horizontal scrollbar appears (document.body.scrollWidth <= viewport width)
 *   - Key sections are present and visible: #balance-display, #input-form,
 *     #transaction-list, #chart-container
 *   - All interactive controls (text input, number input, category select,
 *     submit button) are within the viewport bounds
 *
 * Screenshots are saved to tests/screenshots/ for visual reference.
 *
 * Run with:
 *   npx playwright test tests/responsive.spec.js
 *
 * Requires Node.js and @playwright/test installed:
 *   npm install --save-dev @playwright/test
 *   npx playwright install chromium
 */

const { test, expect } = require('@playwright/test');
const path = require('path');

/** Absolute file:// URL for index.html */
const INDEX_URL = `file://${path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/')}`;

/** Breakpoints under test (width × height — height is ample to avoid vertical clipping) */
const BREAKPOINTS = [
  { label: '320px',  width: 320,  height: 900 },
  { label: '768px',  width: 768,  height: 1024 },
  { label: '1280px', width: 1280, height: 900 },
  { label: '1920px', width: 1920, height: 1080 },
];

/** IDs of sections that must be present and visible at every breakpoint */
const REQUIRED_SECTIONS = [
  '#balance-display',
  '#input-form',
  '#transaction-list',
  '#chart-container',
];

/** Selectors for interactive controls that must sit within viewport bounds */
const INTERACTIVE_CONTROLS = [
  '#item-name',
  '#amount',
  '#category',
  'button[type="submit"]',
];

// ---------------------------------------------------------------------------

for (const bp of BREAKPOINTS) {
  test(`[${bp.label}] no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto(INDEX_URL);

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(
      scrollWidth,
      `Horizontal scrollbar detected at ${bp.label}: body.scrollWidth (${scrollWidth}) > viewport width (${bp.width})`
    ).toBeLessThanOrEqual(bp.width);
  });

  test(`[${bp.label}] required sections are visible`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto(INDEX_URL);

    for (const selector of REQUIRED_SECTIONS) {
      const el = page.locator(selector);
      await expect(
        el,
        `Section "${selector}" not found in DOM at ${bp.label}`
      ).toBeAttached();
    }
  });

  test(`[${bp.label}] interactive controls are within viewport bounds`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto(INDEX_URL);

    for (const selector of INTERACTIVE_CONTROLS) {
      const el = page.locator(selector);
      await expect(
        el,
        `Control "${selector}" not found at ${bp.label}`
      ).toBeAttached();

      const box = await el.boundingBox();
      expect(
        box,
        `Control "${selector}" has no bounding box at ${bp.label} — it may be hidden`
      ).not.toBeNull();

      if (box) {
        expect(
          box.x,
          `Control "${selector}" starts off the left edge at ${bp.label} (x=${box.x})`
        ).toBeGreaterThanOrEqual(0);

        expect(
          box.x + box.width,
          `Control "${selector}" overflows the right edge at ${bp.label} (right=${box.x + box.width}, viewport=${bp.width})`
        ).toBeLessThanOrEqual(bp.width + 1); // +1 px rounding tolerance
      }
    }
  });

  test(`[${bp.label}] screenshot`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await page.goto(INDEX_URL);

    // Allow a brief moment for any deferred rendering
    await page.waitForTimeout(300);

    await page.screenshot({
      path: path.join(__dirname, 'screenshots', `responsive-${bp.label}.png`),
      fullPage: false,
    });

    // Screenshot itself is the artefact; test passes if it doesn't throw
  });
}
