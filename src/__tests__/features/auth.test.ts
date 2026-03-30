/**
 * Feature Test: Authentication & Account Management
 *
 * Covers: auth.store.ts
 * - Login/logout flow
 * - Password hashing & verification
 * - Account creation & validation
 * - Role switching
 * - Password management (change, admin set, onboarding)
 * - Profile updates
 * - Session state
 */

import { useAuthStore, hashPassword, verifyPassword } from "@/store/auth.store";
import { DEMO_USERS } from "@/data/seed";

beforeEach(() => useAuthStore.getState().resetToSeed());

describe("Authentication & Account Management", () => {
    // ── Password Utilities ──────────────────────────────────
    describe("Password hashing", () => {
        it("hashes password to base64", () => {
            const hash = hashPassword("demo1234");
            expect(hash).toBeTruthy();
            expect(hash).not.toBe("demo1234");
        });

        it("verifies correct password", () => {
            const hash = hashPassword("mypassword");
            expect(verifyPassword("mypassword", hash)).toBe(true);
        });

        it("rejects wrong password", () => {
            const hash = hashPassword("correct");
            expect(verifyPassword("wrong", hash)).toBe(false);
        });

        it("handles special characters", () => {
            const hash = hashPassword("p@$$w0rd!#%");
            expect(verifyPassword("p@$$w0rd!#%", hash)).toBe(true);
        });

        it("handles empty string gracefully", () => {
            const hash = hashPassword("");
            expect(verifyPassword("", hash)).toBe(true);
            expect(verifyPassword("notempty", hash)).toBe(false);
        });
    });

    // ── Login Flow ──────────────────────────────────────────
    describe("Login", () => {
        it("starts unauthenticated", () => {
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
        });

        it("logs in with correct credentials", () => {
            const ok = useAuthStore.getState().login("admin@nexhrms.com", "demo1234");
            expect(ok).toBe(true);
            expect(useAuthStore.getState().isAuthenticated).toBe(true);
            expect(useAuthStore.getState().currentUser.email).toBe("admin@nexhrms.com");
        });

        it("rejects wrong password", () => {
            const ok = useAuthStore.getState().login("admin@nexhrms.com", "wrongpass");
            expect(ok).toBe(false);
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
        });

        it("rejects non-existent email", () => {
            const ok = useAuthStore.getState().login("nobody@test.com", "demo1234");
            expect(ok).toBe(false);
        });

        it("is case-insensitive for email", () => {
            const ok = useAuthStore.getState().login("ADMIN@NEXHRMS.COM", "demo1234");
            expect(ok).toBe(true);
        });

        it("sets currentUser on successful login", () => {
            useAuthStore.getState().login("hr@nexhrms.com", "demo1234");
            const user = useAuthStore.getState().currentUser;
            expect(user.role).toBe("hr");
            expect(user.name).toBe("Jordan Lee");
        });
    });

    // ── Logout ──────────────────────────────────────────────
    describe("Logout", () => {
        it("clears authentication on logout", () => {
            useAuthStore.getState().login("admin@nexhrms.com", "demo1234");
            expect(useAuthStore.getState().isAuthenticated).toBe(true);
            useAuthStore.getState().logout();
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
        });

        it("resets currentUser to first account on logout", () => {
            useAuthStore.getState().login("hr@nexhrms.com", "demo1234");
            useAuthStore.getState().logout();
            expect(useAuthStore.getState().currentUser.id).toBe(useAuthStore.getState().accounts[0].id);
        });
    });

    // ── Role Switching ──────────────────────────────────────
    describe("Role switching", () => {
        it("switches to specified role", () => {
            useAuthStore.getState().switchRole("finance");
            expect(useAuthStore.getState().currentUser.role).toBe("finance");
        });

        it("falls back to first account for unknown role", () => {
            useAuthStore.getState().switchRole("nonexistent" as never);
            expect(useAuthStore.getState().currentUser.id).toBe(useAuthStore.getState().accounts[0].id);
        });

        it("can switch through all demo roles", () => {
            const roles = ["admin", "hr", "finance", "employee", "supervisor", "payroll_admin", "auditor"] as const;
            for (const role of roles) {
                useAuthStore.getState().switchRole(role);
                expect(useAuthStore.getState().currentUser.role).toBe(role);
            }
        });
    });

    // ── Account Creation ────────────────────────────────────
    describe("Account creation", () => {
        it("creates a new account", () => {
            const result = useAuthStore.getState().createAccount({
                name: "Test User",
                email: "test@nexhrms.com",
                role: "employee",
                password: "testpass123",
            });
            expect(result.ok).toBe(true);
            const accounts = useAuthStore.getState().accounts;
            expect(accounts.find((a) => a.email === "test@nexhrms.com")).toBeTruthy();
        });

        it("prevents duplicate emails", () => {
            const result = useAuthStore.getState().createAccount({
                name: "Dup User",
                email: "admin@nexhrms.com",
                role: "employee",
                password: "testpass123",
            });
            expect(result.ok).toBe(false);
            expect(result.error).toContain("already exists");
        });

        it("rejects short passwords (< 6 chars)", () => {
            const result = useAuthStore.getState().createAccount({
                name: "Short",
                email: "short@nexhrms.com",
                role: "employee",
                password: "12345",
            });
            expect(result.ok).toBe(false);
            expect(result.error).toContain("6 characters");
        });

        it("sets mustChangePassword by default", () => {
            useAuthStore.getState().createAccount({
                name: "New User",
                email: "new@nexhrms.com",
                role: "employee",
                password: "newpass123",
            });
            const acc = useAuthStore.getState().accounts.find((a) => a.email === "new@nexhrms.com");
            expect(acc?.mustChangePassword).toBe(true);
        });

        it("generates unique ID for new account", async () => {
            useAuthStore.getState().createAccount({
                name: "User A",
                email: "unique-a@nexhrms.com",
                role: "employee",
                password: "passpass",
            });
            // Auth store uses Date.now() for IDs — wait 1ms to guarantee uniqueness
            await new Promise((r) => setTimeout(r, 5));
            useAuthStore.getState().createAccount({
                name: "User B",
                email: "unique-b@nexhrms.com",
                role: "employee",
                password: "passpass",
            });
            const accounts = useAuthStore.getState().accounts;
            const newA = accounts.find((a) => a.email === "unique-a@nexhrms.com");
            const newB = accounts.find((a) => a.email === "unique-b@nexhrms.com");
            expect(newA).toBeTruthy();
            expect(newB).toBeTruthy();
            expect(newA!.id).not.toBe(newB!.id);
        });
    });

    // ── Password Management ─────────────────────────────────
    describe("Password management", () => {
        it("changes password with correct old password", () => {
            const userId = useAuthStore.getState().accounts[0].id;
            const result = useAuthStore.getState().changePassword(userId, "demo1234", "newpass123");
            expect(result.ok).toBe(true);
        });

        it("rejects password change with wrong old password", () => {
            const userId = useAuthStore.getState().accounts[0].id;
            const result = useAuthStore.getState().changePassword(userId, "wrongold", "newpass123");
            expect(result.ok).toBe(false);
        });

        it("admin can force-set password", () => {
            const userId = useAuthStore.getState().accounts[1].id;
            useAuthStore.getState().adminSetPassword(userId, "forcedpass");
            const acc = useAuthStore.getState().accounts.find((a) => a.id === userId);
            expect(acc?.mustChangePassword).toBe(true);
            expect(verifyPassword("forcedpass", acc!.passwordHash!)).toBe(true);
        });
    });

    // ── Profile & Onboarding ────────────────────────────────
    describe("Profile management", () => {
        it("updates profile fields", () => {
            const userId = useAuthStore.getState().accounts[0].id;
            useAuthStore.getState().updateProfile(userId, { name: "Updated Name" });
            const acc = useAuthStore.getState().accounts.find((a) => a.id === userId);
            expect(acc?.name).toBe("Updated Name");
        });

        it("completes onboarding", () => {
            useAuthStore.getState().createAccount({
                name: "Onboard User",
                email: "onboard@nexhrms.com",
                role: "employee",
                password: "initial123",
                mustChangePassword: true,
                profileComplete: false,
            });
            const acc = useAuthStore.getState().accounts.find((a) => a.email === "onboard@nexhrms.com")!;
            useAuthStore.getState().completeOnboarding(acc.id, { name: "Completed User" }, "newpass456");
            const updated = useAuthStore.getState().accounts.find((a) => a.id === acc.id);
            expect(updated?.profileComplete).toBe(true);
            expect(updated?.mustChangePassword).toBe(false);
            expect(updated?.name).toBe("Completed User");
        });
    });

    // ── Account Deletion ────────────────────────────────────
    describe("Account deletion", () => {
        it("removes account by ID", () => {
            const countBefore = useAuthStore.getState().accounts.length;
            const lastId = useAuthStore.getState().accounts[countBefore - 1].id;
            useAuthStore.getState().deleteAccount(lastId);
            expect(useAuthStore.getState().accounts.length).toBe(countBefore - 1);
        });
    });

    // ── Theme ───────────────────────────────────────────────
    describe("Theme", () => {
        it("defaults to light", () => {
            expect(useAuthStore.getState().theme).toBe("light");
        });

        it("can set dark theme", () => {
            useAuthStore.getState().setTheme("dark");
            expect(useAuthStore.getState().theme).toBe("dark");
        });

        it("can set system theme", () => {
            useAuthStore.getState().setTheme("system");
            expect(useAuthStore.getState().theme).toBe("system");
        });
    });

    // ── Seed Reset ──────────────────────────────────────────
    describe("Reset to seed", () => {
        it("restores original accounts", () => {
            useAuthStore.getState().createAccount({
                name: "Extra",
                email: "extra@nexhrms.com",
                role: "employee",
                password: "passpass",
            });
            useAuthStore.getState().resetToSeed();
            expect(useAuthStore.getState().accounts.length).toBe(DEMO_USERS.length);
            expect(useAuthStore.getState().isAuthenticated).toBe(false);
        });
    });
});
