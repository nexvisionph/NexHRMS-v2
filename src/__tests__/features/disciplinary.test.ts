/** @jest-environment jsdom */
/**
 * Disciplinary Store Tests — NexHRMS
 * Covers full case lifecycle: NTE → acknowledgement → explanation → review → NOD → ack → close
 * Also tests the "no response" and "no violation" branches.
 */

import { renderHook, act } from "@testing-library/react";
import { useDisciplinaryStore } from "@/store/disciplinary.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useNotificationsStore } from "@/store/notifications.store";

const EMP = "EMP-001";
const HR = "HR-001";

beforeAll(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch;
});

function makeBasicCase() {
    const { result } = renderHook(() => useDisciplinaryStore());
    act(() => result.current.resetToSeed());
    let caseId = "";
    act(() => {
        const c = result.current.createCase({
            employeeId: EMP,
            violationType: "Tardiness",
            incidentDate: "2025-01-15",
            description: "Late 5 days in a row",
            evidenceUrls: [],
            createdBy: HR,
        });
        caseId = c.id;
    });
    return { result, caseId };
}

describe("Disciplinary Store", () => {
    beforeEach(() => {
        const { result } = renderHook(() => useDisciplinaryStore());
        act(() => result.current.resetToSeed());
        act(() => {
            useEmployeesStore.getState().resetToSeed();
            useNotificationsStore.getState().resetToSeed();
        });
    });

    describe("Case creation", () => {
        it("creates a case with auto-generated CASE-YYYY-NNNN number", () => {
            const { result } = renderHook(() => useDisciplinaryStore());
            act(() => {
                result.current.createCase({
                    employeeId: EMP,
                    violationType: "Tardiness",
                    incidentDate: "2025-01-15",
                    description: "Late",
                    evidenceUrls: [],
                    createdBy: HR,
                });
            });
            const cases = result.current.cases;
            expect(cases).toHaveLength(1);
            expect(cases[0].caseNumber).toMatch(/^CASE-\d{4}-\d{4}$/);
            expect(cases[0].status).toBe("open");
        });

        it("increments case number sequentially", () => {
            const { result } = renderHook(() => useDisciplinaryStore());
            act(() => {
                result.current.createCase({ employeeId: EMP, violationType: "A", incidentDate: "2025-01-01", description: "x", evidenceUrls: [], createdBy: HR });
                result.current.createCase({ employeeId: EMP, violationType: "B", incidentDate: "2025-01-02", description: "y", evidenceUrls: [], createdBy: HR });
            });
            const nums = result.current.cases.map((c) => c.caseNumber).sort();
            expect(nums[0].endsWith("0001")).toBe(true);
            expect(nums[1].endsWith("0002")).toBe(true);
        });

        // Task 3.2 — verify severityLevel, witnesses, and result are persisted via spread
        it("persists severityLevel when provided", () => {
            const { result } = renderHook(() => useDisciplinaryStore());
            let created: ReturnType<typeof result.current.createCase> | undefined;
            act(() => {
                created = result.current.createCase({
                    employeeId: EMP,
                    violationType: "Insubordination",
                    incidentDate: "2025-03-01",
                    description: "Refused direct instruction",
                    evidenceUrls: [],
                    createdBy: HR,
                    severityLevel: "major",
                });
            });
            expect(created?.severityLevel).toBe("major");
            expect(result.current.cases[0].severityLevel).toBe("major");
        });

        it("persists witnesses when provided", () => {
            const { result } = renderHook(() => useDisciplinaryStore());
            let created: ReturnType<typeof result.current.createCase> | undefined;
            act(() => {
                created = result.current.createCase({
                    employeeId: EMP,
                    violationType: "Misconduct",
                    incidentDate: "2025-03-02",
                    description: "Verbal altercation",
                    evidenceUrls: [],
                    createdBy: HR,
                    witnesses: "John Doe, Jane Smith",
                });
            });
            expect(created?.witnesses).toBe("John Doe, Jane Smith");
            expect(result.current.cases[0].witnesses).toBe("John Doe, Jane Smith");
        });

        it("persists result when provided", () => {
            const { result } = renderHook(() => useDisciplinaryStore());
            let created: ReturnType<typeof result.current.createCase> | undefined;
            act(() => {
                created = result.current.createCase({
                    employeeId: EMP,
                    violationType: "Policy Violation",
                    incidentDate: "2025-03-03",
                    description: "Breached data policy",
                    evidenceUrls: [],
                    createdBy: HR,
                    result: "WRITTEN_WARNING",
                });
            });
            expect(created?.result).toBe("WRITTEN_WARNING");
            expect(result.current.cases[0].result).toBe("WRITTEN_WARNING");
        });

        it("defaults severityLevel and witnesses to undefined when not provided", () => {
            const { result } = renderHook(() => useDisciplinaryStore());
            let created: ReturnType<typeof result.current.createCase> | undefined;
            act(() => {
                created = result.current.createCase({
                    employeeId: EMP,
                    violationType: "Tardiness",
                    incidentDate: "2025-03-04",
                    description: "Late arrivals",
                    evidenceUrls: [],
                    createdBy: HR,
                });
            });
            expect(created?.severityLevel).toBeUndefined();
            expect(created?.witnesses).toBeUndefined();
            expect(created?.result).toBeUndefined();
        });

        it("always defaults status to 'open' regardless of other fields", () => {
            const { result } = renderHook(() => useDisciplinaryStore());
            let created: ReturnType<typeof result.current.createCase> | undefined;
            act(() => {
                created = result.current.createCase({
                    employeeId: EMP,
                    violationType: "Tardiness",
                    incidentDate: "2025-03-05",
                    description: "Repeated lateness",
                    evidenceUrls: [],
                    createdBy: HR,
                    severityLevel: "critical",
                    witnesses: "Supervisor A",
                });
            });
            expect(created?.status).toBe("open");
        });

        it("persists all three new fields together in one call", () => {
            const { result } = renderHook(() => useDisciplinaryStore());
            let created: ReturnType<typeof result.current.createCase> | undefined;
            act(() => {
                created = result.current.createCase({
                    employeeId: EMP,
                    violationType: "Gross Misconduct",
                    incidentDate: "2025-03-06",
                    description: "Serious policy breach",
                    evidenceUrls: [],
                    createdBy: HR,
                    severityLevel: "critical",
                    witnesses: "Alice, Bob",
                    result: "TERMINATION",
                });
            });
            expect(created?.severityLevel).toBe("critical");
            expect(created?.witnesses).toBe("Alice, Bob");
            expect(created?.result).toBe("TERMINATION");
            expect(created?.status).toBe("open");
            // Confirm stored in state too
            const stored = result.current.cases[0];
            expect(stored.severityLevel).toBe("critical");
            expect(stored.witnesses).toBe("Alice, Bob");
            expect(stored.result).toBe("TERMINATION");
        });
    });

    describe("Happy path: NTE → ack → explanation → review → NOD → ack → close", () => {
        it("transitions through all states correctly", () => {
            const { result, caseId } = makeBasicCase();

            // Issue NTE
            let nteId = "";
            act(() => {
                const nte = result.current.issueNTE(caseId, { responseDeadline: "2025-01-25", issuedBy: HR });
                nteId = nte!.id;
            });
            expect(result.current.getCase(caseId)?.status).toBe("nte_issued");
            expect(result.current.getNTEByCase(caseId)?.status).toBe("issued");

            // Acknowledge
            act(() => result.current.acknowledgeNTE(nteId));
            expect(result.current.getCase(caseId)?.status).toBe("nte_acknowledged");
            expect(result.current.getNTEByCase(caseId)?.acknowledgedAt).toBeDefined();

            // Submit explanation
            act(() => result.current.submitExplanation(nteId, "I had a family emergency."));
            expect(result.current.getCase(caseId)?.status).toBe("explanation_submitted");
            expect(result.current.getNTEByCase(caseId)?.employeeExplanation).toContain("family emergency");

            // Move to review
            act(() => result.current.moveToReview(caseId));
            expect(result.current.getCase(caseId)?.status).toBe("under_review");

            // Issue NOD (suspension)
            act(() => {
                result.current.issueNOD(caseId, {
                    decision: "suspension",
                    decisionDetails: "3-day suspension",
                    issuedBy: HR,
                    sanctionStartDate: "2025-02-01",
                    sanctionEndDate: "2025-02-03",
                });
            });
            expect(result.current.getCase(caseId)?.status).toBe("nod_issued");
            const nod = result.current.getNODByCase(caseId)!;
            expect(nod.decision).toBe("suspension");

            // Acknowledge NOD → sanction_active for suspension
            act(() => result.current.acknowledgeNOD(nod.id));
            expect(result.current.getCase(caseId)?.status).toBe("sanction_active");
            expect(result.current.getNODByCase(caseId)?.status).toBe("sanction_active");

            // Close case
            act(() => result.current.closeCase(caseId, HR));
            expect(result.current.getCase(caseId)?.status).toBe("closed");
        });

        it("notifies admin and HR when an explanation is submitted", () => {
            act(() => {
                useEmployeesStore.setState({
                    employees: [
                        createMockEmployee({
                            id: "EMP-ADMIN",
                            name: "Alice Admin",
                            email: "alice.admin@test.com",
                            role: "admin",
                            status: "active",
                        }),
                        createMockEmployee({
                            id: "EMP-HR",
                            name: "Carla HR",
                            email: "carla.hr@test.com",
                            role: "hr",
                            status: "active",
                        }),
                        createMockEmployee({
                            id: EMP,
                            name: "Bob Employee",
                            email: "bob.employee@test.com",
                            role: "employee",
                            status: "active",
                        }),
                    ],
                });
            });

            const { result, caseId } = makeBasicCase();
            let nteId = "";

            act(() => {
                nteId = result.current.issueNTE(caseId, { responseDeadline: "2025-01-25", issuedBy: HR })!.id;
            });
            act(() => result.current.acknowledgeNTE(nteId));
            act(() => result.current.submitExplanation(nteId, "I had a family emergency.", EMP));

            const explanationLogs = useNotificationsStore
                .getState()
                .logs.filter((log) => log.type === "disciplinary_explanation_submitted");

            expect(explanationLogs).toHaveLength(2);
            expect(explanationLogs.map((log) => log.employeeId).sort()).toEqual(["EMP-ADMIN", "EMP-HR"]);
            expect(explanationLogs.every((log) => log.link === `/disciplinary/${caseId}`)).toBe(true);
            expect(result.current.getCase(caseId)?.status).toBe("explanation_submitted");
        });

        it("written warning ack moves case to nod_acknowledged (not sanction_active)", () => {
            const { result, caseId } = makeBasicCase();
            let nteId = "";
            act(() => { nteId = result.current.issueNTE(caseId, { responseDeadline: "2025-01-25", issuedBy: HR })!.id; });
            act(() => result.current.acknowledgeNTE(nteId));
            act(() => result.current.submitExplanation(nteId, "ok"));
            act(() => result.current.moveToReview(caseId));
            act(() => {
                result.current.issueNOD(caseId, {
                    decision: "written_warning",
                    decisionDetails: "First written warning",
                    issuedBy: HR,
                });
            });
            const nod = result.current.getNODByCase(caseId)!;
            act(() => result.current.acknowledgeNOD(nod.id));
            expect(result.current.getCase(caseId)?.status).toBe("nod_acknowledged");
        });
    });

    describe("No-response branch", () => {
        it("marks NTE as no-response and updates case status", () => {
            const { result, caseId } = makeBasicCase();
            let nteId = "";
            act(() => { nteId = result.current.issueNTE(caseId, { responseDeadline: "2025-01-25", issuedBy: HR })!.id; });
            act(() => result.current.acknowledgeNTE(nteId));
            act(() => result.current.markNoResponse(nteId));
            expect(result.current.getCase(caseId)?.status).toBe("no_response");
            expect(result.current.getNTEByCase(caseId)?.status).toBe("no_response");
        });
    });

    describe("No-violation branch", () => {
        it("issuing NOD with no_violation closes the case immediately", () => {
            const { result, caseId } = makeBasicCase();
            let nteId = "";
            act(() => { nteId = result.current.issueNTE(caseId, { responseDeadline: "2025-01-25", issuedBy: HR })!.id; });
            act(() => result.current.acknowledgeNTE(nteId));
            act(() => result.current.submitExplanation(nteId, "valid reason"));
            act(() => result.current.moveToReview(caseId));
            act(() => {
                result.current.issueNOD(caseId, {
                    decision: "no_violation",
                    decisionDetails: "Explanation accepted",
                    issuedBy: HR,
                });
            });
            expect(result.current.getCase(caseId)?.status).toBe("closed");
            expect(result.current.getNODByCase(caseId)?.decision).toBe("no_violation");
        });
    });

    describe("Guards", () => {
        it("does not allow issuing two NTEs for the same case", () => {
            const { result, caseId } = makeBasicCase();
            act(() => { result.current.issueNTE(caseId, { responseDeadline: "2025-01-25", issuedBy: HR }); });
            let second: ReturnType<typeof result.current.issueNTE> = undefined;
            act(() => { second = result.current.issueNTE(caseId, { responseDeadline: "2025-01-30", issuedBy: HR }); });
            expect(second).toBeUndefined();
            expect(result.current.ntes.filter((n) => n.caseId === caseId)).toHaveLength(1);
        });

        it("does not allow issuing two NODs for the same case", () => {
            const { result, caseId } = makeBasicCase();
            act(() => { result.current.issueNOD(caseId, { decision: "verbal_warning", decisionDetails: "x", issuedBy: HR }); });
            let second: ReturnType<typeof result.current.issueNOD> = undefined;
            act(() => { second = result.current.issueNOD(caseId, { decision: "written_warning", decisionDetails: "y", issuedBy: HR }); });
            expect(second).toBeUndefined();
        });
    });

    describe("Dashboard stats", () => {
        it("aggregates counts by status", () => {
            const { result } = renderHook(() => useDisciplinaryStore());
            act(() => {
                result.current.createCase({ employeeId: EMP, violationType: "A", incidentDate: "2025-01-01", description: "1", evidenceUrls: [], createdBy: HR });
                result.current.createCase({ employeeId: EMP, violationType: "B", incidentDate: "2025-01-02", description: "2", evidenceUrls: [], createdBy: HR });
                result.current.createCase({ employeeId: EMP, violationType: "C", incidentDate: "2025-01-03", description: "3", evidenceUrls: [], createdBy: HR });
            });
            const stats = result.current.getDashboardStats();
            expect(stats.total).toBe(3);
            expect(stats.open).toBe(3);
            expect(stats.closed).toBe(0);
        });
    });
});
