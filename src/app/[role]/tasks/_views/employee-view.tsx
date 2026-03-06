"use client";

import { useMemo } from "react";
import { useTasksStore } from "@/store/tasks.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInitials, formatDate } from "@/lib/format";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import Link from "next/link";
import {
    ListTodo, CheckCircle2, ArrowUpRight, Eye,
    AlertTriangle, Camera,
} from "lucide-react";
import type { TaskStatus, TaskPriority } from "@/types";

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

export default function EmployeeTasksView() {
    const { getTasksForEmployee, groups, getCompletionReport } = useTasksStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);
    const roleHref = useRoleHref();

    const myTasks = useMemo(() => getTasksForEmployee(currentUser.id), [getTasksForEmployee, currentUser.id]);

    const activeTasks = myTasks.filter((t) => ["open", "in_progress", "rejected"].includes(t.status));
    const pendingReview = myTasks.filter((t) => t.status === "submitted");
    const completedTasks = myTasks.filter((t) => ["verified", "cancelled"].includes(t.status));

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;
    const getGroupName = (id: string) => groups.find((g) => g.id === id)?.name || id;

    const TaskCard = ({ task }: { task: typeof myTasks[0] }) => {
        const sc = STATUS_CONFIG[task.status];
        const pc = PRIORITY_CONFIG[task.priority];
        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !["verified", "cancelled"].includes(task.status);
        const report = task.completionRequired ? getCompletionReport(task.id) : undefined;

        return (
            <Link href={roleHref(`/tasks/${task.id}`)}>
                <Card className="border border-border/50 hover:border-border transition-colors cursor-pointer">
                    <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <p className="text-sm font-medium">{task.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{getGroupName(task.groupId)}</p>
                            </div>
                            <Badge variant="secondary" className={`text-[10px] shrink-0 ${sc.color}`}>{sc.label}</Badge>
                        </div>
                        {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className={`text-[10px] ${pc.color}`}>{pc.label}</Badge>
                            {task.completionRequired && (
                                <Badge variant="outline" className="text-[10px] gap-1"><Camera className="h-3 w-3" /> Proof Required</Badge>
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
                        {report?.rejectionReason && task.status === "rejected" && (
                            <div className="bg-red-50 dark:bg-red-900/20 rounded p-2 text-xs text-red-700 dark:text-red-400">
                                <strong>Rejection:</strong> {report.rejectionReason}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </Link>
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">My Tasks</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{myTasks.length} tasks assigned to you</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Active", value: activeTasks.length, icon: ArrowUpRight, color: "text-yellow-600" },
                    { label: "Pending Review", value: pendingReview.length, icon: Eye, color: "text-purple-600" },
                    { label: "Completed", value: completedTasks.length, icon: CheckCircle2, color: "text-green-600" },
                    { label: "Total", value: myTasks.length, icon: ListTodo, color: "text-foreground" },
                ].map((kpi) => (
                    <Card key={kpi.label} className="border border-border/50">
                        <CardContent className="p-4 flex items-center gap-3">
                            <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                            <div>
                                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                                <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Tabs defaultValue="active">
                <TabsList>
                    <TabsTrigger value="active">Active ({activeTasks.length})</TabsTrigger>
                    <TabsTrigger value="pending">Pending Review ({pendingReview.length})</TabsTrigger>
                    <TabsTrigger value="completed">Completed ({completedTasks.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-4">
                    {activeTasks.length === 0 ? (
                        <Card className="border border-border/50">
                            <CardContent className="p-8 text-center text-muted-foreground">
                                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">No active tasks. All caught up!</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                            {activeTasks.map((task) => <TaskCard key={task.id} task={task} />)}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="pending" className="mt-4">
                    {pendingReview.length === 0 ? (
                        <Card className="border border-border/50">
                            <CardContent className="p-8 text-center text-muted-foreground">
                                <Eye className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">No tasks pending review</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                            {pendingReview.map((task) => <TaskCard key={task.id} task={task} />)}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="completed" className="mt-4">
                    {completedTasks.length === 0 ? (
                        <Card className="border border-border/50">
                            <CardContent className="p-8 text-center text-muted-foreground">
                                <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">No completed tasks yet</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                            {completedTasks.map((task) => <TaskCard key={task.id} task={task} />)}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
