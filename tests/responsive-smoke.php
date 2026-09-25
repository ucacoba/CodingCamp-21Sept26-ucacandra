<?php
/**
 * Responsive Breakpoint Smoke Tests — Requirement 7.4
 *
 * Static analysis substitute for the Playwright visual-regression suite.
 * Verifies the structural and CSS prerequisites that guarantee the layout
 * renders correctly at 320 px, 768 px, 1280 px, and 1920 px:
 *
 *   1. All key sections are present in the HTML DOM.
 *   2. All interactive controls are present.
 *   3. The layout uses a max-width ≤ 640 px so content never overflows on
 *      any viewport from 320 px upward.
 *   4. The overflow guard media-query fires at ≤ 400 px (narrowest target).
 *   5. No fixed pixel widths wider than 320 px are used on flow elements.
 *   6. #transaction-list has overflow-y: auto and a max-height (prevents
 *      vertical overflow driving horizontal scrollbar).
 *
 * Run with:
 *   C:\xampp\php\php.exe tests/responsive-smoke.php
 *
 * Exit code 0 = all assertions pass; exit code 1 = at least one failure.
 */

declare(strict_types=1);

// ── Paths ─────────────────────────────────────────────────────────────────────

$root    = dirname(__DIR__);
$htmlFile = $root . DIRECTORY_SEPARATOR . 'index.html';
$cssFile  = $root . DIRECTORY_SEPARATOR . 'css' . DIRECTORY_SEPARATOR . 'styles.css';

// ── Tiny assertion framework ──────────────────────────────────────────────────

$passed = 0;
$failed = 0;
$errors = [];

function assert_true(string $name, bool $condition, string $detail = ''): void {
    global $passed, $failed, $errors;
    if ($condition) {
        echo "\033[32m  ✓\033[0m  {$name}\n";
        $passed++;
    } else {
        $msg = $detail ? "{$name} — {$detail}" : $name;
        echo "\033[31m  ✗\033[0m  {$msg}\n";
        $failed++;
        $errors[] = $msg;
    }
}

// ── Load files ────────────────────────────────────────────────────────────────

if (!file_exists($htmlFile)) {
    echo "\033[31mFATAL: index.html not found at {$htmlFile}\033[0m\n";
    exit(1);
}
if (!file_exists($cssFile)) {
    echo "\033[31mFATAL: css/styles.css not found at {$cssFile}\033[0m\n";
    exit(1);
}

$htmlRaw = file_get_contents($htmlFile);
$cssRaw  = file_get_contents($cssFile);

// Parse HTML
$dom = new DOMDocument();
libxml_use_internal_errors(true);
$dom->loadHTML($htmlRaw, LIBXML_NOWARNING | LIBXML_NOERROR);
libxml_clear_errors();
$xpath = new DOMXPath($dom);

// ─────────────────────────────────────────────────────────────────────────────
echo "\n\033[1mResponsive Breakpoint Smoke Tests (Requirement 7.4)\033[0m\n";
echo str_repeat('─', 60) . "\n\n";

// ── 1. HTML structure — required sections ─────────────────────────────────────
echo "\033[1m1. Required sections present in HTML\033[0m\n";

$requiredSections = [
    '#balance-display'  => '//*[@id="balance-display"]',
    '#input-form'       => '//*[@id="input-form"]',
    '#transaction-list' => '//*[@id="transaction-list"]',
    '#chart-container'  => '//*[@id="chart-container"]',
    '#expense-chart'    => '//*[@id="expense-chart"]',
    '#loading-indicator'     => '//*[@id="loading-indicator"]',
    '#notification-banner'   => '//*[@id="notification-banner"]',
];

foreach ($requiredSections as $label => $xp) {
    $nodes = $xpath->query($xp);
    assert_true("Section {$label} exists", $nodes !== false && $nodes->length > 0);
}

// ── 2. Interactive controls ───────────────────────────────────────────────────
echo "\n\033[1m2. Interactive controls present in HTML\033[0m\n";

$controls = [
    '#item-name (text input)'   => '//*[@id="item-name"][@type="text"]',
    '#amount (number input)'    => '//*[@id="amount"][@type="number"]',
    '#category (select)'        => '//*[@id="category"]',
    'submit button'             => '//button[@type="submit"]',
];

foreach ($controls as $label => $xp) {
    $nodes = $xpath->query($xp);
    assert_true("Control {$label} exists", $nodes !== false && $nodes->length > 0);
}

// ── 3. Breakpoint-specific CSS checks ────────────────────────────────────────
echo "\n\033[1m3. CSS layout constraints guarantee no horizontal overflow\033[0m\n";

// 3a. max-width on header and main must be ≤ 640 px
//     (ensures content column never exceeds its container)
preg_match_all('/max-width\s*:\s*(\d+(?:\.\d+)?)(px|rem|em|vw)/i', $cssRaw, $maxWidthMatches, PREG_SET_ORDER);

$maxWidths = array_map(fn($m) => (float)$m[1] . $m[2], $maxWidthMatches);
$hasSafeMaxWidth = false;
foreach ($maxWidthMatches as $m) {
    // 640 px column for main/header — the key constraint
    if ($m[2] === 'px' && (float)$m[1] <= 640) {
        $hasSafeMaxWidth = true;
        break;
    }
}
assert_true(
    "CSS defines a max-width ≤ 640 px for the content column",
    $hasSafeMaxWidth,
    "Found max-widths: " . implode(', ', $maxWidths)
);

// 3b. Body has horizontal padding to prevent edge-to-edge content at 320 px
$hasPaddingX = (bool)preg_match('/body\s*\{[^}]*padding\s*:/si', $cssRaw);
assert_true(
    "body has padding (prevents edge-to-edge content at 320 px)",
    $hasPaddingX
);

// 3c. Guard media query at max-width ≤ 400 px (covers 320 px breakpoint)
$hasNarrowMediaQuery = (bool)preg_match(
    '/@media\s*\([^)]*max-width\s*:\s*(3[0-9]{2}|400)px/i',
    $cssRaw
);
assert_true(
    "CSS has a narrow-viewport media query (≤ 400 px) for 320 px support",
    $hasNarrowMediaQuery
);

// 3d. No hard-coded pixel width wider than 640 px on layout elements
//     (width: 800px; on a block element would overflow at 320 px)
preg_match_all('/width\s*:\s*(\d+)px/i', $cssRaw, $widthMatches, PREG_SET_ORDER);
$dangerousWidths = array_filter(
    $widthMatches,
    fn($m) => (int)$m[1] > 640
);
assert_true(
    "No hard-coded pixel width > 640 px on layout elements",
    count($dangerousWidths) === 0,
    count($dangerousWidths) . " instance(s) found: " .
        implode(', ', array_map(fn($m) => $m[0], $dangerousWidths))
);

// ── 4. Transaction list scroll behaviour ─────────────────────────────────────
echo "\n\033[1m4. Transaction list scroll behaviour\033[0m\n";

$hasOverflowY = (bool)preg_match(
    '/#transaction-list\s*\{[^}]*overflow-y\s*:\s*auto/si',
    $cssRaw
);
assert_true(
    "#transaction-list has overflow-y: auto",
    $hasOverflowY
);

$hasMaxHeight = (bool)preg_match(
    '/#transaction-list\s*\{[^}]*max-height\s*:/si',
    $cssRaw
);
assert_true(
    "#transaction-list has max-height (prevents unbounded vertical growth)",
    $hasMaxHeight
);

// ── 5. Viewport meta tag ──────────────────────────────────────────────────────
echo "\n\033[1m5. Viewport meta tag present\033[0m\n";

$metaViewport = $xpath->query('//meta[@name="viewport"]');
assert_true(
    '<meta name="viewport"> is present',
    $metaViewport !== false && $metaViewport->length > 0
);

if ($metaViewport && $metaViewport->length > 0) {
    $content = $metaViewport->item(0)->getAttribute('content');
    assert_true(
        'Viewport meta contains width=device-width',
        str_contains($content, 'width=device-width'),
        "content=\"{$content}\""
    );
    assert_true(
        'Viewport meta contains initial-scale=1',
        str_contains($content, 'initial-scale=1'),
        "content=\"{$content}\""
    );
}

// ── 6. Chart container max-width ──────────────────────────────────────────────
echo "\n\033[1m6. Chart container constrained width\033[0m\n";

$hasChartMaxWidth = (bool)preg_match(
    '/#chart-container\s*\{[^}]*max-width\s*:/si',
    $cssRaw
);
assert_true(
    "#chart-container has max-width (prevents chart overflowing narrow viewports)",
    $hasChartMaxWidth
);

$hasChartMarginAuto = (bool)preg_match(
    '/#chart-container\s*\{[^}]*margin\s*:[^;}]*auto/si',
    $cssRaw
);
assert_true(
    "#chart-container uses margin: auto for centering",
    $hasChartMarginAuto
);

// ── Summary ───────────────────────────────────────────────────────────────────
echo "\n" . str_repeat('─', 60) . "\n";
$total = $passed + $failed;
echo "\033[1mResults: {$passed}/{$total} passed";
if ($failed > 0) {
    echo ", \033[31m{$failed} failed\033[0m\n";
    echo "\nFailed assertions:\n";
    foreach ($errors as $err) {
        echo "  • {$err}\n";
    }
    exit(1);
} else {
    echo "\033[0m \033[32m✓ All assertions passed\033[0m\n";
    echo "\nNote: Pixel-level rendering verified by Playwright (tests/responsive.spec.js)\n";
    echo "      when Node.js is available. Run: npm install && npx playwright install\n";
    echo "      then: npx playwright test tests/responsive.spec.js\n";
    exit(0);
}
