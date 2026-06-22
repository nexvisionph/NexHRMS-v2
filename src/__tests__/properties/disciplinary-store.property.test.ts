/** @jest-environment jsdom */
// Feature: disciplinary-workflow-enhancement, Property 1: New case fields are preserved by the store
// Feature: disciplinary-workflow-enhancement, Property 2: Draft creation suppresses notifications and sets draft status

/**
 * Property-Based Tests — Disciplinary Store: createCase new-fields preservation
 *                                             saveDraft notification suppression
 *
 * Validates: Requirements 1.4, 2.3 (Property 1)
 *            Requirements 3.2      (Property 2)
 *
 * Property 1: For any valid severityLevel value (including undefined) and any
 * witnesses string (including empty), calling createCase with those values should
 * produce a DisciplinaryCase where:
 *   - severityLevel === input.severityLevel
 *   - witnesses === input.witnesses
 *   - result === input.result (when provided)
 *
 * Property 2: For any valid case creation payload, calling saveDraft should:
 *   - return a case with status === "draft"
 *   - store the case in get().cases with status === "draft"
 *   - NOT dispatch a "disciplinary_case_created" notification for the employee
 */

// Mock disciplinaryDb so DB write-throughs succeed
jest.mock("@/services/db.service", () => ({
  ...jest.requireActual("@/services/db.service"),
  disciplinaryDb: {
    ...jest.requireActual("@/services/db.service").disciplinaryDb,
    upsertCase: jest.fn().mockResolvedValue(true),
    upsertNote: jest.fn().mockResolvedValue(true),
  },
}));

import * as fc from "fast-check";
import { renderHook, act } from "@testing-library/react";
import { useDisciplinaryStore } from "@/store/disciplinary.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { useEmployeesStore } from "@/store/employees.store";
import { disciplinaryDb } from "@/services/db.service";
import type { SeverityLevel, CaseResult } from "@/types";

beforeEach(() => {
  (disciplinaryDb.upsertCase as jest.Mock).mockResolvedValue(true);
  (disciplinaryDb.upsertNote as jest.Mock).mockResolvedValue(true);
});

// ── Arbitraries ────────────────────────────────────────────────

/** Generates one of the four valid severity levels or undefined */
const severityLevelArb = fc.option(
  fc.constantFrom<SeverityLevel>("minor", "moderate", "major", "critical"),
  { nil: undefined }
);

/** Generates any string for witnesses, including empty string */
const witnessesArb = fc.option(fc.string(), { nil: undefined });

/** Generates one of the eight valid CaseResult values or undefined */
const caseResultArb = fc.option(
  fc.constantFrom<CaseResult>(
    "DISMISSED",
    "VERBAL_WARNING",
    "WRITTEN_WARNING",
    "FINAL_WARNING",
    "SUSPENSION",
    "TERMINATION",
    "WITHDRAWN",
    "SETTLED"
  ),
  { nil: undefined }
);

// ── Constants ──────────────────────────────────────────────────

const EMP = "EMP-PBT-001";
const HR = "HR-PBT-001";

// ── Property Test ──────────────────────────────────────────────

describe("Property 1: createCase preserves new fields (severityLevel, witnesses, result)", () => {
  beforeEach(() => {
    const { result } = renderHook(() => useDisciplinaryStore());
    act(() => result.current.resetToSeed());
  });

  it(
    "severityLevel, witnesses, and result on the returned case always equal the input values",
    () => {
      fc.assert(
        fc.property(
          severityLevelArb,
          witnessesArb,
          caseResultArb,
          (severityLevel, witnesses, result) => {
            const { result: hook } = renderHook(() => useDisciplinaryStore());

            // Reset before each iteration so case numbering is clean
            act(() => hook.current.resetToSeed());

            let created: ReturnType<typeof hook.current.createCase> | undefined;

            act(() => {
              created = hook.current.createCase({
                employeeId: EMP,
                violationType: "Policy Violation",
                incidentDate: "2025-06-01",
                description: "PBT generated case",
                evidenceUrls: [],
                createdBy: HR,
                // Only pass the field when it is not undefined so we don't
                // accidentally override a default with an explicit undefined key
                ...(severityLevel !== undefined ? { severityLevel } : {}),
                ...(witnesses !== undefined ? { witnesses } : {}),
                ...(result !== undefined ? { result } : {}),
              });
            });

            // The returned case must mirror exactly what was provided
            expect(created?.severityLevel).toBe(severityLevel);
            expect(created?.witnesses).toBe(witnesses);
            expect(created?.result).toBe(result);

            // The case stored in state must also reflect the same values
            const stored = hook.current.cases[0];
            expect(stored?.severityLevel).toBe(severityLevel);
            expect(stored?.witnesses).toBe(witnesses);
            expect(stored?.result).toBe(result);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ── Property 2 Arbitraries ─────────────────────────────────────

/**
 * Generates a non-empty employee ID in the form "EMP-<alphanumeric>" so that
 * the notifications store can associate the employee with a real record.
 * We keep it short and deterministic enough to avoid nanoid collisions.
 */
const employeeIdArb = fc
  .stringMatching(/^[A-Z]{2,4}$/)
  .map((prefix) => `${prefix}-PBT`);

/** Generates a non-empty violation type string */
const violationTypeArb = fc.string({ minLength: 1, maxLength: 40 });

/** Generates a simple YYYY-MM-DD date string */
const incidentDateArb = fc
  .integer({ min: 2020, max: 2030 })
  .chain((year) =>
    fc
      .integer({ min: 1, max: 12 })
      .chain((month) =>
        fc
          .integer({ min: 1, max: 28 })
          .map(
            (day) =>
              `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          )
      )
  );

/** Generates a non-empty description */
const descriptionArb = fc.string({ minLength: 1, maxLength: 200 });

/** Generates an array of 0–3 URL strings */
const evidenceUrlsArb = fc.array(
  fc.webUrl(),
  { minLength: 0, maxLength: 3 }
);

// ── Property 2 Test ────────────────────────────────────────────

describe(
  "Property 2: saveDraft sets status === 'draft' and suppresses notifications",
  () => {
    const HR = "HR-PBT-001";

    beforeEach(() => {
      // Reset all three stores before each property run
      act(() => {
        useDisciplinaryStore.getState().resetToSeed();
        useNotificationsStore.getState().resetToSeed();
        useEmployeesStore.setState({ employees: [] });
      });
    });

    it(
      // Feature: disciplinary-workflow-enhancement, Property 2: Draft creation suppresses notifications and sets draft status
      "Validates: Requirements 3.2 — saveDraft always returns status 'draft' and never logs disciplinary_case_created",
      () => {
        fc.assert(
          fc.property(
            employeeIdArb,
            violationTypeArb,
            incidentDateArb,
            descriptionArb,
            evidenceUrlsArb,
            (employeeId, violationType, incidentDate, description, evidenceUrls) => {
              const { result: hook } = renderHook(() => useDisciplinaryStore());

              // Reset stores on every iteration
              act(() => {
                hook.current.resetToSeed();
                useNotificationsStore.getState().resetToSeed();
                // Put the employee in the employees store so dispatchNotification
                // would fire if saveDraft mistakenly called it
                useEmployeesStore.setState({
                  employees: [
                    createMockEmployee({
                      id: employeeId,
                      name: "Draft Employee",
                      email: `${employeeId.toLowerCase()}@test.com`,
                      role: "employee",
                      status: "active",
                    }),
                  ],
                });
              });

              let created: ReturnType<typeof hook.current.saveDraft> | undefined;

              act(() => {
                created = hook.current.saveDraft({
                  employeeId,
                  violationType,
                  incidentDate,
                  description,
                  evidenceUrls,
                  createdBy: HR,
                });
              });

              // 1. Returned case must have status === "draft"
              expect(created?.status).toBe("draft");

              // 2. The case stored in state must also have status === "draft"
              const stored = hook.current.cases.find((c) => c.id === created?.id);
              expect(stored).toBeDefined();
              expect(stored?.status).toBe("draft");

              // 3. No "disciplinary_case_created" notification should have been
              //    dispatched for the employee (or anyone else)
              const disciplinaryCreatedLogs = useNotificationsStore
                .getState()
                .logs.filter((log) => log.type === "disciplinary_case_created");

              expect(disciplinaryCreatedLogs).toHaveLength(0);
            }
          ),
          { numRuns: 100 }
        );
      }
    );
  }
);

// ── Property 3 ─────────────────────────────────────────────────
// Feature: disciplinary-workflow-enhancement, Property 3: getDashboardStats excludes drafts from non-open buckets

/**
 * Property 3: getDashboardStats excludes drafts from non-open buckets
 *
 * Validates: Requirements 3.3, 8.8
 *
 * For any collection of DisciplinaryCase objects that includes cases with
 * status === "draft", getDashboardStats() should return awaitingExplanation,
 * forReview, nodPending, and suspensionsActive values that do not count any
 * draft case.
 */

import type { DisciplinaryCase, DisciplinaryCaseStatus } from "@/types";

/** All statuses the generated test data may include, including "draft" */
const ALL_STATUSES: DisciplinaryCaseStatus[] = [
  "draft",
  "open",
  "nte_issued",
  "nte_acknowledged",
  "explanation_submitted",
  "no_response",
  "under_review",
  "nod_issued",
  "nod_acknowledged",
  "sanction_active",
  "closed",
];

/** Builds a minimal DisciplinaryCase with the given status */
function makeCase(status: DisciplinaryCaseStatus, index: number): DisciplinaryCase {
  const padded = String(index).padStart(4, "0");
  return {
    id: `CASE-PBT3-${padded}`,
    caseNumber: `CASE-2025-${padded}`,
    employeeId: "EMP-PBT3-001",
    violationType: "PBT Policy Violation",
    incidentDate: "2025-01-01",
    description: "Generated by property test 3",
    evidenceUrls: [],
    status,
    createdBy: "HR-PBT3",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
}

describe(
  "Property 3: getDashboardStats excludes draft cases from non-open buckets",
  () => {
    beforeEach(() => {
      act(() => {
        useDisciplinaryStore.getState().resetToSeed();
      });
    });

    it(
      // Feature: disciplinary-workflow-enhancement, Property 3: getDashboardStats excludes drafts from non-open buckets
      // Validates: Requirements 3.3, 8.8",
      "awaitingExplanation / forReview / nodPending / suspensionsActive never count draft cases",
      () => {
        fc.assert(
          fc.property(
            // Generate an array of 0–20 statuses from the full set (including "draft")
            fc.array(fc.constantFrom(...ALL_STATUSES), { minLength: 0, maxLength: 20 }),
            (statuses) => {
              const { result: hook } = renderHook(() => useDisciplinaryStore());

              // Reset store on every iteration
              act(() => hook.current.resetToSeed());

              // Build a minimal DisciplinaryCase for each generated status
              const generatedCases = statuses.map((status, i) => makeCase(status, i));

              // Inject cases directly into the store (bypass action flows)
              act(() => {
                useDisciplinaryStore.setState({ cases: generatedCases });
              });

              // Compute the stats via the selector
              const stats = hook.current.getDashboardStats();

              // ── Expected counts (non-draft only) ──────────────────────

              const nonDraft = generatedCases.filter((c) => c.status !== "draft");

              const expectedAwaitingExplanation = nonDraft.filter(
                (c) => c.status === "nte_issued" || c.status === "nte_acknowledged"
              ).length;

              const expectedForReview = nonDraft.filter(
                (c) =>
                  c.status === "explanation_submitted" ||
                  c.status === "no_response" ||
                  c.status === "under_review"
              ).length;

              const expectedNodPending = nonDraft.filter(
                (c) => c.status === "nod_issued"
              ).length;

              const expectedSuspensionsActive = nonDraft.filter(
                (c) => c.status === "sanction_active"
              ).length;

              // ── Assertions ────────────────────────────────────────────

              expect(stats.awaitingExplanation).toBe(expectedAwaitingExplanation);
              expect(stats.forReview).toBe(expectedForReview);
              expect(stats.nodPending).toBe(expectedNodPending);
              expect(stats.suspensionsActive).toBe(expectedSuspensionsActive);
            }
          ),
          { numRuns: 100 }
        );
      }
    );
  }
);

// ── Property 4 ─────────────────────────────────────────────────
// Feature: disciplinary-workflow-enhancement, Property 4: Draft-to-open transition produces correct state

/**
 * Property 4: Draft-to-open transition produces correct state
 *
 * Validates: Requirements 3.7
 *
 * For any draft case (with varying violationType, incidentDate, description, etc.),
 * calling submitCase should:
 *   1. Change the case status from "draft" to "open"
 *   2. The new updatedAt is a valid ISO timestamp that is >= the original updatedAt
 */



describe(
  "Property 4: submitCase transitions draft → open with correct updatedAt",
  () => {
    beforeEach(() => {
      act(() => {
        useDisciplinaryStore.getState().resetToSeed();
      });
    });

    it(
      // Feature: disciplinary-workflow-enhancement, Property 4: Draft-to-open transition produces correct state
      // Validates: Requirements 3.7
      "submitCase always moves status to 'open' and updatedAt is >= original updatedAt",
      async () => {
        await fc.assert(
          fc.asyncProperty(
            violationTypeArb,
            incidentDateArb,
            descriptionArb,
            evidenceUrlsArb,
            async (violationType, incidentDate, description, evidenceUrls) => {
              const { result: hook } = renderHook(() => useDisciplinaryStore());

              // Reset store on every iteration
              act(() => {
                hook.current.resetToSeed();
              });

              // Step 1: create a draft case via saveDraft
              let draft: ReturnType<typeof hook.current.saveDraft> | undefined;

              act(() => {
                draft = hook.current.saveDraft({
                  employeeId: EMP,
                  violationType,
                  incidentDate,
                  description,
                  evidenceUrls,
                  createdBy: HR,
                });
              });

              expect(draft).toBeDefined();
              expect(draft!.status).toBe("draft");

              const originalUpdatedAt = draft!.updatedAt;

              // Step 2: call submitCase — it is async so we must await inside act
              await act(async () => {
                await hook.current.submitCase(draft!.id, HR);
              });

              // Step 3: read the updated case from the store
              const updated = hook.current.cases.find((c) => c.id === draft!.id);

              // Assertion 1: status must now be "open"
              expect(updated).toBeDefined();
              expect(updated!.status).toBe("open");

              // Assertion 2: updatedAt must be a valid ISO timestamp and >= original
              const originalTs = Date.parse(originalUpdatedAt);
              const updatedTs = Date.parse(updated!.updatedAt);
              expect(Number.isNaN(updatedTs)).toBe(false);
              expect(updatedTs).toBeGreaterThanOrEqual(originalTs);
            }
          ),
          { numRuns: 100 }
        );
      }
    );
  }
);

// ── Property 5 Test ────────────────────────────────────────────

describe("Property 5: addNote preserves body, authorId, and caseId", () => {
  beforeEach(() => {
    act(() => {
      useDisciplinaryStore.getState().resetToSeed();
    });
  });

  it("addNote returned value has matching fields and valid ISO timestamp", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).map(s => s.trim()).filter(s => s.length > 0), // non-empty, non-whitespace body
        fc.stringMatching(/^[A-Za-z0-9_-]{4,10}$/), // caseId
        fc.stringMatching(/^[A-Za-z0-9_-]{4,10}$/), // authorId
        (body, caseId, authorId) => {
          const { result: hook } = renderHook(() => useDisciplinaryStore());

          // Reset store on each run to prevent notes buildup
          act(() => hook.current.resetToSeed());

          let created: any;
          act(() => {
            created = hook.current.addNote(caseId, body, authorId);
          });

          expect(created).toBeDefined();
          expect(created.body).toBe(body);
          expect(created.caseId).toBe(caseId);
          expect(created.authorId).toBe(authorId);
          expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false);

          // Verify it is also stored in local state
          const stored = hook.current.notes.find((n) => n.id === created.id);
          expect(stored).toBeDefined();
          expect(stored?.body).toBe(body);
          expect(stored?.caseId).toBe(caseId);
          expect(stored?.authorId).toBe(authorId);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 7 Test ────────────────────────────────────────────

describe("Property 7: completeSanction sets closed status and result", () => {
  beforeEach(() => {
    act(() => {
      useDisciplinaryStore.getState().resetToSeed();
    });
  });

  it("completeSanction transitions case status to 'closed' and sets result", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<CaseResult>(
          "DISMISSED",
          "VERBAL_WARNING",
          "WRITTEN_WARNING",
          "FINAL_WARNING",
          "SUSPENSION",
          "TERMINATION",
          "WITHDRAWN",
          "SETTLED"
        ),
        async (caseResult) => {
          const { result: hook } = renderHook(() => useDisciplinaryStore());

          // Reset store
          act(() => hook.current.resetToSeed());

          // Create a mock case with status "sanction_active"
          const baseCase: DisciplinaryCase = {
            id: "CASE-PBT7",
            caseNumber: "CASE-2025-PBT7",
            employeeId: "EMP-PBT7",
            violationType: "PBT Policy Violation",
            incidentDate: "2025-01-01",
            description: "Property test case",
            evidenceUrls: [],
            status: "sanction_active",
            createdBy: "HR-PBT7",
            createdAt: "2025-01-01T00:00:00.000Z",
            updatedAt: "2025-01-01T00:00:00.000Z",
          };

          act(() => {
            useDisciplinaryStore.setState({ cases: [baseCase] });
          });

          await act(async () => {
            await hook.current.completeSanction("CASE-PBT7", caseResult, "HR-PBT7");
          });

          const updated = hook.current.cases.find((c) => c.id === "CASE-PBT7");
          expect(updated).toBeDefined();
          expect(updated!.status).toBe("closed");
          expect(updated!.result).toBe(caseResult);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ── Property 8 Test ────────────────────────────────────────────

describe("Property 8: closeCase result field round-trip", () => {
  beforeEach(() => {
    act(() => {
      useDisciplinaryStore.getState().resetToSeed();
    });
  });

  it("closeCase sets closed status and result", () => {
    fc.assert(
      fc.property(
        caseResultArb,
        (caseResult) => {
          const { result: hook } = renderHook(() => useDisciplinaryStore());

          // Reset store
          act(() => hook.current.resetToSeed());

          // Create a mock open case
          const baseCase: DisciplinaryCase = {
            id: "CASE-PBT8",
            caseNumber: "CASE-2025-PBT8",
            employeeId: "EMP-PBT8",
            violationType: "PBT Policy Violation",
            incidentDate: "2025-01-01",
            description: "Property test case",
            evidenceUrls: [],
            status: "open",
            createdBy: "HR-PBT8",
            createdAt: "2025-01-01T00:00:00.000Z",
            updatedAt: "2025-01-01T00:00:00.000Z",
          };

          act(() => {
            useDisciplinaryStore.setState({ cases: [baseCase] });
          });

          act(() => {
            hook.current.closeCase("CASE-PBT8", "HR-PBT8", caseResult);
          });

          const updated = hook.current.cases.find((c) => c.id === "CASE-PBT8");
          expect(updated).toBeDefined();
          expect(updated!.status).toBe("closed");
          expect(updated!.result).toBe(caseResult);
        }
      ),
      { numRuns: 100 }
    );
  });
});

