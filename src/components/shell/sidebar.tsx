"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";
import { signOut } from "@/services/auth.service";
import { stopWriteThrough } from "@/services/sync.service";
import { useUIStore } from "@/store/ui.store";
import { useRolesStore } from "@/store/roles.store";
import { usePageBuilderStore } from "@/store/page-builder.store";
import { useAppearanceStore } from "@/store/appearance.store";
import { useMessagingStore } from "@/store/messaging.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { useProjectsStore } from "@/store/projects.store";
import { NAV_ITEMS, NAV_GROUPS } from "@/lib/constants";
import { isAdministrativeRole } from "@/lib/admin-tier";
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
    Puzzle,
    ListTodo,
    MessageSquare,
    QrCode,
    ScanFace,
    UserCircle,
    Fingerprint,
    Briefcase,
    Palette,
    Calculator,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useMemo, useCallback, memo } from "react";
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
    Fingerprint,
    Briefcase,
    Palette,
    Calculator,
};

/* ---------- Grouped Navigation Sub-Component ---------- */

interface NavItemData {
    label: string;
    href: string;
    icon: string;
    absolute?: boolean;
    group?: string;
    order?: number;
    [key: string]: unknown;
}

interface GroupedNavProps {
    items: NavItemData[];
    customItems: { label: string; href: string; icon: string }[];
    pathname: string;
    rolePrefix: string;
    showLabel: boolean;
    isMobile: boolean;
    totalUnreadMsgs: number;
    totalUnreadNotifications: number;
}

function GroupedNav({ items, customItems, pathname, rolePrefix, showLabel, isMobile, totalUnreadMsgs, totalUnreadNotifications }: GroupedNavProps) {
    const collapsed = !showLabel && !isMobile;

    // Group items by their group field
    const groupedItems = useMemo(() => {
        const groups: { id: string; label: string; items: NavItemData[] }[] = [];
        const groupMap = new Map<string, NavItemData[]>();

        for (const item of items) {
            const groupId = item.group || "top";
            if (!groupMap.has(groupId)) groupMap.set(groupId, []);
            groupMap.get(groupId)!.push(item);
        }

        // Render in NAV_GROUPS order
        for (const group of NAV_GROUPS) {
            const groupItems = groupMap.get(group.id);
            if (groupItems && groupItems.length > 0) {
                groups.push({ id: group.id, label: group.label, items: groupItems });
            }
        }

        // Any items without a matching group go at the end
        for (const [id, groupItems] of groupMap) {
            if (!NAV_GROUPS.some((g) => g.id === id)) {
                groups.push({ id, label: "", items: groupItems });
            }
        }

        return groups;
    }, [items]);

    const renderNavItem = (item: NavItemData) => {
        const Icon = iconMap[item.icon];
        const fullHref = item.absolute ? item.href : `${rolePrefix}${item.href}`;
        const exactMatch = pathname === fullHref;
        const prefixMatch = pathname.startsWith(fullHref + "/");
        const moreSpecificExists = prefixMatch && items.some(
            (other) => other.href !== item.href && (pathname === `${rolePrefix}${other.href}` || pathname.startsWith(`${rolePrefix}${other.href}/`)) && other.href.startsWith(item.href)
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
                                : "text-foreground/80 hover:bg-muted hover:text-foreground"
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
            {groupedItems.map((group, groupIndex) => {
                const hasLabel = group.label && group.id !== "top" && group.id !== "bottom";

                // For collapsed sidebar, don't show group headers — just show icons
                if (collapsed) {
                    return (
                        <div key={group.id} className="space-y-0.5">
                            {group.items.map(renderNavItem)}
                        </div>
                    );
                }

                // Top-level and bottom items render without a group header
                if (!hasLabel) {
                    return (
                        <div key={group.id} className="space-y-0.5">
                            {group.items.map(renderNavItem)}
                        </div>
                    );
                }

                // Group with static label and top separator (matches screenshot)
                return (
                    <div key={group.id} className="pt-4 first:pt-0">
                        <div className="border-t border-border/40 mb-2" />
                        <div className="px-3 pb-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/45">
                                {group.label}
                            </span>
                        </div>
                        <div className="space-y-0.5">
                            {group.items.map(renderNavItem)}
                        </div>
                    </div>
                );
            })}

            {/* Custom pages */}
            {customItems.length > 0 && (
                <div className="pt-4">
                    {!collapsed && (
                        <>
                            <div className="border-t border-border/40 mb-2" />
                            <div className="px-3 pb-1">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/45">Custom Pages</span>
                            </div>
                        </>
                    )}
                    <div className="space-y-0.5">
                        {customItems.map((item) => {
                            const Icon = iconMap[item.icon] || Puzzle;
                            const fullCustomHref = `${rolePrefix}${item.href}`;
                            const isActive = pathname === fullCustomHref;
                            return (
                                <Tooltip key={item.href}>
                                    <TooltipTrigger asChild>
                                        <Link
                                            href={fullCustomHref}
                                            className={cn(
                                                "group relative flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                                                collapsed
                                                    ? "h-10 w-10 mx-auto justify-center"
                                                    : "gap-3 px-3 py-2",
                                                isActive
                                                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                                    : "text-foreground/80 hover:bg-muted hover:text-foreground"
                                            )}
                                        >
                                            <Icon className="h-[18px] w-[18px] shrink-0" />
                                            {!collapsed && <span className="truncate">{item.label}</span>}
                                        </Link>
                                    </TooltipTrigger>
                                    {collapsed && (
                                        <TooltipContent side="right" sideOffset={8}>{item.label}</TooltipContent>
                                    )}
                                </Tooltip>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
}

function SidebarComponent() {
    const pathname = usePathname();
    
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
    const roleForAccess = isAdministrativeRole(role) ? "admin" : role;
    const getVisiblePages = usePageBuilderStore((s) => s.getVisiblePages);
    const customPages = useMemo(() => getVisiblePages(roleForAccess), [getVisiblePages, roleForAccess]);

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
                    if (item.roles && item.roles.length > 0 && !item.roles.includes(roleForAccess as never)) {
                        return false;
                    }
                    return hasPermission(roleForAccess, item.permission);
                }
                return item.roles.includes(roleForAccess as never);
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
    }, [role, roleForAccess, hasPermission, customPages, modules, navOverrides, hasFaceProject]);

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
                        className="rounded-lg p-1.5 text-foreground/70 hover:bg-muted hover:text-foreground transition-colors"
                        aria-label="Close menu"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* Navigation */}
            <TooltipProvider delayDuration={600} disableHoverableContent>
            <nav className="flex-1 space-y-0.5 px-3 py-4 overflow-y-auto thin-scrollbar">
                <GroupedNav
                    items={filtered.systemItems}
                    customItems={filtered.customNavItems}
                    pathname={pathname}
                    rolePrefix={rolePrefix}
                    showLabel={showLabel}
                    isMobile={isMobile}
                    totalUnreadMsgs={totalUnreadMsgs}
                    totalUnreadNotifications={totalUnreadNotifications}
                />
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
                                "text-foreground/80 hover:bg-red-500/15 hover:text-red-500"
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
