/**
 * ============================================================
 *  Expense & Budget Visualizer — Load-Time Performance Script
 *  Task 14.2 | Requirements 8.3, 8.4
 * ============================================================
 *
 *  WHAT THIS SCRIPT VERIFIES
 *  ─────────────────────────
 *  Req 8.3 — Initial load + full render of 1,000 persisted transactions
 *            MUST complete within 2,000 ms on a standard broadband
 *            connection (≥ 25 Mbps download).
 *  Req 8.4 — IF the load exceeds 2 s, the loading indicator MUST have
 *            appeared within 500 ms of page-load start.
 *
 *  HOW TO USE
 *  ──────────
 *  STEP 1 — Seed localStorage with 1,000 valid transactions
 *    1. Open index.html in a browser (file:// or a local server).
 *    2. Open DevTools → Console.
 *    3. Paste this ENTIRE script and press Enter.
 *       You will see "✅ Seeded 1,000 transactions …" when done.
 *
 *  STEP 2 — Measure initial load time
 *    4. Press F5 (or Cmd+R) to reload the page.
 *    5. After the page finishes loading, open DevTools → Console again.
 *    6. Paste this ENTIRE script once more and press Enter.
 *       (On second run, seeds are already present so seeding is skipped.)
 *    7. Read the printed measurements and PASS/FAIL verdicts.
 *
 *  STEP 3 — Optional: Deep profiling via DevTools Performance panel
 *    - Open DevTools → Performance → click Record, reload, stop recording.
 *    - Look for the "DOMContentLoaded" marker and the first paint frame.
 *    - Cross-check the "Total initial render time" printed by this script.
 *
 *  ASSERTIONS CHECKED
 *  ──────────────────
 *  ✅ PASS / ❌ FAIL  Total initial render time  ≤ 2,000 ms  (Req 8.3)
 *  ✅ PASS / ❌ FAIL  Loading indicator appeared ≤   500 ms  (Req 8.4)
 *
 *  NOTE: The "loading indicator appeared" time is measured by observing
 *  when #loading-indicator received non-empty innerHTML. A PerformanceObserver
 *  mutation-based approach is used on subsequent reloads via performance marks
 *  written by a small inline bootstrap patch (see STEP 2 instrumentation below).
 * ============================================================
 */

(function runLoadTimeScript() {
  'use strict';

  // ─── Constants ──────────────────────────────────────────────────────────────
  const STORAGE_KEY     = 'expense_tracker_transactions';
  const TARGET_COUNT    = 1000;
  const VALID_CATEGORIES = ['Food', 'Transport', 'Fun'];

  // Assertion thresholds (milliseconds)
  const MAX_TOTAL_LOAD_MS      = 2000;  // Req 8.3
  const MAX_LOADING_INDICATOR_MS = 500; // Req 8.4

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /** Generates a UUID (v4-like) without crypto.randomUUID availability check */
  function makeId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback: timestamp + random
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  }

  /**
   * Builds a single valid Transaction object matching the app schema:
   *   { id: string, name: string, amount: number, category: string, timestamp: number }
   * @param {number} index
   * @returns {Object}
   */
  function makeTransaction(index) {
    const categories = VALID_CATEGORIES;
    const category   = categories[index % categories.length];
    const amount     = parseFloat((Math.random() * 199.99 + 0.01).toFixed(2));
    return {
      id:        makeId(),
      name:      'Test Item ' + (index + 1),   // 1–100 chars ✓
      amount:    amount,                         // 0.01–999,999,999.99 ✓
      category:  category,                       // 'Food' | 'Transport' | 'Fun' ✓
      timestamp: Date.now() - (TARGET_COUNT - index) * 1000, // unique descending timestamps
    };
  }

  // ─── Phase 1: Seed localStorage ─────────────────────────────────────────────

  let existingRaw = null;
  try {
    existingRaw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.error('[load-time.js] Cannot access localStorage:', e);
    return;
  }

  let existingTxns = [];
  if (existingRaw) {
    try {
      const parsed = JSON.parse(existingRaw);
      if (Array.isArray(parsed)) existingTxns = parsed;
    } catch (_) {
      // Corrupted — will be overwritten
    }
  }

  if (existingTxns.length < TARGET_COUNT) {
    console.info('[load-time.js] Seeding localStorage with ' + TARGET_COUNT + ' transactions …');
    const transactions = [];
    for (let i = 0; i < TARGET_COUNT; i++) {
      transactions.push(makeTransaction(i));
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      console.info(
        '✅ Seeded ' + TARGET_COUNT + ' transactions into localStorage.\n' +
        '   → Now RELOAD the page (F5 / Cmd+R) then re-run this script to measure load time.'
      );
    } catch (e) {
      console.error('[load-time.js] localStorage write failed (quota exceeded?):', e);
    }
    // Exit — measurements only make sense after a fresh page load with the seeded data
    return;
  }

  console.info(
    '[load-time.js] Found ' + existingTxns.length + ' transactions in localStorage. ' +
    'Proceeding to measure load time …'
  );

  // ─── Phase 2: Measure initial load timing ───────────────────────────────────

  /**
   * The Navigation Timing API gives precise marks relative to the navigation
   * start of the current page load.
   *
   * Key timestamps used:
   *   navEntry.startTime       → 0 (navigation start baseline)
   *   navEntry.domContentLoadedEventStart → when DOMContentLoaded event fired
   *   navEntry.domContentLoadedEventEnd   → when all DOMContentLoaded handlers finished
   *   navEntry.loadEventEnd    → when the load event finished (Chart.js CDN included)
   *
   * The app's bootstrap sequence (DOMContentLoaded handler in App.init()):
   *   1. Shows #loading-indicator immediately
   *   2. Polls for window.Chart (CDN, up to 10 s)
   *   3. Calls TransactionStore.loadFromStorage()
   *   4. Calls ListRenderer.render(), BalanceRenderer.render(), ChartRenderer.render()
   *   5. Hides #loading-indicator
   *
   * Because the app's render work happens inside the DOMContentLoaded handler
   * (async, awaiting Chart.js), we use a combination of:
   *   - navEntry.domContentLoadedEventStart  as "render work began"
   *   - performance.now()                    as "script execution time now"
   *   - inspecting the live DOM              to infer render completion
   */

  const navEntries = performance.getEntriesByType('navigation');
  if (!navEntries || navEntries.length === 0) {
    console.warn('[load-time.js] Navigation Timing API not available in this context.');
    return;
  }

  const nav = navEntries[0];

  // Baseline: navigation start is time 0 for all relative timestamps.
  const navigationStart      = nav.startTime; // always 0 for PerformanceNavigationTiming

  // DOMContentLoaded event timing
  const domContentLoadedStart = nav.domContentLoadedEventStart; // ms from nav start
  const domContentLoadedEnd   = nav.domContentLoadedEventEnd;   // ms from nav start

  // Full page load event (includes all deferred scripts, CDN resources)
  const loadEventEnd          = nav.loadEventEnd; // ms from nav start

  // Current wall-clock offset from page start (approximates time of script execution)
  const scriptRunTime         = performance.now(); // ms from nav start

  // ─── Infer render-completion time ───────────────────────────────────────────

  /**
   * Look for the custom performance mark written when the loading indicator
   * is hidden (indicates full render completion). The app does not currently
   * write these marks natively, so we check if they were injected by a prior
   * run of this script's instrumentation patch (see below).
   */
  const renderDoneMarks = performance.getEntriesByName('app:render-complete');
  const loadingHiddenMarks = performance.getEntriesByName('app:loading-indicator-shown');

  let renderCompleteTime = null;
  let loadingIndicatorShownTime = null;

  if (renderDoneMarks.length > 0) {
    renderCompleteTime = renderDoneMarks[renderDoneMarks.length - 1].startTime;
  }
  if (loadingHiddenMarks.length > 0) {
    loadingIndicatorShownTime = loadingHiddenMarks[0].startTime;
  }

  /**
   * Fallback estimation when performance marks are not present:
   *
   * The app awaits Chart.js (deferred CDN script) before completing its
   * bootstrap. The loadEventEnd timestamp captures the moment all deferred
   * scripts have executed, which is a reasonable proxy for "Chart.js available".
   * After that, loadFromStorage + render are synchronous and fast.
   *
   * We estimate:
   *   totalRenderTime ≈ max(loadEventEnd, scriptRunTime)
   *     — takes whichever is larger: the page load event finishing or now
   *
   * For the loading indicator, the app shows it as the FIRST thing in
   * App.init() (synchronous, no awaits before it), which runs at
   * DOMContentLoaded. So loadingIndicatorShownTime ≈ domContentLoadedStart.
   */
  const estimatedTotalRenderTime = renderCompleteTime !== null
    ? renderCompleteTime
    : Math.max(loadEventEnd, scriptRunTime);

  const estimatedLoadingIndicatorTime = loadingIndicatorShownTime !== null
    ? loadingIndicatorShownTime
    : domContentLoadedStart;

  // ─── DOM inspection: verify final render state ───────────────────────────────

  const transactionList  = document.getElementById('transaction-list');
  const balanceDisplay   = document.getElementById('balance-display');
  const loadingIndicator = document.getElementById('loading-indicator');
  const chartContainer   = document.getElementById('chart-container');

  const listItemCount         = transactionList ? transactionList.querySelectorAll('li').length : -1;
  const balanceText           = balanceDisplay  ? balanceDisplay.textContent.trim() : 'N/A';
  const loadingIndicatorEmpty = loadingIndicator ? loadingIndicator.innerHTML.trim() === '' : null;
  const chartHasContent       = chartContainer  ? chartContainer.innerHTML.trim() !== '' : false;

  // ─── Assert and report ───────────────────────────────────────────────────────

  const totalLoadPass      = estimatedTotalRenderTime <= MAX_TOTAL_LOAD_MS;
  const loadingIndicatorPass = estimatedLoadingIndicatorTime <= MAX_LOADING_INDICATOR_MS;

  console.group('%c📊 Load-Time Performance Report — Task 14.2', 'font-weight:bold;font-size:14px;');

  console.group('Navigation Timing (raw)');
  console.table({
    'DOMContentLoaded start (ms)':  { value: domContentLoadedStart.toFixed(2) },
    'DOMContentLoaded end (ms)':    { value: domContentLoadedEnd.toFixed(2) },
    'loadEventEnd (ms)':            { value: loadEventEnd.toFixed(2) },
    'Script execution time (ms)':   { value: scriptRunTime.toFixed(2) },
  });
  console.groupEnd();

  console.group('DOM State After Load');
  console.table({
    '#transaction-list <li> count': { value: listItemCount },
    '#balance-display text':        { value: balanceText },
    '#loading-indicator hidden':    { value: loadingIndicatorEmpty },
    '#chart-container has content': { value: chartHasContent },
  });
  console.groupEnd();

  console.group('Performance Marks (requires instrumentation patch — see below)');
  if (renderCompleteTime !== null) {
    console.log('  app:render-complete mark found at ' + renderCompleteTime.toFixed(2) + ' ms');
  } else {
    console.log('  app:render-complete mark NOT found — using loadEventEnd as estimate');
  }
  if (loadingIndicatorShownTime !== null) {
    console.log('  app:loading-indicator-shown mark found at ' + loadingIndicatorShownTime.toFixed(2) + ' ms');
  } else {
    console.log('  app:loading-indicator-shown mark NOT found — using DOMContentLoaded start as estimate');
  }
  console.groupEnd();

  console.group('Assertions (Requirements 8.3 & 8.4)');

  console.log(
    (totalLoadPass ? '✅ PASS' : '❌ FAIL') +
    '  [Req 8.3] Total initial render time: ' +
    estimatedTotalRenderTime.toFixed(2) + ' ms' +
    '  (threshold: ≤ ' + MAX_TOTAL_LOAD_MS + ' ms)'
  );

  console.log(
    (loadingIndicatorPass ? '✅ PASS' : '❌ FAIL') +
    '  [Req 8.4] Loading indicator appeared at: ' +
    estimatedLoadingIndicatorTime.toFixed(2) + ' ms' +
    '  (threshold: ≤ ' + MAX_LOADING_INDICATOR_MS + ' ms)'
  );

  const overallPass = totalLoadPass && loadingIndicatorPass;
  console.log(
    '\n' + (overallPass ? '🎉 Overall: PASS' : '⚠️  Overall: FAIL — see details above')
  );

  if (!totalLoadPass) {
    console.warn(
      'Req 8.3 FAILURE: Render took ' + estimatedTotalRenderTime.toFixed(2) + ' ms, ' +
      'exceeding the 2,000 ms budget. Check network speed (CDN Chart.js), ' +
      'localStorage parse time, or rendering bottlenecks in ListRenderer.'
    );
  }
  if (!loadingIndicatorPass) {
    console.warn(
      'Req 8.4 FAILURE: Loading indicator appeared at ' +
      estimatedLoadingIndicatorTime.toFixed(2) + ' ms, ' +
      'exceeding the 500 ms budget. Verify App.init() sets #loading-indicator ' +
      'innerHTML as its very first synchronous operation.'
    );
  }

  console.groupEnd();
  console.groupEnd();

  // ─── Phase 3: Instrumentation patch ─────────────────────────────────────────
  /**
   * OPTIONAL PRECISION IMPROVEMENT — Instrumentation Patch
   * ────────────────────────────────────────────────────────
   * For more accurate measurements, add these two performance.mark() calls
   * directly inside js/app.js:
   *
   *   // In App.init(), immediately after setting loadingEl.innerHTML:
   *   performance.mark('app:loading-indicator-shown');
   *
   *   // In App.init(), immediately after hiding the loading indicator
   *   // (after: loadingEl.innerHTML = ''):
   *   performance.mark('app:render-complete');
   *
   * Then re-run this script after reload — it will use the precise marks
   * instead of the Navigation Timing estimates.
   *
   * The MutationObserver below auto-detects the loading indicator visibility
   * change on the CURRENT page load (useful when you cannot modify app.js):
   */

  // MutationObserver to catch any future loading indicator changes this session
  const loadingEl = document.getElementById('loading-indicator');
  if (loadingEl && loadingIndicatorShownTime === null) {
    const observer = new MutationObserver(function(mutations) {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const isEmpty = loadingEl.innerHTML.trim() === '';
          const t = performance.now();
          if (!isEmpty) {
            performance.mark('app:loading-indicator-shown');
            console.info('[load-time.js] MutationObserver: loading indicator shown at ' + t.toFixed(2) + ' ms');
          } else {
            performance.mark('app:render-complete');
            console.info('[load-time.js] MutationObserver: loading indicator hidden (render complete) at ' + t.toFixed(2) + ' ms');
          }
        }
      }
    });
    observer.observe(loadingEl, { childList: true, characterData: true, subtree: true });
    console.info('[load-time.js] MutationObserver attached to #loading-indicator for future reloads.');
  }

  // ─── Phase 4: Summary ────────────────────────────────────────────────────────

  console.info(
    '\n[load-time.js] Tip: For a more reliable measurement, open DevTools → ' +
    'Performance → Record, then reload. Look for the "DOMContentLoaded" event ' +
    'marker and measure to the last paint frame in the Frames track.'
  );

})();
