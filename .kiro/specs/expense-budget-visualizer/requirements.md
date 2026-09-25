# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that enables users to track their personal spending by recording named transactions with amounts and categories. It presents a real-time summary of total balance and a visual pie chart of spending distribution by category. All data is persisted locally using the browser's Local Storage API, requiring no backend server or user accounts. The application is delivered as a single-page HTML/CSS/JavaScript bundle compatible with all modern browsers.

---

## Glossary

- **App**: The Expense & Budget Visualizer single-page web application.
- **Transaction**: A single expense entry consisting of an item name, a monetary amount, and a category.
- **Transaction_List**: The scrollable on-screen list that displays all recorded Transactions.
- **Input_Form**: The UI component that collects item name, amount, and category from the user before a Transaction is created.
- **Category**: A classification label for a Transaction; one of: Food, Transport, or Fun.
- **Balance_Display**: The UI component at the top of the App that shows the computed total of all Transaction amounts.
- **Pie_Chart**: The visual chart component that renders spending distribution across Categories.
- **Local_Storage**: The browser's `localStorage` Web API used to persist Transaction data client-side.
- **Chart_Library**: A third-party JavaScript charting library (e.g., Chart.js) loaded via CDN to render the Pie_Chart.
- **Theme_Toggle**: The UI control (button) positioned to the right of the app title that switches the App between light and dark visual themes.
- **Custom_Category**: A user-defined Category name added at runtime, stored in Local_Storage, that supplements the built-in Categories (Food, Transport, Fun) in the category dropdown and Pie_Chart.
- **Sort_Control**: The UI control (dropdown or button group) displayed above the Transaction_List that changes the display order of Transactions without modifying stored data.

---

## Requirements

### Requirement 1: Transaction Input

**User Story:** As a user, I want to enter an expense item with a name, amount, and category, so that I can record my spending.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a text field for item name (accepting up to 100 characters), a numeric field for amount, and a dropdown selector for Category containing the options Food, Transport, and Fun.
2. WHEN the user submits the Input_Form with all fields filled and the amount in the range 0.01–999,999,999.99, THE App SHALL create a new Transaction and add it to the Transaction_List.
3. WHEN the user submits the Input_Form with one or more fields empty or with Category unselected, THE App SHALL display an inline validation error message identifying the missing field(s) and SHALL NOT create a Transaction.
4. WHEN the user submits the Input_Form with an amount outside the range 0.01–999,999,999.99, THE App SHALL display an inline validation error message stating that the amount must be between 0.01 and 999,999,999.99 and SHALL NOT create a Transaction.
5. WHEN a Transaction is successfully created, THE Input_Form SHALL reset the item name field to empty, the amount field to empty, and the Category dropdown to its default unselected state.
6. WHEN the user submits the Input_Form with an item name exceeding 100 characters, THE App SHALL display an inline validation error message stating that the item name must not exceed 100 characters and SHALL NOT create a Transaction.

---

### Requirement 2: Transaction List Display

**User Story:** As a user, I want to see all my recorded transactions in a list, so that I can review my spending history.

#### Acceptance Criteria

1. THE Transaction_List SHALL display every Transaction that has been recorded, showing the item name (truncated at 100 characters), amount formatted to 2 decimal places with a currency symbol, and Category for each entry.
2. WHILE the number of Transactions exceeds the visible area of the Transaction_List, THE Transaction_List SHALL be vertically scrollable to allow access to all entries.
3. THE Transaction_List SHALL display Transactions in reverse-chronological order by each Transaction's recorded timestamp, with the most recently added Transaction shown first.
4. WHEN the App is loaded, THE App SHALL retrieve all persisted Transactions from Local_Storage and render them in the Transaction_List within 2 seconds.
5. IF Local_Storage is unavailable or returns a read error on App load, THEN THE App SHALL display an error message indicating transactions could not be loaded and SHALL render an empty Transaction_List.
6. WHEN the App is loaded and Local_Storage is available but contains no Transactions, THE App SHALL display a "no transactions" message in the Transaction_List area.

---

### Requirement 3: Transaction Deletion

**User Story:** As a user, I want to delete a transaction from the list, so that I can correct mistakes or remove unwanted entries.

#### Acceptance Criteria

1. THE Transaction_List SHALL render a delete control for each Transaction entry.
2. WHEN the user activates the delete control for a Transaction, THE App SHALL display a confirmation prompt requiring explicit user confirmation before removing the Transaction.
3. WHEN the user confirms deletion, THE App SHALL remove that Transaction from the Transaction_List and from Local_Storage within 300 milliseconds.
4. WHEN a Transaction is deleted, THE Balance_Display and Pie_Chart SHALL update to reflect the removal within 300 milliseconds of the deletion completing.
5. IF Local_Storage is unavailable when the user confirms deletion, THEN THE App SHALL display an error message indicating the deletion could not be completed and SHALL retain the Transaction in the Transaction_List unchanged.

---

### Requirement 4: Total Balance Display

**User Story:** As a user, I want to see my total spending amount at a glance, so that I can understand my overall expenditure.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of the amounts of all Transactions currently in the Transaction_List, rounded to 2 decimal places.
2. WHEN a new Transaction is added, THE Balance_Display SHALL update to reflect the new total within 1 second without requiring a page reload.
3. WHEN a Transaction is deleted, THE Balance_Display SHALL update to reflect the new total within 1 second without requiring a page reload.
4. WHEN no Transactions exist, THE Balance_Display SHALL show a total of 0.00.
5. IF any Transaction carries a negative amount, THEN THE Balance_Display SHALL reflect the signed sum of all Transaction amounts, rounded to 2 decimal places.

---

### Requirement 5: Spending Distribution Pie Chart

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can understand where my money is going.

#### Acceptance Criteria

1. THE Pie_Chart SHALL display one segment per Category that has at least one Transaction with a positive amount, sized proportionally to that Category's total amount relative to the sum of all displayed Category totals, with each segment's percentage rounded to two decimal places.
2. WHEN a new Transaction is added, THE Pie_Chart SHALL update to reflect the new distribution within 1 second without requiring a page reload.
3. WHEN a Transaction is deleted, THE Pie_Chart SHALL update to reflect the new distribution within 1 second without requiring a page reload.
4. THE Pie_Chart SHALL render each Category segment in a distinct color such that no two adjacent segments share the same color.
5. THE Pie_Chart SHALL display a legend identifying each Category by name alongside its corresponding segment color, with at most one legend entry per Category.
6. WHEN no Transactions exist, THE Pie_Chart SHALL display a placeholder message indicating no spending data is available instead of rendering any chart segments.
7. IF the total number of Categories with at least one Transaction exceeds 10, THEN THE Pie_Chart SHALL group all Categories beyond the 10 largest into a single "Other" segment sized proportionally to their combined total.

---

### Requirement 6: Data Persistence

**User Story:** As a user, I want my transactions to be saved across browser sessions, so that I do not lose my spending history when I close and reopen the browser.

#### Acceptance Criteria

1. WHEN a Transaction is created, THE App SHALL serialize the Transaction and write it to Local_Storage within 500ms of the creation event.
2. WHEN a Transaction is deleted, THE App SHALL remove the corresponding entry from Local_Storage within 500ms of the deletion event.
3. WHEN a Transaction is edited, THE App SHALL update the corresponding Local_Storage entry within 500ms of the edit event.
4. WHEN the App is loaded, THE App SHALL read all Transaction data from Local_Storage and restore the Transaction_List, Balance_Display, and Pie_Chart to their last saved state before accepting any user input.
5. IF Local_Storage is unavailable or a write or read operation fails, THEN THE App SHALL display a non-blocking warning message informing the user that data persistence is unavailable and SHALL continue operating with in-memory state only, preserving the current session's Transaction data.
6. IF Local_Storage contains malformed or corrupted Transaction data on App load, THEN THE App SHALL discard the corrupted entries, display a non-blocking warning message identifying that some data could not be restored, and render the Transaction_List with only the valid entries.

---

### Requirement 7: Compatibility and Delivery

**User Story:** As a user, I want to open the app in any modern browser without installation, so that I can use it immediately on any device.

#### Acceptance Criteria

1. THE App SHALL be deliverable as a single HTML file that references one external CSS file and one external JavaScript file with no build step required.
2. THE App SHALL function correctly in the current stable releases of Chrome, Firefox, Edge, and Safari without requiring browser plugins, where "function correctly" means all UI interactions produce the expected outputs defined in the other requirements with no JavaScript errors in the browser console.
3. WHERE the Chart_Library is loaded via CDN, THE App SHALL load and render the Pie_Chart only after the Chart_Library script has fully loaded, and SHALL display a loading indicator within 500ms of page load while the Chart_Library script is pending.
4. THE App SHALL render correctly on viewport widths between 320px and 1920px, where "render correctly" means no content is clipped, no horizontal scrollbar appears, and all interactive controls remain reachable and operable.
5. IF the Chart_Library CDN script fails to load within 10 seconds, THEN THE App SHALL display an error message indicating the chart could not be loaded and that the user should check their internet connection.

---

### Requirement 8: Performance and Responsiveness

**User Story:** As a user, I want the app to respond to my actions without noticeable delay, so that the experience feels smooth and efficient.

#### Acceptance Criteria

1. WHEN the user submits the Input_Form, THE App SHALL update the Transaction_List, Balance_Display, and Pie_Chart within 200ms of the submission event on a modern desktop browser with up to 1,000 persisted Transactions.
2. WHEN the user activates the delete control for a Transaction, THE App SHALL remove the entry and update the Balance_Display and Pie_Chart within 200ms of the activation event on a modern desktop browser with up to 1,000 persisted Transactions.
3. THE App SHALL complete initial load and render all persisted Transactions within 2 seconds on a standard broadband connection (defined as a minimum download speed of 25 Mbps) with up to 1,000 persisted Transactions.
4. IF the initial load exceeds 2 seconds, THEN THE App SHALL display a loading indicator within 500ms of the load start and remove it once all Transactions are rendered.
5. IF a Transaction_List update, Balance_Display update, or Pie_Chart update following a form submission or delete action fails to complete within 200ms, THEN THE App SHALL display an error message indicating the operation could not be completed and preserve the previous Transaction_List, Balance_Display, and Pie_Chart state.

---

### Requirement 9: Dark/Light Mode Toggle

**User Story:** As a user, I want to switch the app between a light and dark visual theme, so that I can use it comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE App SHALL render a Theme_Toggle button in the page header, positioned to the right of the app title, such that the title is left-aligned and the Theme_Toggle is right-aligned within the same header row.
2. WHEN the user activates the Theme_Toggle while the App is in light mode, THE App SHALL apply a dark theme to the entire App within 200ms, updating all background colors, text colors, border colors, and component surface colors to their dark-mode equivalents.
3. WHEN the user activates the Theme_Toggle while the App is in dark mode, THE App SHALL apply the light theme to the entire App within 200ms, restoring all colors to their light-mode values.
4. WHEN the user activates the Theme_Toggle, THE App SHALL persist the selected theme identifier to Local_Storage within 500ms so that the preference is retained across browser sessions.
5. WHEN the App is loaded and Local_Storage contains a persisted theme preference, THE App SHALL apply that theme before rendering any visible content, preventing a flash of the non-preferred theme.
6. WHEN the App is loaded and Local_Storage contains no persisted theme preference, THE App SHALL default to the light theme.
7. THE Theme_Toggle SHALL display a visible label or icon that reflects the theme the toggle will switch TO (e.g., showing a moon icon when in light mode, a sun icon when in dark mode), with an accessible name announced by screen readers.
8. IF Local_Storage is unavailable when the user activates the Theme_Toggle, THEN THE App SHALL apply the theme change for the current session and display a non-blocking warning message indicating the preference could not be saved.

---

### Requirement 10: Custom Categories

**User Story:** As a user, I want to define my own spending categories in addition to the built-in ones, so that I can track expenses that do not fit the default classification.

#### Acceptance Criteria

1. THE App SHALL provide a UI control consisting of a text input and a submit button that allows the user to type a new Custom_Category name and add it to the App.
2. WHEN the user submits a new Custom_Category name that is between 1 and 50 characters and is not a duplicate of any existing built-in or Custom_Category name (comparison is case-insensitive), THE App SHALL add the Custom_Category to the category dropdown and persist it to Local_Storage within 500ms.
3. WHEN the user submits a new Custom_Category name that is empty or exceeds 50 characters, THE App SHALL display an inline validation error message identifying the violation and SHALL NOT create the Custom_Category.
4. WHEN the user submits a new Custom_Category name that duplicates an existing built-in or Custom_Category name (case-insensitive), THE App SHALL display an inline validation error message stating that the category already exists and SHALL NOT create a duplicate.
5. THE App SHALL render every Custom_Category as a selectable option in the category dropdown alongside the built-in categories Food, Transport, and Fun.
6. WHEN the App is loaded, THE App SHALL retrieve all persisted Custom_Categories from Local_Storage and restore them to the category dropdown before accepting any user input.
7. THE Pie_Chart SHALL render a distinct segment for each Custom_Category that has at least one Transaction with a positive amount, with the segment color auto-assigned from a predefined extended color palette such that no two active Category segments share the same color.
8. THE App SHALL render a remove control next to each Custom_Category in the category management UI.
9. WHEN the user activates the remove control for a Custom_Category that has no Transactions referencing it, THE App SHALL remove that Custom_Category from the category dropdown and from Local_Storage within 500ms.
10. WHEN the user activates the remove control for a Custom_Category that has one or more Transactions referencing it, THE App SHALL display an error message stating the category cannot be removed while Transactions reference it and SHALL NOT remove the Custom_Category.
11. THE App SHALL NOT render a remove control for the built-in categories Food, Transport, and Fun, preventing their deletion.
12. IF Local_Storage is unavailable when a Custom_Category is added or removed, THEN THE App SHALL apply the change for the current session and display a non-blocking warning message indicating the change could not be persisted.

---

### Requirement 11: Transaction List Sorting

**User Story:** As a user, I want to sort my transaction list by different criteria, so that I can find and review my expenses more easily.

#### Acceptance Criteria

1. THE App SHALL render a Sort_Control above the Transaction_List that allows the user to select one of the following sort modes: reverse-chronological (default), amount ascending, amount descending, category A→Z, and category Z→A.
2. WHEN the App is loaded, THE Sort_Control SHALL default to the reverse-chronological sort mode, preserving the existing display behavior.
3. WHEN the user selects the amount ascending sort mode, THE App SHALL re-render the Transaction_List with Transactions ordered from the smallest amount to the largest amount within 200ms of the selection.
4. WHEN the user selects the amount descending sort mode, THE App SHALL re-render the Transaction_List with Transactions ordered from the largest amount to the smallest amount within 200ms of the selection.
5. WHEN the user selects the category A→Z sort mode, THE App SHALL re-render the Transaction_List with Transactions ordered alphabetically by Category name from A to Z within 200ms of the selection.
6. WHEN the user selects the category Z→A sort mode, THE App SHALL re-render the Transaction_List with Transactions ordered alphabetically by Category name from Z to A within 200ms of the selection.
7. WHEN the user selects the reverse-chronological sort mode, THE App SHALL re-render the Transaction_List with Transactions ordered by recorded timestamp descending (most recent first) within 200ms of the selection.
8. WHEN a new Transaction is added or an existing Transaction is deleted, THE App SHALL re-render the Transaction_List using the currently active sort mode so that the new state is consistent with the user's selected ordering.
9. THE Sort_Control SHALL NOT modify, reorder, or overwrite any Transaction data stored in Local_Storage; sorting is a display-only operation applied to the in-memory Transaction array at render time.
10. WHEN two or more Transactions are equal under the active sort criterion (e.g., identical amounts or identical category names), THE App SHALL use reverse-chronological order as a stable secondary sort to determine their relative display order.
