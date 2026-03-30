/**
 * Feature Test: Employee New Fields & Email Uniqueness
 *
 * Covers: employees.store.ts
 * - CRUD with new fields (emergencyContact, address, birthday, teamLeader, shiftId)
 * - Email uniqueness detection pattern (as used by admin-view.tsx)
 * - Partial updates preserve existing fields
 * - Edge cases: empty strings, undefined, clearing fields
 */

import { useEmployeesStore } from "@/store/employees.store";
import type { Employee } from "@/types";

// ── Factory ─────────────────────────────────────────────────
const BASE_EMPLOYEE: Employee = {
    id: "EMP-NF-001",
    name: "New Fields Test Employee",
    email: "newfields@company.com",
    role: "Developer",
    department: "Engineering",
    status: "active",
    workType: "WFO",
    salary: 50000,
    joinDate: "2024-01-15",
    productivity: 80,
    location: "Manila",
};

const FULL_EMPLOYEE: Employee = {
    ...BASE_EMPLOYEE,
    id: "EMP-NF-002",
    email: "full@company.com",
    phone: "+63-555-0199",
    birthday: "1995-06-15",
    teamLeader: "EMP001",
    shiftId: "SHIFT-001",
    emergencyContact: "Jane Doe +63-555-1234",
    address: "123 Main St, Manila, Philippines",
};

beforeEach(() => useEmployeesStore.getState().resetToSeed());

describe("Employee New Fields", () => {
    // ── Creation with New Fields ────────────────────────────
    describe("Creating employees with new fields", () => {
        it("should store emergencyContact when adding employee", () => {
            // Arrange
            const emp: Employee = {
                ...BASE_EMPLOYEE,
                emergencyContact: "Maria Santos +63-912-3456",
            };

            // Act
            useEmployeesStore.getState().addEmployee(emp);

            // Assert
            const stored = useEmployeesStore.getState().getEmployee("EMP-NF-001");
            expect(stored).toBeDefined();
            expect(stored!.emergencyContact).toBe("Maria Santos +63-912-3456");
        });

        it("should store address when adding employee", () => {
            // Arrange
            const emp: Employee = {
                ...BASE_EMPLOYEE,
                address: "456 Rizal Ave, Quezon City",
            };

            // Act
            useEmployeesStore.getState().addEmployee(emp);

            // Assert
            const stored = useEmployeesStore.getState().getEmployee("EMP-NF-001");
            expect(stored!.address).toBe("456 Rizal Ave, Quezon City");
        });

        it("should store birthday when adding employee", () => {
            const emp: Employee = { ...BASE_EMPLOYEE, birthday: "1990-03-25" };

            useEmployeesStore.getState().addEmployee(emp);

            const stored = useEmployeesStore.getState().getEmployee("EMP-NF-001");
            expect(stored!.birthday).toBe("1990-03-25");
        });

        it("should store teamLeader reference when adding employee", () => {
            const emp: Employee = { ...BASE_EMPLOYEE, teamLeader: "EMP010" };

            useEmployeesStore.getState().addEmployee(emp);

            const stored = useEmployeesStore.getState().getEmployee("EMP-NF-001");
            expect(stored!.teamLeader).toBe("EMP010");
        });

        it("should store shiftId when adding employee", () => {
            const emp: Employee = { ...BASE_EMPLOYEE, shiftId: "SHIFT-AM" };

            useEmployeesStore.getState().addEmployee(emp);

            const stored = useEmployeesStore.getState().getEmployee("EMP-NF-001");
            expect(stored!.shiftId).toBe("SHIFT-AM");
        });

        it("should store all new fields together", () => {
            // Arrange & Act
            useEmployeesStore.getState().addEmployee(FULL_EMPLOYEE);

            // Assert
            const stored = useEmployeesStore.getState().getEmployee("EMP-NF-002");
            expect(stored).toBeDefined();
            expect(stored!.birthday).toBe("1995-06-15");
            expect(stored!.teamLeader).toBe("EMP001");
            expect(stored!.shiftId).toBe("SHIFT-001");
            expect(stored!.emergencyContact).toBe("Jane Doe +63-555-1234");
            expect(stored!.address).toBe("123 Main St, Manila, Philippines");
            expect(stored!.phone).toBe("+63-555-0199");
        });

        it("should allow new fields to be undefined", () => {
            useEmployeesStore.getState().addEmployee(BASE_EMPLOYEE);

            const stored = useEmployeesStore.getState().getEmployee("EMP-NF-001");
            expect(stored!.emergencyContact).toBeUndefined();
            expect(stored!.address).toBeUndefined();
            expect(stored!.birthday).toBeUndefined();
            expect(stored!.teamLeader).toBeUndefined();
            expect(stored!.shiftId).toBeUndefined();
        });
    });

    // ── Seed Data Verification ──────────────────────────────
    describe("Seed employees have expected new fields", () => {
        it("should have birthday on seed employees", () => {
            const olivia = useEmployeesStore.getState().getEmployee("EMP001");
            expect(olivia).toBeDefined();
            expect(olivia!.birthday).toBe("1994-06-12");
        });

        it("should have teamLeader on some seed employees", () => {
            const olivia = useEmployeesStore.getState().getEmployee("EMP001");
            expect(olivia!.teamLeader).toBe("EMP010");

            const lucas = useEmployeesStore.getState().getEmployee("EMP010");
            expect(lucas!.teamLeader).toBeUndefined();
        });

        it("should have profileId on demo-mapped employees", () => {
            const sam = useEmployeesStore.getState().getEmployee("EMP026");
            expect(sam!.profileId).toBe("U004");
        });
    });

    // ── Update New Fields ───────────────────────────────────
    describe("Updating new fields on existing employees", () => {
        it("should update emergencyContact on existing employee", () => {
            useEmployeesStore.getState().updateEmployee("EMP001", {
                emergencyContact: "Updated Contact +63-999-0000",
            });

            const emp = useEmployeesStore.getState().getEmployee("EMP001");
            expect(emp!.emergencyContact).toBe("Updated Contact +63-999-0000");
        });

        it("should update address on existing employee", () => {
            useEmployeesStore.getState().updateEmployee("EMP001", {
                address: "789 New Address, Makati",
            });

            expect(useEmployeesStore.getState().getEmployee("EMP001")!.address).toBe("789 New Address, Makati");
        });

        it("should update birthday without affecting other fields", () => {
            const original = useEmployeesStore.getState().getEmployee("EMP001")!;
            const originalName = original.name;
            const originalSalary = original.salary;

            useEmployeesStore.getState().updateEmployee("EMP001", {
                birthday: "2000-01-01",
            });

            const updated = useEmployeesStore.getState().getEmployee("EMP001")!;
            expect(updated.birthday).toBe("2000-01-01");
            expect(updated.name).toBe(originalName);
            expect(updated.salary).toBe(originalSalary);
        });

        it("should update teamLeader reference", () => {
            useEmployeesStore.getState().updateEmployee("EMP001", {
                teamLeader: "EMP011",
            });

            expect(useEmployeesStore.getState().getEmployee("EMP001")!.teamLeader).toBe("EMP011");
        });

        it("should update shiftId", () => {
            useEmployeesStore.getState().updateEmployee("EMP001", {
                shiftId: "SHIFT-PM",
            });

            expect(useEmployeesStore.getState().getEmployee("EMP001")!.shiftId).toBe("SHIFT-PM");
        });

        it("should update multiple new fields in a single call", () => {
            useEmployeesStore.getState().updateEmployee("EMP001", {
                emergencyContact: "Multi Update Contact",
                address: "Multi Update Address",
                shiftId: "SHIFT-NIGHT",
                teamLeader: "EMP005",
            });

            const emp = useEmployeesStore.getState().getEmployee("EMP001")!;
            expect(emp.emergencyContact).toBe("Multi Update Contact");
            expect(emp.address).toBe("Multi Update Address");
            expect(emp.shiftId).toBe("SHIFT-NIGHT");
            expect(emp.teamLeader).toBe("EMP005");
        });

        it("should preserve new fields when updating unrelated fields", () => {
            // Arrange: add employee with all new fields
            useEmployeesStore.getState().addEmployee(FULL_EMPLOYEE);

            // Act: update only salary
            useEmployeesStore.getState().updateEmployee("EMP-NF-002", {
                salary: 60000,
            });

            // Assert: new fields are preserved
            const emp = useEmployeesStore.getState().getEmployee("EMP-NF-002")!;
            expect(emp.salary).toBe(60000);
            expect(emp.emergencyContact).toBe("Jane Doe +63-555-1234");
            expect(emp.address).toBe("123 Main St, Manila, Philippines");
            expect(emp.birthday).toBe("1995-06-15");
            expect(emp.teamLeader).toBe("EMP001");
            expect(emp.shiftId).toBe("SHIFT-001");
        });
    });

    // ── Edge Cases ──────────────────────────────────────────
    describe("Edge cases for new fields", () => {
        it("should handle empty string for emergencyContact", () => {
            useEmployeesStore.getState().addEmployee({
                ...BASE_EMPLOYEE, emergencyContact: "",
            });

            expect(useEmployeesStore.getState().getEmployee("EMP-NF-001")!.emergencyContact).toBe("");
        });

        it("should handle empty string for address", () => {
            useEmployeesStore.getState().addEmployee({
                ...BASE_EMPLOYEE, address: "",
            });

            expect(useEmployeesStore.getState().getEmployee("EMP-NF-001")!.address).toBe("");
        });

        it("should clear a field by setting to undefined", () => {
            // Arrange: create with emergency contact
            useEmployeesStore.getState().addEmployee({
                ...BASE_EMPLOYEE,
                emergencyContact: "Someone +63-555-0000",
            });

            // Act: update to undefined
            useEmployeesStore.getState().updateEmployee("EMP-NF-001", {
                emergencyContact: undefined,
            });

            // Assert: spread with undefined doesn't override
            // (JavaScript spread: { emergencyContact: "..." , ...{emergencyContact: undefined} } = { emergencyContact: undefined })
            const emp = useEmployeesStore.getState().getEmployee("EMP-NF-001")!;
            expect(emp.emergencyContact).toBeUndefined();
        });

        it("should handle very long address string", () => {
            const longAddress = "A".repeat(500) + ", Manila, Philippines, 1000";

            useEmployeesStore.getState().addEmployee({
                ...BASE_EMPLOYEE, address: longAddress,
            });

            expect(useEmployeesStore.getState().getEmployee("EMP-NF-001")!.address).toBe(longAddress);
        });

        it("should handle special characters in emergency contact", () => {
            const contact = "María García (母) — +63-912-345-6789 / +63-917-987-6543";

            useEmployeesStore.getState().addEmployee({
                ...BASE_EMPLOYEE, emergencyContact: contact,
            });

            expect(useEmployeesStore.getState().getEmployee("EMP-NF-001")!.emergencyContact).toBe(contact);
        });
    });

    // ── Email Uniqueness Detection ──────────────────────────
    describe("Email uniqueness detection", () => {
        /**
         * The admin-view.tsx performs email uniqueness validation using:
         *   employees.some(e => e.email.toLowerCase() === newEmail.toLowerCase())
         *
         * These tests verify the pattern works correctly against the store.
         */

        it("should detect duplicate email (exact match)", () => {
            const employees = useEmployeesStore.getState().employees;

            // Olivia's email is already in seed
            const isDuplicate = employees.some(
                (e) => e.email.toLowerCase() === "olivia@company.com"
            );

            expect(isDuplicate).toBe(true);
        });

        it("should detect duplicate email (case-insensitive)", () => {
            const employees = useEmployeesStore.getState().employees;

            const isDuplicate = employees.some(
                (e) => e.email.toLowerCase() === "OLIVIA@COMPANY.COM".toLowerCase()
            );

            expect(isDuplicate).toBe(true);
        });

        it("should detect duplicate email (mixed case)", () => {
            const employees = useEmployeesStore.getState().employees;

            const isDuplicate = employees.some(
                (e) => e.email.toLowerCase() === "Olivia@Company.COM".toLowerCase()
            );

            expect(isDuplicate).toBe(true);
        });

        it("should allow unique email", () => {
            const employees = useEmployeesStore.getState().employees;

            const isDuplicate = employees.some(
                (e) => e.email.toLowerCase() === "unique-new-person@company.com"
            );

            expect(isDuplicate).toBe(false);
        });

        it("should exclude current employee when checking edit uniqueness", () => {
            const employees = useEmployeesStore.getState().employees;
            const editingId = "EMP001"; // Olivia

            // When editing, we exclude the current employee from duplicate check
            const isDuplicate = employees.some(
                (e) => e.id !== editingId && e.email.toLowerCase() === "olivia@company.com"
            );

            // Olivia's own email should NOT be flagged as duplicate during edit
            expect(isDuplicate).toBe(false);
        });

        it("should detect conflict with another employee during edit", () => {
            const employees = useEmployeesStore.getState().employees;
            const editingId = "EMP001"; // Olivia trying to use Ethan's email

            const isDuplicate = employees.some(
                (e) => e.id !== editingId && e.email.toLowerCase() === "ethan@company.com"
            );

            expect(isDuplicate).toBe(true);
        });

        it("should detect duplicate after adding a new employee", () => {
            // Arrange: add new employee
            useEmployeesStore.getState().addEmployee({
                ...BASE_EMPLOYEE,
                email: "brand-new@company.com",
            });

            // Act: check for duplicate
            const employees = useEmployeesStore.getState().employees;
            const isDuplicate = employees.some(
                (e) => e.email.toLowerCase() === "brand-new@company.com"
            );

            // Assert
            expect(isDuplicate).toBe(true);
        });

        it("should not detect duplicate after removing the employee", () => {
            // Arrange
            useEmployeesStore.getState().addEmployee({
                ...BASE_EMPLOYEE,
                email: "temporary@company.com",
            });
            useEmployeesStore.getState().removeEmployee("EMP-NF-001");

            // Act
            const employees = useEmployeesStore.getState().employees;
            const isDuplicate = employees.some(
                (e) => e.email.toLowerCase() === "temporary@company.com"
            );

            // Assert
            expect(isDuplicate).toBe(false);
        });
    });

    // ── Filtering with New Field Data ───────────────────────
    describe("Search includes employees with new fields", () => {
        it("should find employee by name search even with new fields set", () => {
            useEmployeesStore.getState().addEmployee(FULL_EMPLOYEE);
            useEmployeesStore.getState().setSearchQuery("New Fields Test");

            const results = useEmployeesStore.getState().getFiltered();
            expect(results.some((e) => e.id === "EMP-NF-002")).toBe(true);
        });

        it("should find employee by email search even with new fields set", () => {
            useEmployeesStore.getState().addEmployee(FULL_EMPLOYEE);
            useEmployeesStore.getState().setSearchQuery("full@company.com");

            const results = useEmployeesStore.getState().getFiltered();
            expect(results.some((e) => e.id === "EMP-NF-002")).toBe(true);
        });
    });
});
