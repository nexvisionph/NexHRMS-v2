/**
 * Feature Test: Employee Management
 *
 * Covers: employees.store.ts
 * - CRUD operations
 * - Status management (active, inactive, resigned)
 * - Salary change workflow (propose → approve/reject)
 * - Salary history tracking
 * - Document management
 * - Filtering & search
 */

import { useEmployeesStore } from "@/store/employees.store";

const BASE_EMPLOYEE = {
    id: "EMP-TEST-001",
    name: "Test Employee",
    email: "test@company.com",
    role: "Developer",
    department: "Engineering",
    status: "active" as const,
    workType: "WFO" as const,
    salary: 50000,
    joinDate: "2024-01-15",
    productivity: 80,
    location: "Manila",
};

beforeEach(() => useEmployeesStore.getState().resetToSeed());

describe("Employee Management", () => {
    // ── CRUD ────────────────────────────────────────────────
    describe("Employee CRUD", () => {
        it("seed data loads correctly", () => {
            const { employees } = useEmployeesStore.getState();
            expect(employees.length).toBeGreaterThanOrEqual(20);
            expect(employees[0]).toHaveProperty("id");
            expect(employees[0]).toHaveProperty("name");
            expect(employees[0]).toHaveProperty("email");
        });

        it("adds a new employee", () => {
            const before = useEmployeesStore.getState().employees.length;
            useEmployeesStore.getState().addEmployee(BASE_EMPLOYEE);
            expect(useEmployeesStore.getState().employees.length).toBe(before + 1);
        });

        it("generates unique ID for each employee", () => {
            useEmployeesStore.getState().addEmployee({ ...BASE_EMPLOYEE, id: "EMP-TEST-A" });
            useEmployeesStore.getState().addEmployee({ ...BASE_EMPLOYEE, id: "EMP-TEST-B", email: "test2@company.com" });
            const emps = useEmployeesStore.getState().employees;
            const ids = emps.map((e) => e.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it("updates employee fields", () => {
            const emp = useEmployeesStore.getState().employees[0];
            useEmployeesStore.getState().updateEmployee(emp.id, { name: "Updated Name", salary: 120000 });
            const updated = useEmployeesStore.getState().getEmployee(emp.id);
            expect(updated?.name).toBe("Updated Name");
            expect(updated?.salary).toBe(120000);
        });

        it("removes an employee", () => {
            const emp = useEmployeesStore.getState().employees[0];
            const before = useEmployeesStore.getState().employees.length;
            useEmployeesStore.getState().removeEmployee(emp.id);
            expect(useEmployeesStore.getState().employees.length).toBe(before - 1);
            expect(useEmployeesStore.getState().getEmployee(emp.id)).toBeUndefined();
        });

        it("getEmployee returns correct employee", () => {
            const emp = useEmployeesStore.getState().employees[2];
            const found = useEmployeesStore.getState().getEmployee(emp.id);
            expect(found?.id).toBe(emp.id);
            expect(found?.name).toBe(emp.name);
        });

        it("getEmployee returns undefined for non-existent ID", () => {
            expect(useEmployeesStore.getState().getEmployee("INVALID")).toBeUndefined();
        });
    });

    // ── Status Management ───────────────────────────────────
    describe("Status management", () => {
        it("toggles status to inactive", () => {
            const emp = useEmployeesStore.getState().employees.find((e) => e.status === "active")!;
            useEmployeesStore.getState().toggleStatus(emp.id);
            expect(useEmployeesStore.getState().getEmployee(emp.id)?.status).toBe("inactive");
        });

        it("toggles inactive back to active", () => {
            const emp = useEmployeesStore.getState().employees[0];
            useEmployeesStore.getState().updateEmployee(emp.id, { status: "inactive" });
            useEmployeesStore.getState().toggleStatus(emp.id);
            expect(useEmployeesStore.getState().getEmployee(emp.id)?.status).toBe("active");
        });

        it("resigns employee with timestamp", () => {
            const emp = useEmployeesStore.getState().employees[0];
            useEmployeesStore.getState().resignEmployee(emp.id);
            const resigned = useEmployeesStore.getState().getEmployee(emp.id);
            expect(resigned?.status).toBe("resigned");
            expect(resigned?.resignedAt).toBeTruthy();
        });
    });

    // ── Salary Change Workflow ──────────────────────────────
    describe("Salary change workflow", () => {
        it("proposes a salary change", () => {
            const emp = useEmployeesStore.getState().employees[0];
            useEmployeesStore.getState().proposeSalaryChange({
                employeeId: emp.id,
                proposedSalary: emp.salary + 10000,
                effectiveDate: "2026-04-01",
                reason: "Annual review",
                proposedBy: "ADMIN",
            });
            const requests = useEmployeesStore.getState().salaryRequests;
            expect(requests.length).toBeGreaterThan(0);
            const req = requests.find((r) => r.employeeId === emp.id);
            expect(req?.status).toBe("pending");
            expect(req?.proposedSalary).toBe(emp.salary + 10000);
        });

        it("approves salary change and updates employee", () => {
            const emp = useEmployeesStore.getState().employees[0];
            useEmployeesStore.getState().proposeSalaryChange({
                employeeId: emp.id,
                proposedSalary: 150000,
                effectiveDate: "2026-04-01",
                reason: "Promotion",
                proposedBy: "ADMIN",
            });
            const req = useEmployeesStore.getState().salaryRequests.find((r) => r.employeeId === emp.id)!;
            useEmployeesStore.getState().approveSalaryChange(req.id, "HR-MGR");
            const updated = useEmployeesStore.getState().getEmployee(emp.id);
            expect(updated?.salary).toBe(150000);
            const history = useEmployeesStore.getState().getSalaryHistory(emp.id);
            expect(history.length).toBeGreaterThan(0);
            expect(history[history.length - 1].monthlySalary).toBe(150000);
        });

        it("rejects salary change without modifying salary", () => {
            const emp = useEmployeesStore.getState().employees[0];
            const originalSalary = emp.salary;
            useEmployeesStore.getState().proposeSalaryChange({
                employeeId: emp.id,
                proposedSalary: 200000,
                effectiveDate: "2026-04-01",
                reason: "Too much",
                proposedBy: "ADMIN",
            });
            const req = useEmployeesStore.getState().salaryRequests.find((r) => r.employeeId === emp.id)!;
            useEmployeesStore.getState().rejectSalaryChange(req.id, "HR-MGR");
            expect(useEmployeesStore.getState().getEmployee(emp.id)?.salary).toBe(originalSalary);
        });
    });

    // ── Documents ───────────────────────────────────────────
    describe("Document management", () => {
        it("adds a document to an employee", () => {
            const emp = useEmployeesStore.getState().employees[0];
            useEmployeesStore.getState().addDocument(emp.id, "Contract.pdf");
            const docs = useEmployeesStore.getState().getDocuments(emp.id);
            expect(docs.length).toBeGreaterThan(0);
            expect(docs[0].name).toBe("Contract.pdf");
        });

        it("removes a document", () => {
            const emp = useEmployeesStore.getState().employees[0];
            useEmployeesStore.getState().addDocument(emp.id, "ToDelete.pdf");
            const docs = useEmployeesStore.getState().getDocuments(emp.id);
            const docId = docs[0].id;
            useEmployeesStore.getState().removeDocument(emp.id, docId);
            expect(useEmployeesStore.getState().getDocuments(emp.id).find((d) => d.id === docId)).toBeUndefined();
        });

        it("documents are per-employee", () => {
            const [e1, e2] = useEmployeesStore.getState().employees;
            useEmployeesStore.getState().addDocument(e1.id, "E1-doc.pdf");
            useEmployeesStore.getState().addDocument(e2.id, "E2-doc.pdf");
            expect(useEmployeesStore.getState().getDocuments(e1.id).some((d) => d.name === "E1-doc.pdf")).toBe(true);
            expect(useEmployeesStore.getState().getDocuments(e2.id).some((d) => d.name === "E2-doc.pdf")).toBe(true);
        });
    });

    // ── Filtering ───────────────────────────────────────────
    describe("Filtering & search", () => {
        it("filters by status", () => {
            useEmployeesStore.getState().setStatusFilter("active");
            const filtered = useEmployeesStore.getState().getFiltered();
            expect(filtered.every((e) => e.status === "active")).toBe(true);
        });

        it("filters by department", () => {
            useEmployeesStore.getState().setDepartmentFilter("Engineering");
            const filtered = useEmployeesStore.getState().getFiltered();
            expect(filtered.every((e) => e.department === "Engineering")).toBe(true);
            expect(filtered.length).toBeGreaterThan(0);
        });

        it("filters by workType", () => {
            useEmployeesStore.getState().setWorkTypeFilter("WFH");
            const filtered = useEmployeesStore.getState().getFiltered();
            expect(filtered.every((e) => e.workType === "WFH")).toBe(true);
        });

        it("searches by name (case-insensitive)", () => {
            useEmployeesStore.getState().setSearchQuery("olivia");
            const filtered = useEmployeesStore.getState().getFiltered();
            expect(filtered.length).toBeGreaterThan(0);
            expect(filtered[0].name.toLowerCase()).toContain("olivia");
        });

        it("combines multiple filters", () => {
            useEmployeesStore.getState().setStatusFilter("active");
            useEmployeesStore.getState().setDepartmentFilter("Engineering");
            const filtered = useEmployeesStore.getState().getFiltered();
            expect(filtered.every((e) => e.status === "active" && e.department === "Engineering")).toBe(true);
        });

        it("returns all with no filters", () => {
            const all = useEmployeesStore.getState().getFiltered();
            expect(all.length).toBe(useEmployeesStore.getState().employees.length);
        });
    });

    // ── Reset ───────────────────────────────────────────────
    describe("Reset to seed", () => {
        it("restores original employee data", () => {
            const original = useEmployeesStore.getState().employees.length;
            useEmployeesStore.getState().addEmployee(BASE_EMPLOYEE);
            useEmployeesStore.getState().resetToSeed();
            expect(useEmployeesStore.getState().employees.length).toBe(original);
        });
    });
});
