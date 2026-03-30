/**
 * Feature Test: End-to-End Account + Employee Creation Flow
 *
 * Covers the full lifecycle:
 * - Admin creates auth account → gets userId
 * - Admin creates employee with profileId linked to account
 * - Employee data integrity across both stores
 * - Account + employee deletion cascade
 * - Profile updates reflect correctly
 * - Combined validation: duplicate email across both stores
 */

import { useAuthStore, hashPassword, verifyPassword } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";
import { DEMO_USERS } from "@/data/seed";
import type { Employee } from "@/types";

beforeEach(() => {
    useAuthStore.getState().resetToSeed();
    useEmployeesStore.getState().resetToSeed();
});

// ── Factories ───────────────────────────────────────────────
function createTestAccount(overrides: Record<string, unknown> = {}) {
    return {
        name: "New Hire",
        email: "newhire@company.com",
        role: "employee" as const,
        password: "secure123",
        mustChangePassword: true,
        ...overrides,
    };
}

function createTestEmployee(profileId: string, overrides: Partial<Employee> = {}): Employee {
    return {
        id: `EMP-E2E-${Date.now()}`,
        profileId,
        name: "New Hire",
        email: "newhire@company.com",
        role: "Frontend Developer",
        department: "Engineering",
        status: "active",
        workType: "WFO",
        salary: 55000,
        joinDate: "2024-06-01",
        productivity: 75,
        location: "Manila",
        birthday: "1997-03-15",
        emergencyContact: "Parent +63-555-0001",
        address: "123 Test St, Manila",
        teamLeader: "EMP010",
        shiftId: "SHIFT-AM",
        ...overrides,
    };
}

describe("End-to-End: Account + Employee Creation", () => {
    // ── Happy Path ──────────────────────────────────────────
    describe("Full creation flow", () => {
        it("should create account then employee with linked profileId", () => {
            // Arrange & Act: Create auth account
            const accountResult = useAuthStore.getState().createAccount(createTestAccount());

            // Assert: Account created successfully
            expect(accountResult.ok).toBe(true);
            expect(accountResult.userId).toBeDefined();

            // Act: Create employee linked to account
            const emp = createTestEmployee(accountResult.userId!);
            useEmployeesStore.getState().addEmployee(emp);

            // Assert: Employee exists with correct profileId
            const stored = useEmployeesStore.getState().getEmployee(emp.id);
            expect(stored).toBeDefined();
            expect(stored!.profileId).toBe(accountResult.userId);
            expect(stored!.email).toBe("newhire@company.com");
            expect(stored!.emergencyContact).toBe("Parent +63-555-0001");
            expect(stored!.address).toBe("123 Test St, Manila");
        });

        it("should allow login with newly created account", () => {
            // Arrange: Create account
            useAuthStore.getState().createAccount(createTestAccount());

            // Act: Login
            const loginSuccess = useAuthStore.getState().login("newhire@company.com", "secure123");

            // Assert
            expect(loginSuccess).toBe(true);
            expect(useAuthStore.getState().isAuthenticated).toBe(true);
            expect(useAuthStore.getState().currentUser.email).toBe("newhire@company.com");
        });

        it("should create account with mustChangePassword flag", () => {
            const result = useAuthStore.getState().createAccount(
                createTestAccount({ mustChangePassword: true })
            );

            const account = useAuthStore.getState().accounts.find((a) => a.id === result.userId);
            expect(account?.mustChangePassword).toBe(true);
        });

        it("should create multiple employees with separate accounts", () => {
            // Create first account + employee
            // Use jest.spyOn to ensure unique Date.now() values
            const originalDateNow = Date.now;
            let callCount = 0;
            jest.spyOn(Date, "now").mockImplementation(() => {
                callCount++;
                return originalDateNow() + callCount;
            });

            const result1 = useAuthStore.getState().createAccount(
                createTestAccount({ email: "hire1@company.com", name: "Hire One" })
            );
            useEmployeesStore.getState().addEmployee(
                createTestEmployee(result1.userId!, {
                    id: "EMP-E2E-001",
                    email: "hire1@company.com",
                    name: "Hire One",
                })
            );

            // Create second account + employee
            const result2 = useAuthStore.getState().createAccount(
                createTestAccount({ email: "hire2@company.com", name: "Hire Two" })
            );
            useEmployeesStore.getState().addEmployee(
                createTestEmployee(result2.userId!, {
                    id: "EMP-E2E-002",
                    email: "hire2@company.com",
                    name: "Hire Two",
                })
            );

            jest.restoreAllMocks();

            // Assert: Both accounts have unique IDs
            expect(result1.userId).not.toBe(result2.userId);

            // Assert: Both employees exist with correct links
            const emp1 = useEmployeesStore.getState().getEmployee("EMP-E2E-001");
            const emp2 = useEmployeesStore.getState().getEmployee("EMP-E2E-002");
            expect(emp1!.profileId).toBe(result1.userId);
            expect(emp2!.profileId).toBe(result2.userId);
        });
    });

    // ── Validation ──────────────────────────────────────────
    describe("Account creation validation", () => {
        it("should reject duplicate email in auth store", () => {
            // First account succeeds
            const result1 = useAuthStore.getState().createAccount(createTestAccount());
            expect(result1.ok).toBe(true);

            // Same email fails
            const result2 = useAuthStore.getState().createAccount(createTestAccount());
            expect(result2.ok).toBe(false);
            expect(result2.error).toContain("already exists");
        });

        it("should reject duplicate email case-insensitively", () => {
            useAuthStore.getState().createAccount(createTestAccount());

            const result = useAuthStore.getState().createAccount(
                createTestAccount({ email: "NEWHIRE@COMPANY.COM" })
            );
            expect(result.ok).toBe(false);
        });

        it("should reject short password", () => {
            const result = useAuthStore.getState().createAccount(
                createTestAccount({ password: "12345" })
            );

            expect(result.ok).toBe(false);
            expect(result.error).toContain("6 characters");
        });

        it("should reject empty password", () => {
            const result = useAuthStore.getState().createAccount(
                createTestAccount({ password: "" })
            );

            expect(result.ok).toBe(false);
        });

        it("should cross-validate email uniqueness across stores", () => {
            /**
             * Real-world flow: admin-view.tsx checks BOTH
             * employees.some(e => e.email === newEmail)
             * AND createAccount returns duplicate error
             */

            // Create account + employee
            useAuthStore.getState().createAccount(createTestAccount());
            useEmployeesStore.getState().addEmployee(
                createTestEmployee("USR-1", { id: "EMP-CROSS-1" })
            );

            // Check employee email collision
            const employees = useEmployeesStore.getState().employees;
            const empDuplicate = employees.some(
                (e) => e.email.toLowerCase() === "newhire@company.com"
            );
            expect(empDuplicate).toBe(true);

            // Check auth email collision
            const authDuplicate = useAuthStore.getState().createAccount(
                createTestAccount({ email: "newhire@company.com" })
            );
            expect(authDuplicate.ok).toBe(false);
        });
    });

    // ── Password Verification ───────────────────────────────
    describe("Password handling in created accounts", () => {
        it("should hash password on account creation", () => {
            const result = useAuthStore.getState().createAccount(createTestAccount());
            const account = useAuthStore.getState().accounts.find((a) => a.id === result.userId);

            expect(account?.passwordHash).toBeTruthy();
            expect(account?.passwordHash).not.toBe("secure123"); // Not stored in plaintext
        });

        it("should verify correct password after creation", () => {
            const result = useAuthStore.getState().createAccount(createTestAccount());
            const account = useAuthStore.getState().accounts.find((a) => a.id === result.userId);

            expect(verifyPassword("secure123", account!.passwordHash!)).toBe(true);
        });

        it("should reject incorrect password after creation", () => {
            const result = useAuthStore.getState().createAccount(createTestAccount());
            const account = useAuthStore.getState().accounts.find((a) => a.id === result.userId);

            expect(verifyPassword("wrongpassword", account!.passwordHash!)).toBe(false);
        });

        it("should allow password change on newly created account", () => {
            const result = useAuthStore.getState().createAccount(createTestAccount());

            const changeResult = useAuthStore.getState().changePassword(
                result.userId!, "secure123", "newsecure456"
            );

            expect(changeResult.ok).toBe(true);

            // Verify new password works
            const account = useAuthStore.getState().accounts.find((a) => a.id === result.userId);
            expect(verifyPassword("newsecure456", account!.passwordHash!)).toBe(true);
            expect(verifyPassword("secure123", account!.passwordHash!)).toBe(false);
        });
    });

    // ── Employee Data Integrity ─────────────────────────────
    describe("Employee data integrity with new fields", () => {
        it("should store all new fields when creating employee via account flow", () => {
            // Arrange: create account
            const accountResult = useAuthStore.getState().createAccount(createTestAccount());
            const emp = createTestEmployee(accountResult.userId!, {
                id: "EMP-INTEGRITY",
                birthday: "1997-03-15",
                emergencyContact: "Parent +63-555-0001",
                address: "123 Test St, Manila",
                teamLeader: "EMP010",
                shiftId: "SHIFT-AM",
                phone: "+63-555-9999",
            });

            // Act
            useEmployeesStore.getState().addEmployee(emp);

            // Assert: ALL fields persisted
            const stored = useEmployeesStore.getState().getEmployee("EMP-INTEGRITY")!;
            expect(stored.profileId).toBe(accountResult.userId);
            expect(stored.birthday).toBe("1997-03-15");
            expect(stored.emergencyContact).toBe("Parent +63-555-0001");
            expect(stored.address).toBe("123 Test St, Manila");
            expect(stored.teamLeader).toBe("EMP010");
            expect(stored.shiftId).toBe("SHIFT-AM");
            expect(stored.phone).toBe("+63-555-9999");
            expect(stored.name).toBe("New Hire");
            expect(stored.salary).toBe(55000);
            expect(stored.status).toBe("active");
        });

        it("should create employee without optional new fields", () => {
            const accountResult = useAuthStore.getState().createAccount(createTestAccount());
            const emp: Employee = {
                id: "EMP-MINIMAL",
                profileId: accountResult.userId,
                name: "Minimal Hire",
                email: "minimal@company.com",
                role: "Developer",
                department: "Engineering",
                status: "active",
                workType: "WFO",
                salary: 40000,
                joinDate: "2024-01-01",
                productivity: 70,
                location: "Manila",
            };

            useEmployeesStore.getState().addEmployee(emp);

            const stored = useEmployeesStore.getState().getEmployee("EMP-MINIMAL")!;
            expect(stored.emergencyContact).toBeUndefined();
            expect(stored.address).toBeUndefined();
            expect(stored.birthday).toBeUndefined();
            expect(stored.teamLeader).toBeUndefined();
            expect(stored.shiftId).toBeUndefined();
        });
    });

    // ── Profile Updates ─────────────────────────────────────
    describe("Profile updates on linked account", () => {
        it("should update auth profile name", () => {
            const result = useAuthStore.getState().createAccount(createTestAccount());

            useAuthStore.getState().updateProfile(result.userId!, { name: "Updated Name" });

            const account = useAuthStore.getState().accounts.find((a) => a.id === result.userId);
            expect(account?.name).toBe("Updated Name");
        });

        it("should update employee fields independently of account", () => {
            const accountResult = useAuthStore.getState().createAccount(createTestAccount());
            useEmployeesStore.getState().addEmployee(
                createTestEmployee(accountResult.userId!, { id: "EMP-UPD" })
            );

            // Update employee fields
            useEmployeesStore.getState().updateEmployee("EMP-UPD", {
                emergencyContact: "New Emergency Contact",
                address: "New Address",
                salary: 60000,
            });

            // Assert employee updated
            const emp = useEmployeesStore.getState().getEmployee("EMP-UPD")!;
            expect(emp.emergencyContact).toBe("New Emergency Contact");
            expect(emp.address).toBe("New Address");
            expect(emp.salary).toBe(60000);

            // Assert account unchanged
            const account = useAuthStore.getState().accounts.find((a) => a.id === accountResult.userId);
            expect(account?.name).toBe("New Hire"); // Original name
        });
    });

    // ── Deletion ────────────────────────────────────────────
    describe("Account and employee deletion", () => {
        it("should remove account from auth store", () => {
            const result = useAuthStore.getState().createAccount(createTestAccount());
            const countBefore = useAuthStore.getState().accounts.length;

            useAuthStore.getState().deleteAccount(result.userId!);

            expect(useAuthStore.getState().accounts.length).toBe(countBefore - 1);
            expect(useAuthStore.getState().accounts.find((a) => a.id === result.userId)).toBeUndefined();
        });

        it("should remove employee from employees store", () => {
            const accountResult = useAuthStore.getState().createAccount(createTestAccount());
            useEmployeesStore.getState().addEmployee(
                createTestEmployee(accountResult.userId!, { id: "EMP-DEL" })
            );

            useEmployeesStore.getState().removeEmployee("EMP-DEL");

            expect(useEmployeesStore.getState().getEmployee("EMP-DEL")).toBeUndefined();
        });

        it("should allow re-creating account with same email after deletion", () => {
            // Create then delete
            const result = useAuthStore.getState().createAccount(createTestAccount());
            useAuthStore.getState().deleteAccount(result.userId!);

            // Re-create should succeed
            const result2 = useAuthStore.getState().createAccount(createTestAccount());
            expect(result2.ok).toBe(true);
            expect(result2.userId).toBeDefined();
        });
    });

    // ── Onboarding Flow ─────────────────────────────────────
    describe("Full onboarding lifecycle", () => {
        it("should complete onboarding flow for new hire", () => {
            // Step 1: Admin creates account
            const result = useAuthStore.getState().createAccount(
                createTestAccount({
                    mustChangePassword: true,
                    profileComplete: false,
                })
            );
            expect(result.ok).toBe(true);

            // Step 2: Admin creates employee record
            useEmployeesStore.getState().addEmployee(
                createTestEmployee(result.userId!, { id: "EMP-ONBOARD" })
            );

            // Step 3: New hire completes onboarding (changes password, updates profile)
            useAuthStore.getState().completeOnboarding(
                result.userId!,
                { name: "Completed Hire" },
                "newpassword789"
            );

            // Assert: Account is now complete
            const account = useAuthStore.getState().accounts.find((a) => a.id === result.userId);
            expect(account?.profileComplete).toBe(true);
            expect(account?.mustChangePassword).toBe(false);
            expect(account?.name).toBe("Completed Hire");
            expect(verifyPassword("newpassword789", account!.passwordHash!)).toBe(true);

            // Assert: Employee record unchanged
            const emp = useEmployeesStore.getState().getEmployee("EMP-ONBOARD")!;
            expect(emp.emergencyContact).toBe("Parent +63-555-0001");
            expect(emp.salary).toBe(55000);
        });
    });

    // ── Role-Based Account Creation ─────────────────────────
    describe("Role-based account creation", () => {
        const roles = ["admin", "hr", "finance", "employee", "supervisor", "payroll_admin", "auditor"] as const;

        it.each(roles)("should create account with role '%s'", (role) => {
            const result = useAuthStore.getState().createAccount(
                createTestAccount({ email: `${role}test@company.com`, role })
            );

            expect(result.ok).toBe(true);
            const account = useAuthStore.getState().accounts.find((a) => a.id === result.userId);
            expect(account?.role).toBe(role);
        });
    });

    // ── Seed Reset Isolation ────────────────────────────────
    describe("Seed reset cleans up created data", () => {
        it("should remove created accounts on auth reset", () => {
            useAuthStore.getState().createAccount(createTestAccount());
            expect(useAuthStore.getState().accounts.length).toBe(DEMO_USERS.length + 1);

            useAuthStore.getState().resetToSeed();
            expect(useAuthStore.getState().accounts.length).toBe(DEMO_USERS.length);
        });

        it("should remove created employees on employee reset", () => {
            const originalCount = useEmployeesStore.getState().employees.length;
            useEmployeesStore.getState().addEmployee(
                createTestEmployee("USR-TEMP", { id: "EMP-TEMP" })
            );
            expect(useEmployeesStore.getState().employees.length).toBe(originalCount + 1);

            useEmployeesStore.getState().resetToSeed();
            expect(useEmployeesStore.getState().employees.length).toBe(originalCount);
        });
    });
});
