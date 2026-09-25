/**
 * =============================================================================
 * perf/seed-and-time.js — Performance timing script for task 14.1
 * =============================================================================
 *
 * PURPOSE
 * -------
 * Verifies that:
 *   - A form-submit update (add transaction) completes within 200 ms (Req 8.1)
 *   - A delete update completes within 200 ms (Req 8.2)
 * ...when the app already has 1,000 persisted transactions.
 *
 * HOW TO RUN — BROWSER DEVTOOLS (recommended)
 * -------------------------------------------
 * 1. Open the app: open index.html in Chrome/Firefox/Edge/Safari via a local
 *    server (e.g. `npx serve .` or VS Code Live Server), or file:// if allowed.
 * 2. Open DevTools → Console.
 * 3. Copy-paste the entire contents of this file into the console and press Enter.
 *    This defines the helper functions and immediately runs measureUpdateBudget().
 * 4. Read the results in the console output.
 *
 * HOW TO RUN — ONE-LINER SEED ONLY (DevTools)
 * --------------------------------------------
 * To just seed localStorage with 1,000 transactions and then refresh the page
 * to measure real load time separately, run only the seedLocalStorage() call:
 *
 *   seedLocalStorage(1000);
 *   location.reload();
 *
 * HOW TO RUN — NODE.JS
 * ---------------------
 * Most of this script requires a real browser because it accesses:
 *   - window.localStorage
 *   - document.getElementById()
 *   - HTMLFormElement.dispatchEvent()
 *   - performance.now()
 *
 * The generateTransactions() helper is Node.js-safe and can be imported:
 *
 *   const { generateTransactions } = require('./perf/seed-and-time.js');
 *   console.log(generateTransactions(5));
 *
 * All timing/DOM functions require a browser environment.
 * =============================================================================
 */

// ---------------------------------------------------------------------------
// Constants — must match js/app.js
// ---------------------------------------------------------------------------

const PERF_STORAGE_KEY = 'expense_tracker_transactions';
const PERF_CATEGORIES = ['Food', 'Transport', 'Fun'];
const PERF_BUDGET_MS = 200; // Req 8.1 / 8.2

// ---------------------------------------------------------------------------
// generateTransactions(count) — pure, works in Node.js and browser
// ---------------------------------------------------------------------------

/**
 * Generates `count` valid Transaction objects.
 *
 * Each transaction satisfies the schema:
 *   { id: string, name: string, amount: number, category: string, timestamp: number }
 *
 * @param {number} count  Number of transactions to generate (default 1000)
 * @returns {Array<Object>}
 */
function generateTransactions(count = 1000) {
  const txns = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const categoryIndex = i % PERF_CATEGORIES.length;

    // id: use crypto.randomUUID() when available (browser / Node 19+), else fallback
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `perf-tx-${now}-${i}-${Math.random().toString(36).slice(2)}`;

    // name: 1–50 chars, always valid, human-readable for debugging
    const name = `Perf Item ${i + 1}`;

    // amount: spread evenly across the valid range 0.01–999,999,999.99
    // Use a modest range so totals are representable without floating-point overflow
    const amount = parseFloat((Math.random() * 999.98 + 0.01).toFixed(2));

    // category: cycle through all three to exercise all chart segments
    const category = PERF_CATEGORIES[categoryIndex];

    // timestamp: spaced 1 ms apart so reverse-chronological sort is deterministic
    const timestamp = now - (count - i);

    txns.push({ id, name, amount, category, timestamp });
  }

  return txns;
}

// ---------------------------------------------------------------------------
// seedLocalStorage(count) — browser only (requires window.localStorage)
// ---------------------------------------------------------------------------

/**
 * Generates `count` valid transactions and writes them to localStorage under
 * the key `expense_tracker_transactions`.
 *
 * ⚠️  This REPLACES any existing transaction data in localStorage.
 *
 * @param {number} count  Number of transactions to seed (default 1000)
 * @returns {Array<Object>}  The seeded transaction array (for inspection)
 */
function seedLocalStorage(count = 1000) {
  if (typeof localStorage === 'undefined') {
    throw new Error('seedLocalStorage() requires a browser environment (localStorage is not available).');
  }

  const txns = generateTransactions(count);

  try {
    localStorage.setItem(PERF_STORAGE_KEY, JSON.stringify(txns));
    console.log(`[perf] Seeded ${txns.length} transactions into localStorage key "${PERF_STORAGE_KEY}".`);
  } catch (e) {
    console.error('[perf] localStorage.setItem failed:', e.message);
    throw e;
  }

  return txns;
}

// ---------------------------------------------------------------------------
// measureUpdateBudget() — browser only (requires DOM + Chart.js loaded)
// ---------------------------------------------------------------------------

/**
 * Performance timing harness for Requirements 8.1 and 8.2.
 *
 * Steps:
 *   1. Seeds localStorage with 1,000 transactions.
 *   2. Reloads the app's in-memory state from localStorage via
 *      TransactionStore.loadFromStorage() + re-render (simulates page reload
 *      without navigating away).
 *   3. Measures a form-submit cycle: fills the form fields, dispatches a
 *      submit event, and records elapsed time. Asserts < 200 ms.
 *   4. Measures a delete cycle: finds the first delete button,
 *      stubs window.confirm to auto-confirm, clicks the button, and records
 *      elapsed time. Asserts < 200 ms.
 *   5. Restores window.confirm and logs a summary.
 *
 * Prerequisites:
 *   - The app page must be open (index.html served via local server or file://).
 *   - Chart.js must have finished loading (the loading indicator must be gone).
 *   - The app's JS globals (TransactionStore, ListRenderer, etc.) must be in scope.
 *
 * @returns {{ submitMs: number, deleteMs: number, passed: boolean }}
 */
async function measureUpdateBudget() {
  // ── Guard: must run in a browser with the app loaded ──────────────────────
  if (typeof document === 'undefined') {
    throw new Error('measureUpdateBudget() requires a browser environment.');
  }
  if (typeof TransactionStore === 'undefined') {
    throw new Error(
      'measureUpdateBudget() requires the app to be loaded on the page. ' +
      'Open index.html in a browser, wait for it to finish loading, then run this script.'
    );
  }

  console.group('[perf] measureUpdateBudget()');

  // ── Step 1: Seed localStorage with 1,000 transactions ─────────────────────
  console.log('[perf] Step 1: Seeding 1,000 transactions into localStorage…');
  const seeded = seedLocalStorage(1000);

  // ── Step 2: Reload in-memory state from localStorage ──────────────────────
  console.log('[perf] Step 2: Loading seeded transactions into app state…');
  TransactionStore.loadFromStorage();
  const loadedCount = TransactionStore.getAll().length;
  console.log(`[perf] App now has ${loadedCount} transactions in memory.`);

  if (loadedCount !== 1000) {
    console.warn(`[perf] Expected 1000 transactions but got ${loadedCount}. Results may be skewed.`);
  }

  // Re-render all components with the seeded data so the DOM reflects 1,000 items
  const allTxns = TransactionStore.getAll();
  ListRenderer.render(allTxns);
  BalanceRenderer.render(allTxns);
  ChartRenderer.render(allTxns);

  // Small pause to let the browser paint the 1,000-item list before timing
  await new Promise(resolve => setTimeout(resolve, 100));

  // ── Step 3: Measure form-submit (add transaction) — Req 8.1 ───────────────
  console.log('[perf] Step 3: Measuring form-submit update time…');

  const nameInput     = document.getElementById('item-name');
  const amountInput   = document.getElementById('amount');
  const categoryInput = document.getElementById('category');
  const form          = document.getElementById('input-form');

  if (!nameInput || !amountInput || !categoryInput || !form) {
    throw new Error('[perf] Could not find form elements. Is the app loaded?');
  }

  // Fill in valid values
  nameInput.value     = 'Perf Test Item';
  amountInput.value   = '12.34';
  categoryInput.value = 'Food';

  const t0Submit = performance.now();

  // Dispatch submit event — this triggers FormController._handleSubmit
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

  const submitMs = performance.now() - t0Submit;
  const submitPassed = submitMs < PERF_BUDGET_MS;

  console.log(
    `[perf] Form-submit elapsed: ${submitMs.toFixed(3)} ms — ${submitPassed ? '✅ PASS' : '❌ FAIL'} (budget: ${PERF_BUDGET_MS} ms)`
  );

  if (!submitPassed) {
    console.warn(
      `[perf] ⚠️  Form-submit exceeded ${PERF_BUDGET_MS} ms budget by ${(submitMs - PERF_BUDGET_MS).toFixed(3)} ms (Req 8.1).`
    );
  }

  // Small pause between measurements
  await new Promise(resolve => setTimeout(resolve, 100));

  // ── Step 4: Measure delete — Req 8.2 ─────────────────────────────────────
  console.log('[perf] Step 4: Measuring delete update time…');

  // Stub window.confirm to auto-confirm without showing a dialog
  const originalConfirm = window.confirm;
  window.confirm = () => true;

  let deleteMs = NaN;
  let deletePassed = false;

  try {
    // Find the first delete button in the rendered list
    const deleteBtn = document.querySelector('#transaction-list .delete-btn');

    if (!deleteBtn) {
      throw new Error('[perf] No delete buttons found in transaction list. Is the list rendered?');
    }

    const t0Delete = performance.now();

    // Click triggers App._handleListClick → confirm → TransactionStore.remove()
    deleteBtn.click();

    deleteMs = performance.now() - t0Delete;
    deletePassed = deleteMs < PERF_BUDGET_MS;

    console.log(
      `[perf] Delete elapsed:      ${deleteMs.toFixed(3)} ms — ${deletePassed ? '✅ PASS' : '❌ FAIL'} (budget: ${PERF_BUDGET_MS} ms)`
    );

    if (!deletePassed) {
      console.warn(
        `[perf] ⚠️  Delete exceeded ${PERF_BUDGET_MS} ms budget by ${(deleteMs - PERF_BUDGET_MS).toFixed(3)} ms (Req 8.2).`
      );
    }
  } finally {
    // Always restore window.confirm
    window.confirm = originalConfirm;
  }

  // ── Step 5: Summary ────────────────────────────────────────────────────────
  const allPassed = submitPassed && deletePassed;

  console.log('');
  console.log('══════════════════════════════════════════════');
  console.log(`  RESULT: ${allPassed ? '✅ ALL CHECKS PASSED' : '❌ ONE OR MORE CHECKS FAILED'}`);
  console.log(`  Form-submit: ${submitMs.toFixed(3)} ms  (budget ${PERF_BUDGET_MS} ms) → ${submitPassed ? 'PASS' : 'FAIL'}`);
  console.log(`  Delete:      ${deleteMs.toFixed(3)} ms  (budget ${PERF_BUDGET_MS} ms) → ${deletePassed ? 'PASS' : 'FAIL'}`);
  console.log('══════════════════════════════════════════════');
  console.groupEnd();

  return { submitMs, deleteMs, passed: allPassed };
}

// ---------------------------------------------------------------------------
// Auto-run when pasted into DevTools console
// ---------------------------------------------------------------------------

// When running in a browser, kick off the measurement immediately.
// In Node.js (typeof document === 'undefined') this block is skipped so the
// file can be safely require()'d to extract generateTransactions().
if (typeof document !== 'undefined') {
  measureUpdateBudget().catch(err => {
    console.error('[perf] measureUpdateBudget() failed:', err.message);
    console.groupEnd();
  });
}

// ---------------------------------------------------------------------------
// Node.js export (for generateTransactions only)
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generateTransactions, seedLocalStorage };
}
