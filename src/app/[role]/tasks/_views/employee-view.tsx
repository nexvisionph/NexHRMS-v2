"use client";

import { useState, useMemo, useEffect } from "react";
import { useTasksStore } from "@/store/tasks.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { tasksDb } from "@/services/db.service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getInitials, formatDate } from "@/lib/format";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import Link from "next/link";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    ListTodo, CheckCircle2, ArrowUpRight, Eye, Clock, Send, XCircle,
    AlertTriangle, Camera, ChevronRight, ChevronLeft, Search, Filter, Loader2,
    LayoutGrid, Table2, CalendarDays, ChevronDown,
} from "lucide-react";
import { FullScreenCalendar, type CalendarItem, type CalendarItemColor } from "@/components/ui/fullscreen-calendar";
import type { Task, TaskStatus, TaskPriority, TaskCompletionReport } from "@/types";

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
    open: { label: "Open", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    submitted: { label: "Submitted", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
    verified: { label: "Verified", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    rejected: { label: "Rejected", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
    low: { label: "Low", color: "bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400" },
    medium: { label: "Medium", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
    high: { label: "High", color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
    urgent: { label: "Urgent", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
};

function EmptyState({ icon: Icon, message }: { icon: typeof ListTodo; message: string }) {
    return (
        <Card className="border border-border/50">
            <CardContent className="p-10 text-center text-muted-foreground">
                <Icon className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{message}</p>
            </CardContent>
        </Card>
    );
}

function TaskCard({
    task, href, groupName, getEmpName, completionReport,
}: {
    task: Task;
    href: string;
    groupName: string;
    getEmpName: (id: string) => string;
    completionReport?: TaskCompletionReport;
}) {
    const sc = STATUS_CONFIG[task.status];
    const pc = PRIORITY_CONFIG[task.priority];
    const isOverdue =
        task.dueDate &&
        new Date(task.dueDate) < new Date() &&
        !["verified", "cancelled"].includes(task.status);

    return (
        <Link href={href}>
            <Card className="border border-border/50 hover:border-border active:scale-[0.99] transition-all cursor-pointer touch-manipulation">
                <CardContent className="p-3.5 sm:p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 overflow-hidden">
                            <p className="text-sm font-medium leading-snug break-words">{task.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{groupName}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <Badge variant="secondary" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>
                    {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 break-words">{task.description}</p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className={`text-[10px] ${pc.color}`}>{pc.label}</Badge>
                        {task.completionRequired && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                                <Camera className="h-3 w-3" /> Proof
                            </Badge>
                        )}
                        {task.tags?.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                        ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex -space-x-1.5">
                            {task.assignedTo.slice(0, 3).map((empId) => (
                                <Avatar key={empId} className="h-5 w-5 border-2 border-card">
                                    <AvatarFallback className="text-[7px] bg-muted">{getInitials(getEmpName(empId))}</AvatarFallback>
                                </Avatar>
                            ))}
                        </div>
                        {task.dueDate && (
                            <span className={isOverdue ? "text-red-600 font-medium" : ""}>
                                {isOverdue && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}
                                Due {formatDate(task.dueDate)}
                            </span>
                        )}
                    </div>
                    {completionReport?.rejectionReason && task.status === "rejected" && (
                        <div className="bg-red-50 dark:bg-red-900/20 rounded p-2 text-xs text-red-700 dark:text-red-400">
                            <strong>Rejection:</strong> {completionReport.rejectionReason}
                        </div>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}

export default function EmployeeTasksView() {
    // Subscribe to tasks array so component re-renders when new tasks are added
    const tasks = useTasksStore((s) => s.tasks);
    const groups = useTasksStore((s) => s.groups);
    const getCompletionReport = useTasksStore((s) => s.getCompletionReport);
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);
    const roleHref = useRoleHref();
    const [search, setSearch] = useState("");
    const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
    const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
    const [viewMode, setViewMode] = useState<"table" | "board">("table");
    const [activeTab, setActiveTab] = useState("all");
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // Loading state — show spinner until we've made at least one DB fetch
    // so the employee never sees stale seed/localStorage tasks.
    const [isLoading, setIsLoading] = useState(true);
    const [fetchAttempted, setFetchAttempted] = useState(false);

    // Resolve the HR employee record by email so tasks assigned to "EMP026"
    // are found even though the DemoUser id is "U004".
    const myEmployeeId = useMemo(
        () => employees.find((e) => e.profileId === currentUser.id || e.email?.toLowerCase() === currentUser.email?.toLowerCase() || e.name === currentUser.name)?.id ?? currentUser.id,
        [employees, currentUser.email, currentUser.name, currentUser.id],
    );

    // Always fetch fresh tasks from DB on mount so newly assigned tasks are
    // visible even when hydrateAllStores() ran before the task was created.
    // The 400ms delay gives the global hydration a head-start; if that already
    // set a non-empty tasks array we still replace it with the freshest data.
    useEffect(() => {
        if (fetchAttempted) return;

        const timer = setTimeout(async () => {
            try {
                const allTasks = await tasksDb.fetchTasks();
                // Always replace store tasks with authoritative DB data
                useTasksStore.setState({ tasks: allTasks });
            } catch (err) {
                console.error("[EmployeeTasks] Failed to fetch tasks:", err);
            } finally {
                setIsLoading(false);
                setFetchAttempted(true);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [fetchAttempted]);

    // If the store was already hydrated with real (non-seed) tasks before the
    // component-level fetch completes, stop the spinner immediately so the user
    // doesn't wait unnecessarily.
    useEffect(() => {
        if (!fetchAttempted && employees.length > 0 && tasks.length > 0) {
            // Only skip the loading spinner, not the DB refresh — the timer above
            // will still fire and reconcile with Supabase in the background.
            setIsLoading(false);
        }
    }, [fetchAttempted, employees.length, tasks.length]);

    const isOverdue = (t: Task) =>
        t.dueDate && new Date(t.dueDate) < new Date() && !["verified", "cancelled"].includes(t.status);

    // Filter tasks assigned to current employee and sort by createdAt descending (newest first)
    const myTasks = useMemo(
        () => tasks
            .filter((t) => t.assignedTo.includes(myEmployeeId))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        [tasks, myEmployeeId],
    );

    const filteredTasks = useMemo(() => {
        let result = myTasks;
        if (statusFilter !== "all") result = result.filter((t) => t.status === statusFilter);
        if (priorityFilter !== "all") result = result.filter((t) => t.priority === priorityFilter);
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(
                (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
            );
        }
        return result;
    }, [myTasks, search, statusFilter, priorityFilter]);

    // ── Pagination computed ───────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(filteredTasks.length / rowsPerPage));
    const paginatedTasks = filteredTasks.length > 10
        ? filteredTasks.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
        : filteredTasks;

    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(1);
    }, [currentPage, totalPages]);

    useEffect(() => { setCurrentPage(1); }, [search, statusFilter, priorityFilter]);

    const activeTasks = filteredTasks.filter((t) => ["open", "in_progress", "rejected"].includes(t.status));
    const pendingReview = filteredTasks.filter((t) => t.status === "submitted");
    const completedTasks = filteredTasks.filter((t) => ["verified", "cancelled"].includes(t.status));

    const completionRate = myTasks.length > 0
        ? Math.round((myTasks.filter((t) => t.status === "verified").length / myTasks.length) * 100)
        : 0;
    const overdueCount = myTasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < new Date() && !["verified", "cancelled"].includes(t.status),
    ).length;

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name ?? id;
    const getGroupName = (id?: string) => id ? groups.find((g) => g.id === id)?.name ?? id : "Direct assignment";

    // Show loading state while hydrating/fetching
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
                <Loader2 className="h-10 w-10 mb-3 opacity-40 animate-spin" />
                <p className="text-sm">Loading your tasks...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-6">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">My Tasks</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    {myTasks.length} task{myTasks.length !== 1 ? "s" : ""} assigned to you
                </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {[
                    { label: "Active", value: activeTasks.length, icon: ArrowUpRight, color: "text-yellow-600" },
                    { label: "Review", value: pendingReview.length, icon: Eye, color: "text-purple-600" },
                    { label: "Done", value: completedTasks.length, icon: CheckCircle2, color: "text-green-600" },
                    { label: "Overdue", value: overdueCount, icon: AlertTriangle, color: overdueCount > 0 ? "text-red-600" : "text-muted-foreground" },
                ].map((kpi) => (
                    <Card key={kpi.label} className="border border-border/50">
                        <CardContent className="p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                            <kpi.icon className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 ${kpi.color}`} />
                            <div className="min-w-0">
                                <p className="text-[11px] sm:text-xs text-muted-foreground truncate">{kpi.label}</p>
                                <p className={`text-lg sm:text-xl font-bold leading-none mt-0.5 ${kpi.color}`}>{kpi.value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Progress Bar */}
            {myTasks.length > 0 && (
                <Card className="border border-border/50">
                    <CardContent className="p-3 sm:p-2">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">Completion Progress</span>
                            <span className="text-xs text-muted-foreground">{completionRate}%</span>
                        </div>
                        <Progress value={completionRate} className="h-1" />
                        <p className="text-[10px] text-muted-foreground mt-1">
                            {myTasks.filter((t) => t.status === "verified").length} of {myTasks.length} tasks verified
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* ── Tabs ────────────────────────────────── */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                {/* Mobile: scrollable row with toggle inline */}
                <div className="overflow-x-auto pb-0.5 sm:hidden">
                    <div className="flex items-center gap-2 w-full">
                        <TabsList className="flex-1">
                            <TabsTrigger value="all" className="gap-1.5 text-xs">
                                <Table2 className="h-3.5 w-3.5" /> All Tasks
                                <Badge variant="secondary" className="text-[10px] h-4 min-w-4 justify-center px-1">
                                    {filteredTasks.length}
                                </Badge>
                            </TabsTrigger>
                            <TabsTrigger value="pending" className="gap-1.5 text-xs">
                                Pending
                                {pendingReview.length > 0 && (
                                    <Badge variant="secondary" className="text-[10px] h-4 min-w-4 justify-center px-1">
                                        {pendingReview.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="calendar" className="gap-1.5 text-xs">
                                <CalendarDays className="h-3.5 w-3.5" /> Calendar
                            </TabsTrigger>
                        </TabsList>
                        {activeTab === "all" && (
                            <div className="flex items-center gap-1 border rounded-md p-0.5 shrink-0">
                                <Button variant={viewMode === "table" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" title="Table view" onClick={() => setViewMode("table")}>
                                    <Table2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant={viewMode === "board" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" title="Board view" onClick={() => setViewMode("board")}>
                                    <LayoutGrid className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Desktop: tabs left, toggle right */}
                <div className="hidden sm:flex sm:items-center justify-between gap-3">
                    <TabsList className="w-auto">
                        <TabsTrigger value="all" className="gap-1.5 text-sm">
                            <Table2 className="h-3.5 w-3.5" /> All Tasks
                            <Badge variant="secondary" className="text-[10px] h-4 min-w-4 justify-center px-1">
                                {filteredTasks.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="pending" className="gap-1.5 text-sm">
                            Pending
                            {pendingReview.length > 0 && (
                                <Badge variant="secondary" className="text-[10px] h-4 min-w-4 justify-center px-1">
                                    {pendingReview.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className="gap-1.5 text-sm">
                            <CalendarDays className="h-3.5 w-3.5" /> Calendar
                        </TabsTrigger>
                    </TabsList>
                    {activeTab === "all" && (
                        <div className="flex items-center gap-1 border rounded-md p-0.5">
                            <Button variant={viewMode === "table" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" title="Table view" onClick={() => setViewMode("table")}>
                                <Table2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant={viewMode === "board" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" title="Board view" onClick={() => setViewMode("board")}>
                                <LayoutGrid className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* ═══════════════ ALL TASKS TAB ═══════════════ */}
                <TabsContent value="all" className="mt-0 space-y-4">
                    {/* Search & Filters */}
                    <div className="flex flex-col sm:flex-row gap-2 mt-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search your tasks..."
                                className="pl-9"
                            />
                        </div>
                        <div className={`grid gap-2 sm:flex sm:flex-wrap ${viewMode === "board" ? "grid-cols-1" : "grid-cols-2"}`}>
                            {viewMode === "table" && (
                                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TaskStatus | "all")}>
                                    <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs">
                                        <Filter className="h-3 w-3 mr-1" />
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof STATUS_CONFIG["open"]][]).map(
                                            ([key, cfg]) => (
                                                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            )}
                            <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as TaskPriority | "all")}>
                                <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs">
                                    <SelectValue placeholder="Priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Priority</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* TABLE VIEW */}
                    {viewMode === "table" && (
                        <Card className="border border-border/50 overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[200px]">Task</TableHead>
                                        <TableHead className="hidden lg:table-cell w-[200px]">Description</TableHead>
                                        <TableHead className="w-[100px]">Status</TableHead>
                                        <TableHead className="w-[90px]">Priority</TableHead>
                                        <TableHead className="hidden md:table-cell w-[120px]">Assignees</TableHead>
                                        <TableHead className="hidden sm:table-cell w-[100px]">Start</TableHead>
                                        <TableHead className="w-[100px]">Due</TableHead>
                                        <TableHead className="w-[50px]">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTasks.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                                                No tasks match your filters.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedTasks.map((task) => {
                                            const sc = STATUS_CONFIG[task.status];
                                            const pc = PRIORITY_CONFIG[task.priority];
                                            const overdue = isOverdue(task);
                                            return (
                                                <TableRow key={task.id}>
                                                    <TableCell className="font-medium text-sm">{task.title}</TableCell>
                                                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                                                        {task.description || "—"}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className={`text-[10px] ${pc.color}`}>{pc.label}</Badge>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">
                                                        <TooltipProvider delayDuration={200}>
                                                            <div className="flex -space-x-1.5">
                                                                {task.assignedTo.slice(0, 4).map((empId) => {
                                                                    const emp = employees.find((e) => e.id === empId);
                                                                    return (
                                                                        <Tooltip key={empId}>
                                                                            <TooltipTrigger asChild>
                                                                                <Avatar className="h-6 w-6 border-2 border-card cursor-default">
                                                                                    <AvatarFallback className="text-[7px] bg-muted">{getInitials(emp?.name ?? empId)}</AvatarFallback>
                                                                                </Avatar>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent side="bottom" className="text-xs px-2 py-1.5">
                                                                                <p className="font-medium">{emp?.name ?? empId}</p>
                                                                                <p className="text-muted-foreground">{emp?.department ?? ""}</p>
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    );
                                                                })}
                                                                {task.assignedTo.length > 4 && (
                                                                    <Avatar className="h-6 w-6 border-2 border-card">
                                                                        <AvatarFallback className="text-[8px] bg-muted">+{task.assignedTo.length - 4}</AvatarFallback>
                                                                    </Avatar>
                                                                )}
                                                            </div>
                                                        </TooltipProvider>
                                                    </TableCell>
                                                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                                                        {task.startDate ? formatDate(task.startDate) : "—"}
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        {task.dueDate ? (
                                                            <span className={overdue ? "text-red-600 font-medium" : "text-muted-foreground"}>
                                                                {overdue && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}
                                                                {formatDate(task.dueDate)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="View" asChild>
                                                            <Link href={roleHref(`/tasks/${task.id}`)}>
                                                                <Eye className="h-4 w-4" />
                                                            </Link>
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                            <div className="px-4 py-1.5 border-t flex items-center justify-between text-xs text-muted-foreground">
                                <span>Showing {paginatedTasks.length} of {filteredTasks.length} tasks</span>
                                {filteredTasks.length > 10 && (
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1.5">
                                            <span>Rows per page</span>
                                            <Select value={String(rowsPerPage)} onValueChange={(v) => { setRowsPerPage(Number(v)); setCurrentPage(1); }}>
                                                <SelectTrigger className="h-7 w-[65px] text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="10">10</SelectItem>
                                                    <SelectItem value="20">20</SelectItem>
                                                    <SelectItem value="50">50</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <span>Page {currentPage} of {Math.ceil(filteredTasks.length / rowsPerPage)}</span>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={currentPage >= Math.ceil(filteredTasks.length / rowsPerPage)} onClick={() => setCurrentPage((p) => p + 1)}>
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* BOARD VIEW */}
                    {viewMode === "board" && (
                        <EmployeeBoardView tasks={filteredTasks} roleHref={roleHref} getEmpName={getEmpName} />
                    )}
                </TabsContent>

                {/* ═══════════════ PENDING TAB ═══════════════ */}
                <TabsContent value="pending" className="mt-3">
                    {pendingReview.length === 0 ? (
                        <EmptyState icon={Eye} message="No tasks pending review" />
                    ) : (
                        <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
                            {pendingReview.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    href={roleHref(`/tasks/${task.id}`)}
                                    groupName={getGroupName(task.groupId ?? "")}
                                    getEmpName={getEmpName}
                                    completionReport={task.completionRequired ? getCompletionReport(task.id) : undefined}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* ═══════════════ CALENDAR TAB ═══════════════ */}
                <TabsContent value="calendar" className="mt-3">
                    <EmployeeCalendarView tasks={myTasks} roleHref={roleHref} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

// ── Board View Sub-Component ──────────────────────────────────────

const BOARD_STATUSES: TaskStatus[] = ["open", "in_progress", "submitted", "rejected", "verified", "cancelled"];

const STATUS_ICONS: Record<TaskStatus, typeof ListTodo> = {
    open: ListTodo,
    in_progress: Clock,
    submitted: Send,
    verified: CheckCircle2,
    rejected: XCircle,
    cancelled: XCircle,
};

function EmployeeBoardView({
    tasks, roleHref, getEmpName,
}: {
    tasks: Task[];
    roleHref: (path: string) => string;
    getEmpName: (id: string) => string;
}) {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const toggle = (status: string) => setCollapsed((prev) => ({ ...prev, [status]: !prev[status] }));

    const renderTaskCard = (task: Task) => {
        const pc = PRIORITY_CONFIG[task.priority];
        return (
            <Link key={task.id} href={roleHref(`/tasks/${task.id}`)}>
                <Card className="border border-border/50 hover:border-border active:scale-[0.99] transition-all cursor-pointer">
                    <CardContent className="p-3 space-y-1.5">
                        <p className="text-sm font-medium leading-snug line-clamp-2">{task.title}</p>
                        <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className={`text-[10px] ${pc.color}`}>
                                {pc.label}
                            </Badge>
                            {task.dueDate && (
                                <span className="text-[10px] text-muted-foreground ml-auto">
                                    Due {formatDate(task.dueDate)}
                                </span>
                            )}
                        </div>
                        <div className="flex -space-x-1.5">
                            {task.assignedTo.slice(0, 3).map((empId) => (
                                <Avatar key={empId} className="h-5 w-5 border-2 border-card">
                                    <AvatarFallback className="text-[7px] bg-muted">{getInitials(getEmpName(empId))}</AvatarFallback>
                                </Avatar>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </Link>
        );
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BOARD_STATUSES.map((status) => {
                const cfg = STATUS_CONFIG[status];
                const Icon = STATUS_ICONS[status];
                const columnTasks = tasks.filter((t) => t.status === status);
                const isCol = collapsed[status];
                const behindCount = Math.min(columnTasks.length - 1, 2);
                return (
                    <div key={status} className="min-w-0">
                        {/* Folder header */}
                        <button
                            onClick={() => toggle(status)}
                            className="flex items-center gap-2 px-2 py-1.5 w-full text-left rounded-t-lg border border-border/50 bg-muted/40 hover:bg-muted/60 transition-colors"
                        >
                            <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${isCol ? "-rotate-90" : ""}`} />
                            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                                {cfg.label}
                            </span>
                            <Badge variant="secondary" className="text-[10px] h-4 min-w-4 px-1 ml-auto shrink-0">
                                {columnTasks.length}
                            </Badge>
                        </button>

                        {/* Collapsed: stacked cards showing depth */}
                        {isCol && (
                            <div className="border-x border-b border-border/30 rounded-b-lg p-2 pr-4 bg-muted/10">
                                {columnTasks.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border/50 p-4 text-center">
                                        <p className="text-xs text-muted-foreground">No tasks</p>
                                    </div>
                                ) : (
                                    <div
                                        className="relative cursor-pointer"
                                        onClick={() => toggle(status)}
                                        style={{ marginBottom: `${behindCount * 8}px` }}
                                    >
                                        {/* Stacked cards behind — offset down-right for depth */}
                                        {behindCount >= 2 && (
                                            <div
                                                className="absolute rounded-lg border border-border/30 bg-card shadow-sm dark:border-border/20 dark:bg-card/80"
                                                style={{
                                                    top: "16px",
                                                    left: "8px",
                                                    right: "-8px",
                                                    bottom: "-16px",
                                                    zIndex: 1,
                                                }}
                                            />
                                        )}
                                        {behindCount >= 1 && (
                                            <div
                                                className="absolute rounded-lg border border-border/40 bg-card shadow-sm dark:border-border/30 dark:bg-card/90"
                                                style={{
                                                    top: "8px",
                                                    left: "4px",
                                                    right: "-4px",
                                                    bottom: "-8px",
                                                    zIndex: 2,
                                                }}
                                            />
                                        )}
                                        {/* Top card */}
                                        <div className="relative" style={{ zIndex: 3 }}>
                                            {renderTaskCard(columnTasks[0])}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Expanded: full card list with spacing */}
                        {!isCol && (
                            <div className="flex flex-col gap-2 border-x border-b border-border/30 rounded-b-lg p-2 bg-muted/10 max-h-[calc(3*7rem+2*0.75rem+1rem)] overflow-y-auto">
                                {columnTasks.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border/50 p-4 text-center">
                                        <p className="text-xs text-muted-foreground">No tasks</p>
                                    </div>
                                ) : (
                                    columnTasks.map((task) => renderTaskCard(task))
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── Calendar View Sub-Component ──────────────────────────────────

const TASK_CALENDAR_COLORS: Record<TaskStatus, CalendarItemColor> = {
    open: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
    in_progress: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400", dot: "bg-yellow-500" },
    submitted: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-400", dot: "bg-purple-500" },
    verified: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", dot: "bg-green-500" },
    rejected: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
    cancelled: { bg: "bg-gray-100 dark:bg-gray-900/30", text: "text-gray-700 dark:text-gray-400", dot: "bg-gray-400" },
};

function EmployeeCalendarView({
    tasks, roleHref,
}: {
    tasks: Task[];
    roleHref: (path: string) => string;
}) {
    const calendarItems: CalendarItem[] = useMemo(() =>
        tasks
            .filter((t) => t.dueDate)
            .map((t) => ({
                id: t.id,
                title: t.title,
                date: t.dueDate!,
                status: t.status,
                priority: t.priority,
            })),
        [tasks],
    );

    const handleItemClick = (item: CalendarItem) => {
        window.location.href = roleHref(`/tasks/${item.id}`);
    };

    return (
        <Card className="border border-border/50 overflow-hidden">
            <FullScreenCalendar
                items={calendarItems}
                colorMap={TASK_CALENDAR_COLORS}
                onItemClick={handleItemClick}
                itemLabel="Tasks"
            />
        </Card>
    );
}
