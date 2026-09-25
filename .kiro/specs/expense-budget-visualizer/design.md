# Design Document: Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a fully client-side single-page application (SPA) built with plain HTML, CSS, and vanilla JavaScript — no build tools, no frameworks, no backend. Users record named expense transactions with amounts and categories, and the app presents a running total balance alongside a live pie chart of spending by category. All data persists in the browser's `localStorage`.

The app is delivered as three files:

```
index.html
css/
  styles.css
js/
  app.js
```

`index.html` references `css/styles.css` and `js/app.js` as relative paths. Chart.js is loaded via CDN. No build step is required; opening `index.html` directly in a modern browser is sufficient.

---

## Architecture

The application follows a unidirectional data-flow pattern inside a single JS module (`app.js`):

```
User Action
     │
     ▼
Event Handler  ──► Validation Layer
     │                    │ (invalid)
     │ (valid)            ▼
     ▼              UI Error Display
State Mutation
     │
     ▼
Storage Layer (localStorage)
     │
     ▼
Render Layer  ──► DOM Update (Transaction List, Balance, Pie Chart)
```

There is no framework — state is held in a plain in-memory JavaScript array (`transactions`). Every mutation (add, delete) immediately writes to `localStorage` and then synchronously re-renders all dependent UI components. This keeps the render cycle simple and ensures the 200 ms responsiveness budget is met.

### Key Design Decisions

- **No reactive framework**: With at most 1,000 transactions and three UI components, full re-render on every state change is well within the 200 ms budget. Avoiding a framework keeps the file count and complexity minimal.
- **Synchronous render after every mutation**: Eliminates the possibility of UI/state drift. Timers or debouncing are not needed.
- **localStorage as the only persistence layer**: The requirements explicitly prohibit a backend. All persistence is `JSON.stringify` / `JSON.parse` around a single `localStorage` key.
- **Chart.js via CDN**: Provides a production-quality pie chart without a build step. The app defers input until Chart.js is confirmed loaded and shows a loading indicator in the interim.
- **Theme applied before first paint**: An inline `<script>` in `<head>` reads the stored theme and sets `data-theme` on `<html>` before any CSS paint, preventing a flash of the wrong theme.
- **`CATEGORY_COLORS` replaced by `CategoryService.getColor()`**: Centralizes color assignment so both built-in and custom categories are handled uniformly across `ChartRenderer` and `CategoryManagerUI`.
- **Sort is display-only**: `SortController` never mutates `localStorage` or the in-memory array — it applies a sort to a shallow copy at render time only, keeping the storage and memory state canonical.

---

## Components and Interfaces

### 1. `StorageService`

Responsible for all `localStorage` interactions. Isolated so that failures are caught and propagated cleanly.

```js
StorageService = {
  load()        → Transaction[]  // reads + parses JSON; returns [] on failure
  save(txns)    → void           // serializes + writes; throws StorageError on failure
  clear()       → void           // removes the storage key
}
```

Errors are represented as a plain `StorageError` object `{ type: 'unavailable' | 'corrupt', message: string }`.

### 2. `TransactionStore`

In-memory state container. Wraps the `transactions` array and exposes atomic mutation methods. Coordinates with `StorageService` after every mutation.

```js
TransactionStore = {
  getAll()        → Transaction[]
  add(tx)         → void           // appends, persists, triggers render
  remove(id)      → void           // filters, persists, triggers render
  loadFromStorage() → { ok: boolean, warnings: string[] }
}
```

### 3. `Validator`

Pure functions — no side effects, no DOM access. Used by the form handler and independently testable.

```js
Validator = {
  validateName(name)     → ValidationResult
  validateAmount(amount) → ValidationResult
  validateCategory(cat)  → ValidationResult
  validateTransaction(name, amount, category) → ValidationResult[]
}

ValidationResult = { valid: boolean, error?: string }
```

### 4. `FormController`

Handles the `submit` event on `#input-form`. Calls `Validator`, shows/clears inline errors, calls `TransactionStore.add()` on valid input, and resets the form.

### 5. `ListRenderer`

Renders the `Transaction_List` DOM from the current `TransactionStore` state. Called after every state mutation.

```js
ListRenderer.render(transactions: Transaction[]) → void
```

Generates one `<li>` per transaction containing: item name, formatted amount (`$X.XX`), category badge, and a delete button with `data-id` attribute.

### 6. `BalanceRenderer`

Pure display update — recomputes and writes the total balance string.

```js
BalanceRenderer.render(transactions: Transaction[]) → void
```

### 7. `ChartRenderer`

Owns the Chart.js instance. On each call, aggregates category totals and calls `chart.update()` (or `chart.destroy()` + recreate on first render).

```js
ChartRenderer = {
  init(canvasEl)                      → void
  render(transactions: Transaction[]) → void
  showPlaceholder()                   → void
}
```

### 8. `NotificationService`

Displays non-blocking warning banners and inline error messages. Centralized so all error paths share consistent UX.

```js
NotificationService = {
  showBanner(message, type)  → void  // type: 'warning' | 'error' | 'info'
  hideBanner()               → void
  showFieldError(fieldId, message) → void
  clearFieldErrors()         → void
}
```

### 9. `ThemeService`

Manages the active theme state and persists the user's preference to `localStorage`. Applied to the DOM by toggling a `data-theme="dark"` attribute on the `<html>` element; all color tokens are driven by CSS custom properties scoped to `[data-theme="dark"]`.

```js
ThemeService = {
  getTheme()              → 'light' | 'dark'
  setTheme(theme)         → void    // writes to localStorage + updates <html> attribute
  toggle()                → void    // flips between 'light' and 'dark'
  loadFromStorage()       → void    // reads preference before first paint
}
```

**Flash prevention**: An inline `<script>` in `<head>` (before any CSS is applied) calls `ThemeService.loadFromStorage()` so the correct `data-theme` attribute is set before the browser renders any visible content. This eliminates the flash-of-non-preferred-theme.

**Toggle button**: Rendered inside `<header>` with `display: flex; justify-content: space-between` so the app title is left-aligned and the button is right-aligned. The button displays a moon icon (🌙) in light mode and a sun icon (☀️) in dark mode, and carries an `aria-label` of `"Switch to dark mode"` / `"Switch to light mode"` respectively.

**Persistence key**: `'expense_tracker_theme'` — stores the string `'light'` or `'dark'`.

---

### 10. `CategoryService`

Manages the complete list of categories — the three hardcoded built-ins plus any user-defined custom categories. Replaces the static `CATEGORY_COLORS` constant. `Validator.validateCategory()` and `ChartRenderer` both delegate to this service.

```js
CategoryService = {
  getAll()              → Category[]               // built-ins first, then custom, alphabetical
  addCustom(name)       → { ok: boolean, error?: string }
  removeCustom(name)    → { ok: boolean, error?: string }
  getColor(name)        → string                   // hex color for a category
  loadFromStorage()     → void
  save()                → void                     // persists only custom categories
}

Category = {
  name:      string,
  color:     string,    // CSS hex color
  isBuiltIn: boolean
}
```

**Built-in categories** (hardcoded, always present, not stored, cannot be removed):

| Name | Color |
|---|---|
| Food | `#FF6384` |
| Transport | `#36A2EB` |
| Fun | `#FFCE56` |

**Extended color palette** for custom categories (auto-assigned in order; all distinct from built-in colors):

```js
const EXTENDED_PALETTE = [
  '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7CFC00',
  '#DC143C', '#00CED1', '#FF69B4', '#8A2BE2', '#FFA500',
];
```

The color at index `(customCategories.length % EXTENDED_PALETTE.length)` is assigned when a new custom category is added, guaranteeing cycling without repetition for the first 10 custom categories.

**Validation on `addCustom(name)`**:
- Name must be 1–50 characters (trimmed).
- Name must not duplicate any existing built-in or custom category name (case-insensitive).
- Returns `{ ok: false, error: '...' }` on violation; `{ ok: true }` on success.

**Validation on `removeCustom(name)`**:
- Built-in categories cannot be removed.
- A custom category cannot be removed if any transaction in `TransactionStore` references it.
- Returns `{ ok: false, error: '...' }` on violation; `{ ok: true }` on success.

**Persistence key**: `'expense_tracker_categories'` — stores a JSON array of custom `Category` objects only; built-ins are never written to storage.

---

### 11. `CategoryManagerUI`

Renders the custom category management interface as a self-contained DOM section. Wired to `CategoryService` for all data operations.

```js
CategoryManagerUI = {
  init(containerEl)  → void   // attaches the form and list to the given container
  render()           → void   // re-renders the category list from CategoryService.getAll()
}
```

**Rendered structure** (inside the container element):
- A text `<input>` for the new category name + an "Add" `<button>`.
- Inline validation error `<span>` beneath the input (reuses `.field-error` CSS class).
- A list of all categories: built-ins shown with a color swatch but **no** remove button; custom categories shown with a color swatch **and** a remove `<button>`.

On "Add" submission: calls `CategoryService.addCustom()`, surfaces any error inline, on success calls `render()` and also updates the category `<select>` in `#input-form`.

On "Remove" click: calls `CategoryService.removeCustom()`, surfaces any error inline, on success calls `render()`, updates the category `<select>`, and triggers a full re-render of `ListRenderer`, `BalanceRenderer`, and `ChartRenderer` (the removed category's transactions are now orphaned — the UX decision is to display them with their original category label still intact, but the category is removed from the selector going forward).

---

### 12. `SortController`

Manages the active sort mode for the transaction list. Sort is a **display-only** operation — it never touches `localStorage` or the in-memory `Transaction` array order.

```js
SortController = {
  getMode()       → SortMode
  setMode(mode)   → void     // updates active mode and re-renders the list
}

SortMode = 'date-desc' | 'amount-asc' | 'amount-desc' | 'category-asc' | 'category-desc'
```

**Default mode**: `'date-desc'` (reverse-chronological — preserves existing behavior).

**Sort predicates**:

| Mode | Primary key | Secondary key |
|---|---|---|
| `date-desc` | `timestamp` descending | — (timestamps are unique) |
| `amount-asc` | `amount` ascending | `timestamp` descending |
| `amount-desc` | `amount` descending | `timestamp` descending |
| `category-asc` | `category` A→Z | `timestamp` descending |
| `category-desc` | `category` Z→A | `timestamp` descending |

**Sort control**: A `<select>` dropdown rendered immediately above `#transaction-list`. Changing the selection calls `SortController.setMode()`, which calls `ListRenderer.render(TransactionStore.getAll())`. Balance and chart are **not** re-rendered on sort change.

**Integration with `ListRenderer.render()`**: `ListRenderer` delegates to `SortController.getMode()` to determine the sort order before rendering. The sort is applied to a shallow copy of the input array — the original array is never mutated.

---

### 13. `App` (bootstrap)

Top-level initialization in a `DOMContentLoaded` listener:

1. Show loading indicator.
2. Wait for Chart.js to load (with 10-second timeout).
3. Call `TransactionStore.loadFromStorage()`.
4. Initial render of list, balance, and chart.
5. Attach event listeners (form submit, list click delegation for delete).
6. Remove loading indicator.

---

## Data Models

### `Transaction` object

```js
{
  id:        string,   // crypto.randomUUID() or Date.now().toString() fallback
  name:      string,   // 1–100 characters
  amount:    number,   // 0.01–999,999,999.99 (or negative per Req 4.5)
  category:  string,   // any valid category name from CategoryService.getAll()
  timestamp: number    // Date.now() at time of creation (Unix ms)
}
```

> **Migration note**: The `category` field was previously typed as the literal union `'Food' | 'Transport' | 'Fun'`. It is now a plain `string` to support custom categories. The three built-in values remain valid; `Validator.validateCategory()` now delegates to `CategoryService.getAll()` instead of a hardcoded set.

### localStorage schema

Three keys are used:

**Key `'expense_tracker_transactions'`** — JSON array of Transaction objects (unchanged):

```json
[
  {
    "id": "abc123",
    "name": "Coffee",
    "amount": 4.50,
    "category": "Food",
    "timestamp": 1700000000000
  }
]
```

On load, each entry is validated to have all required fields with correct types. Entries failing validation are discarded with a warning (Req 6.6).

**Key `'expense_tracker_theme'`** — string, either `"light"` or `"dark"`:

```json
"dark"
```

Read by an inline `<script>` in `<head>` before first paint to prevent flash of non-preferred theme. Defaults to `"light"` when absent.

**Key `'expense_tracker_categories'`** — JSON array of custom `Category` objects only (built-ins are never stored):

```json
[
  { "name": "Groceries", "color": "#4BC0C0", "isBuiltIn": false },
  { "name": "Health",    "color": "#9966FF", "isBuiltIn": false }
]
```

Absent or empty means only the three built-in categories are active.

### Category color lookup — `CategoryService.getColor(name)`

The static `CATEGORY_COLORS` constant is replaced by `CategoryService.getColor(name)`, which returns the hex color string for any category (built-in or custom). Built-in colors are hardcoded inside `CategoryService`; custom colors are drawn from `EXTENDED_PALETTE` in the order they were added.

```js
// Built-in colors (internal to CategoryService — same values as the former constant)
Food:      '#FF6384'
Transport: '#36A2EB'
Fun:       '#FFCE56'

// Extended palette for custom categories (cycles if > 10 custom categories exist)
const EXTENDED_PALETTE = [
  '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7CFC00',
  '#DC143C', '#00CED1', '#FF69B4', '#8A2BE2', '#FFA500',
];
```

All 13 colors (3 built-in + 10 palette) are distinct. `ChartRenderer` calls `CategoryService.getColor(cat)` instead of looking up `CATEGORY_COLORS[cat]` directly.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid transaction creation

*For any* triple of (item name ≤ 100 chars and non-empty, amount in range 0.01–999,999,999.99, category in {Food, Transport, Fun}), calling `TransactionStore.add()` with those values SHALL cause the transaction list length to increase by exactly 1 and the new entry to appear in the list.

**Validates: Requirements 1.2**

---

### Property 2: Invalid input rejection

*For any* input triple where at least one field is invalid — name is empty or exceeds 100 characters, amount is ≤ 0 or > 999,999,999.99 or not a number, or category is not one of {Food, Transport, Fun} — the `Validator.validateTransaction()` function SHALL return at least one `ValidationResult` with `valid: false`, and no new Transaction SHALL be created.

**Validates: Requirements 1.3, 1.4, 1.6**

---

### Property 3: Transaction list rendering completeness

*For any* non-empty array of Transaction objects, `ListRenderer.render()` SHALL produce a DOM structure where every transaction in the array has a corresponding list item that contains the item name, the amount formatted as a currency string with exactly 2 decimal places, the category label, and a delete button with a `data-id` attribute matching the transaction's `id`.

**Validates: Requirements 2.1, 3.1**

---

### Property 4: Reverse-chronological ordering

*For any* array of Transaction objects with distinct `timestamp` values, the order of list items produced by `ListRenderer.render()` SHALL correspond to descending sort order by `timestamp` (most recently created first).

**Validates: Requirements 2.3**

---

### Property 5: Balance calculation correctness

*For any* array of Transaction objects (including those with negative amounts), `BalanceRenderer`'s computed balance value SHALL equal the algebraic sum of all `amount` fields rounded to exactly 2 decimal places, and in particular SHALL equal `0.00` when the array is empty.

**Validates: Requirements 4.1, 4.4, 4.5**

---

### Property 6: Pie chart proportion accuracy

*For any* non-empty array of Transaction objects containing at least one positive-amount transaction, the percentage assigned to each category by `ChartRenderer` SHALL equal `(category_positive_total / grand_positive_total) × 100` rounded to 2 decimal places, and the sum of all displayed percentages SHALL equal 100.00 (subject to rounding).

**Validates: Requirements 5.1**

---

### Property 7: Distinct category colors

*For any* subset of active categories (the at-most-3 categories that have at least one transaction), the color values assigned from `CATEGORY_COLORS` SHALL all be distinct — no two categories share the same color string.

**Validates: Requirements 5.4**

---

### Property 8: Legend deduplication

*For any* array of Transaction objects spanning one or more categories, the chart legend produced by `ChartRenderer` SHALL contain exactly one entry per category that has at least one transaction, regardless of how many transactions exist for that category.

**Validates: Requirements 5.5**

---

### Property 9: Transaction serialization round-trip

*For any* valid `Transaction` object, serializing it with `JSON.stringify()` and then deserializing the result with `JSON.parse()` SHALL produce an object that is deep-equal to the original (all fields present with the same values and types).

**Validates: Requirements 6.1**

---

### Property 10: Malformed data filtering

*For any* array of localStorage entries that is a mixture of valid Transaction JSON objects and corrupted/malformed entries (wrong types, missing fields, invalid JSON strings), `StorageService.load()` SHALL return only the subset of entries that pass the Transaction schema validation, discarding all invalid entries, and SHALL NOT throw an unhandled exception.

**Validates: Requirements 6.6**

---

### Property 11: Theme persistence round-trip

*For any* theme value in `{'light', 'dark'}`, calling `ThemeService.setTheme(value)` SHALL write that value to `localStorage` under key `'expense_tracker_theme'`, such that a subsequent `localStorage.getItem('expense_tracker_theme')` returns the same string, and `ThemeService.getTheme()` also returns that value.

**Validates: Requirement 9.4**

---

### Property 12: Custom category uniqueness

*For any* sequence of `CategoryService.addCustom(name)` calls, `CategoryService.getAll()` SHALL never contain two entries whose names are equal under case-insensitive comparison — duplicate additions SHALL be rejected with `{ ok: false }` and leave the category list unchanged.

**Validates: Requirement 10.4**

---

### Property 13: Sort correctness

*For any* Transaction array and any `SortMode`, the array produced by applying the sort SHALL be a permutation of the input (same elements, none added or removed) AND shall satisfy the ordering predicate for that mode, with ties broken by `timestamp` descending.

**Validates: Requirements 11.3, 11.4, 11.5, 11.6, 11.7, 11.10**

---

## Error Handling

| Scenario | Detection point | User-visible response | Internal behavior |
|---|---|---|---|
| localStorage unavailable on load | `StorageService.load()` catches exception | Banner: "Transactions could not be loaded. Running in memory-only mode." | Empty array used as initial state |
| localStorage unavailable on save | `StorageService.save()` catches exception | Banner: "Data could not be saved. Changes are in-memory only this session." | In-memory state preserved; no crash |
| localStorage unavailable on delete | `StorageService.save()` catches exception | Banner: "Deletion could not be saved. Transaction retained." | Transaction NOT removed from in-memory list |
| Malformed localStorage data | `StorageService.load()` per-entry validation | Banner: "Some transactions could not be restored and were skipped." | Invalid entries silently discarded |
| Chart.js CDN timeout (>10 s) | `App` bootstrap timeout handler | Banner: "Chart could not be loaded. Check your internet connection." | Chart area shows error message; rest of app functional |
| Chart.js CDN loading (pending) | `App` bootstrap | Spinner/loading indicator in chart area | Input form disabled until chart ready |
| Form validation failure | `FormController` submit handler | Inline error beneath each invalid field | No transaction created |
| Theme storage failure | `ThemeService.setTheme()` write fails | Banner: "Theme preference could not be saved." (non-blocking) | Theme applied to current session; preference not persisted |
| Custom category storage failure | `CategoryService.save()` write fails | Banner: "Category change could not be saved." (non-blocking) | Change applied in memory for current session only |

All banners are dismissible and non-blocking. The app remains usable even when chart or storage errors occur.

---

## Testing Strategy

### Unit Tests (example-based)

Focus on concrete scenarios and component contracts:

- `Validator`: test each invalid input class (empty name, name > 100 chars, amount = 0, amount = -1, amount > 999999999.99, no category, all valid); test that a valid custom category name is accepted after being added via `CategoryService`.
- `StorageService`: mock `localStorage` to verify save/load/clear behavior; mock failures to verify error propagation.
- `BalanceRenderer`: test with 0 transactions, all positive, mixed positive/negative, floating point sums (e.g., 0.1 + 0.2).
- `ListRenderer`: test empty list renders placeholder; test list with items renders name/amount/category/delete button; test each sort mode produces correct order for a known set of transactions.
- `ChartRenderer`: test placeholder shown with no transactions; test chart data matches category totals; test custom category colors are sourced from `CategoryService.getColor()`.
- `FormController`: test successful submission resets form fields; test validation errors appear inline.
- `ThemeService`: test `setTheme('dark')` sets `data-theme="dark"` on `<html>` and writes `'dark'` to localStorage; test `toggle()` flips between modes; test `loadFromStorage()` reads saved preference; test graceful fallback to `'light'` when key is absent.
- `CategoryService`: test `addCustom()` rejects empty name; test `addCustom()` rejects name > 50 chars; test `addCustom()` rejects case-insensitive duplicate; test `removeCustom()` rejects built-in names; test `removeCustom()` rejects names referenced by existing transactions; test `getAll()` returns built-ins first then custom categories; test colors auto-assigned from `EXTENDED_PALETTE` in order.
- `CategoryManagerUI`: test custom category form renders; test built-ins have no remove button; test custom categories have remove button; test inline error shown on duplicate submission.
- `SortController`: test default mode is `'date-desc'`; test `setMode()` updates the mode and triggers list re-render; test each mode against a small known dataset.

### Property-Based Tests

Use [fast-check](https://fast-check.dev/) (JavaScript PBT library). Each property test runs a minimum of **100 iterations**.

```
// Tag format: Feature: expense-budget-visualizer, Property N: <property text>
```

| Property | Test description | Generator strategy |
|---|---|---|
| P1: Valid transaction creation | For any valid (name, amount, category), list grows by 1 | Arbitrary non-empty string ≤ 100 chars, float in [0.01, 999999999.99], one of 3 categories |
| P2: Invalid input rejection | For any invalid input, validator returns at least one error | Arbitrary string > 100 chars OR empty string; float ≤ 0 or > 999999999.99; invalid category string |
| P3: List rendering completeness | For any transaction array, all entries appear with required fields | Arbitrary arrays of valid Transaction objects |
| P4: Reverse-chronological ordering | For any transaction array with distinct timestamps, rendered order is newest-first | Arbitrary arrays of Transaction objects with distinct timestamps |
| P5: Balance calculation correctness | For any transaction array, balance equals signed sum rounded to 2dp | Arbitrary arrays of floats within amount domain including negatives |
| P6: Pie chart proportion accuracy | For any array with positive amounts, category percentages sum to 100 | Arbitrary arrays of positive-amount transactions across 1–3 categories |
| P7: Distinct category colors | Color map has no duplicate values | Static check — verified once |
| P8: Legend deduplication | For any transaction array, legend has one entry per category | Arbitrary arrays with varying category distribution |
| P9: Serialization round-trip | For any transaction, stringify then parse returns equivalent object | Arbitrary valid Transaction objects |
| P10: Malformed data filtering | For any mixed valid/invalid entry array, only valid entries returned | Arrays mixing valid Transaction objects with arbitrary malformed objects |
| P11: Theme persistence round-trip | For any theme value in {'light','dark'}, setTheme then getTheme returns the same value | Arbitrary choice between 'light' and 'dark' |
| P12: Custom category uniqueness | For any sequence of addCustom calls, getAll() contains no case-insensitive duplicates | Arbitrary sequences of category name strings, some duplicates included |
| P13: Sort correctness | For any Transaction array and SortMode, sorted output is a permutation satisfying the ordering predicate | Arbitrary Transaction arrays × arbitrary SortMode; ties broken by timestamp desc |

### Integration / Smoke Tests

Manual verification or browser automation (e.g., Playwright) for:

- App loads in Chrome, Firefox, Edge, and Safari without console errors.
- Viewport renders correctly at 320px, 768px, 1280px, and 1920px widths.
- Adding 1,000 transactions and verifying UI updates within 200 ms (DevTools Performance panel).
- Chart.js CDN blocked (DevTools Network throttle) → error message shown within 10 s.
- localStorage cleared mid-session → warning banner shown on next write.
- Theme toggle persists across page reload (verify `data-theme` attribute before first paint).
- Custom category added → appears in dropdown, chart segment rendered with correct color; custom category removed → no longer in dropdown, chart updates.
- Sort mode change re-renders list without altering balance or chart.
