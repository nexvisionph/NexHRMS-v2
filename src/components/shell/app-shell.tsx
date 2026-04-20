"use client";

import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { PushNotificationBanner } from "@/components/push-notification-banner";
import { useUIStore } from "@/store/ui.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { cn } from "@/lib/utils";
import { memo, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

function AppShellComponent({ children }: { children: React.ReactNode }) {
    const sidebarOpen = useUIStore((s) => s.sidebarOpen);
    
    // Consolidated appearance store selector
    const { density, bannerEnabled, bannerText, bannerColor } = useAppearanceStore(
        useShallow((s) => ({
            density: s.density,
            bannerEnabled: s.topbarBannerEnabled,
            bannerText: s.topbarBannerText,
            bannerColor: s.topbarBannerColor,
        }))
    );

    // Memoize padding class to avoid recalculation on every render
    const paddingClass = useMemo(() => 
        density === "compact"
            ? "p-2 sm:p-3 md:p-4"
            : density === "relaxed"
                ? "p-4 sm:p-6 md:p-8"
                : "p-3 sm:p-4 md:p-6",
        [density]
    );

    // Memoize margin class
    const marginClass = sidebarOpen ? "lg:ml-64" : "lg:ml-[72px]";

    return (
        <div className="min-h-screen bg-background">
            <Sidebar />
            <Topbar />
            {/* Push Notification Banner */}
            <div className={cn("sticky top-16 z-20 transition-all duration-300", marginClass)}>
                <PushNotificationBanner />
            </div>
            {/* Announcement Banner */}
            {bannerEnabled && bannerText && (
                <div
                    className={cn(
                        "sticky top-16 z-20 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white transition-all duration-300",
                        marginClass
                    )}
                    style={{ backgroundColor: bannerColor || "#3b82f6" }}
                >
                    <span>{bannerText}</span>
                </div>
            )}
            <main
                className={cn(
                    "min-h-[calc(100vh-4rem)] transition-all duration-300",
                    paddingClass,
                    marginClass
                )}
            >
                {children}
            </main>
        </div>
    );
}

// Memoize to prevent unnecessary re-renders
export const AppShell = memo(AppShellComponent);
