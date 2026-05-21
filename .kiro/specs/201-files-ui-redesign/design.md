# Design Document

## Overview

This design covers the UI-only redesign of the 201 Files admin dashboard (`Documents201AdminView`). The backend sync layer is already complete (see `201-files-supabase-sync` spec). Data flows into the component via two Zustand stores: `useEmployeesStore` (seed-initialized, no persist) and `useDocumentsStore` (persisted via `safePersistStorage`).

The redesign addresses five concerns:

1. **Visual declutter** — remove the heading icon, the "Employees" card header, and the decorative dots next to metric numbers.
2. **Department filtering** — add a dropdown populated from active employees' departments, combined with the existing search bar via AND logic.
3. **Pagination** — slice the filtered employee list into pages of 10, with Previous/Next controls and a "Page X of Y" indicator.
4. **Filter-pagination coordination** — reset to page 1 whenever the department filter or search input changes.
5. **Hydration loading state** — show a skeleton table body while the documents store rehydrates, preventing a flash of "No employees found."

All changes are confined to the `admin-view.tsx` component and its local helpers. No new stores, API routes, or database changes are required.

## Architecture

```mermaid
graph TD
    subgraph Zustand Stores
        ES[useEmployeesStore<br/>employees: Employee[]]
        DS[useDocumentsStore<br/>documents: Employee201Document[]]
    end

    subgraph Admin View Component
        HS[Hydration Check]
        FP[Filter Pipeline]
        PG[Pagination Slice]
        UI[Render]
    end

    ES -->|employees| HS
    DS -->|documents, persist status| HS
    HS -->|hydrated=false| UI
    HS -->|hydrated=true| FP
    FP -->|search + department filter| PG
    PG -->|page slice| UI
```

### Data Flow

1. Component mounts → checks `useDocumentsStore.persist.hasHydrated()`.
2. While not hydrated: render skeleton rows (≥5 rows matching 6-column layout).
3. Once hydrated: run the filter pipeline (search → department → sort → paginate).
4. Render the current page slice into the table body.

### State Ownership

All new state lives as local `useState` hooks inside `Documents201AdminView`:

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `departmentFilter` | `string` | `"all"` | Selected department or `"all"` |
| `currentPage` | `number` | `1` | Active page number |
| `isHydrated` | `boolean` | `false` | Tracks documents store rehydration |

The existing `search` state remains unchanged.

Constants:
- `ITEMS_PER_PAGE = 10`

## Components and Interfaces

### Modified: `Documents201AdminView`

The main component receives the following changes:

```typescript
// New local state
const [departmentFilter, setDepartmentFilter] = useState<string>("all");
const [currentPage, setCurrentPage] = useState(1);
const [isHydrated, setIsHydrated] = useState(false);

// Hydration detection (documents store uses persist middleware)
useEffect(() => {
  const unsub = useDocumentsStore.persist.onFinishHydration(() => {
    setIsHydrated(true);
  });
  // If already hydrated by the time effect runs
  if (useDocumentsStore.persist.hasHydrated()) {
    setIsHydrated(true);
  }
  return unsub;
}, []);
```

### Modified: `DocTile`

Remove the conditional dot element:

```diff
- {value > 0 && <span className={`mb-0.5 h-1.5 w-1.5 rounded-full ${s.dot}`} />}
```

### New: `DepartmentDropdown` (inline)

A `<Select>` component placed adjacent to the search bar:

```typescript
interface DepartmentDropdownProps {
  value: string;
  onChange: (value: string) => void;
  departments: string[]; // sorted unique departments from active employees
}
```

### New: `PaginationFooter` (inline)

A footer below the table card:

```typescript
interface PaginationFooterProps {
  currentPage: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}
```

Renders: `[Previous] Page X of Y [Next]`

### New: `TableSkeleton` (inline)

Renders 5 skeleton rows matching the 6-column table layout using the existing `<Skeleton>` component from `@/components/ui/skeleton`.

## Data Models

No new data models are introduced. The feature operates on existing types:

### Existing Types Used

```typescript
// From @/types
interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  status: EmployeeStatus; // "active" | "inactive" | "on_leave" | "terminated" | "resigned"
  // ... other fields
}

// From @/lib/constants
const DEPARTMENTS: readonly string[] = [
  "Engineering", "Design", "Marketing",
  "Human Resources", "Finance", "Sales", "Operations"
];
```

### Filter Pipeline (computed via `useMemo`)

```typescript
// Step 1: Active employees only
// Step 2: Department filter (skip if "all")
// Step 3: Search text filter (name/email/ID)
// Step 4: Sort by completeness ascending
// Result: filteredEmployees[]

// Step 5: Pagination slice
// paginatedEmployees = filteredEmployees.slice(
//   (currentPage - 1) * ITEMS_PER_PAGE,
//   currentPage * ITEMS_PER_PAGE
// )
```

### Derived Values

```typescript
const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE));
const uniqueDepartments = [...new Set(
  employees.filter(e => e.status === "active").map(e => e.department).filter(Boolean)
)].sort();
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Filter pipeline correctness

*For any* list of employees, any department filter value (either "all" or a specific department string), and any search text, the filtered result set SHALL contain exactly those employees where: (a) status is "active", AND (b) department matches the filter (all employees when filter is "all"; exact case-sensitive match when a specific department is selected; employees with empty/unset department excluded when a specific department is selected), AND (c) name, email, or ID contains the search text (case-insensitive).

**Validates: Requirements 4.3, 4.4, 6.2, 6.3, 6.5**

### Property 2: Page bounds invariant

*For any* non-negative count of filtered employees, the total pages value SHALL equal `max(1, ceil(count / 10))`, and the current page SHALL always satisfy `1 <= currentPage <= totalPages`.

**Validates: Requirements 5.1, 7.1, 7.4**

### Property 3: Pagination slice correctness

*For any* filtered employee list of length N and any valid current page P (where 1 ≤ P ≤ totalPages), the displayed employees SHALL be exactly `filteredEmployees.slice((P - 1) * 10, P * 10)`.

**Validates: Requirements 5.3, 7.2**

### Property 4: Filter change resets page

*For any* current page value greater than 1, when either the department filter value or the search input value changes, the current page SHALL be reset to 1 before the next render.

**Validates: Requirements 5.4, 8.1, 8.2**

### Property 5: Dropdown options derived from active employees

*For any* set of employees in the store, the department dropdown options SHALL consist of "All Departments" followed by the alphabetically sorted unique non-empty department values from employees with status "active".

**Validates: Requirements 9.2, 9.5**

## Error Handling

| Scenario | Handling |
|----------|----------|
| Hydration timeout (30s stall) | Display error message "Employee data could not be loaded" and hide skeleton. Only triggers if hydration is truly stalled (not actively running). |
| Empty employee store after hydration | Display "No employees found" empty state row (colSpan=6). |
| Employee with empty/null department | Excluded from specific department filter results; included under "All Departments". |
| Current page exceeds total pages after filter change | Clamp `currentPage` to `totalPages` (which is at minimum 1). |
| Zero filtered results | Show empty state row; pagination shows "Page 1 of 1" with both buttons disabled. |

## Testing Strategy

### Unit Tests (Example-Based)

Focus on concrete rendering assertions and UI interactions:

- **Visual declutter**: Heading renders without icon; no CardHeader in table card; no dot elements in DocTile.
- **Initial state**: Department filter defaults to "all"; page defaults to 1.
- **Pagination controls**: Previous disabled on page 1; Next disabled on last page; clicking Next/Previous updates page.
- **Hydration states**: Skeleton renders during hydration; "No employees found" hidden during hydration; skeleton replaced after hydration; error shown after 30s stall.
- **Edge cases**: Zero employees after hydration shows empty state; single page hides pagination controls; employees with empty department only appear under "All Departments".

### Property-Based Tests

Library: **fast-check** (already available in the JS/TS ecosystem, pairs well with Jest/Vitest)

Each property test runs a minimum of 100 iterations with randomly generated employee data.

| Property | Generator Strategy |
|----------|-------------------|
| Property 1: Filter pipeline | Generate arrays of Employee objects with random names, emails, departments (including empty), and statuses. Generate random department filter and search text. |
| Property 2: Page bounds | Generate random non-negative integers for filtered count. Verify formula. |
| Property 3: Pagination slice | Generate random arrays (0–100 items) and random valid page numbers. Verify slice. |
| Property 4: Filter reset | Generate sequences of state changes (department selections, search keystrokes) with arbitrary starting page. Verify reset. |
| Property 5: Dropdown options | Generate random employee arrays with various departments and statuses. Verify derived options. |

### Test Configuration

- Minimum 100 iterations per property test
- Tag format: `Feature: 201-files-ui-redesign, Property {N}: {title}`
- Test runner: Vitest (project standard) with fast-check integration
- Each correctness property maps to exactly one property-based test

