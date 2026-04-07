"use client";

import { ThemeProvider } from "@/components/shell/theme-provider";
import { AppShell } from "@/components/shell/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OnboardingModal } from "@/components/auth/onboarding-modal";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase-browser";
import { hydrateAllStores, startWriteThrough, startRealtime, stopRealtime, stopWriteThrough } from "@/services/sync.service";

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

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        if (!isAuthenticated && pathname !== "/login") {
            // Hard navigation so the middleware re-evaluates cookies cleanly
            window.location.href = "/login";
        }
    }, [mounted, isAuthenticated, pathname]);

    // Sync stores with Supabase when authenticated (handles page refresh).
    // Also listens for Supabase SIGNED_OUT events (e.g. invalid/expired refresh
    // token) so the app redirects to login instead of logging auth errors.
    useEffect(() => {
        if (!mounted || !isAuthenticated) return;

        const supabase = createClient();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: import("@supabase/supabase-js").Session | null) => {
            // TOKEN_REFRESH_FAILED fires when the stored refresh token is
            // expired or revoked (e.g. after a server-side sign-out or token
            // rotation). SIGNED_OUT fires on explicit logout. Both should
            // redirect to login cleanly.
            // INITIAL_SESSION with a null session also means no valid auth.
            const shouldSignOut =
                event === "SIGNED_OUT" ||
                event === "TOKEN_REFRESHED" && !session ||
                (event as string) === "TOKEN_REFRESH_FAILED";
            if (shouldSignOut) {
                stopRealtime();
                stopWriteThrough();
                useAuthStore.getState().logout();
            }
        });

        hydrateAllStores().then(() => {
            startWriteThrough();
            startRealtime();
        });

        return () => {
            subscription.unsubscribe();
            stopRealtime();
        };
    }, [mounted, isAuthenticated]);

    const isLoginPage = pathname === "/login";
    const isRoot      = pathname === "/";
    const isKiosk     = pathname === "/kiosk" || pathname.startsWith("/kiosk/");
    const skipShell   = isLoginPage || isRoot || isKiosk;

    // Show spinner until React has mounted on the client (prevents hydration mismatch)
    if (!mounted) return <AppLoadingScreen />;

    // Show spinner while the unauthenticated redirect is in-flight
    if (!isAuthenticated && !isLoginPage) return <AppLoadingScreen />;

    return (
        <TooltipProvider>
            <ThemeProvider>
                <OnboardingModal />
                {skipShell ? children : <AppShell>{children}</AppShell>}
            </ThemeProvider>
        </TooltipProvider>
    );
}
