/** @jest-environment jsdom */
/**
 * Employees Store Tests — NexHRMS
 * Tests employee CRUD, salary governance, filtering, and document management
 */

import { renderHook, act } from "@testing-library/react";
import { useEmployeesStore } from "@/store/employees.store";

const MOCK_EMPLOYEE = {
    id: "EMP-TEST-NEW",
    name: "Test Employee",
    email: "test@company.com",
    role: "employee",
    department: "Engineering",
    status: "active" as const,
    workType: "ONSITE" as const,
    salary: 25000,
    joinDate: "2026-01-15",
    productivity: 85,
    location: "BGC Office",
};

describe("Employees Store", () => {
    beforeEach(() => {
        const { result } = renderHook(() => useEmployeesStore());
        act(() => {
            result.current.resetToSeed();
        });
    });

    // ══════════════════════════════════════════════════════════
    // CRUD Operations
    // ══════════════════════════════════════════════════════════

    describe("Employee CRUD", () => {
        it("should add new employee", () => {
            const { result } = renderHook(() => useEmployeesStore());

            act(() => {
                result.current.addEmployee(MOCK_EMPLOYEE);
            });

            const emp = result.current.getEmployee("EMP-TEST-NEW");
            expect(emp).toBeDefined();
            expect(emp?.name).toBe("Test Employee");
            expect(emp?.salary).toBe(25000);
        });

        it("should update employee fields", () => {
            const { result } = renderHook(() => useEmployeesStore());

            act(() => {
                result.current.addEmployee(MOCK_EMPLOYEE);
            });

            act(() => {
                result.current.updateEmployee("EMP-TEST-NEW", {
                    department: "Finance",
                    location: "Makati Office",
                });
            });

            const emp = result.current.getEmployee("EMP-TEST-NEW");
            expect(emp?.department).toBe("Finance");
            expect(emp?.location).toBe("Makati Office");
        });

        it("should remove employee", () => {
            const { result } = renderHook(() => useEmployeesStore());

            act(() => {
                result.current.addEmployee(MOCK_EMPLOYEE);
            });

            act(() => {
                result.current.removeEmployee("EMP-TEST-NEW");
            });

            const emp = result.current.getEmployee("EMP-TEST-NEW");
            expect(emp).toBeUndefined();
        });

        it("should toggle employee status (active <-> inactive)", () => {
            const { result } = renderHook(() => useEmployeesStore());

            act(() => {
                result.current.addEmployee(MOCK_EMPLOYEE);
            });

            act(() => {
                result.current.toggleStatus("EMP-TEST-NEW");
            });

            let emp = result.current.getEmployee("EMP-TEST-NEW");
            expect(emp?.status).toBe("inactive");

            act(() => {
                result.current.toggleStatus("EMP-TEST-NEW");
            });

            emp = result.current.getEmployee("EMP-TEST-NEW");
            expect(emp?.status).toBe("active");
        });

        it("should resign employee with timestamp", () => {
            const { result } = renderHook(() => useEmployeesStore());

            act(() => {
                result.current.addEmployee(MOCK_EMPLOYEE);
            });

            act(() => {
                result.current.resignEmployee("EMP-TEST-NEW");
            });

            const emp = result.current.getEmployee("EMP-TEST-NEW");
            expect(emp?.status).toBe("resigned");
            expect(emp?.resignedAt).toBeDefined();
        });
    });

    // ══════════════════════════════════════════════════════════
    // Filtering
    // ══════════════════════════════════════════════════════════

    describe("Employee Filtering", () => {
        it("should filter by search query (name)", () => {
            const { result } = renderHook(() => useEmployeesStore());

            act(() => {
                result.current.addEmployee(MOCK_EMPLOYEE);
                result.current.setSearchQuery("Test Employee");
            });

            const filtered = result.current.getFiltered();
            expect(filtered.every((e) => e.name.includes("Test"))).toBe(true);
        });

        it("should filter by status", () => {
            const { result } = renderHook(() => useEmployeesStore());

            act(() => {
                result.current.setStatusFilter("active");
            });

            const filtered = result.current.getFiltered();
            expect(filtered.every((e) => e.status === "active")).toBe(true);
        });

        it("should filter by work type", () => {
            const { result } = renderHook(() => useEmployeesStore());

            act(() => {
                result.current.setWorkTypeFilter("ONSITE");
            })

            const filtered = result.current.getFiltered();
            expect(filtered.every((e) => e.workType === "ONSITE")).toBe(true);
        });

        it("should return all when filter is 'all'", () => {
            const { result } = renderHook(() => useEmployeesStore());

            act(() => {
                result.current.setStatusFilter("all");
                result.current.setWorkTypeFilter("all");
                result.current.setDepartmentFilter("all");
                result.current.setSearchQuery("");
            });

            const all = result.current.getFiltered();
            const nonAdminCount = result.current.employees.filter(
                (e) => !["admin", "hr", "payroll_admin", "finance"].includes(e.role)
            ).length;
            expect(all.length).toBe(nonAdminCount);
        });
    });

    // ══════════════════════════════════════════════════════════
    // Salary Change Governance
    // ══════════════════════════════════════════════════════════

    describe("Salary Governance", () => {
        const today = new Date().toISOString().split("T")[0];

        it("should propose salary change with pending status", () => {
            const { result } = renderHook(() => useEmployeesStore());

            // Use an existing seed employee
            const existingEmp = result.current.employees[0];

            act(() => {
                result.current.proposeSalaryChange({
                    employeeId: existingEmp.id,
                    proposedSalary: 35000,
                    effectiveDate: today,
                    reason: "Annual review",
                    proposedBy: "ADMIN-001",
                });
            });

            const requests = result.current.salaryRequests;
            const req = requests.find((r) => r.employeeId === existingEmp.id);
            expect(req).toBeDefined();
            expect(req?.status).toBe("pending");
            expect(req?.proposedSalary).toBe(35000);
            expect(req?.oldSalary).toBe(existingEmp.salary);
        });

        it("should approve salary change and update employee salary", () => {
            const { result } = renderHook(() => useEmployeesStore());

            const existingEmp = result.current.employees[0];

            act(() => {
                result.current.proposeSalaryChange({
                    employeeId: existingEmp.id,
                    proposedSalary: 40000,
                    effectiveDate: today,
                    reason: "Promotion",
                    proposedBy: "ADMIN-001",
                });
            });

            const req = result.current.salaryRequests.find((r) => r.employeeId === existingEmp.id);

            act(() => {
                result.current.approveSalaryChange(req!.id, "REVIEWER-001");
            });

            // Salary should be updated
            const updatedEmp = result.current.getEmployee(existingEmp.id);
            expect(updatedEmp?.salary).toBe(40000);

            // Request should be approved
            const updatedReq = result.current.salaryRequests.find((r) => r.id === req!.id);
            expect(updatedReq?.status).toBe("approved");

            // History should be recorded
            const history = result.current.getSalaryHistory(existingEmp.id);
            expect(history.length).toBeGreaterThan(0);
            expect(history[history.length - 1].monthlySalary).toBe(40000);
        });

        it("should reject salary change without updating salary", () => {
            const { result } = renderHook(() => useEmployeesStore());

            const existingEmp = result.current.employees[0];
            const originalSalary = existingEmp.salary;

            act(() => {
                result.current.proposeSalaryChange({
                    employeeId: existingEmp.id,
                    proposedSalary: 50000,
                    effectiveDate: today,
                    reason: "Raise request",
                    proposedBy: "ADMIN-001",
                });
            });

            const req = result.current.salaryRequests.find((r) => r.proposedSalary === 50000);

            act(() => {
                result.current.rejectSalaryChange(req!.id, "REVIEWER-001");
            });

            // Salary should remain unchanged
            const emp = result.current.getEmployee(existingEmp.id);
            expect(emp?.salary).toBe(originalSalary);

            // Request should be rejected
            const updatedReq = result.current.salaryRequests.find((r) => r.id === req!.id);
            expect(updatedReq?.status).toBe("rejected");
        });
    });

    // ══════════════════════════════════════════════════════════
    // Document Management
    // ══════════════════════════════════════════════════════════

    describe("Document Management", () => {
        it("should add document to employee", () => {
            const { result } = renderHook(() => useEmployeesStore());

            act(() => {
                result.current.addDocument("EMP-001", "ID_scan.pdf");
            });

            const docs = result.current.getDocuments("EMP-001");
            expect(docs.length).toBeGreaterThan(0);
            expect(docs[0].name).toBe("ID_scan.pdf");
        });

        it("should remove document from employee", () => {
            const { result } = renderHook(() => useEmployeesStore());

            act(() => {
                result.current.addDocument("EMP-001", "TIN_cert.pdf");
            });

            const docs = result.current.getDocuments("EMP-001");
            const docId = docs[0].id;

            act(() => {
                result.current.removeDocument("EMP-001", docId);
            });

            const after = result.current.getDocuments("EMP-001");
            expect(after.find((d) => d.id === docId)).toBeUndefined();
        });

        it("should return empty array for employee with no documents", () => {
            const { result } = renderHook(() => useEmployeesStore());
            const docs = result.current.getDocuments("EMP-NODOCS");
            expect(docs).toEqual([]);
        });
    });

    // ══════════════════════════════════════════════════════════
    // Reset
    // ══════════════════════════════════════════════════════════

    describe("Reset", () => {
        it("should reset to seed state", () => {
            const { result } = renderHook(() => useEmployeesStore());

            act(() => {
                result.current.addEmployee(MOCK_EMPLOYEE);
                result.current.setSearchQuery("test");
            });

            act(() => {
                result.current.resetToSeed();
            });

            expect(result.current.searchQuery).toBe("");
            expect(result.current.getEmployee("EMP-TEST-NEW")).toBeUndefined();
        });
    });
});
