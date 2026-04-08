"use client";

import { useAuthStore } from "@/store/auth.store";
import { useUIStore } from "@/store/ui.store";
import { signOut } from "@/services/auth.service";
import { stopWriteThrough } from "@/services/sync.service";
import { useEmployeesStore } from "@/store/employees.store";
import { useNotificationsStore } from "@/store/notifications.store";
import { DEMO_USERS } from "@/data/seed";
import {
    Search,
    Bell,
    Moon,
    Sun,
    Menu,
    ChevronDown,
    LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";
import { useRouter } from "next/navigation";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { useEffect, useState } from "react";
import { useAppearanceStore } from "@/store/appearance.store";

export function Topbar() {
    const { currentUser, theme, setTheme, switchRole, logout } = useAuthStore();
    const { sidebarOpen, toggleMobileSidebar } = useUIStore();
    const employees = useEmployeesStore((s) => s.employees);
    const router = useRouter();
    const [cmdOpen, setCmdOpen] = useState(false);
    const getUnreadCountForEmployee = useNotificationsStore((s) => s.getUnreadCountForEmployee);
    const companyName = useAppearanceStore((s) => s.companyName);
    const showCompanyNameInTopbar = useAppearanceStore((s) => s.showCompanyNameInTopbar);
    const accentBadgeText = useAppearanceStore((s) => s.accentBadgeText);
    const markAllAsRead = useNotificationsStore((s) => s.markAllAsRead);
    const rolePrefix = `/${currentUser.role}`;

    // Get current employee ID for notification count
    const currentEmployeeId = employees.find(
        (e) => e.profileId === currentUser.id || e.email === currentUser.email || e.name === currentUser.name
    )?.id;
    const notifCount = currentEmployeeId ? getUnreadCountForEmployee(currentEmployeeId) : 0;

    const handleNotificationClick = () => {
        // Mark all notifications as read when clicking the bell icon
        if (currentEmployeeId && notifCount > 0) {
            markAllAsRead(currentEmployeeId);
        }
        router.push(`${rolePrefix}/notifications`);
    };

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setCmdOpen((open) => !open);
            }
        };
        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const roleColors: Record<Role, string> = {
        admin: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        hr: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
        finance: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        employee: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
        supervisor: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
        payroll_admin: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
        auditor: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    };

    return (
        <>
            <header
                className={cn(
                    "sticky top-0 z-30 flex h-16 items-center gap-2 sm:gap-4 border-b border-border bg-card/80 backdrop-blur-xl px-3 sm:px-6 transition-all duration-300",
                    // On mobile: full width. On desktop: respect sidebar width.
                    sidebarOpen ? "lg:ml-64" : "lg:ml-[72px]"
                )}
            >
                {/* Hamburger — mobile only */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden shrink-0"
                    onClick={toggleMobileSidebar}
                >
                    <Menu className="h-5 w-5" />
                </Button>

                {/* Company name — desktop only */}
                {showCompanyNameInTopbar && (
                    <div className="hidden lg:flex items-center gap-2">
                        <span className="text-sm font-semibold truncate max-w-[200px]">{companyName}</span>
                        {accentBadgeText && (
                            <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                                {accentBadgeText}
                            </Badge>
                        )}
                    </div>
                )}

                {/* Search — hidden on small screens, icon button to open command palette */}
                <div className="relative flex-1 max-w-md hidden sm:block">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search... (Ctrl+K)"
                        className="pl-9 bg-muted/50 border-0 focus-visible:ring-1"
                        onFocus={() => setCmdOpen(true)}
                        readOnly
                    />
                </div>
                {/* Mobile search icon */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="sm:hidden shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => setCmdOpen(true)}
                >
                    <Search className="h-5 w-5" />
                </Button>

                {/* Spacer on mobile */}
                <div className="flex-1 sm:hidden" />

                <div className="flex items-center gap-1 sm:gap-2 ml-auto">
                    {/* Theme toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </Button>

                    {/* Notifications */}
                    <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors" onClick={handleNotificationClick}>
                        <Bell className="h-[1.125rem] w-[1.125rem]" />
                        {notifCount > 0 && (
                            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-background">
                                {notifCount > 9 ? "9+" : notifCount}
                            </span>
                        )}
                    </Button>

                    {/* Role Switcher — only in demo mode */}
                    {process.env.NEXT_PUBLIC_DEMO_MODE === "true" && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                                <Badge variant="secondary" className={cn("text-xs font-medium", roleColors[currentUser.role])}>
                                    <span className="hidden sm:inline">{currentUser.role.toUpperCase()}</span>
                                    <span className="sm:hidden">{currentUser.role.slice(0, 3).toUpperCase()}</span>
                                </Badge>
                                <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Switch Role (Demo)</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {DEMO_USERS.map((u) => (
                                <DropdownMenuItem
                                    key={u.id}
                                    onClick={() => {
                                        switchRole(u.role);
                                        router.push(`/${u.role}/dashboard`);
                                    }}
                                    className={cn(currentUser.role === u.role && "bg-accent")}
                                >
                                    <span className="flex items-center gap-2">
                                        <Badge variant="secondary" className={cn("text-xs", roleColors[u.role])}>
                                            {u.role}
                                        </Badge>
                                        {u.name}
                                    </span>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    )}

                    {/* User Avatar */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="gap-2 px-2">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                                        {getInitials(currentUser.name)}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="hidden md:block text-sm font-medium">
                                    {currentUser.name}
                                </span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel>{currentUser.email}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push(`${rolePrefix}/settings`)}>
                                Settings
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={async () => {
                                    logout();
                                    stopWriteThrough();
                                    await signOut().catch(() => {});
                                    window.location.href = "/login";
                                }}
                                className="text-red-600 focus:text-red-600 focus:bg-red-500/10 gap-2"
                            >
                                <LogOut className="h-4 w-4" /> Log out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Command Palette */}
            <CommandDialog open={cmdOpen} onOpenChange={setCmdOpen}>
                <CommandInput placeholder="Search employees, pages..." />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup heading="Pages">
                        {[
                            { label: "Dashboard", href: "/dashboard" },
                            { label: "Employees", href: "/employees/manage" },
                            { label: "Directory", href: "/employees/directory" },
                            { label: "Attendance", href: "/attendance" },
                            { label: "Leave", href: "/leave" },
                            { label: "Payroll", href: "/payroll" },
                            { label: "Settings", href: "/settings" },
                        ].map((p) => (
                            <CommandItem
                                key={p.href}
                                onSelect={() => {
                                    router.push(`${rolePrefix}${p.href}`);
                                    setCmdOpen(false);
                                }}
                            >
                                {p.label}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                    <CommandGroup heading="Employees">
                        {employees.slice(0, 8).map((emp) => (
                            <CommandItem
                                key={emp.id}
                                onSelect={() => {
                                    router.push(`${rolePrefix}/employees/${emp.id}`);
                                    setCmdOpen(false);
                                }}
                            >
                                {emp.name} — {emp.role}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    );
}
