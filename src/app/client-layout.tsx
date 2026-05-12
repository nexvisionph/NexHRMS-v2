"use client";

import { ThemeProvider } from "@/components/shell/theme-provider";
import { AppShell } from "@/components/shell/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useEffect, useState } from "react";
import { createClient, clearAuthStorage, resetClient, safeGetSession, installAuthErrorSuppression } from "@/services/supabase-browser";
import { hydrateAllStores, startWriteThrough, startRealtime, stopRealtime, stopWriteThrough } from "@/services/sync.service";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const USE_DEMO_MODE = process.env.NEXT_PUBLIC_USE_DEMO_MODE === "true";

function AppLoadingScreen() {
    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
        </div>
    );
}

function ForcePasswordChangeModal() {
    const currentUser = useAuthStore((s) => s.currentUser);
    const forceSetPassword = useAuthStore((s) => s.forceSetPassword);
    const setUser = useAuthStore((s) => s.setUser);

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const isOpen = currentUser?.mustChangePassword === true;
    const isValid = newPassword.length >= 8 && newPassword === confirmPassword;

    const handleSubmit = async () => {
        if (!isValid) return;
        setLoading(true);

        try {
            if (USE_DEMO_MODE) {
                // Demo mode: use forceSetPassword to update password without requiring old password
                const result = forceSetPassword(currentUser.id, newPassword);
                if (!result.ok) {
                    toast.error(result.error || "Failed to change password");
                    setLoading(false);
                    return;
                }
                toast.success("Password changed successfully!");
            } else {
                // Supabase mode: call API to change password
                const res = await fetch("/api/auth/change-password", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ newPassword }),
                });
                const data = await res.json();
                if (!res.ok) {
                    toast.error(data.error || "Failed to change password");
                    setLoading(false);
                    return;
                }
                // Update local state
                setUser({ ...currentUser, mustChangePassword: false });
                toast.success("Password changed successfully!");
            }
            setNewPassword("");
            setConfirmPassword("");
        } catch {
            toast.error("Failed to change password. Please try again.");
        }
        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <Dialog open={true}>
            <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                <DialogHeader>
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-5 w-5" />
                        <DialogTitle>Password Change Required</DialogTitle>
                    </div>
                    <DialogDescription>
                        For security reasons, you must set a new password before continuing.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <div className="relative">
                            <Input
                                id="new-password"
                                type={showPassword ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Min. 8 characters"
                                autoFocus
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                        {newPassword && newPassword.length < 8 && (
                            <p className="text-xs text-destructive">Password must be at least 8 characters</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input
                            id="confirm-password"
                            type={showPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                        />
                        {confirmPassword && newPassword !== confirmPassword && (
                            <p className="text-xs text-destructive">Passwords do not match</p>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSubmit} disabled={!isValid || loading} className="w-full gap-2">
                        <KeyRound className="h-4 w-4" />
                        {loading ? "Changing..." : "Set New Password"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const currentUser = useAuthStore((s) => s.currentUser);
    const employees = useEmployeesStore((s) => s.employees);
    const [mounted, setMounted] = useState(false);

    // Install global auth error suppression on mount (once)
    useEffect(() => {
        installAuthErrorSuppression();
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        if (!isAuthenticated && pathname !== "/login" && pathname !== "/deactivated") {
            // Hard navigation so the middleware re-evaluates cookies cleanly
            window.location.href = "/login";
        }
    }, [mounted, isAuthenticated, pathname]);

    // Guard: kick out deactivated/resigned employees that are already authenticated
    // (covers mid-session deactivation and page-refresh with a deactivated account)
    useEffect(() => {
        if (!isAuthenticated || !mounted || employees.length === 0) return;
        if (pathname === "/deactivated" || pathname === "/login") return;
        const myEmployee = employees.find(
            (e) =>
                e.profileId === currentUser?.id ||
                e.email?.toLowerCase() === currentUser?.email?.toLowerCase()
        );
        if (myEmployee && (myEmployee.status === "inactive" || myEmployee.status === "resigned")) {
            clearAuthStorage();
            resetClient();
            stopRealtime();
            stopWriteThrough();
            useAuthStore.getState().logout();
            window.location.href = "/deactivated";
        }
    }, [isAuthenticated, mounted, employees, currentUser, pathname]);

    // Sync stores with Supabase when authenticated (handles page refresh).
    // Also listens for Supabase auth events to handle invalid/expired tokens.
    useEffect(() => {
        if (!mounted || !isAuthenticated) return;

        const supabase = createClient();

        // Handle auth errors that may occur during token refresh
        const handleInvalidSession = () => {
            console.info("[Auth] Invalid session detected — logging out");
            clearAuthStorage();
            resetClient();
            stopRealtime();
            stopWriteThrough();
            useAuthStore.getState().logout();
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: import("@supabase/supabase-js").Session | null) => {
            // TOKEN_REFRESHED with no session = refresh token was invalid
            // SIGNED_OUT = explicit logout or server-side session termination
            const shouldSignOut =
                event === "SIGNED_OUT" ||
                (event === "TOKEN_REFRESHED" && !session);

            if (shouldSignOut) {
                console.info("[Auth] Session ended:", event);
                handleInvalidSession();
            }
        });

        // Verify current session is valid using safe getter (no console errors)
        safeGetSession(supabase).then((session) => {
            if (!session) {
                handleInvalidSession();
                return;
            }
            // Session is valid, hydrate stores (skip redundant session check)
            hydrateAllStores({ skipSessionCheck: true }).then(() => {
                startWriteThrough();
                startRealtime();  // non-blocking — both fire immediately after hydration
            });
        });

        return () => {
            subscription.unsubscribe();
            stopRealtime();
        };
    }, [mounted, isAuthenticated]);

    const isLoginPage = pathname === "/login";
    const isRoot      = pathname === "/";
    const isKiosk     = pathname === "/kiosk" || pathname.startsWith("/kiosk/");
    const isDeactivated = pathname === "/deactivated";
    const skipShell   = isLoginPage || isRoot || isKiosk || isDeactivated;

    // Show spinner until React has mounted on the client (prevents hydration mismatch)
    if (!mounted) return <AppLoadingScreen />;

    // Show spinner while the unauthenticated redirect is in-flight
    if (!isAuthenticated && !isLoginPage && !isDeactivated) return <AppLoadingScreen />;

    return (
        <TooltipProvider>
            <ThemeProvider>
                {skipShell ? children : <AppShell>{children}</AppShell>}
                {/* Force password change modal - blocks UI until password is changed */}
                {isAuthenticated && !isKiosk && <ForcePasswordChangeModal />}
            </ThemeProvider>
        </TooltipProvider>
    );
}
