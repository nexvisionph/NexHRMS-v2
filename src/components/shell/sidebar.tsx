"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useProjectsStore } from "@/store/projects.store";
import { signOut } from "@/services/auth.service";
import { stopWriteThrough } from "@/services/sync.service";
import { useUIStore } from "@/store/ui.store";
import { useRolesStore } from "@/store/roles.store";
import { usePageBuilderStore } from "@/store/page-builder.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { useMessagingStore } from "@/store/messaging.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { NAV_ITEMS } from "@/lib/constants";
import {
    LayoutDashboard,
    Users,
    Contact,
    FolderKanban,
    Clock,
    Calendar,
    CalendarOff,
    Wallet,
    Banknote,
    BarChart3,
    Settings,
    Bell,
    ChevronLeft,
    LogOut,
    Building2,
    Clock3,
    Shield,
    ClipboardList,
    FileSearch,
    AlarmClock,
    X,
    FileText,
    Puzzle,
    ListTodo,
    MessageSquare,
    QrCode,
    ScanFace,
    UserCircle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useMemo } from "react";

const iconMap: Record<string, React.ElementType> = {
    LayoutDashboard,
    Users,
    Contact,
    FolderKanban,
    Clock,
    Calendar,
    CalendarOff,
    Wallet,
    Banknote,
    BarChart3,
    Settings,
    Bell,
    Building2,
    Clock3,
    Shield,
    ClipboardList,
    FileSearch,
    AlarmClock,
    FileText,
    Puzzle,
    ListTodo,
    MessageSquare,
    QrCode,
    ScanFace,
    UserCircle,
};

export function Sidebar() {
    const pathname = usePathname();
    const role = useAuthStore((s) => s.currentUser.role);
    const currentUser = useAuthStore((s) => s.currentUser);
    const { sidebarOpen, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore();
    const hasPermission = useRolesStore((s) => s.hasPermission);
    const getVisiblePages = usePageBuilderStore((s) => s.getVisiblePages);
    const customPages = useMemo(() => getVisiblePages(role), [getVisiblePages, role]);

    // Appearance store
    const modules = useAppearanceStore((s) => s.modules);
    const navOverrides = useAppearanceStore((s) => s.navOverrides);
    const sidebarVariant = useAppearanceStore((s) => s.sidebarVariant);
    const logoUrl = useAppearanceStore((s) => s.logoUrl);
    const companyName = useAppearanceStore((s) => s.companyName);
    const logoTextVisible = useAppearanceStore((s) => s.logoTextVisible);

    // Unread messages badge
    const currentUserId = useAuthStore((s) => s.currentUser.id);
    const getTotalUnreadForEmployee = useMessagingStore((s) => s.getTotalUnreadForEmployee);
    const totalUnreadMsgs = getTotalUnreadForEmployee(currentUserId);

    // Unread notifications badge
    const employees = useEmployeesStore((s) => s.employees);
    const getUnreadCountForEmployee = useNotificationsStore((s) => s.getUnreadCountForEmployee);
    const currentEmployeeId = useMemo(() => {
        const emp = employees.find(
            (e) => e.profileId === currentUser.id || e.email?.toLowerCase() === currentUser.email?.toLowerCase() || e.name === currentUser.name
        );
        return emp?.id;
    }, [employees, currentUser]);
    const totalUnreadNotifications = currentEmployeeId ? getUnreadCountForEmployee(currentEmployeeId) : 0;

    // Check if employee is assigned to a face-recognition project
    const getProjectForEmployee = useProjectsStore((s) => s.getProjectForEmployee);
    const hasFaceProject = useMemo(() => {
        if (role !== "employee" && role !== "supervisor") return false;
        const myEmp = employees.find(
            (e) => e.profileId === currentUser.id || e.email?.toLowerCase() === currentUser.email?.toLowerCase() || e.name === currentUser.name
        );
        if (!myEmp) return false;
        const project = getProjectForEmployee(myEmp.id);
        return project?.verificationMethod === "face_only";
    }, [role, employees, currentUser, getProjectForEmployee]);

    // Permission-based filtering + module flags + nav overrides
    const filtered = useMemo(() => {
        const systemItems = NAV_ITEMS
            .filter((item) => {
                // Face Enrollment: only show for employees with face-recognition projects
                if (item.href === "/face-enrollment" && !hasFaceProject) {
                    return false;
                }
                // Module flag check
                if (item.moduleFlag && !modules[item.moduleFlag as keyof typeof modules]) {
                    return false;
                }
                // Permission check
                if (item.permission) {
                    return hasPermission(role, item.permission);
                }
                return item.roles.includes(role as never);
            })
            .filter((item) => {
                // Nav override hidden check
                const ovr = navOverrides.find((o) => o.href === item.href);
                return !ovr?.hidden;
            })
            .map((item) => {
                // Apply nav overrides (label, icon, order)
                const ovr = navOverrides.find((o) => o.href === item.href);
                return {
                    ...item,
                    label: ovr?.label || item.label,
                    icon: ovr?.icon || item.icon,
                    order: ovr?.order ?? 999,
                };
            })
            .sort((a, b) => a.order - b.order);

        // Inject custom pages into the nav
        const customNavItems = customPages.map((page) => ({
            label: page.title,
            href: `/custom/${page.slug}`,
            icon: page.icon || "FileText",
        }));

        return { systemItems, customNavItems };
    }, [role, hasPermission, customPages, modules, navOverrides, hasFaceProject]);

    // Build role-prefixed paths
    const rolePrefix = `/${role}`;

    // Close mobile sidebar on route change
    useEffect(() => {
        setMobileSidebarOpen(false);
    }, [pathname, setMobileSidebarOpen]);

    // Close mobile sidebar on window resize to desktop
    useEffect(() => {
        const onResize = () => {
            if (window.innerWidth >= 1024) setMobileSidebarOpen(false);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [setMobileSidebarOpen]);

    /* ---------- Shared navigation content ---------- */
    const navContent = (showLabel: boolean, isMobile: boolean) => (
        <>
            {/* Logo */}
            <div className={cn("flex h-16 items-center px-4", showLabel || isMobile ? "justify-between" : "justify-center")}>
                <Link href={`${rolePrefix}/dashboard`} className="flex items-center gap-2.5">
                    {logoUrl ? (
                        <img
                            src={logoUrl}
                            alt={companyName}
                            className="sidebar-logo max-h-[40px] w-auto max-w-[160px] object-contain transition-all duration-300"
                            style={{ marginLeft: showLabel ? "8px" : "0" }}
                        />
                    ) : (
                        <>
                            <Image
                                src="/logo.png"
                                alt={companyName}
                                width={showLabel ? 160 : 40}
                                height={40}
                                className="sidebar-logo transition-all duration-300 dark:hidden"
                                style={{ width: "auto", height: "auto", maxHeight: 40, marginLeft: showLabel ? "8px" : "0" }}
                                priority
                            />
                            <Image
                                src="/darklogo.png"
                                alt={companyName}
                                width={showLabel ? 160 : 40}
                                height={40}
                                className="sidebar-logo transition-all duration-300 hidden dark:block"
                                style={{ width: "auto", height: "auto", maxHeight: 40, marginLeft: showLabel ? "8px" : "0" }}
                                priority
                            />
                        </>
                    )}
                    {showLabel && logoTextVisible && logoUrl && (
                        <span className="text-sm font-bold truncate">{companyName}</span>
                    )}
                </Link>
                {isMobile && (
                    <button
                        onClick={() => setMobileSidebarOpen(false)}
                        className="rounded-lg p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                        aria-label="Close menu"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto thin-scrollbar">
                {filtered.systemItems.map((item) => {
                    const Icon = iconMap[item.icon];
                    const fullHref = item.absolute ? item.href : `${rolePrefix}${item.href}`;
                    const exactMatch = pathname === fullHref;
                    const prefixMatch = pathname.startsWith(fullHref + "/");
                    const moreSpecificExists = prefixMatch && filtered.systemItems.some(
                        (other) => other.href !== item.href && (pathname === `${rolePrefix}${other.href}` || pathname.startsWith(`${rolePrefix}${other.href}/`)) && other.href.startsWith(item.href)
                    );
                    const isActive = exactMatch || (prefixMatch && !moreSpecificExists);
                    return (
                        <Tooltip key={item.href} delayDuration={0}>
                            <TooltipTrigger asChild>
                                <Link
                                    href={fullHref}
                                    className={cn(
                                        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                        !showLabel && "justify-center",
                                        isActive
                                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                    )}
                                >
                                    {Icon && <Icon className="h-5 w-5 shrink-0" />}
                                    {showLabel && <span className="truncate">{item.label}</span>}
                                    {showLabel && item.href === "/messages" && totalUnreadMsgs > 0 && (
                                        <span className="ml-auto text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 rounded-full px-2 py-0.5 min-w-[20px] text-center border border-blue-200/50 dark:border-blue-800/30 shadow-sm leading-none">
                                            {totalUnreadMsgs}
                                        </span>
                                    )}
                                    {showLabel && item.href === "/notifications" && totalUnreadNotifications > 0 && (
                                        <span className="ml-auto text-[10px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 rounded-full px-2 py-0.5 min-w-[20px] text-center border border-rose-200/50 dark:border-rose-800/30 shadow-sm leading-none">
                                            {totalUnreadNotifications}
                                        </span>
                                    )}
                                </Link>
                            </TooltipTrigger>
                            {!showLabel && (
                                <TooltipContent side="right">{item.label}</TooltipContent>
                            )}
                        </Tooltip>
                    );
                })}

                {/* Custom pages */}
                {filtered.customNavItems.length > 0 && (
                    <>
                        {showLabel && (
                            <div className="pt-3 pb-1 px-3">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">Custom Pages</span>
                            </div>
                        )}
                        {filtered.customNavItems.map((item) => {
                            const Icon = iconMap[item.icon] || Puzzle;
                            const fullCustomHref = `${rolePrefix}${item.href}`;
                            const isActive = pathname === fullCustomHref;
                            return (
                                <Tooltip key={item.href} delayDuration={0}>
                                    <TooltipTrigger asChild>
                                        <Link
                                            href={fullCustomHref}
                                            className={cn(
                                                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                                !showLabel && "justify-center",
                                                isActive
                                                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                            )}
                                        >
                                            <Icon className="h-5 w-5 shrink-0" />
                                            {showLabel && <span className="truncate">{item.label}</span>}
                                        </Link>
                                    </TooltipTrigger>
                                    {!showLabel && (
                                        <TooltipContent side="right">{item.label}</TooltipContent>
                                    )}
                                </Tooltip>
                            );
                        })}
                    </>
                )}
            </nav>

            {/* Sign Out */}
            <div className="border-t border-sidebar-border p-3">
                <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                        <button
                            onClick={async () => {
                                useAuthStore.getState().logout();
                                stopWriteThrough();
                                await signOut().catch(() => {});
                                window.location.href = "/login";
                            }}
                            className={cn(
                                "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                !showLabel && "justify-center",
                                "text-sidebar-foreground/75 hover:bg-red-500/15 hover:text-red-500"
                            )}
                        >
                            <LogOut className="h-5 w-5 shrink-0" />
                            {showLabel && <span className="truncate">Sign Out</span>}
                        </button>
                    </TooltipTrigger>
                    {!showLabel && <TooltipContent side="right">Sign Out</TooltipContent>}
                </Tooltip>
            </div>

            {/* Collapse toggle — desktop only */}
            {!isMobile && (
                <button
                    onClick={toggleSidebar}
                    className="flex h-12 w-full items-center justify-center border-t border-sidebar-border text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
                    aria-label="Toggle sidebar"
                >
                    <ChevronLeft
                        className={cn(
                            "h-5 w-5 transition-transform duration-300",
                            !sidebarOpen && "rotate-180"
                        )}
                    />
                </button>
            )}
        </>
    );

    return (
        <>
            {/* Desktop sidebar — hidden below lg */}
            <aside
                className={cn(
                    "fixed left-0 top-0 z-40 hidden lg:flex h-screen flex-col border-r border-border bg-card transition-all duration-300",
                    sidebarOpen ? "w-64" : "w-[72px]",
                    sidebarVariant === "colored" && "sidebar-colored bg-primary text-primary-foreground border-primary/20"
                )}
            >
                {navContent(sidebarOpen, false)}
            </aside>

            {/* Mobile sidebar overlay — shown only when mobileSidebarOpen, hidden at lg+ */}
            {mobileSidebarOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm lg:hidden"
                        onClick={() => setMobileSidebarOpen(false)}
                        aria-hidden="true"
                    />
                    {/* Drawer — must be higher z-index than backdrop */}
                    <aside className={cn(
                        "fixed left-0 top-0 z-[70] flex h-screen w-72 max-w-[85vw] flex-col border-r border-border bg-card shadow-xl lg:hidden animate-in slide-in-from-left duration-200 touch-pan-y",
                        sidebarVariant === "colored" && "sidebar-colored bg-primary text-primary-foreground border-primary/20"
                    )}>
                        {navContent(true, true)}
                    </aside>
                </>
            )}
        </>
    );
}
