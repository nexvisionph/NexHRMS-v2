/** @jest-environment jsdom */
/**
 * Disciplinary Store Tests — NexHRMS
 * Covers full case lifecycle: NTE → acknowledgement → explanation → review → NOD → ack → close
 * Also tests the "no response" and "no violation" branches.
 */

import { renderHook, act } from "@testing-library/react";
import { useDisciplinaryStore } from "@/store/disciplinary.store";

const EMP = "EMP-001";
const HR = "HR-001";

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
