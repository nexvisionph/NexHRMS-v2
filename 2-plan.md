# NexHRMS 201 Files UI: Redesign & Table Optimization Plan

**System Context:**
We are refining the UI of the "201 Files" dashboard in a Next.js / Tailwind CSS application. The backend synchronization (Supabase) is already fully implemented and hydrated via our Zustand stores (`useDocumentsStore` and `useEmployeesStore`). 

Please create an implementation plan the following UI updates to the main 201 Files page component to match the system's design language and improve data handling. Do not change anything on the codebase yet.

---

## Task 1: Typography and Header Cleanup
Clean up the visual headers and metric cards to align with the rest of the application's minimalist design.
1. **Remove the Heading Icon:** Find the main page heading (e.g., `<h2>201 Files</h2>` or similar) and remove the folder/document icon next to it.
2. **Remove Table Title:** Remove the "Employees" text/heading that currently sits directly above the data table.
3. **Clean Up Metric Numbers:** In the "Document Overview" metric cards (For Review, Approved, Rejected, etc.), remove the trailing dot ('.') that appears next to the large metric numbers (e.g., change `1.` to `1`).

---

## Task 2: State Management for Table Features
Introduce React state (`useState`) to handle our new table capabilities.
1. `departmentFilter`: A string state to store the currently selected department (defaulting to `"All"` or `""`).
2. `currentPage`: A number state to track the active page (defaulting to `1`).
3. `itemsPerPage`: A constant or state (e.g., `10` or `15`) to control pagination size.

---

## Task 3: Filtering & Pagination Logic
Implement the data transformation logic before rendering the table rows. The data source is the array of employees combined with their document completion status.
1. **Department Filtering:** Filter the employee list based on the `departmentFilter` state. (Ensure this chains correctly with the existing Search bar filter).
2. **Pagination Math:** - Calculate `totalPages` based on the filtered array length.
   - Slice the filtered array to get the `paginatedEmployees` for the current page: 
     `filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)`
3. **Reset Effect:** Add a `useEffect` that resets `currentPage` back to `1` whenever the `departmentFilter` or search input changes, preventing out-of-bounds page errors.

---

## Task 4: Implement UI Controls
Update the JSX to render the new controls.
1. **Department Dropdown:** Add a select/dropdown component next to the existing Search bar. Populate its options dynamically based on the unique departments present in the employees list, plus an "All Departments" option.
2. **Pagination Footer:** Add a pagination component at the bottom of the table containing:
   - "Previous" and "Next" buttons (disabled appropriately on the first/last pages).
   - Page number indicators (e.g., "Page 1 of 5").

---

## Task 5: Hydration Loading State (Bonus Requirement)
Because the app now hydrates data from Supabase via `sync.service.ts` on load, the table might flash empty for a fraction of a second.
1. Wrap the table body in a conditional render.
2. If the employee data is still loading or hydrating, display a skeleton loader or a subtle loading spinner inside the table rather than showing "0 results".