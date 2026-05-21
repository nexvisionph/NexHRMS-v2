# Requirements Document

## Introduction

This feature redesigns the 201 Files dashboard UI in the NexHRMS application. The backend synchronization with Supabase is already implemented and data hydrates via Zustand stores (`useDocumentsStore` and `useEmployeesStore`). The redesign focuses on cleaning up visual elements, adding department filtering and pagination to the employee table, and providing a hydration loading state to prevent empty-table flashes during initial data load.

## Glossary

- **Admin_View**: The main 201 Files page component (`Documents201AdminView`) that displays the employee document repository dashboard
- **Document_Overview_Card**: The summary card at the top of the page displaying metric tiles (For Review, Approved, Rejected, Expiring in 30d, Total on File)
- **Employee_Table**: The data table listing active employees with their document completeness, document count, and missing document indicators
- **Department_Filter**: A dropdown control that filters the Employee_Table by the selected department value
- **Search_Bar**: The existing text input that filters employees by name, email, or ID
- **Pagination_Controls**: A footer component below the Employee_Table providing Previous/Next navigation and page indicators
- **Hydration_State**: The brief period after page load when Zustand stores are rehydrating data from persisted storage or Supabase sync

## Requirements

### Requirement 1: Remove Heading Icon

**User Story:** As an admin, I want the page heading to display only text without an icon, so that the page aligns with the application's minimalist design language.

#### Acceptance Criteria

1. THE Admin_View SHALL render the page heading text without any icon element adjacent to it
2. THE Admin_View SHALL preserve the heading text content, font size, and font weight after icon removal

### Requirement 2: Remove Table Section Title

**User Story:** As an admin, I want the redundant "Employees" title above the data table removed, so that the interface is cleaner and less repetitive.

#### Acceptance Criteria

1. THE Admin_View SHALL render the Employee_Table card without a CardHeader element or any heading text (such as "Employees") between the Card wrapper and the CardContent containing the table
2. THE Admin_View SHALL preserve all existing table structure including the six column headers (Employee, Department, Completeness, Documents, Missing, Actions), data rows, and empty-state row after the CardHeader removal. The removal SHALL proceed regardless of any side effects on column count
3. WHEN the Employee_Table card renders without the CardHeader, THE Admin_View SHALL maintain the same outer Card border and CardContent padding (p-0) so that the table remains flush against the card edges with no additional whitespace where the title previously appeared

### Requirement 3: Clean Up Metric Card Numbers

**User Story:** As an admin, I want metric numbers in the Document Overview cards to display as clean integers without trailing dots, so that the data is presented clearly.

#### Acceptance Criteria

1. THE Document_Overview_Card SHALL display each metric value (For Review, Approved, Rejected, Expiring in 30d, Total on File) as a plain integer with no adjacent decorative dot, indicator, or non-numeric visual element within the value display area
2. WHEN ANY individual metric value is zero, THE Document_Overview_Card SHALL display the character "0" with no trailing dot or indicator element rendered beside it
3. WHEN a metric value is greater than zero, THE Document_Overview_Card SHALL display the numeric value as an integer with no trailing dot or indicator element rendered beside it

### Requirement 4: Department Filter State

**User Story:** As an admin, I want a department filter state variable, so that the table can be filtered by department.

#### Acceptance Criteria

1. THE Admin_View SHALL maintain a department filter state of type string initialized to "all"
2. THE Admin_View SHALL accept only the value "all" or any value present in the DEPARTMENTS constant as a valid department filter state
3. WHEN the department filter state is set to "all", THE Admin_View SHALL display all employees from the useEmployeesStore without department-based filtering
4. WHEN the department filter state is set to a specific department name, THE Admin_View SHALL display only employees whose department field exactly matches the selected department value (case-sensitive)

### Requirement 5: Pagination State

**User Story:** As an admin, I want pagination state variables, so that the employee table supports paged navigation.

#### Acceptance Criteria

1. THE Admin_View SHALL maintain a current page state initialized to 1, with a minimum value of 1 and a maximum value equal to the total number of pages derived from the filtered employee list. WHEN no employees match the filter, THE Admin_View SHALL set total pages to 1
2. THE Admin_View SHALL define an items-per-page value of 10 that controls how many rows display per page
3. WHEN the current page state changes, THE Admin_View SHALL display the slice of filtered employees from index ((currentPage - 1) × itemsPerPage) to index (currentPage × itemsPerPage)
4. WHEN the department filter or search input value changes, THE Admin_View SHALL reset the current page state to 1

### Requirement 6: Department Filtering Logic

**User Story:** As an admin, I want to filter the employee table by department, so that I can focus on a specific team's document status.

#### Acceptance Criteria

1. WHEN a department value is selected from the department filter dropdown, THE Admin_View SHALL set the department filter mode to the selected value, and the existing filtering rules SHALL handle the actual employee visibility logic
2. WHEN "All Departments" is selected from the department filter dropdown, THE Admin_View SHALL display all active employees regardless of their department value
3. THE Admin_View SHALL apply the department filter using AND logic with the existing Search_Bar text filter (name/email/ID), so that only employees satisfying both the department match and the search text match are displayed
4. WHEN the Admin_View initially loads, THE Admin_View SHALL default the department filter to "All Departments" so that all active employees are visible before any filter interaction
5. IF an employee has an empty or unset department field, THEN THE Admin_View SHALL exclude that employee from results when any specific department is selected, and include that employee only when "All Departments" is selected

### Requirement 7: Pagination Logic

**User Story:** As an admin, I want the employee table paginated, so that large employee lists are navigable without excessive scrolling.

#### Acceptance Criteria

1. THE Admin_View SHALL calculate total pages as the ceiling of filtered employee count divided by items-per-page (10), with a minimum of 1 total page
2. THE Admin_View SHALL display only the slice of employees corresponding to the current page using the formula: filteredEmployees.slice((currentPage - 1) × itemsPerPage, currentPage × itemsPerPage)
3. WHEN the filtered employee list has fewer entries than items-per-page, THE Admin_View SHALL display a single page without pagination controls
4. WHEN the current page exceeds the total pages after any state change (including but not limited to filter changes), THE Admin_View SHALL clamp the current page to the new total pages value

### Requirement 8: Filter and Pagination Reset

**User Story:** As an admin, I want the page to reset to page 1 when I change filters, so that I always see results from the beginning after adjusting criteria.

#### Acceptance Criteria

1. WHEN the department filter value changes, THE Admin_View SHALL reset the current page to 1 before rendering the updated filtered result set, ignoring any concurrent page navigation attempts
2. WHEN the search input value changes (on each keystroke), THE Admin_View SHALL reset the current page to 1 before rendering the updated filtered result set
3. WHEN any filter resets the current page to 1, THE Admin_View SHALL display the first page of the newly filtered results within the same render cycle, and the system SHALL allow immediate navigation to other pages after the reset completes

### Requirement 9: Department Dropdown Control

**User Story:** As an admin, I want a department dropdown next to the search bar, so that I can quickly filter employees by their department.

#### Acceptance Criteria

1. THE Admin_View SHALL render a department dropdown adjacent to the Search_Bar, positioned immediately to the right of the Search_Bar within the same toolbar row
2. THE Admin_View SHALL populate the dropdown options dynamically from the unique department values present among employees with status "active" in the employee list, sorted in alphabetical order
3. THE Admin_View SHALL include an "All Departments" option as the first item in the dropdown, selected by default on initial page load
4. WHEN the user selects a department option, THE Admin_View SHALL update the department filter state to the selected value and the displayed employee list SHALL update accordingly
5. IF no active employees exist for any department, THEN THE Admin_View SHALL display only the "All Departments" option in the dropdown

### Requirement 10: Pagination Footer Controls

**User Story:** As an admin, I want Previous/Next buttons and a page indicator below the table, so that I can navigate through pages of employees.

#### Acceptance Criteria

1. THE Admin_View SHALL render a pagination footer below the Employee_Table containing a Previous button, a Next button, and a page indicator displayed in the format "Page X of Y" where X is the current page number and Y is the total number of pages
2. WHILE the current page is 1, THE Admin_View SHALL render the Previous button in a disabled state that prevents user interaction, and clicking the disabled Previous button SHALL have no effect
3. WHILE the current page equals the total pages, THE Admin_View SHALL render the Next button in a disabled state that prevents user interaction
4. WHEN the user clicks the Next button, THE Admin_View SHALL increment the current page by 1 and display the corresponding slice of employee rows for the new page
5. WHEN the user clicks the Previous button, THE Admin_View SHALL decrement the current page by 1 and display the corresponding slice of employee rows for the new page

### Requirement 11: Hydration Loading State

**User Story:** As an admin, I want a loading indicator while data hydrates, so that I see a skeleton state instead of a misleading "No employees found" message.

#### Acceptance Criteria

1. WHILE the employee data is hydrating or loading, THE Admin_View SHALL display a skeleton placeholder consisting of at least 5 rows that match the table's column layout in place of the table body
2. WHILE the employee data is hydrating or loading, THE Admin_View SHALL NOT display the "No employees found" empty state message
3. WHEN hydration completes successfully, THE Admin_View SHALL replace the skeleton with the actual employee rows
4. WHEN hydration completes successfully and no employees exist in the store, THE Admin_View SHALL display the "No employees found" empty state message
5. IF hydration does not complete within 30 seconds AND the hydration process is truly stalled (not actively running), THEN THE Admin_View SHALL hide the skeleton and display an error message indicating that employee data could not be loaded. IF the hydration process is still actively running at the 30-second mark, THE Admin_View SHALL wait for it to complete naturally
