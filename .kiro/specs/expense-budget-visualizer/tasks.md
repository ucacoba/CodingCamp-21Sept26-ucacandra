# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a fully client-side single-page expense tracker as three files (`index.html`, `css/styles.css`, `js/app.js`) with Chart.js loaded via CDN. Implementation follows the unidirectional data-flow architecture defined in the design: user action → validation → state mutation → storage → render. Tasks are ordered so each step integrates immediately into the running application.

---

## Tasks

- [x] 1. Project scaffolding — create file structure and HTML skeleton
  - Create the directory layout: `index.html` at root, `css/styles.css`, `js/app.js`
  - Write the HTML skeleton with `<head>` meta tags (charset, viewport), title "Expense & Budget Visualizer", and `<link>` to `css/styles.css`
  - Add Chart.js CDN `<script>` tag (with `defer`) and a `<script src="js/app.js" defer>` tag
  - Add top-level layout sections: `#loading-indicator`, `#notification-banner`, `#balance-display`, `#input-form`, `#transaction-list`, `#chart-container` with a `<canvas id="expense-chart">`
  - Add semantic HTML (`<main>`, `<section>`, `<header>`) and ARIA landmark roles for accessibility
  - _Requirements: 7.1, 7.3_

- [x] 2. CSS baseline — layout and responsive design
  - [x] 2.1 Write CSS reset, custom properties (color palette, spacing), and base typography
    - Define CSS variables for category colors (`--color-food: #FF6384`, `--color-transport: #36A2EB`, `--color-fun: #FFCE56`) and neutral tokens
    - _Requirements: 7.4_

  - [x] 2.2 Implement responsive layout
    - Build a single-column layout using CSS Grid or Flexbox that adapts from 320 px to 1920 px without horizontal overflow or clipped content
    - Style `#transaction-list` with `overflow-y: auto` and a max-height so it scrolls when entries exceed the visible area
    - _Requirements: 2.2, 7.4_

  - [x] 2.3 Write visual-regression smoke tests for responsive breakpoints
    - Manually verify (or via Playwright screenshot) that layout is correct at 320 px, 768 px, 1280 px, and 1920 px
    - _Requirements: 7.4_

- [x] 3. `StorageService` — localStorage abstraction
  - [x] 3.1 Implement `StorageService.load()`, `save()`, and `clear()`
    - `load()`: reads `'expense_tracker_transactions'` key, `JSON.parse`s it, validates each entry's schema (id: string, name: string, amount: number, category: valid enum, timestamp: number), discards malformed entries, returns valid `Transaction[]`; returns `[]` and sets an internal `lastError` on any exception
    - `save(txns)`: `JSON.stringify`s the array and writes it; throws a `StorageError { type, message }` on failure
    - `clear()`: removes the key
    - _Requirements: 6.1, 6.2, 6.5, 6.6_

  - [ ]* 3.2 Write property test for malformed data filtering (Property 10)
    - **Property 10: Malformed data filtering**
    - **Validates: Requirements 6.6**
    - Use fast-check: generate arrays mixing valid `Transaction` objects with arbitrary malformed objects; assert `StorageService.load()` returns only valid entries and never throws
    - _Requirements: 6.6_

  - [ ]* 3.3 Write unit tests for `StorageService`
    - Mock `localStorage` to test save/load/clear happy paths and failure cases (quota exceeded, `getItem` throws, corrupted JSON)
    - _Requirements: 6.1, 6.2, 6.5, 6.6_

- [ ] 4. `Validator` — pure input validation
  - [x] 4.1 Implement `Validator.validateName()`, `validateAmount()`, `validateCategory()`, and `validateTransaction()`
    - `validateName(name)`: returns `{ valid: false, error: '...' }` when empty or length > 100; otherwise `{ valid: true }`
    - `validateAmount(amount)`: returns error when not a number, ≤ 0, or > 999,999,999.99; otherwise `{ valid: true }`
    - `validateCategory(cat)`: returns error when not one of `'Food' | 'Transport' | 'Fun'`; otherwise `{ valid: true }`
    - `validateTransaction()`: calls all three and returns the full `ValidationResult[]`
    - _Requirements: 1.2, 1.3, 1.4, 1.6_

  - [ ]* 4.2 Write property test for invalid input rejection (Property 2)
    - **Property 2: Invalid input rejection**
    - **Validates: Requirements 1.3, 1.4, 1.6**
    - Use fast-check: generate triples where at least one field is invalid; assert `validateTransaction()` always returns at least one `{ valid: false }` result
    - _Requirements: 1.3, 1.4, 1.6_

  - [ ]* 4.3 Write unit tests for `Validator`
    - Cover each invalid input class: empty name, name = 101 chars, amount = 0, amount = -1, amount = 1e9, no category, all valid
    - _Requirements: 1.2, 1.3, 1.4, 1.6_

- [x] 5. `NotificationService` — banner and inline error display
  - [x] 5.1 Implement `NotificationService.showBanner()`, `hideBanner()`, `showFieldError()`, and `clearFieldErrors()`
    - `showBanner(message, type)`: injects a dismissible banner into `#notification-banner`; `type` maps to a CSS modifier class (`warning`, `error`, `info`)
    - `showFieldError(fieldId, message)`: inserts an inline `<span>` error beneath the identified field
    - `clearFieldErrors()`: removes all inline error spans
    - Banners are dismissible via a close button and are non-blocking (do not prevent app interaction)
    - _Requirements: 1.3, 1.4, 1.6, 3.5, 6.5, 6.6, 7.3, 8.5_

  - [ ]* 5.2 Write unit tests for `NotificationService`
    - Test banner appears/disappears with correct CSS class; test inline error injection and clearing
    - _Requirements: 1.3, 6.5_

- [x] 6. `BalanceRenderer` — total balance display
  - [x] 6.1 Implement `BalanceRenderer.render(transactions)`
    - Compute `sum = transactions.reduce((acc, tx) => acc + tx.amount, 0)`
    - Format to exactly 2 decimal places with `$` prefix and write to `#balance-display`
    - Render `$0.00` when array is empty
    - _Requirements: 4.1, 4.4, 4.5_

  - [ ]* 6.2 Write property test for balance calculation correctness (Property 5)
    - **Property 5: Balance calculation correctness**
    - **Validates: Requirements 4.1, 4.4, 4.5**
    - Use fast-check: generate arbitrary arrays of floats within the amount domain including negatives; assert rendered balance equals algebraic sum rounded to 2 dp and equals `$0.00` for empty arrays
    - _Requirements: 4.1, 4.4, 4.5_

  - [ ]* 6.3 Write unit tests for `BalanceRenderer`
    - Test 0 transactions → `$0.00`; all positive; mixed positive/negative; floating-point edge cases (0.1 + 0.2)
    - _Requirements: 4.1, 4.4, 4.5_

- [x] 7. `ListRenderer` — transaction list DOM rendering
  - [x] 7.1 Implement `ListRenderer.render(transactions)`
    - Sort input array by `timestamp` descending before rendering
    - For each transaction generate an `<li>` containing: item name (max 100 chars display), amount as `$X.XX`, category badge `<span>`, and a delete `<button data-id="...">` with accessible label
    - When array is empty, render a single `<li>` "no transactions" placeholder message
    - _Requirements: 2.1, 2.3, 2.6, 3.1_

  - [ ]* 7.2 Write property test for transaction list rendering completeness (Property 3)
    - **Property 3: Transaction list rendering completeness**
    - **Validates: Requirements 2.1, 3.1**
    - Use fast-check: generate arbitrary non-empty arrays of valid `Transaction` objects; assert every transaction has a corresponding `<li>` with name, `$X.XX` amount, category, and a delete button whose `data-id` matches
    - _Requirements: 2.1, 3.1_

  - [ ]* 7.3 Write property test for reverse-chronological ordering (Property 4)
    - **Property 4: Reverse-chronological ordering**
    - **Validates: Requirements 2.3**
    - Use fast-check: generate arrays of `Transaction` objects with distinct timestamps; assert rendered `<li>` order matches descending timestamp sort
    - _Requirements: 2.3_

  - [ ]* 7.4 Write unit tests for `ListRenderer`
    - Test empty list shows placeholder; test list with items renders all fields; test delete button `data-id` matches transaction id
    - _Requirements: 2.1, 2.6, 3.1_

- [x] 8. `ChartRenderer` — Chart.js pie chart integration
  - [x] 8.1 Implement `ChartRenderer.init(canvasEl)` and `ChartRenderer.render(transactions)`
    - `init()`: create a Chart.js `'doughnut'`/`'pie'` instance on the provided canvas
    - `render()`: aggregate positive-amount totals per category; update `chart.data.datasets[0].data` and call `chart.update()`; use the static `CATEGORY_COLORS` map for segment colors; include one legend entry per active category
    - Only include segments for categories with at least one positive-amount transaction; percentages are `(cat_total / grand_total) × 100` rounded to 2 dp
    - _Requirements: 5.1, 5.4, 5.5_

  - [x] 8.2 Implement `ChartRenderer.showPlaceholder()`
    - Destroy the chart instance if it exists and render a text message "No spending data available" in the chart container
    - _Requirements: 5.6_

  - [ ]* 8.3 Write property test for pie chart proportion accuracy (Property 6)
    - **Property 6: Pie chart proportion accuracy**
    - **Validates: Requirements 5.1**
    - Use fast-check: generate arbitrary arrays of positive-amount transactions across 1–3 categories; assert each category's computed percentage equals `(cat_total / grand_total) × 100` rounded to 2 dp and all percentages sum to 100.00 (±0.01 rounding tolerance)
    - _Requirements: 5.1_

  - [ ]* 8.4 Write property test for distinct category colors (Property 7)
    - **Property 7: Distinct category colors**
    - **Validates: Requirements 5.4**
    - Assert that all values in `CATEGORY_COLORS` are unique strings — a static check run once
    - _Requirements: 5.4_

  - [ ]* 8.5 Write property test for legend deduplication (Property 8)
    - **Property 8: Legend deduplication**
    - **Validates: Requirements 5.5**
    - Use fast-check: generate arrays with varying category distribution; assert chart legend has exactly one entry per category that has at least one transaction
    - _Requirements: 5.5_

  - [ ]* 8.6 Write unit tests for `ChartRenderer`
    - Test placeholder rendered when no transactions; test chart data matches category totals for a known input; test `showPlaceholder()` destroys existing chart instance
    - _Requirements: 5.1, 5.6_

- [x] 9. `TransactionStore` — in-memory state and coordination
  - [x] 9.1 Implement `TransactionStore.getAll()`, `add(tx)`, `remove(id)`, and `loadFromStorage()`
    - `add(tx)`: appends transaction to in-memory array, calls `StorageService.save()`, catches `StorageError` and surfaces it via `NotificationService.showBanner()`, then calls all three renderers (list, balance, chart)
    - `remove(id)`: if `StorageService.save()` throws, show banner and abort — do NOT remove from in-memory array (Req 3.5); otherwise filter array and re-render
    - `loadFromStorage()`: calls `StorageService.load()`; if it returned warnings (malformed entries), calls `NotificationService.showBanner()`; returns `{ ok, warnings }`
    - _Requirements: 3.3, 3.4, 3.5, 6.1, 6.2, 6.5_

  - [ ]* 9.2 Write property test for valid transaction creation (Property 1)
    - **Property 1: Valid transaction creation**
    - **Validates: Requirements 1.2**
    - Use fast-check: generate valid (name ≤ 100 chars, non-empty; amount in [0.01, 999999999.99]; category in enum) triples; assert `TransactionStore.add()` causes `getAll().length` to increase by exactly 1 and the new entry is present
    - _Requirements: 1.2_

  - [ ]* 9.3 Write unit tests for `TransactionStore`
    - Test `add()` persists to storage and triggers render; test `remove()` with storage failure retains transaction; test `loadFromStorage()` propagates malformed-data warning
    - _Requirements: 3.3, 3.5, 6.5_

- [x] 10. `FormController` — form submission and validation wiring
  - [x] 10.1 Implement `FormController` submit handler
    - On `#input-form` submit: prevent default, call `NotificationService.clearFieldErrors()`, call `Validator.validateTransaction()` with field values
    - If any `ValidationResult.valid === false`: call `NotificationService.showFieldError()` for each invalid field and return without creating a transaction
    - If all valid: build a `Transaction` object (`id` via `crypto.randomUUID()` with `Date.now()` fallback, `timestamp: Date.now()`), call `TransactionStore.add()`, reset form fields to empty / unselected default
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 10.2 Write property test for transaction serialization round-trip (Property 9)
    - **Property 9: Transaction serialization round-trip**
    - **Validates: Requirements 6.1**
    - Use fast-check: generate arbitrary valid `Transaction` objects; assert `JSON.parse(JSON.stringify(tx))` is deep-equal to the original
    - _Requirements: 6.1_

  - [ ]* 10.3 Write unit tests for `FormController`
    - Test successful submission resets all form fields; test each validation failure shows correct inline error and does not create a transaction
    - _Requirements: 1.2, 1.3, 1.5_

- [x] 11. Checkpoint — verify core data flow end-to-end
  - Ensure all tests pass, ask the user if questions arise.
  - At this point: adding a transaction should update the list, balance, and chart; deleting should reverse all three; localStorage should persist across simulated page reloads.

- [x] 12. `App` bootstrap — initialization and Chart.js CDN handling
  - [x] 12.1 Implement the `DOMContentLoaded` bootstrap sequence
    - Show `#loading-indicator` immediately
    - Wait for Chart.js to load: poll `window.Chart` every 100 ms, resolve when available, reject after 10 seconds
    - On Chart.js timeout: call `NotificationService.showBanner('Chart could not be loaded. Check your internet connection.', 'error')` and display a static error message in `#chart-container`; enable the rest of the app
    - On Chart.js load: call `ChartRenderer.init(canvasEl)`
    - Call `TransactionStore.loadFromStorage()`; surface any warnings via `NotificationService`
    - Initial render: `ListRenderer.render()`, `BalanceRenderer.render()`, `ChartRenderer.render()` (or `showPlaceholder()` if no transactions)
    - Attach `FormController` submit handler and event-delegated click handler on `#transaction-list` for delete buttons
    - Hide `#loading-indicator`
    - _Requirements: 2.4, 2.5, 6.4, 7.3, 8.3, 8.4_

  - [x] 12.2 Implement delete confirmation and delete flow
    - On click of a delete button: show a `window.confirm()` prompt (or a custom modal) for explicit user confirmation (Req 3.2)
    - On confirmation: call `TransactionStore.remove(id)` (which handles storage error and re-render internally)
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [ ]* 12.3 Write unit tests for `App` bootstrap
    - Test loading indicator is shown then hidden; test Chart.js timeout triggers error banner; test `loadFromStorage()` warnings are surfaced
    - _Requirements: 7.3, 8.3_

- [x] 13. CSS polish — visual design and component styling
  - [x] 13.1 Style the input form
    - Style `#input-form` fields, labels, submit button with focus rings (WCAG 2.1 AA visible focus); style inline validation error spans (red text, error icon)
    - _Requirements: 1.1, 1.3_

  - [x] 13.2 Style the transaction list and category badges
    - Style `#transaction-list` items with item name, `$X.XX` amount, category badge (using category CSS variables for badge background), and delete button
    - Apply truncation (`text-overflow: ellipsis`) for long item names
    - _Requirements: 2.1, 2.2_

  - [x] 13.3 Style the balance display, chart container, notification banner, and loading indicator
    - Make `#balance-display` visually prominent (large font, top of page)
    - Style `#notification-banner` as a dismissible strip with type-based color (`warning` = amber, `error` = red, `info` = blue)
    - Style `#loading-indicator` as a centered spinner
    - _Requirements: 4.1, 7.3, 8.3_

- [x] 14. Performance and timing validation
  - [x] 14.1 Verify 200 ms update budget with 1,000 transactions
    - Write a script (or browser DevTools snippet) that seeds `localStorage` with 1,000 valid transactions, loads the app, and measures form-submit and delete response times using `performance.now()`; assert both are under 200 ms
    - _Requirements: 8.1, 8.2_

  - [x] 14.2 Verify 2-second initial load with 1,000 persisted transactions
    - Measure time from `DOMContentLoaded` to final render completion with 1,000 pre-seeded transactions; confirm ≤ 2 s on a standard broadband connection; confirm loading indicator appears within 500 ms if load exceeds 2 s
    - _Requirements: 8.3, 8.4_

- [x] 15. Final checkpoint — full integration and cross-browser verification
  - Ensure all tests pass, ask the user if questions arise.
  - Manually verify in Chrome, Firefox, Edge, and Safari: no console errors, all UI interactions produce expected outputs, viewport renders correctly at 320 px and 1920 px.
  - _Requirements: 7.2, 7.4_

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use [fast-check](https://fast-check.dev/) with a minimum of 100 iterations each
- Checkpoints (Tasks 11 and 15) ensure incremental integration is validated before proceeding
- `TransactionStore.remove()` has a deliberate "abort on storage failure" contract — do not optimistically update the DOM before the storage write succeeds
- The app must remain functional even when Chart.js CDN fails (chart area shows error; form and list still work)

- [x] 16. Dark/Light mode toggle — `ThemeService` and header layout
  - [x] 16.1 Add inline flash-prevention script and HTML structure
    - In `<head>`, add an inline `<script>` that reads `localStorage.getItem('expense_tracker_theme')` and sets `document.documentElement.setAttribute('data-theme', theme || 'light')` before any CSS renders
    - Update `<header>` to use `display: flex; justify-content: space-between; align-items: center` so the app title is left-aligned and the toggle button is right-aligned
    - Add a `<button id="theme-toggle">` with a moon icon (🌙) as initial inner text and `aria-label="Switch to dark mode"`
    - _Requirements: 9.1, 9.5, 9.7_

  - [x] 16.2 Implement `ThemeService`
    - `getTheme()`: returns `document.documentElement.getAttribute('data-theme') || 'light'`
    - `setTheme(theme)`: sets `data-theme` attribute on `<html>`, updates the toggle button icon and `aria-label`, writes to `localStorage.setItem('expense_tracker_theme', theme)` — catches storage errors and shows a banner via `NotificationService`
    - `toggle()`: reads current theme, flips it, calls `setTheme()`
    - `loadFromStorage()`: reads `localStorage.getItem('expense_tracker_theme')`, calls `setTheme()` with the result (defaults to `'light'` if absent)
    - Attach click handler on `#theme-toggle` to call `ThemeService.toggle()`
    - _Requirements: 9.2, 9.3, 9.4, 9.6, 9.7, 9.8_

  - [x] 16.3 Add dark-mode CSS custom properties
    - Define light-mode defaults as CSS custom properties on `:root` (background, surface, text, border, etc.)
    - Override them under `[data-theme="dark"]` selector: dark backgrounds, light text, adjusted component surface colors
    - Ensure all existing UI components (form, list, chart container, balance display, notification banner) respect the CSS variables
    - _Requirements: 9.2, 9.3_

  - [ ]* 16.4 Write property test for theme persistence round-trip (Property 11)
    - **Property 11: Theme persistence round-trip**
    - **Validates: Requirement 9.4**
    - Use fast-check: for any theme in {'light', 'dark'}, call `ThemeService.setTheme(value)` and assert `localStorage.getItem('expense_tracker_theme') === value` and `ThemeService.getTheme() === value`
    - _Requirements: 9.4_

  - [ ]* 16.5 Write unit tests for `ThemeService`
    - Test `setTheme('dark')` sets `data-theme="dark"` on `<html>` and writes `'dark'` to localStorage
    - Test `toggle()` flips between modes
    - Test `loadFromStorage()` reads saved preference and defaults to `'light'` when key absent
    - Test storage failure shows banner and applies theme to current session
    - _Requirements: 9.2, 9.4, 9.6, 9.8_

- [x] 17. `CategoryService` — category data management
  - [x] 17.1 Implement `CategoryService`
    - Define built-in categories array: `[{name:'Food', color:'#FF6384', isBuiltIn:true}, {name:'Transport', color:'#36A2EB', isBuiltIn:true}, {name:'Fun', color:'#FFCE56', isBuiltIn:true}]`
    - Define `EXTENDED_PALETTE` array of 10 colors: `['#4BC0C0','#9966FF','#FF9F40','#C9CBCF','#7CFC00','#DC143C','#00CED1','#FF69B4','#8A2BE2','#FFA500']`
    - `getAll()`: returns built-ins first, then custom categories sorted alphabetically
    - `getColor(name)`: returns hex color for any category name
    - `addCustom(name)`: validates (1–50 chars, case-insensitive no-duplicate); assigns next color from `EXTENDED_PALETTE`; calls `save()`; returns `{ok, error?}`
    - `removeCustom(name)`: rejects built-ins; rejects if any transaction in `TransactionStore.getAll()` references it; calls `save()`; returns `{ok, error?}`
    - `loadFromStorage()`: reads `'expense_tracker_categories'` key, parses and validates entries, populates custom categories array
    - `save()`: writes only custom categories to `'expense_tracker_categories'`; catches errors and shows banner
    - _Requirements: 10.2, 10.3, 10.4, 10.6, 10.9, 10.10, 10.11, 10.12_

  - [x] 17.2 Update `Validator.validateCategory()` to use `CategoryService`
    - Change `validateCategory(cat)` from checking against the hardcoded `['Food','Transport','Fun']` set to checking against `CategoryService.getAll().map(c => c.name)`
    - _Requirements: 10.5_

  - [x] 17.3 Update `ChartRenderer.render()` to use `CategoryService.getColor()`
    - Replace all `CATEGORY_COLORS[cat]` lookups with `CategoryService.getColor(cat)` so custom category segments get their assigned colors
    - _Requirements: 10.7_

  - [ ]* 17.4 Write property test for custom category uniqueness (Property 12)
    - **Property 12: Custom category uniqueness**
    - **Validates: Requirement 10.4**
    - Use fast-check: generate arbitrary sequences of category name strings (some duplicates); assert `CategoryService.getAll()` never contains two entries with the same name under case-insensitive comparison
    - _Requirements: 10.4_

  - [ ]* 17.5 Write unit tests for `CategoryService`
    - Test `addCustom()` rejects empty name, name > 50 chars, case-insensitive duplicate
    - Test `removeCustom()` rejects built-in names and names referenced by transactions
    - Test `getAll()` returns built-ins first then custom alphabetically
    - Test colors auto-assigned from `EXTENDED_PALETTE` in order
    - Test `loadFromStorage()` restores custom categories
    - _Requirements: 10.2, 10.3, 10.4, 10.6, 10.9, 10.10, 10.11_

- [x] 18. `CategoryManagerUI` — custom category management interface
  - [x] 18.1 Add category manager HTML and wire `CategoryManagerUI`
    - Add a `<section id="category-manager">` in `index.html` with: a text `<input id="new-category-input">`, an "Add Category" `<button id="add-category-btn">`, an inline error `<span id="category-error">`, and an empty `<ul id="category-list">` for the category list
    - Implement `CategoryManagerUI.init(containerEl)`: attaches submit handler on "Add Category" button; calls `CategoryManagerUI.render()` on init
    - Implement `CategoryManagerUI.render()`: iterates `CategoryService.getAll()`; for each category renders an `<li>` with a color swatch and name; adds a remove `<button data-cat-name="...">` only for non-built-in categories; updates the category `<select>` in `#input-form` to reflect the current list
    - _Requirements: 10.1, 10.5, 10.8, 10.11_

  - [x] 18.2 Wire add and remove flows in `CategoryManagerUI`
    - On "Add Category" submit: call `CategoryService.addCustom(name)`; on error surface inline error via `#category-error`; on success call `CategoryManagerUI.render()` (which also updates the `<select>`)
    - On remove button click: call `CategoryService.removeCustom(catName)`; on error surface inline error; on success call `CategoryManagerUI.render()` and trigger full re-render of `ListRenderer`, `BalanceRenderer`, `ChartRenderer`
    - Clear `#category-error` on each new submission attempt
    - _Requirements: 10.2, 10.3, 10.4, 10.9, 10.10_

  - [ ]* 18.3 Write unit tests for `CategoryManagerUI`
    - Test built-in categories render without remove button
    - Test custom categories render with remove button
    - Test inline error shown on duplicate submission
    - Test category `<select>` in input form updates after add/remove
    - _Requirements: 10.1, 10.5, 10.8, 10.11_

- [x] 19. `SortController` — transaction list sort control
  - [x] 19.1 Add sort control HTML and implement `SortController`
    - Add a `<select id="sort-control">` above `#transaction-list` in `index.html` with options:
      - value `"date-desc"`: "Newest First (Default)"
      - value `"amount-asc"`: "Amount: Low to High"
      - value `"amount-desc"`: "Amount: High to Low"
      - value `"category-asc"`: "Category: A → Z"
      - value `"category-desc"`: "Category: Z → A"
    - Implement `SortController.getMode()`: returns current active `SortMode` (default `'date-desc'`)
    - Implement `SortController.setMode(mode)`: sets active mode, calls `ListRenderer.render(TransactionStore.getAll())`
    - Attach `change` event listener on `#sort-control` to call `SortController.setMode(event.target.value)`
    - _Requirements: 11.1, 11.2_

  - [x] 19.2 Update `ListRenderer.render()` to apply sort
    - At the top of `render(transactions)`, create a shallow copy of the input array and sort it according to `SortController.getMode()`
    - Sort predicates:
      - `'date-desc'`: `b.timestamp - a.timestamp`
      - `'amount-asc'`: `a.amount - b.amount` (tie-break: `b.timestamp - a.timestamp`)
      - `'amount-desc'`: `b.amount - a.amount` (tie-break: `b.timestamp - a.timestamp`)
      - `'category-asc'`: `a.category.localeCompare(b.category)` (tie-break: `b.timestamp - a.timestamp`)
      - `'category-desc'`: `b.category.localeCompare(a.category)` (tie-break: `b.timestamp - a.timestamp`)
    - Never mutate the input array — sort a copy only
    - _Requirements: 11.3, 11.4, 11.5, 11.6, 11.7, 11.9, 11.10_

  - [x] 19.3 Ensure add/delete operations preserve active sort mode
    - Verify that after `TransactionStore.add()` and `TransactionStore.remove()`, `ListRenderer.render()` is called (which already reads `SortController.getMode()`), so the list re-renders in the currently selected order
    - _Requirements: 11.8_

  - [ ]* 19.4 Write property test for sort correctness (Property 13)
    - **Property 13: Sort correctness**
    - **Validates: Requirements 11.3–11.7, 11.10**
    - Use fast-check: generate arbitrary Transaction arrays × arbitrary SortMode; assert the sorted output is a permutation of the input AND satisfies the ordering predicate for that mode, with ties broken by timestamp descending
    - _Requirements: 11.3, 11.4, 11.5, 11.6, 11.7, 11.10_

  - [ ]* 19.5 Write unit tests for `SortController`
    - Test default mode is `'date-desc'`
    - Test `setMode()` updates the mode and triggers list re-render
    - Test each mode against a small known dataset with known expected order
    - Test tie-breaking by timestamp descending for amount and category modes
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.10_

- [x] 20. Final integration checkpoint — verify all three new features end-to-end
  - Verify dark/light toggle works, persists on reload, and applies without flash
  - Verify custom categories appear in dropdown, chart, and are persisted; verify built-ins cannot be deleted
  - Verify sorting changes the list order without affecting balance or chart, and that add/delete respects current sort mode
  - _Requirements: 9.1–9.8, 10.1–10.12, 11.1–11.10_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1"] },
    { "id": 1, "tasks": ["2.2", "3.1"] },
    { "id": 2, "tasks": ["2.3", "3.2", "3.3", "4.1", "5.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "5.2", "6.1"] },
    { "id": 4, "tasks": ["6.2", "6.3", "7.1"] },
    { "id": 5, "tasks": ["7.2", "7.3", "7.4", "8.1"] },
    { "id": 6, "tasks": ["8.2", "8.3", "8.4", "8.5", "8.6", "9.1"] },
    { "id": 7, "tasks": ["9.2", "9.3", "10.1"] },
    { "id": 8, "tasks": ["10.2", "10.3", "12.1"] },
    { "id": 9, "tasks": ["12.2", "12.3", "13.1"] },
    { "id": 10, "tasks": ["13.2", "13.3"] },
    { "id": 11, "tasks": ["14.1", "14.2"] },
    { "id": 12, "tasks": ["16.1", "16.3", "17.1"] },
    { "id": 13, "tasks": ["16.2", "17.2", "17.3", "18.1", "19.1"] },
    { "id": 14, "tasks": ["16.4", "16.5", "17.4", "17.5", "18.2", "19.2"] },
    { "id": 15, "tasks": ["18.3", "19.3", "19.4", "19.5"] },
    { "id": 16, "tasks": ["20"] }
  ]
}
```
