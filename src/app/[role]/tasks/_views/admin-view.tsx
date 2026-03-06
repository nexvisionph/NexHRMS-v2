"use client";

import { useState, useMemo } from "react";
import { useTasksStore } from "@/store/tasks.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useProjectsStore } from "@/store/projects.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { getInitials, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import Link from "next/link";
import {
    ListTodo, Plus, Users, FolderKanban, Clock, CheckCircle2, XCircle,
    AlertTriangle, ArrowUpRight, Search, Filter, Trash2, Eye,
} from "lucide-react";
import type { TaskStatus, TaskPriority, AnnouncementPermission } from "@/types";

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    open: { label: "Open", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: Clock },
    in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: ArrowUpRight },
    submitted: { label: "Submitted", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: Eye },
    verified: { label: "Verified", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
    rejected: { label: "Rejected", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
    cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400", icon: XCircle },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string }> = {
    low: { label: "Low", color: "bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400" },
    medium: { label: "Medium", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
    high: { label: "High", color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
    urgent: { label: "Urgent", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
};

export default function AdminTasksView() {
    const {
        groups, tasks, addGroup, addTask, deleteTask, deleteGroup, changeStatus, getStats,
    } = useTasksStore();
    const employees = useEmployeesStore((s) => s.employees);
    const projects = useProjectsStore((s) => s.projects);
    const currentUser = useAuthStore((s) => s.currentUser);
    const roleHref = useRoleHref();

    const stats = getStats();

    // ── Filters ──────────────────────────────────────────────
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
    const [groupFilter, setGroupFilter] = useState<string>("all");
    const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");

    const filteredTasks = useMemo(() => {
        return tasks.filter((t) => {
            if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.description?.toLowerCase().includes(search.toLowerCase())) return false;
            if (statusFilter !== "all" && t.status !== statusFilter) return false;
            if (groupFilter !== "all" && t.groupId !== groupFilter) return false;
            if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
            return true;
        });
    }, [tasks, search, statusFilter, groupFilter, priorityFilter]);

    // ── Create Group Dialog ──────────────────────────────────
    const [groupOpen, setGroupOpen] = useState(false);
    const [gName, setGName] = useState("");
    const [gDesc, setGDesc] = useState("");
    const [gProjectId, setGProjectId] = useState("");
    const [gMembers, setGMembers] = useState<string[]>([]);
    const [gPermission, setGPermission] = useState<AnnouncementPermission>("admin_only");

    const handleCreateGroup = () => {
        if (!gName) { toast.error("Group name is required"); return; }
        addGroup({
            name: gName,
            description: gDesc || undefined,
            projectId: gProjectId && gProjectId !== "none" ? gProjectId : undefined,
            createdBy: currentUser.id,
            memberEmployeeIds: gMembers,
            announcementPermission: gPermission,
        });
        toast.success(`Group "${gName}" created`);
        setGName(""); setGDesc(""); setGProjectId(""); setGMembers([]); setGPermission("admin_only");
        setGroupOpen(false);
    };

    // ── Create Task Dialog ───────────────────────────────────
    const [taskOpen, setTaskOpen] = useState(false);
    const [tTitle, setTTitle] = useState("");
    const [tDesc, setTDesc] = useState("");
    const [tGroupId, setTGroupId] = useState("");
    const [tPriority, setTPriority] = useState<TaskPriority>("medium");
    const [tDue, setTDue] = useState("");
    const [tAssigned, setTAssigned] = useState<string[]>([]);
    const [tCompletion, setTCompletion] = useState(false);
    const [tTags, setTTags] = useState("");

    const handleCreateTask = () => {
        if (!tTitle || !tGroupId) { toast.error("Title and group are required"); return; }
        addTask({
            groupId: tGroupId,
            title: tTitle,
            description: tDesc || "",
            priority: tPriority,
            status: "open",
            dueDate: tDue || undefined,
            assignedTo: tAssigned,
            createdBy: currentUser.id,
            completionRequired: tCompletion,
            tags: tTags ? tTags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
        });
        toast.success(`Task "${tTitle}" created`);
        setTTitle(""); setTDesc(""); setTGroupId(""); setTPriority("medium");
        setTDue(""); setTAssigned([]); setTCompletion(false); setTTags("");
        setTaskOpen(false);
    };

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;
    const getGroupName = (id: string) => groups.find((g) => g.id === id)?.name || id;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Task Management</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{tasks.length} tasks across {groups.length} groups</p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-1.5"><Users className="h-4 w-4" /> New Group</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                            <DialogHeader><DialogTitle>Create Task Group</DialogTitle></DialogHeader>
                            <div className="space-y-4 pt-2">
                                <div>
                                    <label className="text-sm font-medium">Group Name *</label>
                                    <Input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="e.g. Field Operations" className="mt-1" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Description</label>
                                    <Textarea value={gDesc} onChange={(e) => setGDesc(e.target.value)} placeholder="Brief description..." className="mt-1" rows={2} />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Linked Project</label>
                                    <Select value={gProjectId} onValueChange={setGProjectId}>
                                        <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Announcement Permission</label>
                                    <Select value={gPermission} onValueChange={(v) => setGPermission(v as AnnouncementPermission)}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="admin_only">Admin Only</SelectItem>
                                            <SelectItem value="group_leads">Group Leads</SelectItem>
                                            <SelectItem value="all_members">All Members</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Members</label>
                                    <ScrollArea className="h-40 rounded border mt-1 p-2">
                                        {employees.filter((e) => e.status === "active").map((emp) => (
                                            <div key={emp.id} className="flex items-center gap-2 py-1">
                                                <Checkbox
                                                    checked={gMembers.includes(emp.id)}
                                                    onCheckedChange={(checked) =>
                                                        setGMembers((prev) => checked ? [...prev, emp.id] : prev.filter((id) => id !== emp.id))
                                                    }
                                                />
                                                <span className="text-sm">{emp.name}</span>
                                                <span className="text-xs text-muted-foreground">({emp.department})</span>
                                            </div>
                                        ))}
                                    </ScrollArea>
                                </div>
                                <Button onClick={handleCreateGroup} className="w-full">Create Group</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-1.5"><Plus className="h-4 w-4" /> New Task</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                            <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
                            <div className="space-y-4 pt-2">
                                <div>
                                    <label className="text-sm font-medium">Title *</label>
                                    <Input value={tTitle} onChange={(e) => setTTitle(e.target.value)} placeholder="e.g. Site inspection" className="mt-1" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Description</label>
                                    <Textarea value={tDesc} onChange={(e) => setTDesc(e.target.value)} placeholder="Task details..." className="mt-1" rows={3} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-medium">Group *</label>
                                        <Select value={tGroupId} onValueChange={setTGroupId}>
                                            <SelectTrigger className="mt-1"><SelectValue placeholder="Select group" /></SelectTrigger>
                                            <SelectContent>
                                                {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Priority</label>
                                        <Select value={tPriority} onValueChange={(v) => setTPriority(v as TaskPriority)}>
                                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="low">Low</SelectItem>
                                                <SelectItem value="medium">Medium</SelectItem>
                                                <SelectItem value="high">High</SelectItem>
                                                <SelectItem value="urgent">Urgent</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Due Date</label>
                                    <Input type="date" value={tDue} onChange={(e) => setTDue(e.target.value)} className="mt-1" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch checked={tCompletion} onCheckedChange={setTCompletion} />
                                    <label className="text-sm font-medium">Require photo/GPS proof</label>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Tags (comma-separated)</label>
                                    <Input value={tTags} onChange={(e) => setTTags(e.target.value)} placeholder="inspection, safety" className="mt-1" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Assign To</label>
                                    <ScrollArea className="h-40 rounded border mt-1 p-2">
                                        {employees.filter((e) => e.status === "active").map((emp) => (
                                            <div key={emp.id} className="flex items-center gap-2 py-1">
                                                <Checkbox
                                                    checked={tAssigned.includes(emp.id)}
                                                    onCheckedChange={(checked) =>
                                                        setTAssigned((prev) => checked ? [...prev, emp.id] : prev.filter((id) => id !== emp.id))
                                                    }
                                                />
                                                <span className="text-sm">{emp.name}</span>
                                            </div>
                                        ))}
                                    </ScrollArea>
                                </div>
                                <Button onClick={handleCreateTask} className="w-full">Create Task</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { label: "Total", value: stats.total, color: "text-foreground" },
                    { label: "Open", value: stats.open, color: "text-blue-600" },
                    { label: "In Progress", value: stats.inProgress, color: "text-yellow-600" },
                    { label: "Submitted", value: stats.submitted, color: "text-purple-600" },
                    { label: "Verified", value: stats.verified, color: "text-green-600" },
                    { label: "Overdue", value: stats.overdue, color: "text-red-600" },
                ].map((kpi) => (
                    <Card key={kpi.label} className="border border-border/50">
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">{kpi.label}</p>
                            <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Tabs defaultValue="tasks">
                <TabsList>
                    <TabsTrigger value="tasks">All Tasks</TabsTrigger>
                    <TabsTrigger value="board">Board View</TabsTrigger>
                    <TabsTrigger value="groups">Groups ({groups.length})</TabsTrigger>
                </TabsList>

                {/* ── All Tasks Tab ──────────────────────────── */}
                <TabsContent value="tasks" className="space-y-4 mt-4">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                        </div>
                        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TaskStatus | "all")}>
                            <SelectTrigger className="w-[140px]"><Filter className="h-3.5 w-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Status</SelectItem>
                                {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof STATUS_CONFIG[TaskStatus]][]).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={groupFilter} onValueChange={setGroupFilter}>
                            <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Groups" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Groups</SelectItem>
                                {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as TaskPriority | "all")}>
                            <SelectTrigger className="w-[130px]"><SelectValue placeholder="All Priority" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Priority</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Task</TableHead>
                                            <TableHead className="text-xs">Group</TableHead>
                                            <TableHead className="text-xs">Priority</TableHead>
                                            <TableHead className="text-xs">Status</TableHead>
                                            <TableHead className="text-xs">Due</TableHead>
                                            <TableHead className="text-xs">Assigned</TableHead>
                                            <TableHead className="text-xs w-24">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredTasks.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                                                    <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                                    No tasks found
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredTasks.map((task) => {
                                            const sc = STATUS_CONFIG[task.status];
                                            const pc = PRIORITY_CONFIG[task.priority];
                                            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !["verified", "cancelled"].includes(task.status);
                                            return (
                                                <TableRow key={task.id}>
                                                    <TableCell>
                                                        <Link href={roleHref(`/tasks/${task.id}`)} className="hover:underline">
                                                            <p className="text-sm font-medium">{task.title}</p>
                                                            <p className="text-xs text-muted-foreground font-mono">{task.id}</p>
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell className="text-xs">{getGroupName(task.groupId)}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className={`text-[10px] ${pc.color}`}>{pc.label}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {task.dueDate ? (
                                                            <span className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                                                                {isOverdue && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}
                                                                {formatDate(task.dueDate)}
                                                            </span>
                                                        ) : <span className="text-xs text-muted-foreground">—</span>}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex -space-x-1.5">
                                                            {task.assignedTo.slice(0, 3).map((empId) => (
                                                                <Avatar key={empId} className="h-6 w-6 border-2 border-card">
                                                                    <AvatarFallback className="text-[8px] bg-muted">{getInitials(getEmpName(empId))}</AvatarFallback>
                                                                </Avatar>
                                                            ))}
                                                            {task.assignedTo.length > 3 && (
                                                                <span className="text-xs text-muted-foreground pl-1">+{task.assignedTo.length - 3}</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                                                <Link href={roleHref(`/tasks/${task.id}`)}><Eye className="h-3.5 w-3.5" /></Link>
                                                            </Button>
                                                            {task.status === "submitted" && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                                                                    title="Verify task"
                                                                    onClick={() => { changeStatus(task.id, "verified"); toast.success("Task verified"); }}
                                                                >
                                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-500/10"
                                                                onClick={() => { deleteTask(task.id); toast.success("Task deleted"); }}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Board View Tab ─────────────────────────── */}
                <TabsContent value="board" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {(["open", "in_progress", "submitted", "verified", "rejected"] as TaskStatus[]).map((status) => {
                            const sc = STATUS_CONFIG[status];
                            const StatusIcon = sc.icon;
                            const colTasks = tasks.filter((t) => t.status === status);
                            return (
                                <div key={status} className="space-y-2">
                                    <div className="flex items-center gap-2 mb-3">
                                        <StatusIcon className="h-4 w-4" />
                                        <h3 className="text-sm font-semibold">{sc.label}</h3>
                                        <Badge variant="secondary" className="text-[10px]">{colTasks.length}</Badge>
                                    </div>
                                    {colTasks.length === 0 && (
                                        <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No tasks</div>
                                    )}
                                    {colTasks.map((task) => {
                                        const pc = PRIORITY_CONFIG[task.priority];
                                        return (
                                            <Link key={task.id} href={roleHref(`/tasks/${task.id}`)}>
                                                <Card className="border border-border/50 hover:border-border transition-colors cursor-pointer">
                                                    <CardContent className="p-3 space-y-2">
                                                        <p className="text-sm font-medium leading-snug">{task.title}</p>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <Badge variant="secondary" className={`text-[10px] ${pc.color}`}>{pc.label}</Badge>
                                                            {task.completionRequired && (
                                                                <Badge variant="outline" className="text-[10px]">📸 Proof</Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex -space-x-1.5">
                                                                {task.assignedTo.slice(0, 2).map((empId) => (
                                                                    <Avatar key={empId} className="h-5 w-5 border-2 border-card">
                                                                        <AvatarFallback className="text-[7px] bg-muted">{getInitials(getEmpName(empId))}</AvatarFallback>
                                                                    </Avatar>
                                                                ))}
                                                            </div>
                                                            {task.dueDate && (
                                                                <span className="text-[10px] text-muted-foreground">{formatDate(task.dueDate)}</span>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            </Link>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </TabsContent>

                {/* ── Groups Tab ──────────────────────────────── */}
                <TabsContent value="groups" className="space-y-4 mt-4">
                    {groups.length === 0 ? (
                        <Card className="border border-border/50">
                            <CardContent className="p-8 text-center text-muted-foreground">
                                <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">No task groups yet. Create one to get started.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {groups.map((group) => {
                                const gTasks = tasks.filter((t) => t.groupId === group.id);
                                const project = projects.find((p) => p.id === group.projectId);
                                return (
                                    <Card key={group.id} className="border border-border/50">
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <CardTitle className="text-base">{group.name}</CardTitle>
                                                    {group.description && <p className="text-xs text-muted-foreground mt-1">{group.description}</p>}
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-500/10" onClick={() => { deleteGroup(group.id); toast.success("Group deleted"); }}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {project && (
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                    <FolderKanban className="h-3.5 w-3.5" /> {project.name}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-4 text-xs">
                                                <span><strong>{group.memberEmployeeIds.length}</strong> members</span>
                                                <span><strong>{gTasks.length}</strong> tasks</span>
                                                <span className="text-green-600"><strong>{gTasks.filter((t) => t.status === "verified").length}</strong> verified</span>
                                            </div>
                                            <div className="flex -space-x-2">
                                                {group.memberEmployeeIds.slice(0, 5).map((empId) => (
                                                    <Avatar key={empId} className="h-6 w-6 border-2 border-card">
                                                        <AvatarFallback className="text-[8px] bg-muted">{getInitials(getEmpName(empId))}</AvatarFallback>
                                                    </Avatar>
                                                ))}
                                                {group.memberEmployeeIds.length > 5 && (
                                                    <span className="text-xs text-muted-foreground ml-2">+{group.memberEmployeeIds.length - 5}</span>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
