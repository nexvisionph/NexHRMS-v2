"use client";

import { useState, useMemo, useEffect } from "react";
import { useTasksStore } from "@/store/tasks.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { tasksDb } from "@/services/db.service";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInitials, formatDate } from "@/lib/format";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import Link from "next/link";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    ListTodo, CheckCircle2, ArrowUpRight, Eye,
    AlertTriangle, Camera, ChevronRight, Search, Filter, Loader2,
} from "lucide-react";
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
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-snug">{task.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{groupName}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <Badge variant="secondary" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>
                    {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
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
    
    // Loading state for DB fetch fallback
    const [isLoading, setIsLoading] = useState(true);
    const [fetchedTasks, setFetchedTasks] = useState<Task[]>([]);
    const [fetchAttempted, setFetchAttempted] = useState(false);

    // Resolve the HR employee record by email so tasks assigned to "EMP026"
    // are found even though the DemoUser id is "U004".
    const myEmployeeId = useMemo(
        () => employees.find((e) => e.profileId === currentUser.id || e.email?.toLowerCase() === currentUser.email?.toLowerCase() || e.name === currentUser.name)?.id ?? currentUser.id,
        [employees, currentUser.email, currentUser.name, currentUser.id],
    );

    // Fetch from DB if store tasks are empty and employees not loaded yet
    useEffect(() => {
        // If employees are loaded and tasks exist, we're ready
        if (employees.length > 0 && tasks.length > 0) {
            setIsLoading(false);
            return;
        }
        
        // If we already tried fetching, don't retry
        if (fetchAttempted) {
            return;
        }

        // Give hydration a moment to complete, then fetch if still empty
        const timer = setTimeout(async () => {
            if (tasks.length === 0) {
                try {
                    const allTasks = await tasksDb.fetchTasks();
                    setFetchedTasks(allTasks);
                    // Update the store with fetched tasks
                    if (allTasks.length > 0) {
                        useTasksStore.setState((s) => ({
                            tasks: allTasks.length > s.tasks.length ? allTasks : s.tasks,
                        }));
                    }
                } catch (err) {
                    console.error("[EmployeeTasks] Failed to fetch tasks:", err);
                }
            }
            setIsLoading(false);
            setFetchAttempted(true);
        }, 500); // Small delay to allow hydration

        return () => clearTimeout(timer);
    }, [tasks.length, employees.length, fetchAttempted]);

    // Combine store tasks with fetched tasks (prefer store)
    const allTasks = useMemo(() => {
        if (tasks.length > 0) return tasks;
        return fetchedTasks;
    }, [tasks, fetchedTasks]);

    // Filter tasks assigned to current employee and sort by createdAt descending (newest first)
    const myTasks = useMemo(
        () => allTasks
            .filter((t) => t.assignedTo.includes(myEmployeeId))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        [allTasks, myEmployeeId],
    );

    const filteredTasks = useMemo(() => {
        let result = myTasks;
        // Apply priority filter
        if (priorityFilter !== "all") {
            result = result.filter((t) => t.priority === priorityFilter);
        }
        // Apply search filter
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(
                (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
            );
        }
        return result;
    }, [myTasks, search, priorityFilter]);

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
    const getGroupName = (id: string) => groups.find((g) => g.id === id)?.name ?? id;

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
                    <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium">Completion Progress</span>
                            <span className="text-xs text-muted-foreground">{completionRate}%</span>
                        </div>
                        <Progress value={completionRate} className="h-2" />
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                            {myTasks.filter((t) => t.status === "verified").length} of {myTasks.length} tasks verified
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search your tasks..."
                        className="pl-9"
                    />
                </div>
                <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as TaskPriority | "all")}>
                    <SelectTrigger className="w-full sm:w-36">
                        <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Tabs defaultValue="active">
                <TabsList className="w-full sm:w-auto">
                    <TabsTrigger value="active" className="flex-1 sm:flex-none gap-1.5 text-xs sm:text-sm">
                        Active
                        {activeTasks.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-4 min-w-4 justify-center px-1">
                                {activeTasks.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="pending" className="flex-1 sm:flex-none gap-1.5 text-xs sm:text-sm">
                        <span className="hidden sm:inline">Pending </span>Review
                        {pendingReview.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-4 min-w-4 justify-center px-1">
                                {pendingReview.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="completed" className="flex-1 sm:flex-none gap-1.5 text-xs sm:text-sm">
                        <span className="hidden sm:inline">Completed</span>
                        <span className="sm:hidden">Done</span>
                        {completedTasks.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-4 min-w-4 justify-center px-1">
                                {completedTasks.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-3">
                    {activeTasks.length === 0 ? (
                        <EmptyState icon={CheckCircle2} message="No active tasks. All caught up!" />
                    ) : (
                        <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
                            {activeTasks.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    href={roleHref(`/tasks/${task.id}`)}
                                    groupName={getGroupName(task.groupId)}
                                    getEmpName={getEmpName}
                                    completionReport={task.completionRequired ? getCompletionReport(task.id) : undefined}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>

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
                                    groupName={getGroupName(task.groupId)}
                                    getEmpName={getEmpName}
                                    completionReport={task.completionRequired ? getCompletionReport(task.id) : undefined}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="completed" className="mt-3">
                    {completedTasks.length === 0 ? (
                        <EmptyState icon={ListTodo} message="No completed tasks yet" />
                    ) : (
                        <div className="grid gap-2 sm:gap-3 sm:grid-cols-2">
                            {completedTasks.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    href={roleHref(`/tasks/${task.id}`)}
                                    groupName={getGroupName(task.groupId)}
                                    getEmpName={getEmpName}
                                    completionReport={task.completionRequired ? getCompletionReport(task.id) : undefined}
                                />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
