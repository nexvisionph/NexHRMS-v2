"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";
import { signOut } from "@/services/auth.service";
import { stopWriteThrough } from "@/services/sync.service";
import { useUIStore } from "@/store/ui.store";
import { useRolesStore } from "@/store/roles.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { useMessagingStore } from "@/store/messaging.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { useProjectsStore } from "@/store/projects.store";
import { NAV_ITEMS, NAV_GROUPS } from "@/lib/constants";
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
    ChevronRight,
    LogOut,
    Building2,
    Clock3,
    Shield,
    ClipboardList,
    FileSearch,
    AlarmClock,
    X,
    FileText,
    ListTodo,
    MessageSquare,
    QrCode,
    ScanFace,
    UserCircle,
    Landmark,
    ReceiptText,
    ShieldCheck,
    Paintbrush,
    Calculator,
    FolderArchive,
    Gavel,
    Briefcase,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useMemo, memo } from "react";
import { useShallow } from "zustand/react/shallow";

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
    Landmark,
    ReceiptText,
    ShieldCheck,
    Paintbrush,
    Calculator,
    FolderArchive,
    Gavel,
    Briefcase,
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
    ListTodo,
    MessageSquare,
    QrCode,
    ScanFace,
    UserCircle,
};

function SidebarComponent() {
    const pathname = usePathname();
    const router = useRouter();
    
    // Consolidated auth store selector
    const { role, currentUserId, currentUserEmail, currentUserName } = useAuthStore(
        useShallow((s) => ({
            role: s.currentUser.role,
            currentUserId: s.currentUser.id,
            currentUserEmail: s.currentUser.email,
            currentUserName: s.currentUser.name,
        }))
    );
    
    // Consolidated UI store selector
    const { sidebarOpen, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore(
        useShallow((s) => ({
            sidebarOpen: s.sidebarOpen,
            toggleSidebar: s.toggleSidebar,
            mobileSidebarOpen: s.mobileSidebarOpen,
            setMobileSidebarOpen: s.setMobileSidebarOpen,
        }))
    );
    
    const hasPermission = useRolesStore((s) => s.hasPermission);

    // Consolidated appearance store selector
    const { modules, navOverrides, sidebarVariant, logoUrl, companyName, logoTextVisible } = useAppearanceStore(
        useShallow((s) => ({
            modules: s.modules,
            navOverrides: s.navOverrides,
            sidebarVariant: s.sidebarVariant,
            logoUrl: s.logoUrl,
            companyName: s.companyName,
            logoTextVisible: s.logoTextVisible,
        }))
    );

    // Unread messages badge
    const getTotalUnreadForEmployee = useMessagingStore((s) => s.getTotalUnreadForEmployee);
    const totalUnreadMsgs = getTotalUnreadForEmployee(currentUserId);

    // Unread notifications badge
    const employees = useEmployeesStore((s) => s.employees);
    const getUnreadCountForEmployee = useNotificationsStore((s) => s.getUnreadCountForEmployee);
    const currentEmployeeId = useMemo(() => {
        const emp = employees.find(
            (e) => e.profileId === currentUserId || e.email?.toLowerCase() === currentUserEmail?.toLowerCase() || e.name === currentUserName
        );
        return emp?.id;
    }, [employees, currentUserId, currentUserEmail, currentUserName]);
    const totalUnreadNotifications = currentEmployeeId ? getUnreadCountForEmployee(currentEmployeeId) : 0;

    // Check if this employee is assigned to a face-enabled project
    const getProjectForEmployee = useProjectsStore((s) => s.getProjectForEmployee);
    const hasFaceProject = useMemo(() => {
        if (!currentEmployeeId) return false;
        const project = getProjectForEmployee(currentEmployeeId);
        // Show face enrollment only if the employee's project uses face verification
        return !!project && project.verificationMethod === "face_only";
    }, [currentEmployeeId, getProjectForEmployee]);

    // Permission-based filtering + module flags + nav overrides
    const filtered = useMemo(() => {
        const systemItems = NAV_ITEMS
            .filter((item) => {
                // Module flag check
                if (item.moduleFlag && !modules[item.moduleFlag as keyof typeof modules]) {
                    return false;
                }
                // Face enrollment: only show for employees on face-enabled projects
                if (item.href === "/face-enrollment" && !hasFaceProject) {
                    return false;
                }
                // Permission check — also enforce roles list when defined
                if (item.permission) {
                    if (item.roles && item.roles.length > 0 && !item.roles.includes(role as never)) {
                        return false;
                    }
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

        return { systemItems };
    }, [role, hasPermission, modules, navOverrides, hasFaceProject]);

    // Split filtered items into top-level (no group) and section groups
    const groupedNav = useMemo(() => {
        const topLevel = filtered.systemItems.filter((item) => !item.group);
        const sectionMap = new Map<string, typeof filtered.systemItems>();
        for (const item of filtered.systemItems) {
            if (item.group) {
                if (!sectionMap.has(item.group)) sectionMap.set(item.group, []);
                sectionMap.get(item.group)!.push(item);
            }
        }
        const sections = NAV_GROUPS
            .filter((g) => sectionMap.has(g.key))
            .map((g) => ({ ...g, items: sectionMap.get(g.key)! }));
        return { topLevel, sections };
    }, [filtered]);

    // Build role-prefixed paths
    const rolePrefix = `/${role}`;

    // Prefetch all nav routes on mount for instant page transitions
    useEffect(() => {
        if (!role) return;
        const routes = filtered.systemItems.map((item) =>
            item.absolute ? item.href : `${rolePrefix}${item.href}`
        );
        // Prefetch in batches to avoid overwhelming the browser
        routes.forEach((route, i) => {
            setTimeout(() => router.prefetch(route), i * 100);
        });
    }, [role, rolePrefix, filtered.systemItems, router]);

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

    // Keyboard shortcut: Ctrl+. to toggle sidebar (desktop only)
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === ".") {
                // Don't toggle when typing in inputs
                const tag = (e.target as HTMLElement)?.tagName;
                if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
                e.preventDefault();
                toggleSidebar();
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [toggleSidebar]);

    /* ---------- Shared navigation content ---------- */
    const navContent = (showLabel: boolean, isMobile: boolean) => {
        const collapsed = !showLabel && !isMobile;

        // Renders a single nav link row
        const renderNavItem = (item: (typeof filtered.systemItems)[number]) => {
            const Icon = iconMap[item.icon];
            const fullHref = item.absolute ? item.href : `${rolePrefix}${item.href}`;
            const exactMatch = pathname === fullHref;
            const prefixMatch = pathname.startsWith(fullHref + "/");
            const moreSpecificExists = prefixMatch && filtered.systemItems.some(
                (other) =>
                    other.href !== item.href &&
                    (pathname === `${rolePrefix}${other.href}` ||
                        pathname.startsWith(`${rolePrefix}${other.href}/`)) &&
                    other.href.startsWith(item.href)
            );
            const isActive = exactMatch || (prefixMatch && !moreSpecificExists);

            return (
                <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                        <Link
                            href={fullHref}
                            className={cn(
                                "group relative flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                                collapsed
                                    ? "h-10 w-10 mx-auto justify-center"
                                    : "gap-3 px-3 py-2",
                                isActive
                                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                            )}
                        >
                            {Icon && <Icon className="h-[18px] w-[18px] shrink-0" />}
                            {!collapsed && <span className="truncate">{item.label}</span>}
                            {/* Badge counts — expanded mode */}
                            {!collapsed && item.href === "/messages" && totalUnreadMsgs > 0 && (
                                <span className="ml-auto text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 rounded-full px-2 py-0.5 min-w-[20px] text-center border border-blue-200/50 dark:border-blue-800/30 shadow-sm leading-none">
                                    {totalUnreadMsgs}
                                </span>
                            )}
                            {!collapsed && item.href === "/notifications" && totalUnreadNotifications > 0 && (
                                <span className="ml-auto text-[10px] font-semibold bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 rounded-full px-2 py-0.5 min-w-[20px] text-center border border-rose-200/50 dark:border-rose-800/30 shadow-sm leading-none">
                                    {totalUnreadNotifications}
                                </span>
                            )}
                            {/* Dot indicators — collapsed mode */}
                            {collapsed && item.href === "/messages" && totalUnreadMsgs > 0 && (
                                <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-blue-500 ring-1 ring-background" />
                            )}
                            {collapsed && item.href === "/notifications" && totalUnreadNotifications > 0 && (
                                <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-rose-500 ring-1 ring-background" />
                            )}
                        </Link>
                    </TooltipTrigger>
                    {collapsed && (
                        <TooltipContent side="right" sideOffset={8}>{item.label}</TooltipContent>
                    )}
                </Tooltip>
            );
        };

        return (
        <>
            {/* Logo */}
            <div className={cn("flex h-16 items-center px-4", showLabel || isMobile ? "justify-between" : "justify-center")}>
                <Link href={`${rolePrefix}/dashboard`} className="flex items-center gap-2.5">
                    {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={logoUrl}
                            alt={companyName}
                            className="sidebar-logo h-9 max-w-[140px] object-contain transition-all duration-300"
                        />
                    ) : (
                        <>
                            <Image
                                src="/logo.png"
                                alt={companyName}
                                width={showLabel ? 140 : 36}
                                height={36}
                                className="sidebar-logo transition-all duration-300 dark:hidden"
                                style={{ width: "auto", height: "auto", maxHeight: 36 }}
                                priority
                            />
                            <Image
                                src="/darklogo.png"
                                alt={companyName}
                                width={showLabel ? 140 : 36}
                                height={36}
                                className="sidebar-logo transition-all duration-300 hidden dark:block"
                                style={{ width: "auto", height: "auto", maxHeight: 36 }}
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
            <TooltipProvider delayDuration={600} disableHoverableContent>
            <nav className="flex-1 px-3 py-3 overflow-y-auto thin-scrollbar space-y-0.5">
                {/* Top-level items (Dashboard, My Profile) */}
                {groupedNav.topLevel.map(renderNavItem)}

                {/* Grouped sections */}
                {groupedNav.sections.map((section) => (
                    <div key={section.key}>
                        {/* Section divider */}
                        <div className={cn(
                            "border-t border-sidebar-border/40 mt-3",
                            collapsed ? "mb-2 mx-1" : "mb-1 mx-0"
                        )} />
                        {/* Section label — hidden in collapsed icon-only mode */}
                        {!collapsed && (
                            <p className="px-2 pb-1 text-[10px] font-semibold tracking-widest uppercase text-sidebar-foreground/40 select-none">
                                {section.label}
                            </p>
                        )}
                        <div className="space-y-0.5">
                            {section.items.map(renderNavItem)}
                        </div>
                    </div>
                ))}
            </nav>
            </TooltipProvider>

            {/* Sign Out */}
            <div className="border-t border-sidebar-border p-3">
                <TooltipProvider delayDuration={600} disableHoverableContent>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={async () => {
                                useAuthStore.getState().logout();
                                stopWriteThrough();
                                await signOut().catch(() => {});
                                window.location.href = "/login";
                            }}
                            className={cn(
                                "group flex w-full items-center rounded-lg text-sm font-medium transition-all duration-200",
                                !showLabel && !isMobile
                                    ? "h-10 w-10 mx-auto justify-center"
                                    : "gap-3 px-3 py-2.5",
                                "text-sidebar-foreground/75 hover:bg-red-500/15 hover:text-red-500"
                            )}
                        >
                            <LogOut className="h-5 w-5 shrink-0" />
                            {(showLabel || isMobile) && <span className="truncate">Sign Out</span>}
                        </button>
                    </TooltipTrigger>
                    {!showLabel && !isMobile && <TooltipContent side="right" sideOffset={8}>Sign Out</TooltipContent>}
                </Tooltip>
                </TooltipProvider>
            </div>


        </>
        );
    };

    return (
        <>
            {/* Desktop sidebar — hidden below lg */}
            <aside
                className={cn(
                    "fixed left-0 top-0 z-40 hidden lg:flex h-screen flex-col border-r border-border bg-card overflow-visible transition-all duration-300",
                    sidebarOpen ? "w-64" : "w-[72px]",
                    sidebarVariant === "colored" && "sidebar-colored bg-primary text-primary-foreground border-primary/20"
                )}
            >
                {navContent(sidebarOpen, false)}

                {/* Overlapping collapse button — desktop only */}
                <button
                    onClick={toggleSidebar}
                    className={cn(
                        "absolute top-[86px] -right-3.5 z-50",
                        "h-7 w-7 rounded-full border border-border bg-card shadow-sm",
                        "flex items-center justify-center",
                        "text-foreground/60 hover:text-foreground hover:shadow-md",
                        "transition-all duration-200",
                        sidebarVariant === "colored" && "bg-primary border-primary-foreground/20 text-primary-foreground/70 hover:text-primary-foreground"
                    )}
                    aria-label="Toggle sidebar"
                >
                    {sidebarOpen
                        ? <ChevronLeft className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
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

// Memoize to prevent unnecessary re-renders when parent (AppShell) re-renders
export const Sidebar = memo(SidebarComponent);
