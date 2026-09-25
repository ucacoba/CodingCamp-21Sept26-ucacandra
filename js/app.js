// Expense & Budget Visualizer — app.js

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'expense_tracker_transactions';
const THEME_KEY   = 'expense_tracker_theme';

// ---------------------------------------------------------------------------
// CategoryService — category data management (Task 17.1)
// ---------------------------------------------------------------------------

/**
 * @typedef {{ name: string, color: string, isBuiltIn: boolean }} Category
 */

const CategoryService = {
  /** Built-in categories — always present, never stored, cannot be removed. */
  _builtIns: [
    { name: 'Food',      color: '#FF6384', isBuiltIn: true },
    { name: 'Transport', color: '#36A2EB', isBuiltIn: true },
    { name: 'Fun',       color: '#FFCE56', isBuiltIn: true },
  ],

  /**
   * Extended color palette for custom categories.
   * Colors cycle when more than 10 custom categories exist.
   * All values are distinct from the built-in colors.
   */
  EXTENDED_PALETTE: [
    '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7CFC00',
    '#DC143C', '#00CED1', '#FF69B4', '#8A2BE2', '#FFA500',
  ],

  /** @type {Category[]} — user-defined categories only (not stored built-ins) */
  _custom: [],

  /**
   * Returns built-in categories first, then custom categories sorted
   * alphabetically by name.
   * @returns {Category[]}
   */
  getAll() {
    const sortedCustom = this._custom.slice().sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    return [...this._builtIns, ...sortedCustom];
  },

  /**
   * Returns the hex color string for the named category.
   * Returns '#999999' as a fallback for unknown category names.
   * @param {string} name
   * @returns {string}
   */
  getColor(name) {
    const found = this.getAll().find(
      c => c.name.toLowerCase() === name.toLowerCase()
    );
    return found ? found.color : '#999999';
  },

  /**
   * Adds a new custom category after validation.
   *
   * Validation rules:
   *  - Name must be 1–50 characters (after trimming).
   *  - Name must not duplicate any existing built-in or custom category
   *    (case-insensitive comparison).
   *
   * On success, assigns the next color from EXTENDED_PALETTE, calls save(),
   * and returns { ok: true }.
   * On failure, returns { ok: false, error: '<message>' } without mutating state.
   *
   * @param {string} name
   * @returns {{ ok: boolean, error?: string }}
   */
  addCustom(name) {
    const trimmed = (name || '').trim();

    if (trimmed.length === 0) {
      return { ok: false, error: 'Category name is required.' };
    }
    if (trimmed.length > 50) {
      return { ok: false, error: 'Category name must not exceed 50 characters.' };
    }

    const lowerTrimmed = trimmed.toLowerCase();
    const duplicate = this.getAll().find(
      c => c.name.toLowerCase() === lowerTrimmed
    );
    if (duplicate) {
      return { ok: false, error: 'Category already exists.' };
    }

    // Assign next color from the extended palette (cycles if > 10 custom)
    const color = this.EXTENDED_PALETTE[this._custom.length % this.EXTENDED_PALETTE.length];

    const newCategory = { name: trimmed, color, isBuiltIn: false };
    this._custom.push(newCategory);

    this.save();

    return { ok: true };
  },

  /**
   * Removes a custom category by name.
   *
   * Rejection rules:
   *  - Built-in categories cannot be removed (Req 10.11).
   *  - A category cannot be removed if any transaction in TransactionStore
   *    references it (Req 10.10).
   *
   * On success, removes the category, calls save(), and returns { ok: true }.
   * On failure, returns { ok: false, error: '<message>' } without mutating state.
   *
   * @param {string} name
   * @returns {{ ok: boolean, error?: string }}
   */
  removeCustom(name) {
    // Reject built-in names
    const isBuiltIn = this._builtIns.some(
      c => c.name.toLowerCase() === name.toLowerCase()
    );
    if (isBuiltIn) {
      return { ok: false, error: 'Built-in categories cannot be removed.' };
    }

    // Ensure the custom category actually exists
    const idx = this._custom.findIndex(
      c => c.name.toLowerCase() === name.toLowerCase()
    );
    if (idx === -1) {
      return { ok: false, error: 'Category not found.' };
    }

    // Reject if any transaction references this category
    const referencedBy = TransactionStore.getAll().filter(
      tx => tx.category.toLowerCase() === name.toLowerCase()
    );
    if (referencedBy.length > 0) {
      return {
        ok: false,
        error: 'Category cannot be removed while transactions reference it.',
      };
    }

    // Safe to remove
    this._custom.splice(idx, 1);
    this.save();

    return { ok: true };
  },

  /**
   * Reads the 'expense_tracker_categories' key from localStorage, parses the
   * JSON, validates each entry, and populates the internal _custom array.
   * Silently discards malformed entries.
   */
  loadFromStorage() {
    this._custom = [];

    let raw;
    try {
      raw = localStorage.getItem('expense_tracker_categories');
    } catch (e) {
      // localStorage unavailable — proceed with empty custom list
      return;
    }

    if (raw === null) return; // No custom categories saved yet

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return; // Corrupted data — start fresh
    }

    if (!Array.isArray(parsed)) return;

    // Validate and filter: each entry must have a name string and not be a built-in
    const validCustom = parsed.filter(entry => {
      if (!entry || typeof entry !== 'object') return false;
      if (typeof entry.name !== 'string' || entry.name.trim().length === 0) return false;
      if (entry.name.trim().length > 50) return false;
      if (typeof entry.color !== 'string') return false;
      // Reject entries whose name conflicts with built-ins
      const isBuiltIn = this._builtIns.some(
        b => b.name.toLowerCase() === entry.name.trim().toLowerCase()
      );
      if (isBuiltIn) return false;
      return true;
    });

    // Deduplicate (case-insensitive) — keep first occurrence
    const seen = new Set();
    this._custom = validCustom
      .map(entry => ({
        name:      entry.name.trim(),
        color:     entry.color,
        isBuiltIn: false,
      }))
      .filter(entry => {
        const key = entry.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  },

  /**
   * Writes only the custom categories to 'expense_tracker_categories'.
   * Built-ins are never stored.
   * Catches storage errors and shows a non-blocking banner via NotificationService.
   */
  save() {
    try {
      localStorage.setItem(
        'expense_tracker_categories',
        JSON.stringify(this._custom)
      );
    } catch (e) {
      // NotificationService may not be defined yet during early init — guard it
      if (typeof NotificationService !== 'undefined') {
        NotificationService.showBanner(
          'Category change could not be saved. Changes are in-memory only this session.',
          'warning'
        );
      }
    }
  },
};

// ---------------------------------------------------------------------------
// StorageError factory
// ---------------------------------------------------------------------------

/**
 * Creates a StorageError object.
 * @param {'unavailable'|'corrupt'} type
 * @param {string} message
 * @returns {{ type: string, message: string }}
 */
function StorageError(type, message) {
  return { type, message };
}

// ---------------------------------------------------------------------------
// StorageService — localStorage abstraction
// ---------------------------------------------------------------------------

/**
 * Validates a single entry against the Transaction schema.
 * Allows negative amounts (Req 4.5) but requires isFinite.
 * Category is validated against all known categories (built-in + custom).
 * @param {*} entry
 * @returns {boolean}
 */
function isValidTransaction(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (typeof entry.id !== 'string') return false;
  if (typeof entry.name !== 'string' || entry.name.length < 1) return false;
  if (typeof entry.amount !== 'number' || !isFinite(entry.amount)) return false;
  if (typeof entry.category !== 'string') return false;
  if (typeof entry.timestamp !== 'number') return false;
  return true;
}

const StorageService = {
  /** @type {{ type: string, message: string } | null} */
  lastError: null,

  /** @type {{ discarded: number } | null} */
  lastWarnings: null,

  /**
   * Reads and parses the transaction array from localStorage.
   * Validates each entry; discards malformed ones.
   * Never throws — returns [] and sets lastError on any exception.
   * @returns {Transaction[]}
   */
  load() {
    this.lastError = null;
    this.lastWarnings = null;

    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      this.lastError = StorageError('unavailable', 'localStorage read failed: ' + e.message);
      return [];
    }

    // Key not present — no data yet, not an error
    if (raw === null) {
      return [];
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      this.lastError = StorageError('corrupt', 'Failed to parse stored data: ' + e.message);
      return [];
    }

    if (!Array.isArray(parsed)) {
      this.lastError = StorageError('corrupt', 'Stored data is not an array.');
      return [];
    }

    const valid = parsed.filter(isValidTransaction);
    const discarded = parsed.length - valid.length;
    if (discarded > 0) {
      this.lastWarnings = { discarded };
    }

    return valid;
  },

  /**
   * Serializes and writes the transaction array to localStorage.
   * Throws a StorageError on failure.
   * @param {Transaction[]} txns
   */
  save(txns) {
    if (typeof localStorage === 'undefined') {
      throw StorageError('unavailable', 'localStorage is not available');
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(txns));
    } catch (e) {
      throw StorageError('unavailable', 'localStorage write failed: ' + e.message);
    }
  },

  /**
   * Removes the transaction data key from localStorage.
   */
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
};

// ---------------------------------------------------------------------------
// Validator — pure input validation (no side effects, no DOM access)
// ---------------------------------------------------------------------------

/**
 * @typedef {{ valid: true } | { valid: false, error: string }} ValidationResult
 */

const Validator = {
  /**
   * Validates the transaction item name.
   * @param {*} name
   * @returns {ValidationResult}
   */
  validateName(name) {
    if (name === null || name === undefined || name === '') {
      return { valid: false, error: 'Item name is required.' };
    }
    if (name.length > 100) {
      return { valid: false, error: 'Item name must not exceed 100 characters.' };
    }
    return { valid: true };
  },

  /**
   * Validates the transaction amount.
   * Accepts a string (from form input) or a number.
   * @param {*} amount
   * @returns {ValidationResult}
   */
  validateAmount(amount) {
    if (amount === null || amount === undefined || amount === '') {
      return { valid: false, error: 'Amount must be a number.' };
    }
    const parsed = Number(amount);
    if (isNaN(parsed)) {
      return { valid: false, error: 'Amount must be a number.' };
    }
    if (parsed <= 0 || parsed > 999999999.99) {
      return { valid: false, error: 'Amount must be between 0.01 and 999,999,999.99.' };
    }
    return { valid: true };
  },

  /**
   * Validates the transaction category.
   * Delegates to CategoryService so custom categories are accepted.
   * @param {*} cat
   * @returns {ValidationResult}
   */
  validateCategory(cat) {
    const validNames = CategoryService.getAll().map(c => c.name);
    if (!validNames.includes(cat)) {
      return { valid: false, error: 'Please select a valid category.' };
    }
    return { valid: true };
  },

  /**
   * Validates all three transaction fields together.
   * @param {*} name
   * @param {*} amount
   * @param {*} category
   * @returns {ValidationResult[]}
   */
  validateTransaction(name, amount, category) {
    return [
      this.validateName(name),
      this.validateAmount(amount),
      this.validateCategory(category),
    ];
  },
};

// ---------------------------------------------------------------------------
// NotificationService — banner and inline field-error display (Task 5.1)
// ---------------------------------------------------------------------------

const NotificationService = {
  /**
   * Injects a dismissible banner into #notification-banner.
   * @param {string} message
   * @param {'warning'|'error'|'info'} type
   */
  showBanner(message, type) {
    const container = document.getElementById('notification-banner');
    if (!container) return;

    // Clear any existing banner
    container.innerHTML = '';

    const banner = document.createElement('div');
    banner.className = 'notification-banner notification-banner--' + type;
    // role="alert" and aria-live="assertive" are already set on the #notification-banner
    // container element in index.html. Do NOT duplicate them on the injected child div —
    // nested live regions can cause double-announcement in some screen readers.

    const text = document.createElement('span');
    text.className = 'notification-banner__message';
    text.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'notification-banner__close';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.hideBanner());

    banner.appendChild(text);
    banner.appendChild(closeBtn);
    container.appendChild(banner);
  },

  /**
   * Clears the #notification-banner contents.
   */
  hideBanner() {
    const container = document.getElementById('notification-banner');
    if (container) {
      container.innerHTML = '';
    }
  },

  /**
   * Inserts an inline error <span> after the identified field element.
   * @param {string} fieldId  — the `id` of the form field
   * @param {string} message
   */
  showFieldError(fieldId, message) {
    // Remove any existing error for this field first
    const existingError = document.getElementById(fieldId + '-error');
    if (existingError) {
      existingError.remove();
    }

    const field = document.getElementById(fieldId);
    if (!field) return;

    const span = document.createElement('span');
    span.id = fieldId + '-error';
    span.className = 'field-error';
    span.setAttribute('role', 'alert');
    span.setAttribute('aria-live', 'polite');
    span.textContent = message;

    // Insert immediately after the field element
    field.insertAdjacentElement('afterend', span);

    // Also wire up aria-describedby on the field for screen readers
    field.setAttribute('aria-describedby', fieldId + '-error');
    field.setAttribute('aria-invalid', 'true');
  },

  /**
   * Removes all inline error spans from the DOM.
   */
  clearFieldErrors() {
    const errors = document.querySelectorAll('.field-error');
    errors.forEach(el => el.remove());

    // Clean up aria attributes on the fields
    const fields = document.querySelectorAll('[aria-invalid="true"]');
    fields.forEach(field => {
      field.removeAttribute('aria-invalid');
      field.removeAttribute('aria-describedby');
    });
  },
};

// ---------------------------------------------------------------------------
// BalanceRenderer — total balance display (Task 6.1)
// ---------------------------------------------------------------------------

const BalanceRenderer = {
  /**
   * Computes the signed sum of all transaction amounts, formats it to exactly
   * 2 decimal places with a `$` prefix, and writes it to `#balance-display`.
   *
   * Renders `$0.00` when the transactions array is empty.
   * Handles negative amounts per Req 4.5 by using the algebraic sum.
   *
   * @param {Transaction[]} transactions
   */
  render(transactions) {
    const sum = transactions.reduce((acc, tx) => acc + tx.amount, 0);
    // Round to 2 decimal places to avoid floating-point representation issues
    const formatted = '$' + sum.toFixed(2);
    const el = document.getElementById('balance-display');
    if (el) {
      el.textContent = formatted;
    }
  },
};

// ---------------------------------------------------------------------------
// SortController — display-only sort mode management (Task 19.1)
// ---------------------------------------------------------------------------

/**
 * @typedef {'date-desc'|'amount-asc'|'amount-desc'|'category-asc'|'category-desc'} SortMode
 */

const SortController = {
  /** @type {SortMode} */
  _mode: 'date-desc',

  /**
   * Returns the currently active sort mode.
   * Defaults to 'date-desc' (reverse-chronological) on first load (Req 11.2).
   * @returns {SortMode}
   */
  getMode() {
    return this._mode;
  },

  /**
   * Sets the active sort mode and re-renders the transaction list.
   * Balance and chart are NOT re-rendered — sort is display-only (Req 11.9).
   * @param {SortMode} mode
   */
  setMode(mode) {
    this._mode = mode;
    ListRenderer.render(TransactionStore.getAll());
  },
};

// ---------------------------------------------------------------------------
// ListRenderer — transaction list DOM rendering (Task 7.1)
// ---------------------------------------------------------------------------

const ListRenderer = {
  /**
   * Renders the transaction list into #transaction-list.
   *
   * - Sorts by timestamp descending (most recent first) without mutating the input.
   * - Renders a placeholder <li> when the array is empty.
   * - For each transaction renders an <li> with: item name, formatted amount,
   *   category badge, and an accessible delete button.
   *
   * @param {Transaction[]} transactions
   */
  render(transactions) {
    const listEl = document.getElementById('transaction-list');
    if (!listEl) return;

    // Clear existing content
    listEl.innerHTML = '';

    // Empty state
    if (!transactions || transactions.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'no-transactions';
      emptyItem.textContent = 'No transactions yet.';
      listEl.appendChild(emptyItem);
      return;
    }

    // Sort a shallow copy according to the active SortController mode — never mutate input (Req 11.9)
    const mode = (typeof SortController !== 'undefined') ? SortController.getMode() : 'date-desc';
    const sorted = transactions.slice().sort((a, b) => {
      switch (mode) {
        case 'amount-asc':
          return a.amount !== b.amount
            ? a.amount - b.amount
            : b.timestamp - a.timestamp; // tie-break: newest first
        case 'amount-desc':
          return a.amount !== b.amount
            ? b.amount - a.amount
            : b.timestamp - a.timestamp;
        case 'category-asc': {
          const cmp = a.category.localeCompare(b.category);
          return cmp !== 0 ? cmp : b.timestamp - a.timestamp;
        }
        case 'category-desc': {
          const cmp = b.category.localeCompare(a.category);
          return cmp !== 0 ? cmp : b.timestamp - a.timestamp;
        }
        case 'date-desc':
        default:
          return b.timestamp - a.timestamp;
      }
    });

    const fragment = document.createDocumentFragment();

    sorted.forEach(tx => {
      const li = document.createElement('li');
      li.className = 'transaction-item';
      li.dataset.id = tx.id;

      // Item name — truncate display to 100 chars; use textContent for XSS safety
      const nameEl = document.createElement('span');
      nameEl.className = 'transaction-name';
      nameEl.textContent = tx.name.length > 100 ? tx.name.slice(0, 100) : tx.name;

      // Formatted amount ($X.XX)
      const amountEl = document.createElement('span');
      amountEl.className = 'transaction-amount';
      amountEl.textContent = '$' + tx.amount.toFixed(2);

      // Category badge — CSS class uses lower-cased category name for built-ins;
      // inline style covers custom categories that have no corresponding CSS class.
      // Text color is determined by a luminance check so dark palette colors get
      // white text (WCAG contrast) while light palette colors keep dark text.
      const categoryEl = document.createElement('span');
      categoryEl.className =
        'category-badge category-' + tx.category.toLowerCase();
      const badgeColor = CategoryService.getColor(tx.category);
      categoryEl.style.backgroundColor = badgeColor;
      // Simple relative luminance heuristic from hex color
      const r = parseInt(badgeColor.slice(1, 3), 16);
      const g = parseInt(badgeColor.slice(3, 5), 16);
      const b = parseInt(badgeColor.slice(5, 7), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (luminance < 0.55) {
        categoryEl.style.color = '#ffffff';
      }
      categoryEl.textContent = tx.category;

      // Delete button with accessible label
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'delete-btn';
      deleteBtn.dataset.id = tx.id;
      deleteBtn.setAttribute('aria-label', 'Delete ' + tx.name);
      deleteBtn.textContent = '×';

      li.appendChild(nameEl);
      li.appendChild(amountEl);
      li.appendChild(categoryEl);
      li.appendChild(deleteBtn);

      fragment.appendChild(li);
    });

    listEl.appendChild(fragment);
  },
};

// ---------------------------------------------------------------------------
// ChartRenderer — Chart.js pie chart integration (Tasks 8.1, 8.2)
// ---------------------------------------------------------------------------

const ChartRenderer = {
  /** @type {import('chart.js').Chart | null} */
  _chart: null,

  /**
   * Creates a Chart.js 'pie' instance on the provided canvas element.
   * Stores the instance in `this._chart`.
   * @param {HTMLCanvasElement} canvasEl
   */
  init(canvasEl) {
    // Destroy any existing chart instance before creating a new one
    if (this._chart) {
      this._chart.destroy();
      this._chart = null;
    }

    this._chart = new Chart(canvasEl, {
      type: 'pie',
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            backgroundColor: [],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
          },
          tooltip: {
            callbacks: {
              label(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const value = context.parsed;
                const pct = total > 0 ? ((value / total) * 100).toFixed(2) : '0.00';
                return context.label + ': $' + value.toFixed(2) + ' (' + pct + '%)';
              },
            },
          },
        },
      },
    });
  },

  /**
   * Aggregates positive-amount totals per category and updates the pie chart.
   * Calls `showPlaceholder()` when there are no positive-amount transactions.
   * If `init()` has not been called yet (or the chart was destroyed by
   * `showPlaceholder()`), attempts to re-initialise from the canvas element
   * before rendering — provided Chart.js is available.
   * @param {Transaction[]} transactions
   */
  render(transactions) {
    // Re-init if chart instance was destroyed (e.g. by showPlaceholder) but
    // Chart.js is now available.
    if (!this._chart) {
      if (typeof window.Chart === 'undefined') return;
      const canvasEl = document.getElementById('expense-chart');
      if (!canvasEl) return;
      // Make the canvas visible again before re-initialising
      canvasEl.style.display = '';
      this.init(canvasEl);
    }

    // Aggregate positive-amount totals per category
    const totals = {};
    for (const tx of transactions) {
      if (tx.amount > 0) {
        totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
      }
    }

    const activeCategories = Object.keys(totals).filter(cat => totals[cat] > 0);

    if (activeCategories.length === 0) {
      this.showPlaceholder();
      return;
    }

    // Build parallel arrays for Chart.js — order by CategoryService.getAll() where possible,
    // then append any unrecognised category names at the end.
    const knownOrder = CategoryService.getAll().map(c => c.name);
    const orderedCategories = [
      ...knownOrder.filter(name => activeCategories.includes(name)),
      ...activeCategories.filter(name => !knownOrder.includes(name)),
    ];

    const labels          = orderedCategories;
    const data            = orderedCategories.map(cat => totals[cat]);
    const backgroundColor = orderedCategories.map(cat => CategoryService.getColor(cat));

    // Update chart data in-place and redraw
    this._chart.data.labels = labels;
    this._chart.data.datasets[0].data = data;
    this._chart.data.datasets[0].backgroundColor = backgroundColor;
    this._chart.update();

    // Ensure the canvas is visible (may have been hidden by showPlaceholder)
    const canvasEl = document.getElementById('expense-chart');
    if (canvasEl) {
      canvasEl.style.display = '';
    }

    // Remove any placeholder message
    const placeholder = document.querySelector('.chart-placeholder');
    if (placeholder) {
      placeholder.remove();
    }
  },

  /**
   * Destroys the existing Chart.js instance, preserves the canvas element,
   * and renders a "No spending data available" message in the chart container.
   * Ensures the canvas is available for a future `init()` call.
   */
  showPlaceholder() {
    if (this._chart) {
      this._chart.destroy();
      this._chart = null;
    }

    const container = document.getElementById('chart-container');
    if (!container) return;

    // Grab the canvas before clearing innerHTML so we can re-insert it
    const canvasEl = document.getElementById('expense-chart');

    // Clear the container
    container.innerHTML = '';

    // Re-insert the canvas (hidden — no chart data to show)
    if (canvasEl) {
      canvasEl.style.display = 'none';
      container.appendChild(canvasEl);
    } else {
      // Canvas was somehow removed — recreate it
      const newCanvas = document.createElement('canvas');
      newCanvas.id = 'expense-chart';
      newCanvas.setAttribute('role', 'img');
      newCanvas.setAttribute('aria-label', 'Pie chart showing spending distribution by category');
      newCanvas.style.display = 'none';
      container.appendChild(newCanvas);
    }

    // Inject the placeholder message
    const msg = document.createElement('p');
    msg.className = 'chart-placeholder';
    msg.textContent = 'No spending data available';
    container.appendChild(msg);
  },
};

// ---------------------------------------------------------------------------
// TransactionStore — in-memory state and coordination (Task 9.1)
// ---------------------------------------------------------------------------

const TransactionStore = {
  /** @type {Transaction[]} */
  _transactions: [],

  /**
   * Returns a shallow copy of the in-memory transactions array.
   * @returns {Transaction[]}
   */
  getAll() {
    return [...this._transactions];
  },

  /**
   * Appends a transaction to the in-memory array, persists to localStorage,
   * and re-renders all dependent UI components.
   *
   * If StorageService.save() throws, surfaces a warning banner but does NOT
   * rethrow — the transaction is still kept in memory for the current session.
   *
   * @param {Transaction} tx
   */
  add(tx) {
    this._transactions.push(tx);

    try {
      StorageService.save(this._transactions);
    } catch (e) {
      NotificationService.showBanner(
        'Data could not be saved. Changes are in-memory only this session.',
        'warning'
      );
    }

    // Re-render all dependent components regardless of save outcome
    ListRenderer.render(this._transactions);
    BalanceRenderer.render(this._transactions);
    ChartRenderer.render(this._transactions);
  },

  /**
   * Removes a transaction by id. Attempts the storage write BEFORE mutating
   * the in-memory array so that a storage failure leaves state unchanged (Req 3.5).
   *
   * If StorageService.save() throws: shows an error banner and returns without
   * modifying _transactions or triggering a re-render.
   *
   * @param {string} id
   */
  remove(id) {
    const filtered = this._transactions.filter(tx => tx.id !== id);

    try {
      StorageService.save(filtered);
    } catch (e) {
      NotificationService.showBanner(
        'Deletion could not be saved. Transaction retained.',
        'error'
      );
      return; // Abort — do NOT mutate in-memory state
    }

    // Storage write succeeded — now update in-memory state and re-render
    this._transactions = filtered;

    ListRenderer.render(this._transactions);
    BalanceRenderer.render(this._transactions);
    ChartRenderer.render(this._transactions);
  },

  /**
   * Loads persisted transactions from localStorage into the in-memory array.
   * Surfaces errors and malformed-data warnings via NotificationService banners.
   *
   * @returns {{ ok: boolean, warnings: string[] }}
   */
  loadFromStorage() {
    this._transactions = StorageService.load();

    if (StorageService.lastError) {
      NotificationService.showBanner(
        'Transactions could not be loaded. Running in memory-only mode.',
        'error'
      );
      return { ok: false, warnings: [StorageService.lastError.message] };
    }

    if (StorageService.lastWarnings) {
      NotificationService.showBanner(
        'Some transactions could not be restored and were skipped.',
        'warning'
      );
      return {
        ok: true,
        warnings: ['Some transactions could not be restored and were skipped.'],
      };
    }

    return { ok: true, warnings: [] };
  },
};

// ---------------------------------------------------------------------------
// FormController — form submission and validation wiring (Task 10.1)
// ---------------------------------------------------------------------------

const FormController = {
  /**
   * Attaches the submit event listener to #input-form.
   * Safe to call multiple times — removes any prior listener first.
   */
  init() {
    const form = document.getElementById('input-form');
    if (!form) return;

    // Guard against double-binding (e.g. hot-reload scenarios)
    if (this._boundHandler) {
      form.removeEventListener('submit', this._boundHandler);
    }
    this._boundHandler = this._handleSubmit.bind(this);
    form.addEventListener('submit', this._boundHandler);
  },

  /** @private — stored so it can be removed on re-init */
  _boundHandler: null,

  /**
   * Handles the form submit event.
   *
   * 1. Prevents default browser submission.
   * 2. Clears any previous inline validation errors.
   * 3. Reads raw field values.
   * 4. Validates all three fields via Validator.validateTransaction().
   * 5a. On any invalid field → shows per-field inline errors and returns.
   * 5b. On all valid → builds a Transaction object, adds it via
   *     TransactionStore.add(), and resets the form.
   *
   * Field-to-ID mapping for showFieldError():
   *   name     → 'item-name'
   *   amount   → 'amount'
   *   category → 'category'
   *
   * @param {SubmitEvent} event
   */
  _handleSubmit(event) {
    event.preventDefault();

    // Clear all previous inline errors before re-validating
    NotificationService.clearFieldErrors();

    // Read raw values from the form fields
    const nameInput     = document.getElementById('item-name');
    const amountInput   = document.getElementById('amount');
    const categoryInput = document.getElementById('category');

    const rawName     = nameInput     ? nameInput.value.trim()     : '';
    const rawAmount   = amountInput   ? amountInput.value.trim()   : '';
    const rawCategory = categoryInput ? categoryInput.value        : '';

    // Run all three validators in one call — returns [nameResult, amountResult, categoryResult]
    const [nameResult, amountResult, categoryResult] =
      Validator.validateTransaction(rawName, rawAmount, rawCategory);

    const hasErrors =
      !nameResult.valid || !amountResult.valid || !categoryResult.valid;

    if (hasErrors) {
      // Surface per-field errors inline
      if (!nameResult.valid) {
        NotificationService.showFieldError('item-name', nameResult.error);
      }
      if (!amountResult.valid) {
        NotificationService.showFieldError('amount', amountResult.error);
      }
      if (!categoryResult.valid) {
        NotificationService.showFieldError('category', categoryResult.error);
      }
      return; // Do NOT create a transaction
    }

    // All fields valid — build the Transaction object
    const id =
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : Date.now().toString();

    /** @type {Transaction} */
    const tx = {
      id,
      name:      rawName,
      amount:    parseFloat(rawAmount),
      category:  rawCategory,
      timestamp: Date.now(),
    };

    // Persist, update in-memory state, and trigger full re-render
    TransactionStore.add(tx);

    // Reset the form: clear text/number fields and return select to unselected
    if (nameInput)     nameInput.value     = '';
    if (amountInput)   amountInput.value   = '';
    if (categoryInput) categoryInput.value = '';

    // Return focus to the first field for a smooth UX
    if (nameInput) nameInput.focus();
  },
};

// ---------------------------------------------------------------------------
// ThemeService — dark/light mode management (Task 16.2)
// ---------------------------------------------------------------------------

const ThemeService = {
  /**
   * Returns the currently active theme by reading the `data-theme` attribute
   * from the <html> element. Defaults to 'light' if the attribute is absent.
   * @returns {'light'|'dark'}
   */
  getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  },

  /**
   * Applies the given theme to the page:
   *  - Sets `data-theme` on <html> so CSS custom-property overrides take effect.
   *  - Updates the toggle button icon and aria-label to reflect the theme the
   *    button will switch TO (moon when light, sun when dark).
   *  - Persists the preference to localStorage under 'expense_tracker_theme'.
   *    On storage failure, applies the theme for the current session and shows
   *    a non-blocking warning banner (Req 9.8).
   *
   * @param {'light'|'dark'} theme
   */
  setTheme(theme) {
    // Apply to DOM
    document.documentElement.setAttribute('data-theme', theme);

    // Update toggle button icon and accessible label
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      if (theme === 'dark') {
        btn.textContent = '☀️';
        btn.setAttribute('aria-label', 'Switch to light mode');
      } else {
        btn.textContent = '🌙';
        btn.setAttribute('aria-label', 'Switch to dark mode');
      }
    }

    // Persist preference to localStorage
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      // localStorage unavailable — theme applied for current session only (Req 9.8)
      if (typeof NotificationService !== 'undefined') {
        NotificationService.showBanner(
          'Theme preference could not be saved.',
          'warning'
        );
      }
    }
  },

  /**
   * Toggles between 'light' and 'dark' themes.
   * Reads the current theme, flips it, and delegates to setTheme().
   */
  toggle() {
    const current = this.getTheme();
    this.setTheme(current === 'dark' ? 'light' : 'dark');
  },

  /**
   * Reads the stored theme preference from localStorage and applies it.
   * Defaults to 'light' when the key is absent or storage is unavailable.
   * Called both by the inline flash-prevention script (in <head>) and during
   * App.init() to sync the button state with the already-applied theme.
   */
  loadFromStorage() {
    let stored = null;
    try {
      stored = localStorage.getItem(THEME_KEY);
    } catch (e) {
      // localStorage unavailable — use default
    }
    this.setTheme(stored === 'dark' ? 'dark' : 'light');
  },
};

// ---------------------------------------------------------------------------
// CategoryManagerUI — custom category management interface (Task 18.1)
// ---------------------------------------------------------------------------

const CategoryManagerUI = {
  /**
   * Attaches the "Add Category" click handler to #add-category-btn and
   * performs an initial render of the category list.
   *
   * Safe to call multiple times — removes any prior listener first.
   *
   * @param {HTMLElement} containerEl  — the #category-manager section
   */
  init(containerEl) {
    if (!containerEl) return;

    const addBtn = document.getElementById('add-category-btn');
    if (!addBtn) return;

    // Guard against double-binding
    if (this._boundAddHandler) {
      addBtn.removeEventListener('click', this._boundAddHandler);
    }
    this._boundAddHandler = this._handleAdd.bind(this);
    addBtn.addEventListener('click', this._boundAddHandler);

    // Also allow pressing Enter in the input to trigger add
    const input = document.getElementById('new-category-input');
    if (input) {
      if (this._boundKeyHandler) {
        input.removeEventListener('keydown', this._boundKeyHandler);
      }
      this._boundKeyHandler = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this._handleAdd();
        }
      };
      input.addEventListener('keydown', this._boundKeyHandler);
    }

    this.render();
  },

  /** @private */
  _boundAddHandler: null,
  /** @private */
  _boundKeyHandler: null,

  /**
   * Handles the "Add Category" button click.
   * Reads the input value, calls CategoryService.addCustom(), surfaces any
   * inline error, and on success triggers a full re-render.
   * @private
   */
  _handleAdd() {
    const input = document.getElementById('new-category-input');
    const errorSpan = document.getElementById('category-error');

    // Clear previous error
    if (errorSpan) {
      errorSpan.textContent = '';
    }
    if (input) {
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
    }

    const name = input ? input.value : '';
    const result = CategoryService.addCustom(name);

    if (!result.ok) {
      // Surface inline validation error
      if (errorSpan) {
        errorSpan.textContent = result.error || 'Invalid category name.';
      }
      if (input) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', 'category-error');
      }
      return;
    }

    // Success — clear the input and re-render
    if (input) {
      input.value = '';
      input.focus();
    }

    this.render();
  },

  /**
   * Re-renders the category list (#category-list) from CategoryService.getAll()
   * and updates the category <select> in #input-form to reflect the current list.
   *
   * For each category renders an <li> with:
   *  - A color swatch <span>
   *  - The category name
   *  - A remove <button data-cat-name="..."> ONLY for non-built-in categories
   *
   * Built-in categories get no remove button (Req 10.11).
   */
  render() {
    this._renderCategoryList();
    this._updateCategorySelect();
  },

  /**
   * Renders the #category-list <ul>.
   * @private
   */
  _renderCategoryList() {
    const listEl = document.getElementById('category-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    const fragment = document.createDocumentFragment();
    const categories = CategoryService.getAll();

    categories.forEach(cat => {
      const li = document.createElement('li');
      li.className = 'category-item';

      // Color swatch
      const swatch = document.createElement('span');
      swatch.className = 'category-swatch';
      swatch.style.backgroundColor = cat.color;
      swatch.setAttribute('aria-hidden', 'true');

      // Category name
      const nameEl = document.createElement('span');
      nameEl.className = 'category-item-name';
      nameEl.textContent = cat.name;

      li.appendChild(swatch);
      li.appendChild(nameEl);

      // Remove button — only for custom (non-built-in) categories (Req 10.11)
      if (!cat.isBuiltIn) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-category-btn';
        removeBtn.dataset.catName = cat.name;
        removeBtn.setAttribute('aria-label', 'Remove category ' + cat.name);
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => this._handleRemove(cat.name));
        li.appendChild(removeBtn);
      }

      fragment.appendChild(li);
    });

    listEl.appendChild(fragment);
  },

  /**
   * Synchronises the category <select> in #input-form with the current
   * list from CategoryService.getAll().
   * Preserves the currently selected value where possible.
   * @private
   */
  _updateCategorySelect() {
    const select = document.getElementById('category');
    if (!select) return;

    // Remember the currently selected value so we can restore it
    const previousValue = select.value;

    // Rebuild options: default placeholder + one per category
    select.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Select a category --';
    select.appendChild(defaultOption);

    CategoryService.getAll().forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.name;
      option.textContent = cat.name;
      select.appendChild(option);
    });

    // Restore previous selection if it still exists in the new list
    if (previousValue) {
      const stillExists = CategoryService.getAll().some(c => c.name === previousValue);
      if (stillExists) {
        select.value = previousValue;
      }
    }
  },

  /**
   * Handles a remove button click for a custom category.
   * Calls CategoryService.removeCustom(), surfaces any inline error, and on
   * success triggers a full re-render of the category list, select, and all
   * transaction UI components.
   *
   * @param {string} catName
   * @private
   */
  _handleRemove(catName) {
    const errorSpan = document.getElementById('category-error');

    // Clear previous error
    if (errorSpan) {
      errorSpan.textContent = '';
    }

    const result = CategoryService.removeCustom(catName);

    if (!result.ok) {
      // Surface inline error in the category manager error span
      if (errorSpan) {
        errorSpan.textContent = result.error || 'Could not remove category.';
      }
      return;
    }

    // Success — re-render category UI and all transaction components
    this.render();

    // Trigger full re-render of transaction components so any orphaned
    // transactions (now referencing a removed category) display correctly
    const txns = TransactionStore.getAll();
    ListRenderer.render(txns);
    BalanceRenderer.render(txns);
    ChartRenderer.render(txns);
  },
};

// ---------------------------------------------------------------------------
// App — bootstrap and initialization (Tasks 12.1, 12.2)
// ---------------------------------------------------------------------------

const App = {
  /**
   * Polls window.Chart every 100 ms until it is available or 10 s have elapsed.
   * @returns {Promise<void>}
   */
  _waitForChart() {
    return new Promise((resolve, reject) => {
      if (typeof window.Chart !== 'undefined') {
        resolve();
        return;
      }
      const POLL_INTERVAL_MS = 100;
      const TIMEOUT_MS = 10_000;
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += POLL_INTERVAL_MS;
        if (typeof window.Chart !== 'undefined') {
          clearInterval(interval);
          resolve();
        } else if (elapsed >= TIMEOUT_MS) {
          clearInterval(interval);
          reject(new Error('Chart.js did not load within 10 seconds.'));
        }
      }, POLL_INTERVAL_MS);
    });
  },

  /**
   * Event-delegated click handler for delete buttons inside #transaction-list.
   * @param {MouseEvent} event
   */
  _handleListClick(event) {
    const btn = event.target.closest('.delete-btn');
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    const confirmed = window.confirm('Are you sure you want to delete this transaction?');
    if (confirmed) {
      TransactionStore.remove(id);
    }
  },

  /**
   * Main bootstrap sequence — called once DOMContentLoaded fires.
   *
   * Step-by-step sequence per Requirements 2.4, 2.5, 6.4, 7.3, 8.3, 8.4:
   *   1. Show #loading-indicator within 500 ms of page load (immediately here).
   *   2. Disable the form's submit button while Chart.js is pending (Req 7.3).
   *   3. Await Chart.js with a 10-second timeout.
   *      - Timeout: show error banner + static message in chart container.
   *      - Success: call ChartRenderer.init(canvasEl).
   *   4. Load persisted transactions from localStorage (Req 6.4).
   *   5. Initial render of list, balance, and chart (or placeholder).
   *   6. Attach FormController submit handler and delegated click handler on list.
   *   7. Re-enable the submit button and hide #loading-indicator.
   */
  async init() {
    // 1. Show loading indicator immediately (Req 8.4 — within 500 ms of page load)
    const loadingEl = document.getElementById('loading-indicator');
    if (loadingEl) {
      loadingEl.innerHTML = '<span class="spinner" aria-hidden="true"></span> Loading\u2026';
    }

    // 2. Disable the submit button while Chart.js CDN is pending (Req 7.3)
    const submitBtn = document.querySelector('#input-form button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
    }

    // 3. Wait for Chart.js, with a 10-second timeout
    let chartLoaded = false;
    try {
      await this._waitForChart();
      chartLoaded = true;
    } catch (e) {
      // Chart.js failed to load within the timeout (Req 7.5)
      NotificationService.showBanner(
        'Chart could not be loaded. Check your internet connection.',
        'error'
      );
      const chartContainer = document.getElementById('chart-container');
      if (chartContainer) {
        const errorMsg = document.createElement('p');
        errorMsg.className = 'chart-error';
        errorMsg.textContent = 'Chart unavailable. Please check your internet connection.';
        chartContainer.innerHTML = '';
        chartContainer.appendChild(errorMsg);
      }
    }

    // 4. Load persisted categories first (must happen before transactions so
    //    isValidTransaction can accept custom category names), then transactions.
    //    Banners for errors/warnings surfaced internally (Req 6.4).
    CategoryService.loadFromStorage();
    TransactionStore.loadFromStorage();
    const txns = TransactionStore.getAll();

    // 5a. Init chart renderer (must happen before ChartRenderer.render)
    if (chartLoaded) {
      const canvasEl = document.getElementById('expense-chart');
      if (canvasEl) {
        ChartRenderer.init(canvasEl);
      }
    }

    // 5b. Initial renders — list and balance always; chart only when Chart.js loaded
    ListRenderer.render(txns);
    BalanceRenderer.render(txns);

    if (chartLoaded) {
      // render() calls showPlaceholder() internally if there are no positive-amount txns
      ChartRenderer.render(txns);
    }
    // If Chart.js is unavailable the chart container already shows the error message.

    // 6. Attach event listeners (after all initial renders are complete)
    FormController.init();

    // Init CategoryManagerUI — renders the category list and syncs the select
    const categoryManagerEl = document.getElementById('category-manager');
    CategoryManagerUI.init(categoryManagerEl);

    // Sync theme toggle button state with the theme already applied by the
    // inline flash-prevention script, and attach the toggle click handler (Task 16.2)
    ThemeService.loadFromStorage();
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => ThemeService.toggle());
    }

    const listEl = document.getElementById('transaction-list');
    if (listEl) {
      listEl.addEventListener('click', (e) => this._handleListClick(e));
    }

    // Wire sort control — change re-renders list only (Req 11.1)
    const sortControl = document.getElementById('sort-control');
    if (sortControl) {
      sortControl.addEventListener('change', (e) => {
        SortController.setMode(/** @type {SortMode} */ (e.target.value));
      });
    }

    // 7. Re-enable the submit button and hide loading indicator
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.removeAttribute('aria-busy');
    }
    if (loadingEl) {
      loadingEl.innerHTML = '';
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
