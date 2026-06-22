/** @jest-environment jsdom */
// Feature: disciplinary-workflow-enhancement, Property 6: Notes are displayed in reverse-chronological order
// Feature: disciplinary-workflow-enhancement, Property 9: Closed cases have no write-action buttons rendered
// Feature: disciplinary-workflow-enhancement, Property 10: Admin list row hides Edit and Delete for closed cases
// Feature: disciplinary-workflow-enhancement, Property 11: Admin Dashboard awaiting count uses three-status set
// Feature: disciplinary-workflow-enhancement, Property 12: Employee needs-action count uses four-status set

// Mock db service to prevent database calls and setup mocks
jest.mock("@/services/db.service", () => ({
  ...jest.requireActual("@/services/db.service"),
  disciplinaryDb: {
    fetchCases: jest.fn().mockResolvedValue([]),
    fetchNTEs: jest.fn().mockResolvedValue([]),
    fetchNODs: jest.fn().mockResolvedValue([]),
    fetchNotes: jest.fn().mockResolvedValue([]),
    upsertCase: jest.fn().mockResolvedValue(true),
    upsertNote: jest.fn().mockResolvedValue(true),
  },
}));

import * as fc from "fast-check";
import React from "react";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { disciplinaryDb } from "@/services/db.service";

// Mocks for Next.js navigation and custom hooks
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock("@/lib/hooks/use-role-href", () => ({
  useRoleHref: () => (path: string) => path,
}));

// Mock Recharts to avoid layout measuring crashes in JSDOM
jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => children,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  PieChart: () => null,
  Pie: () => null,
  Cell: () => null,
  AreaChart: () => null,
  Area: () => null,
}));

// Mock react.use to return a deterministic role and caseId for testing DisciplinaryCasePage
let mockParams = { role: "admin", caseId: "CASE-1" };
jest.mock("react", () => {
  const originalReact = jest.requireActual("react");
  return {
    ...originalReact,
    use: (promiseOrContext: any) => {
      if (promiseOrContext && typeof promiseOrContext.then === "function") {
        return mockParams;
      }
      return originalReact.use(promiseOrContext);
    },
  };
});

// Import components to test
import DisciplinaryAdminView from "@/app/[role]/disciplinary/_views/admin-view";
import DisciplinaryCasePage from "@/app/[role]/disciplinary/[caseId]/page";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import DisciplinaryEmployeeView from "@/app/[role]/disciplinary/_views/employee-view";
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard";

// Import stores to seed states
import { useDisciplinaryStore } from "@/store/disciplinary.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import type { DisciplinaryCase, DisciplinaryCaseStatus, SeverityLevel, CaseResult, DisciplinaryNote } from "@/types";

// Setup global mock for fetch (used in EmployeeDashboard)
global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ status: "checked_out", checkIn: null, checkOut: null }),
  })
) as jest.Mock;

const EMP_ID = "EMP-TEST-001";
const currentUserMock = {
  id: EMP_ID,
  name: "Test Employee",
  email: "test@example.com",
  role: "employee" as const,
  passwordHash: "xxx",
  mustChangePassword: false,
  profileComplete: true,
  createdAt: new Date().toISOString(),
};

const employeeMock = {
  id: EMP_ID,
  profileId: EMP_ID,
  name: "Test Employee",
  email: "test@example.com",
  role: "employee" as const,
  jobTitle: "Developer",
  department: "Engineering",
  workType: "WFO" as const,
  salary: 50000,
  joinDate: "2024-01-15",
  productivity: 80,
  status: "active" as const,
  location: "",
};

const HR_ID = "EMP-HR-001";
const hrUserMock = {
  id: HR_ID,
  name: "Carla HR",
  email: "carla.hr@test.com",
  role: "hr" as const,
  passwordHash: "xxx",
  mustChangePassword: false,
  profileComplete: true,
  createdAt: new Date().toISOString(),
};

const hrEmployeeMock = {
  id: HR_ID,
  profileId: HR_ID,
  name: "Carla HR",
  email: "carla.hr@test.com",
  role: "hr" as const,
  jobTitle: "HR Manager",
  department: "Human Resources",
  workType: "WFO" as const,
  salary: 60000,
  joinDate: "2023-01-15",
  productivity: 90,
  status: "active" as const,
  location: "",
};

// Safe date generator (returns ISO strings directly) to avoid toISOString failures on extreme years
const safeDateStrArb = fc.integer({
  min: new Date("2020-01-01").getTime(),
  max: new Date("2030-12-31").getTime(),
}).map(ts => new Date(ts).toISOString());

beforeEach(() => {
  (disciplinaryDb.fetchCases as jest.Mock).mockResolvedValue([]);
  (disciplinaryDb.fetchNTEs as jest.Mock).mockResolvedValue([]);
  (disciplinaryDb.fetchNODs as jest.Mock).mockResolvedValue([]);
  (disciplinaryDb.fetchNotes as jest.Mock).mockResolvedValue([]);
  (disciplinaryDb.upsertCase as jest.Mock).mockResolvedValue(true);
  (disciplinaryDb.upsertNote as jest.Mock).mockResolvedValue(true);

  act(() => {
    useDisciplinaryStore.setState({ cases: [], ntes: [], nods: [], notes: [] });
    useEmployeesStore.setState({ employees: [employeeMock, hrEmployeeMock] });
    useAuthStore.setState({ currentUser: currentUserMock, isAuthenticated: true });
  });
});

// ── Property 6: Notes sort ───────────────────────────────────────
describe("Property 6: Notes are displayed in reverse-chronological order", () => {
  it("displays notes in reverse-chronological order based on createdAt timestamp", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.record({
            id: fc.string({ minLength: 5 }),
            caseId: fc.constant("CASE-1"),
            authorId: fc.constant(HR_ID),
            body: fc.stringMatching(/^Note \d+$/),
            createdAt: safeDateStrArb,
          }),
          { selector: (n) => n.createdAt } // unique timestamps to avoid stable sort variance
        ),
        (generatedNotes) => {
          act(() => {
            useAuthStore.setState({ currentUser: hrUserMock, isAuthenticated: true });
            const baseCase: DisciplinaryCase = {
              id: "CASE-1",
              caseNumber: "CASE-2026-0001",
              employeeId: EMP_ID,
              violationType: "Policy Violation",
              incidentDate: "2026-06-01",
              description: "A case description",
              status: "under_review",
              createdAt: "2026-06-01T00:00:00Z",
              updatedAt: "2026-06-01T00:00:00Z",
              evidenceUrls: [],
              createdBy: HR_ID,
            };
            useDisciplinaryStore.setState({
              cases: [baseCase],
              notes: generatedNotes,
            });
          });

          mockParams = { role: "hr", caseId: "CASE-1" };

          const { unmount } = render(
            React.createElement(DisciplinaryCasePage, {
              params: Promise.resolve(mockParams),
            })
          );

          if (generatedNotes.length > 0) {
            const noteElements = screen.getAllByText(/^Note \d+$/);
            const renderedBodies = noteElements.map((el) => el.textContent);

            const expectedSortedNotes = [...generatedNotes].sort((a, b) =>
              b.createdAt.localeCompare(a.createdAt)
            );
            const expectedBodies = expectedSortedNotes.map((n) => n.body);

            expect(renderedBodies).toEqual(expectedBodies);
          }

          unmount();
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ── Property 9: Closed cases read-only state ──────────────────────
describe("Property 9: Closed cases have no write-action buttons rendered", () => {
  it("hides all edit, delete, close case, and lifecycle action buttons when case is closed", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.constant("CASE-1"),
          caseNumber: fc.string(),
          employeeId: fc.constant(EMP_ID),
          violationType: fc.string(),
          incidentDate: safeDateStrArb,
          description: fc.string(),
          status: fc.constant<DisciplinaryCaseStatus>("closed"),
          createdAt: safeDateStrArb,
          updatedAt: safeDateStrArb,
          evidenceUrls: fc.constant<string[]>([]),
          createdBy: fc.constant(HR_ID),
        }),
        (closedCase) => {
          act(() => {
            useAuthStore.setState({ currentUser: hrUserMock, isAuthenticated: true });
            useDisciplinaryStore.setState({
              cases: [closedCase],
              notes: [],
              ntes: [],
              nods: [],
            });
          });

          mockParams = { role: "hr", caseId: "CASE-1" };

          const { unmount } = render(
            React.createElement(DisciplinaryCasePage, {
              params: Promise.resolve(mockParams),
            })
          );

          const forbiddenTexts = [
            "Edit",
            "Delete",
            "Close Case",
            "Issue NTE",
            "Acknowledge NTE",
            "Submit Explanation",
            "Record Explanation",
            "Mark No-Response",
            "Move to Under Review",
            "Issue NOD",
            "Acknowledge NOD",
            "Mark Sanction Completed",
            "Save Note",
          ];

          forbiddenTexts.forEach((text) => {
            const btn = screen.queryByRole("button", { name: new RegExp(text, "i") });
            expect(btn).toBeNull();
          });

          unmount();
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ── Property 10: Admin row closed cases read-only ──────────────────
describe("Property 10: Admin list row hides Edit and Delete for closed cases", () => {
  it("hides Edit and Delete buttons for closed cases but displays them for other cases in the table", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.record({
            id: fc.string({ minLength: 5 }),
            caseNumber: fc.string({ minLength: 5 }),
            employeeId: fc.constant(EMP_ID),
            violationType: fc.string({ minLength: 5 }),
            incidentDate: safeDateStrArb.map(s => s.slice(0, 10)),
            description: fc.string(),
            status: fc.constantFrom<DisciplinaryCaseStatus>("open", "closed", "nte_issued", "under_review"),
            createdAt: safeDateStrArb,
            updatedAt: safeDateStrArb,
            evidenceUrls: fc.constant<string[]>([]),
            createdBy: fc.constant(HR_ID),
          }),
          { selector: (c) => c.id }
        ),
        (generatedCases) => {
          generatedCases.forEach((c, idx) => {
            c.caseNumber = `CASE-PBT-${String(idx).padStart(4, "0")}`;
          });

          act(() => {
            useAuthStore.setState({ currentUser: hrUserMock, isAuthenticated: true });
            useDisciplinaryStore.setState({
              cases: generatedCases,
              notes: [],
              ntes: [],
              nods: [],
            });
          });

          const { unmount } = render(React.createElement(DisciplinaryAdminView));

          generatedCases.forEach((c) => {
            if (c.status === "draft") return;

            const caseNumElements = screen.queryAllByText(c.caseNumber);
            if (caseNumElements.length === 0) return;

            const row = caseNumElements[0].closest("tr");
            expect(row).not.toBeNull();

            const editBtn = row?.querySelector('[title="Edit"]');
            const deleteBtn = row?.querySelector('[title="Delete"]');

            if (c.status === "closed") {
              expect(editBtn).toBeNull();
              expect(deleteBtn).toBeNull();
            } else {
              expect(editBtn).not.toBeNull();
              expect(deleteBtn).not.toBeNull();
            }
          });

          unmount();
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ── Property 11: Admin dashboard awaiting count ──────────────────
describe("Property 11: Admin Dashboard awaiting count uses three-status set", () => {
  it("aggregates the awaiting response count using only nte_issued, nte_acknowledged, and no_response", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 5 }),
            caseNumber: fc.string({ minLength: 5 }),
            employeeId: fc.constant(EMP_ID),
            violationType: fc.string(),
            incidentDate: safeDateStrArb,
            description: fc.string(),
            status: fc.constantFrom<DisciplinaryCaseStatus>(
              "draft",
              "open",
              "nte_issued",
              "nte_acknowledged",
              "no_response",
              "under_review",
              "nod_issued",
              "closed"
            ),
            createdAt: safeDateStrArb,
            updatedAt: safeDateStrArb,
            evidenceUrls: fc.constant<string[]>([]),
            createdBy: fc.constant(HR_ID),
          })
        ),
        (generatedCases) => {
          const expectedCount = generatedCases.filter((c) =>
            ["nte_issued", "nte_acknowledged", "no_response"].includes(c.status)
          ).length;

          act(() => {
            useAuthStore.setState({ currentUser: hrUserMock, isAuthenticated: true });
            useDisciplinaryStore.setState({
              cases: generatedCases,
              notes: [],
              ntes: [],
              nods: [],
            });
          });

          const { unmount } = render(React.createElement(AdminDashboard));

          const awaitingText = screen.queryByText(new RegExp(`${expectedCount} awaiting explanation`, "i"));
          expect(awaitingText).not.toBeNull();

          unmount();
        }
      ),
      { numRuns: 20 }
    );
  });
});

// ── Property 12: Employee Needs Action count ──────────────────────
describe("Property 12: Employee needs-action count uses four-status set", () => {
  it("aggregates the Needs Action count using nte_issued, nte_acknowledged, nod_issued, and nod_acknowledged", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 5 }),
            caseNumber: fc.string({ minLength: 5 }),
            employeeId: fc.constant(EMP_ID),
            violationType: fc.string(),
            incidentDate: safeDateStrArb,
            description: fc.string(),
            status: fc.constantFrom<DisciplinaryCaseStatus>(
              "draft",
              "open",
              "nte_issued",
              "nte_acknowledged",
              "no_response",
              "under_review",
              "nod_issued",
              "nod_acknowledged",
              "closed"
            ),
            createdAt: safeDateStrArb,
            updatedAt: safeDateStrArb,
            evidenceUrls: fc.constant<string[]>([]),
            createdBy: fc.constant(HR_ID),
          })
        ),
        (generatedCases) => {
          const needsActionCount = generatedCases.filter((c) =>
            ["nte_issued", "nte_acknowledged", "nod_issued", "nod_acknowledged"].includes(c.status)
          ).length;

          act(() => {
            useAuthStore.setState({ currentUser: currentUserMock, isAuthenticated: true });
            useDisciplinaryStore.setState({
              cases: generatedCases,
              notes: [],
              ntes: [],
              nods: [],
            });
          });

          // Render employee view and assert Needs My Action count
          const { unmount: unmountView } = render(React.createElement(DisciplinaryEmployeeView));
          const labelEl = screen.getByText("Needs My Action");
          const cardContainer = labelEl.closest("div");
          const valueEl = cardContainer?.querySelector(".text-3xl");
          expect(valueEl?.textContent).toBe(String(needsActionCount));
          unmountView();

          // Render employee dashboard and assert Needs Action vs My Cases label
          const { unmount: unmountDash } = render(React.createElement(EmployeeDashboard));
          if (needsActionCount > 0) {
            const needsActionLabel = screen.queryByText(/Needs Action/i);
            expect(needsActionLabel).not.toBeNull();
          } else {
            const myCasesLabel = screen.queryByText(/My Cases/i);
            expect(myCasesLabel).not.toBeNull();
          }
          unmountDash();
        }
      ),
      { numRuns: 20 }
    );
  });
});
