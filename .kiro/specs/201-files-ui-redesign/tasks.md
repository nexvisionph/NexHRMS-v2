# Implementation Plan: 201 Files UI Redesign

## Overview

Redesign the `Documents201AdminView` component to remove visual clutter (heading icon, table section title, metric card dots), add department filtering and pagination to the employee table, and introduce a hydration loading state. All changes are confined to `admin-view.tsx` and its local helpers.

## Tasks

- [x] 1. Visual declutter — remove heading icon, table CardHeader, and metric dots
  - [x] 1.1 Remove the heading icon and table section title
    - Remove the `<FolderArchive>` icon from the `<h1>` heading element
    - Remove the `<CardHeader>` / `<CardTitle>` ("Employees") from the employee table `<Card>`
    - Ensure the Card's `<CardContent className="p-0">` remains flush against the card edges
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3_

  - [x] 1.2 Remove the decorative dot from DocTile
    - Delete the conditional `{value > 0 && <span className={...dot...} />}` line in the `DocTile` component
    - Verify metric values render as plain integers with no adjacent decorative elements
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 2. Add department filter state and dropdown UI
  - [x] 2.1 Add department filter state and derive unique departments
    - Add `const [departmentFilter, setDepartmentFilter] = useState<string>("all")` state hook
    - Compute `uniqueDepartments` from active employees' non-empty department values, sorted alphabetically
    - _Requirements: 4.1, 4.2, 9.2, 9.5_

  - [x] 2.2 Implement the DepartmentDropdown inline component
    - Create a `<Select>` dropdown placed adjacent (right) to the existing search bar in the same toolbar row
    - Populate with "All Departments" as the first/default option, followed by `uniqueDepartments`
    - Wire `onValueChange` to call `setDepartmentFilter`
    - _Requirements: 9.1, 9.3, 9.4_

  - [ ]* 2.3 Write property test for dropdown options derivation
    - **Property 5: Dropdown options derived from active employees**
    - **Validates: Requirements 9.2, 9.5**

- [x] 3. Add pagination state and controls
  - [x] 3.1 Add pagination state hooks and constants
    - Add `const ITEMS_PER_PAGE = 10` constant
    - Add `const [currentPage, setCurrentPage] = useState(1)` state hook
    - _Requirements: 5.1, 5.2_

  - [x] 3.2 Implement the PaginationFooter inline component
    - Render below the employee table card with Previous button, "Page X of Y" indicator, and Next button
    - Disable Previous when `currentPage === 1`; disable Next when `currentPage === totalPages`
    - Wire onClick handlers to increment/decrement `currentPage`
    - Hide pagination controls when filtered list fits in a single page
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 7.3_

- [x] 4. Integrate filter pipeline with department filter and pagination
  - [x] 4.1 Update the filteredEmployees useMemo to include department filtering
    - After the active-status filter, add department filter step: skip if "all", otherwise exact case-sensitive match on `emp.department`
    - Exclude employees with empty/unset department when a specific department is selected
    - Maintain AND logic with existing search text filter
    - _Requirements: 4.3, 4.4, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 4.2 Add pagination slice logic and totalPages derivation
    - Compute `totalPages = Math.max(1, Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE))`
    - Compute `paginatedEmployees = filteredEmployees.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)`
    - Clamp `currentPage` to `totalPages` when it exceeds after filter changes
    - Render `paginatedEmployees` in the table body instead of `filteredEmployees`
    - _Requirements: 5.3, 7.1, 7.2, 7.4_

  - [x] 4.3 Implement filter-change page reset logic
    - Reset `currentPage` to 1 whenever `departmentFilter` changes
    - Reset `currentPage` to 1 whenever `search` input changes
    - Use `useEffect` or inline setter logic to ensure reset happens before render
    - _Requirements: 5.4, 8.1, 8.2, 8.3_

  - [ ]* 4.4 Write property test for filter pipeline correctness
    - **Property 1: Filter pipeline correctness**
    - **Validates: Requirements 4.3, 4.4, 6.2, 6.3, 6.5**

  - [ ]* 4.5 Write property test for page bounds invariant
    - **Property 2: Page bounds invariant**
    - **Validates: Requirements 5.1, 7.1, 7.4**

  - [ ]* 4.6 Write property test for pagination slice correctness
    - **Property 3: Pagination slice correctness**
    - **Validates: Requirements 5.3, 7.2**

  - [ ]* 4.7 Write property test for filter change resets page
    - **Property 4: Filter change resets page**
    - **Validates: Requirements 5.4, 8.1, 8.2**

- [x] 5. Checkpoint - Verify visual declutter, filtering, and pagination
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add hydration loading state
  - [x] 6.1 Implement hydration detection and skeleton UI
    - Add `const [isHydrated, setIsHydrated] = useState(false)` state hook
    - Subscribe to `useDocumentsStore.persist.onFinishHydration` in a `useEffect`; also check `hasHydrated()` on mount
    - Create a `TableSkeleton` inline component rendering ≥5 skeleton rows matching the 6-column layout using `@/components/ui/skeleton`
    - While `!isHydrated`: render `TableSkeleton` in place of table body; suppress "No employees found" message
    - After hydration: render actual employee rows or "No employees found" empty state
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 6.2 Implement hydration timeout fallback
    - Add a 30-second timeout that shows an error message if hydration is truly stalled
    - If hydration completes before timeout, clear the timer
    - Display "Employee data could not be loaded" error message when timeout fires and hydration hasn't completed
    - _Requirements: 11.5_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- All changes are confined to `src/app/[role]/employees/201-files/_views/admin-view.tsx`
- The project uses Vitest as the test runner with fast-check for property-based tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1", "3.1"] },
    { "id": 1, "tasks": ["2.2", "4.1", "6.1"] },
    { "id": 2, "tasks": ["2.3", "4.2", "4.3", "3.2", "6.2"] },
    { "id": 3, "tasks": ["4.4", "4.5", "4.6", "4.7"] }
  ]
}
```
