"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTasksStore } from "@/store/tasks.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useProjectsStore } from "@/store/projects.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials, formatDate } from "@/lib/format";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import Link from "next/link";
import { toast } from "sonner";
import {
    ListTodo, CheckCircle2, Clock, Eye, AlertTriangle, Plus, Search, MoreHorizontal,
    Pencil, Trash2, Users, FolderOpen, ArrowUpDown, XCircle, ChevronRight, ChevronLeft, ChevronDown,
    Layers, LayoutGrid, Table2, FolderPlus, Send, Tag, Briefcase,
    ClipboardCheck, Filter, CalendarDays,
} from "lucide-react";
import { FullScreenCalendar, type CalendarItem, type CalendarItemColor } from "@/components/ui/fullscreen-calendar";
import type { Task, TaskStatus, TaskPriority, TaskGroup, TaskTag } from "@/types";

// ── Status & Priority Config ──────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: typeof ListTodo }> = {
    open: { label: "Open", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: ListTodo },
    in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
    submitted: { label: "Submitted", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: Send },
    verified: { label: "Verified", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
    rejected: { label: "Rejected", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
    cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400", icon: XCircle },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; dot: string }> = {
    low: { label: "Low", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400", dot: "bg-slate-400" },
    medium: { label: "Medium", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400", dot: "bg-blue-500" },
    high: { label: "High", color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400", dot: "bg-orange-500" },
    urgent: { label: "Urgent", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400", dot: "bg-red-500" },
};



// ── Default form state ────────────────────────────────────────

const defaultTaskForm = {
    title: "",
    description: "",
    priority: "medium" as TaskPriority,
    groupId: "",
    projectId: "",
    startDate: "",
    dueDate: "",
    assignedTo: [] as string[],
    completionRequired: false,
    tags: [] as string[],
};

const generateTaskCode = () =>
    `TSK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const defaultGroupForm = {
    name: "",
    description: "",
    projectId: "",
    memberEmployeeIds: [] as string[],
};

// ── Main Component ────────────────────────────────────────────

export default function AdminTasksView() {
    const {
        tasks, groups, completionReports,
        addTask, updateTask, deleteTask,
        addGroup, updateGroup, deleteGroup,
        verifyCompletion, rejectCompletion,
        getStats,
        taskTags, addTag, updateTag, deleteTag,
    } = useTasksStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);
    const projects = useProjectsStore((s) => s.projects);
    const roleHref = useRoleHref();

    // ── Filters ───────────────────────────────────────────────
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [priorityFilter, setPriorityFilter] = useState<string>("all");
    const [groupFilter, setGroupFilter] = useState<string>("all");
    const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

    // ── Task CRUD dialogs ─────────────────────────────────────
    const [createOpen, setCreateOpen] = useState(false);
    const [editTask, setEditTask] = useState<Task | null>(null);
    const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
    const [taskForm, setTaskForm] = useState(defaultTaskForm);

    // ── Group CRUD dialogs ────────────────────────────────────
    const [groupCreateOpen, setGroupCreateOpen] = useState(false);
    const [editGroup, setEditGroup] = useState<TaskGroup | null>(null);
    const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
    const [groupForm, setGroupForm] = useState(defaultGroupForm);

    // ── Tag CRUD dialogs ──────────────────────────────────────
    const [tagCreateOpen, setTagCreateOpen] = useState(false);
    const [editTag, setEditTag] = useState<TaskTag | null>(null);
    const [deleteTagId, setDeleteTagId] = useState<string | null>(null);
    const [tagForm, setTagForm] = useState({ name: "", color: "#6366f1" });

    // ── Tag input ──────────────────────────────────────────────
    const [tagInput, setTagInput] = useState("");
    const [showTagSugs, setShowTagSugs] = useState(false);
    const tagSugRef = useRef<HTMLDivElement>(null);

    // ── Employee search/filter (inside assign panel) ────────────────────
    const [empSearch, setEmpSearch] = useState("");
    const [empDeptFilter, setEmpDeptFilter] = useState("all");

    // ── Member search/filter (inside group form) ──────────────────────
    const [grpSearch, setGrpSearch] = useState("");
    const [grpDeptFilter, setGrpDeptFilter] = useState("all");

    // ── Verification dialog ───────────────────────────────────
    const [rejectOpen, setRejectOpen] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    // ── Group search ──────────────────────────────────────────
    const [groupSearch, setGroupSearch] = useState("");

    // ── Task view mode (table / board) ───────────────────────
    const [taskViewMode, setTaskViewMode] = useState<"table" | "board">("table");
    const [activeTab, setActiveTab] = useState("tasks");

    // ── Sorting ───────────────────────────────────────────────
    const [sortField, setSortField] = useState<"title" | "priority" | "dueDate" | "status" | "createdAt">("createdAt");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    // ── Pagination ────────────────────────────────────────────
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // ── Helpers ───────────────────────────────────────────────
    const getEmpName = useCallback(
        (id: string) => employees.find((e) => e.id === id)?.name ?? id,
        [employees],
    );
    const getGroupName = useCallback(
        (id?: string) => id ? (groups.find((g) => g.id === id)?.name ?? "Ungrouped") : "—",
        [groups],
    );
    const myEmployeeId = useMemo(
        () =>
            employees.find(
                (e) =>
                    e.profileId === currentUser.id ||
                    e.email?.toLowerCase() === currentUser.email?.toLowerCase() ||
                    e.name === currentUser.name,
            )?.id ?? currentUser.id,
        [employees, currentUser],
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const stats = useMemo(() => getStats(), [getStats, tasks.length]);

    // ── Tag helpers (array-based) ──────────────────────────────
    const allTags = useMemo(() => {
        const tagSet = new Set<string>(taskTags.map((t) => t.name));
        tasks.forEach((t) => t.tags?.forEach((tag) => tagSet.add(tag)));
        return Array.from(tagSet).sort();
    }, [tasks, taskTags]);

    const tagSuggestions = useMemo(() => {
        const q = tagInput.trim().toLowerCase();
        return allTags
            .filter((t) => !taskForm.tags.includes(t) && (!q || t.toLowerCase().includes(q)))
            .slice(0, 8);
    }, [allTags, tagInput, taskForm.tags]);

    const addTagToForm = useCallback(
        (tag: string) => {
            const trimmed = tag.trim();
            if (trimmed && !taskForm.tags.includes(trimmed)) {
                setTaskForm((p) => ({ ...p, tags: [...p.tags, trimmed] }));
            }
            setTagInput("");
        },
        [taskForm.tags],
    );

    const removeTagFromForm = useCallback(
        (tag: string) => {
            setTaskForm((p) => ({ ...p, tags: p.tags.filter((t) => t !== tag) }));
        },
        [],
    );

    // Scroll tag suggestion dropdown into view when it appears
    useEffect(() => {
        if (showTagSugs && tagSugRef.current) {
            tagSugRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    }, [showTagSugs]);

    // ── Needs Review tasks (submitted, awaiting verification) ─
    const needsReviewTasks = useMemo(() => {
        return tasks.filter((t) => {
            if (t.status !== "submitted") return false;
            const report = completionReports.find((r) => r.taskId === t.id);
            return report && !report.verifiedBy && !report.rejectionReason;
        });
    }, [tasks, completionReports]);

    const isOverdue = (t: Task) =>
        t.dueDate && new Date(t.dueDate) < new Date() && !["verified", "cancelled"].includes(t.status);

    // ── Filtered tasks (for table/board) ──────────────────────
    const filteredTasks = useMemo(() => {
        let list = [...tasks];
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(
                (t) =>
                    t.title.toLowerCase().includes(q) ||
                    t.description.toLowerCase().includes(q) ||
                    t.id.toLowerCase().includes(q),
            );
        }
        if (statusFilter === "overdue") list = list.filter((t) => isOverdue(t));
        else if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter);
        if (priorityFilter !== "all") list = list.filter((t) => t.priority === priorityFilter);
        if (groupFilter !== "all") list = list.filter((t) => t.groupId === groupFilter);
        if (assigneeFilter !== "all") list = list.filter((t) => t.assignedTo.includes(assigneeFilter));

        const priorityOrder: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        const statusOrder: Record<TaskStatus, number> = { open: 0, in_progress: 1, submitted: 2, rejected: 3, verified: 4, cancelled: 5 };

        list.sort((a, b) => {
            let cmp = 0;
            if (sortField === "title") cmp = a.title.localeCompare(b.title);
            else if (sortField === "priority") cmp = priorityOrder[a.priority] - priorityOrder[b.priority];
            else if (sortField === "status") cmp = statusOrder[a.status] - statusOrder[b.status];
            else if (sortField === "dueDate") {
                const da = a.dueDate ?? "9999-12-31";
                const db = b.dueDate ?? "9999-12-31";
                cmp = da.localeCompare(db);
            } else if (sortField === "createdAt") {
                cmp = a.createdAt.localeCompare(b.createdAt);
            }
            return sortDir === "asc" ? cmp : -cmp;
        });
        return list;
    }, [tasks, search, statusFilter, priorityFilter, groupFilter, assigneeFilter, sortField, sortDir]);

    // ── Task form handlers ────────────────────────────────────
    const resetTaskForm = () => setTaskForm(defaultTaskForm);

    const openCreateDialog = () => {
        setTaskForm({ ...defaultTaskForm });
        setCreateOpen(true);
    };

    const openEditDialog = (task: Task) => {
        setTaskForm({
            ...defaultTaskForm,
            title: task.title ?? "",
            description: task.description ?? "",
            priority: task.priority ?? "medium",
            groupId: task.groupId ?? "",
            projectId: task.projectId ?? "",
            startDate: task.startDate ?? "",
            dueDate: task.dueDate ?? "",
            assignedTo: task.assignedTo ? [...task.assignedTo] : [],
            completionRequired: task.completionRequired ?? false,
            tags: task.tags ? [...task.tags] : [],
        });
        setTagInput("");
        setEditTask(task);
    };

    const handleSaveTask = () => {
        if (!taskForm.title.trim()) { toast.error("Title is required"); return; }
        if (!taskForm.startDate) { toast.error("Start date is required"); return; }
        if (!taskForm.dueDate) { toast.error("Due date is required"); return; }
        const today = new Date().toISOString().split("T")[0];
        if (taskForm.startDate < today) { toast.error("Start date cannot be in the past"); return; }
        if (taskForm.dueDate < taskForm.startDate) { toast.error("Due date cannot be before start date"); return; }
        if (!taskForm.groupId && taskForm.assignedTo.length === 0) { toast.error("At least one employee must be assigned"); return; }

        try {
            if (editTask) {
                updateTask(editTask.id, {
                    title: taskForm.title.trim(),
                    description: taskForm.description.trim(),
                    priority: taskForm.priority,
                    groupId: taskForm.groupId || undefined,
                    projectId: taskForm.projectId || undefined,
                    startDate: taskForm.startDate || undefined,
                    dueDate: taskForm.dueDate || undefined,
                    assignedTo: taskForm.assignedTo,
                    completionRequired: taskForm.completionRequired,
                    tags: taskForm.tags.length > 0 ? taskForm.tags : undefined,
                });
                toast.success("Task updated");
                setEditTask(null);
            } else {
                const code = generateTaskCode();
                addTask({
                    id: code,
                    title: taskForm.title.trim(),
                    description: taskForm.description.trim(),
                    priority: taskForm.priority,
                    groupId: taskForm.groupId || undefined,
                    projectId: taskForm.projectId || undefined,
                    status: "open",
                    startDate: taskForm.startDate || undefined,
                    dueDate: taskForm.dueDate || undefined,
                    assignedTo: taskForm.assignedTo,
                    createdBy: myEmployeeId,
                    completionRequired: taskForm.completionRequired,
                    tags: taskForm.tags.length > 0 ? taskForm.tags : undefined,
                });
                toast.success("Task created");
                setCreateOpen(false);
            }
            resetTaskForm();
            setTagInput("");
        } catch (err) {
            toast.error(`Failed to save task: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
    };

    const handleDeleteTask = () => {
        if (deleteTaskId) {
            try {
                deleteTask(deleteTaskId);
                toast.success("Task deleted");
            } catch (err) {
                toast.error(`Failed to delete task: ${err instanceof Error ? err.message : "Unknown error"}`);
            }
            setDeleteTaskId(null);
        }
    };

    // ── Group form handlers ───────────────────────────────────
    const resetGroupForm = () => setGroupForm(defaultGroupForm);

    const openGroupCreate = () => {
        resetGroupForm();
        setGroupCreateOpen(true);
    };

    const openGroupEdit = (group: TaskGroup) => {
        setGroupForm({
            name: group.name,
            description: group.description ?? "",
            projectId: group.projectId ?? "",
            memberEmployeeIds: [...group.memberEmployeeIds],
        });
        setEditGroup(group);
    };

    const handleSaveGroup = () => {
        if (!groupForm.name.trim()) { toast.error("Group name is required"); return; }
        const nameNorm = groupForm.name.trim().toLowerCase();

        try {
            if (editGroup) {
                const conflict = groups.find((g) => g.id !== editGroup.id && g.name.toLowerCase() === nameNorm);
                if (conflict) { toast.error(`A group named "${groupForm.name.trim()}" already exists`); return; }
                updateGroup(editGroup.id, {
                    name: groupForm.name.trim(),
                    description: groupForm.description.trim() || undefined,
                    projectId: groupForm.projectId || undefined,
                    memberEmployeeIds: groupForm.memberEmployeeIds,
                });
                toast.success("Group updated");
                setEditGroup(null);
            } else {
                const conflict = groups.find((g) => g.name.toLowerCase() === nameNorm);
                if (conflict) { toast.error(`A group named "${groupForm.name.trim()}" already exists`); return; }
                addGroup({
                    name: groupForm.name.trim(),
                    description: groupForm.description.trim() || undefined,
                    projectId: groupForm.projectId || undefined,
                    createdBy: myEmployeeId,
                    memberEmployeeIds: groupForm.memberEmployeeIds,
                    announcementPermission: "admin_only",
                });
                toast.success("Group created");
                setGroupCreateOpen(false);
            }
            resetGroupForm();
        } catch (err) {
            toast.error(`Failed to save group: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
    };

    const handleDeleteGroup = () => {
        if (deleteGroupId) {
            try {
                deleteGroup(deleteGroupId);
                toast.success("Group and its tasks deleted");
            } catch (err) {
                toast.error(`Failed to delete group: ${err instanceof Error ? err.message : "Unknown error"}`);
            }
            setDeleteGroupId(null);
        }
    };

    // ── Tag form handlers ──────────────────────────────────────
    const openTagCreate = () => {
        setTagForm({ name: "", color: "#6366f1" });
        setTagCreateOpen(true);
    };

    const openTagEdit = (tag: TaskTag) => {
        setTagForm({ name: tag.name, color: tag.color });
        setEditTag(tag);
    };

    const handleSaveTag = () => {
        if (!tagForm.name.trim()) { toast.error("Tag name is required"); return; }
        const nameNorm = tagForm.name.trim().toLowerCase();
        try {
            if (editTag) {
                const conflict = taskTags.find((t) => t.id !== editTag.id && t.name.toLowerCase() === nameNorm);
                if (conflict) { toast.error(`Tag "${tagForm.name.trim()}" already exists`); return; }
                updateTag(editTag.id, { name: tagForm.name.trim(), color: tagForm.color });
                toast.success("Tag updated");
                setEditTag(null);
            } else {
                const conflict = taskTags.find((t) => t.name.toLowerCase() === nameNorm);
                if (conflict) { toast.error(`Tag "${tagForm.name.trim()}" already exists`); return; }
                addTag({ name: tagForm.name.trim(), color: tagForm.color, createdBy: myEmployeeId });
                toast.success("Tag created");
                setTagCreateOpen(false);
            }
            setTagForm({ name: "", color: "#6366f1" });
        } catch (err) {
            toast.error(`Failed to save tag: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
    };

    const handleDeleteTag = () => {
        if (deleteTagId) {
            try {
                deleteTag(deleteTagId);
                toast.success("Tag deleted");
            } catch (err) {
                toast.error(`Failed to delete tag: ${err instanceof Error ? err.message : "Unknown error"}`);
            }
            setDeleteTagId(null);
        }
    };

    // ── Verification handlers ─────────────────────────────────
    const handleVerify = (taskId: string) => {
        const report = completionReports.find((r) => r.taskId === taskId);
        if (report) {
            verifyCompletion(report.id, myEmployeeId);
            toast.success("Task verified");
        }
    };

    const handleReject = () => {
        if (!rejectOpen || !rejectReason.trim()) { toast.error("Reason is required"); return; }
        try {
            const report = completionReports.find((r) => r.taskId === rejectOpen);
            if (report) {
                rejectCompletion(report.id, rejectReason.trim());
                toast.success("Task rejected");
            }
        } catch (err) {
            toast.error(`Failed to reject task: ${err instanceof Error ? err.message : "Unknown error"}`);
        }
        setRejectOpen(null);
        setRejectReason("");
    };

    // ── Toggle employee in assignedTo ─────────────────────────
    const toggleAssignee = (empId: string) => {
        setTaskForm((prev) => ({
            ...prev,
            assignedTo: prev.assignedTo.includes(empId)
                ? prev.assignedTo.filter((id) => id !== empId)
                : [...prev.assignedTo, empId],
        }));
    };

    const toggleGroupMember = (empId: string) => {
        setGroupForm((prev) => ({
            ...prev,
            memberEmployeeIds: prev.memberEmployeeIds.includes(empId)
                ? prev.memberEmployeeIds.filter((id) => id !== empId)
                : [...prev.memberEmployeeIds, empId],
        }));
    };

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setSortField(field); setSortDir("asc"); }
    };

    const EXCLUDED_ROLES = ["admin", "hr", "finance", "auditor", "payroll_admin", "supervisor"];
    const activeEmployees = useMemo(
        () => employees.filter((e) => e.status === "active" && !EXCLUDED_ROLES.includes(e.role?.toLowerCase() ?? "")),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [employees],
    );

    // Filter employees by selected group (takes priority) or project
    const assignableEmployees = useMemo(() => {
        if (taskForm.groupId) {
            const grp = groups.find((g) => g.id === taskForm.groupId);
            // Use ALL employees (not just active) so every group member appears checked
            if (grp) return employees.filter((e) => grp.memberEmployeeIds.includes(e.id));
        }
        if (!taskForm.projectId) return activeEmployees;
        const project = projects.find((p) => p.id === taskForm.projectId);
        if (!project || !project.assignedEmployeeIds?.length) return activeEmployees;
        return activeEmployees.filter((e) => project.assignedEmployeeIds.includes(e.id));
    }, [employees, activeEmployees, groups, projects, taskForm.groupId, taskForm.projectId]);

    // Unique departments from the current assignable list (for filter dropdown)
    const assignableDepts = useMemo(() =>
        [...new Set(assignableEmployees.map((e) => e.department).filter(Boolean))].sort() as string[],
        [assignableEmployees],
    );

    // Employee list filtered by search + department, checked-first ordering
    const visibleEmployees = useMemo(() => {
        let list = assignableEmployees;
        if (empSearch.trim()) {
            const q = empSearch.toLowerCase();
            list = list.filter((e) => e.name.toLowerCase().includes(q));
        }
        if (empDeptFilter !== "all") {
            list = list.filter((e) => e.department === empDeptFilter);
        }
        return [...list].sort((a, b) => {
            const aChecked = taskForm.assignedTo.includes(a.id) ? 0 : 1;
            const bChecked = taskForm.assignedTo.includes(b.id) ? 0 : 1;
            return aChecked - bChecked || a.name.localeCompare(b.name);
        });
    }, [assignableEmployees, empSearch, empDeptFilter, taskForm.assignedTo]);

    // Unique assigned employees for the assignee filter dropdown
    const assignedEmployeeIds = useMemo(() => {
        const ids = new Set<string>();
        tasks.forEach((t) => t.assignedTo.forEach((id) => ids.add(id)));
        return Array.from(ids);
    }, [tasks]);

    const hasActiveFilters = statusFilter !== "all" || priorityFilter !== "all" || groupFilter !== "all" || assigneeFilter !== "all" || search !== "";

    const clearFilters = () => {
        setSearch("");
        setStatusFilter("all");
        setPriorityFilter("all");
        setGroupFilter("all");
        setAssigneeFilter("all");
        setCurrentPage(1);
    };

    // This week verified count
    const thisWeekVerified = useMemo(() => {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        return tasks.filter((t) => t.status === "verified" && t.updatedAt && new Date(t.updatedAt) >= startOfWeek).length;
    }, [tasks]);

    // ────────────────────────────────────────────────────────────
    // RENDER
    // ────────────────────────────────────────────────────────────
    const taskFormDialogOpen = createOpen || !!editTask;
    const taskFormOnClose = () => {
        setCreateOpen(false);
        setEditTask(null);
        resetTaskForm();
        setEmpSearch("");
        setEmpDeptFilter("all");
        setShowTagSugs(false);
        setTagInput("");
    };
    const groupFormDialogOpen = groupCreateOpen || !!editGroup;
    const groupFormOnClose = () => {
        setGroupCreateOpen(false);
        setEditGroup(null);
        resetGroupForm();
        setGrpSearch("");
        setGrpDeptFilter("all");
    };
    const tagFormDialogOpen = tagCreateOpen || !!editTag;
    const tagFormOnClose = () => { setTagCreateOpen(false); setEditTag(null); setTagForm({ name: "", color: "#6366f1" }); };

    // ── Pagination computed ────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(filteredTasks.length / rowsPerPage));
    const paginatedTasks = filteredTasks.length > 10
        ? filteredTasks.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)
        : filteredTasks;

    // Reset to page 1 when filtered list shrinks below current page
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(1);
    }, [currentPage, totalPages]);

    return (
        <div className="space-y-6 pb-8">
            {/* ── Header ───────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Task Management</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Assign, track, and verify employee tasks
                    </p>
                </div>
                <Button onClick={openCreateDialog} className="gap-2 shrink-0">
                    <Plus className="h-4 w-4" /> New Task
                </Button>
            </div>

            {/* ── Stats (4 KPIs) ──────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {([
                    { label: "Total Open", value: tasks.filter((t) => t.status === "open" || t.status === "in_progress" || isOverdue(t)).length, icon: ListTodo, color: "text-blue-600" },
                    { label: "Pending Review", value: tasks.filter((t) => t.status === "submitted").length, icon: ClipboardCheck, color: tasks.some((t) => t.status === "submitted") ? "text-purple-600" : "text-muted-foreground" },
                    { label: "Overdue", value: stats.overdue, icon: AlertTriangle, color: stats.overdue > 0 ? "text-red-600" : "text-muted-foreground" },
                    { label: "Completed this Week", value: thisWeekVerified, icon: CheckCircle2, color: "text-green-600" },
                ] as const).map((kpi) => (
                    <Card key={kpi.label} className="border border-border/50">
                        <CardContent className="p-3 sm:p-4 flex items-center gap-2.5">
                            <kpi.icon className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 ${kpi.color}`} />
                            <div className="min-w-0">
                                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{kpi.label}</p>
                                <p className={`text-lg sm:text-xl font-bold leading-none mt-0.5 ${kpi.color}`}>{kpi.value}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* ── Main Tabs ────────────────────────────────── */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                {/* Mobile: scrollable row with toggle inline */}
                <div className="overflow-x-auto pb-0.5 sm:hidden">
                    <div className="flex items-center gap-2 w-full">
                        <TabsList className="flex-1">
                            <TabsTrigger value="tasks" className="gap-1.5 text-xs">
                                <Table2 className="h-3.5 w-3.5" /> All Tasks
                                <Badge variant="secondary" className="text-[10px] h-4 min-w-4 px-1">{tasks.length}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="review" className="gap-1.5 text-xs">
                                <ClipboardCheck className="h-3.5 w-3.5" /> Needs Review
                                {needsReviewTasks.length > 0 && (
                                    <Badge variant="secondary" className="text-[10px] h-4 min-w-4 px-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                        {needsReviewTasks.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="groups" className="gap-1.5 text-xs">
                                <Layers className="h-3.5 w-3.5" /> Groups
                                <Badge variant="secondary" className="text-[10px] h-4 min-w-4 px-1">{groups.length}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="calendar" className="gap-1.5 text-xs">
                                <CalendarDays className="h-3.5 w-3.5" /> Calendar
                            </TabsTrigger>
                            <TabsTrigger value="settings" className="gap-1.5 text-xs">
                                <Tag className="h-3.5 w-3.5" /> Settings
                            </TabsTrigger>
                        </TabsList>
                        {activeTab === "tasks" && (
                            <div className="flex items-center gap-1 border rounded-md p-0.5 shrink-0">
                                <Button variant={taskViewMode === "table" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" title="Table view" onClick={() => setTaskViewMode("table")}>
                                    <Table2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant={taskViewMode === "board" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" title="Board view" onClick={() => setTaskViewMode("board")}>
                                    <LayoutGrid className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Desktop: tabs left, toggle right */}
                <div className="hidden sm:flex sm:items-center justify-between gap-3">
                    <TabsList>
                        <TabsTrigger value="tasks" className="gap-1.5 text-xs sm:text-sm">
                            <Table2 className="h-3.5 w-3.5" /> All Tasks
                            <Badge variant="secondary" className="text-[10px] h-4 min-w-4 px-1">{tasks.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="review" className="gap-1.5 text-xs sm:text-sm">
                            <ClipboardCheck className="h-3.5 w-3.5" /> Needs Review
                            {needsReviewTasks.length > 0 && (
                                <Badge variant="secondary" className="text-[10px] h-4 min-w-4 px-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                    {needsReviewTasks.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="groups" className="gap-1.5 text-xs sm:text-sm">
                            <Layers className="h-3.5 w-3.5" /> Groups
                            <Badge variant="secondary" className="text-[10px] h-4 min-w-4 px-1">{groups.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="calendar" className="gap-1.5 text-xs sm:text-sm">
                            <CalendarDays className="h-3.5 w-3.5" /> Calendar
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm">
                            <Tag className="h-3.5 w-3.5" /> Settings
                        </TabsTrigger>
                    </TabsList>
                    {activeTab === "tasks" && (
                        <div className="flex items-center gap-1 border rounded-md p-0.5">
                            <Button variant={taskViewMode === "table" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" title="Table view" onClick={() => setTaskViewMode("table")}>
                                <Table2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant={taskViewMode === "board" ? "secondary" : "ghost"} size="sm" className="h-7 w-7 p-0" title="Board view" onClick={() => setTaskViewMode("board")}>
                                <LayoutGrid className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    )}
                </div>


                {/* ═══════════════════════════════════════════════
                    NEEDS REVIEW TAB — HR's most important view
                ═══════════════════════════════════════════════ */}
                <TabsContent value="review" className="mt-4">
                    {needsReviewTasks.length === 0 ? (
                        <Card className="border border-border/50">
                            <CardContent className="p-10 text-center text-muted-foreground">
                                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                <p className="text-sm font-medium">All caught up!</p>
                                <p className="text-xs mt-1">No tasks waiting for your review right now.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {needsReviewTasks.map((task) => {
                                const report = completionReports.find((r) => r.taskId === task.id);
                                const pc = PRIORITY_CONFIG[task.priority];
                                return (
                                    <Card key={task.id} className="border border-border/50">
                                        <CardContent className="p-4">
                                            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                                                {/* Task info */}
                                                <div className="flex-1 min-w-0 space-y-2">
                                                    <div className="flex items-start gap-2">
                                                        <div className="min-w-0 flex-1">
                                                            <Link
                                                                href={roleHref(`/tasks/${task.id}`)}
                                                                className="text-sm font-semibold hover:underline break-words"
                                                            >
                                                                {task.title}
                                                            </Link>
                                                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{task.id}</p>
                                                        </div>
                                                        <Badge variant="secondary" className={`text-[10px] shrink-0 ${pc.color}`}>
                                                            {pc.label}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                                        <span className="flex items-center gap-1">
                                                            <Users className="h-3 w-3" />
                                                            Submitted by {getEmpName(report?.employeeId ?? "")}
                                                        </span>
                                                        {report?.submittedAt && (
                                                            <span>{formatDate(report.submittedAt)}</span>
                                                        )}
                                                        <span className="text-muted-foreground/60">·</span>
                                                        <span>{getGroupName(task.groupId)}</span>
                                                    </div>
                                                    {report?.notes && (
                                                        <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 line-clamp-2">
                                                            &quot;{report.notes}&quot;
                                                        </p>
                                                    )}
                                                    {report?.photoDataUrl && (
                                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Eye className="h-3 w-3" /> Photo proof attached
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Action buttons — inline, most important for HR */}
                                                <div className="flex items-center gap-2 shrink-0 sm:flex-col sm:items-end">
                                                    <Button
                                                        size="sm"
                                                        className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                                                        onClick={() => handleVerify(task.id)}
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5" /> Verify
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                                        onClick={() => setRejectOpen(task.id)}
                                                    >
                                                        <XCircle className="h-3.5 w-3.5" /> Reject
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="gap-1 text-xs"
                                                        asChild
                                                    >
                                                        <Link href={roleHref(`/tasks/${task.id}`)}>
                                                            <Eye className="h-3.5 w-3.5" /> Details
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* ── Filter Bar (for All Tasks) ──────────── */}
                <TabsContent value="tasks" className="mt-0 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-2 mt-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search tasks..."
                                className="pl-9"
                            />
                        </div>
                        <div className={`grid gap-2 sm:flex sm:flex-wrap ${taskViewMode === "board" ? "grid-cols-3" : "grid-cols-2"}`}>
                            {taskViewMode !== "board" && (
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs">
                                        <Filter className="h-3 w-3 mr-1" />
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="overdue">Overdue</SelectItem>
                                        {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof STATUS_CONFIG["open"]][]).map(
                                            ([key, cfg]) => (
                                                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            )}
                            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                                <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs">
                                    <SelectValue placeholder="Priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Priority</SelectItem>
                                    {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, typeof PRIORITY_CONFIG["low"]][]).map(
                                        ([key, cfg]) => (
                                            <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                                        ),
                                    )}
                                </SelectContent>
                            </Select>
                            <Select value={groupFilter} onValueChange={setGroupFilter}>
                                <SelectTrigger className="w-full sm:w-[150px] h-9 text-xs">
                                    <SelectValue placeholder="Group" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Groups</SelectItem>
                                    {groups.map((g) => (
                                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                                <SelectTrigger className="w-full sm:w-[150px] h-9 text-xs">
                                    <Users className="h-3 w-3 mr-1" />
                                    <SelectValue placeholder="Assignee" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Employees</SelectItem>
                                    {assignedEmployeeIds.map((empId) => (
                                        <SelectItem key={empId} value={empId}>{getEmpName(empId)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {hasActiveFilters && (
                                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs gap-1 col-span-full sm:col-auto">
                                    <XCircle className="h-3 w-3" /> Clear
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* ═══════════════════════════════════════════════
                        TABLE VIEW
                    ═══════════════════════════════════════════════ */}
                    {taskViewMode === "table" && filteredTasks.length === 0 && (
                        <Card className="border border-border/50">
                            <CardContent className="p-10 text-center text-muted-foreground">
                                <ListTodo className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">
                                    {hasActiveFilters ? "No tasks match your filters" : "No tasks yet. Create your first task!"}
                                </p>
                            </CardContent>
                        </Card>
                    )}
                    {taskViewMode === "table" && filteredTasks.length > 0 && (
                        <Card className="border border-border/50 overflow-hidden">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="[&>th]:py-2">
                                            <TableHead>Task</TableHead>
                                            <TableHead className="hidden sm:table-cell">Group</TableHead>
                                            <TableHead
                                                className="cursor-pointer select-none"
                                                onClick={() => toggleSort("status")}
                                            >
                                                <span className="flex items-center gap-1">
                                                    Status <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                                </span>
                                            </TableHead>
                                            <TableHead
                                                className="cursor-pointer select-none hidden md:table-cell"
                                                onClick={() => toggleSort("priority")}
                                            >
                                                <span className="flex items-center gap-1">
                                                    Priority <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                                </span>
                                            </TableHead>
                                            <TableHead className="hidden lg:table-cell">Assignees</TableHead>
                                            <TableHead className="hidden md:table-cell">Start Date</TableHead>
                                            <TableHead
                                                className="cursor-pointer select-none hidden md:table-cell"
                                                onClick={() => toggleSort("dueDate")}
                                            >
                                                <span className="flex items-center gap-1">
                                                    Due <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                                                </span>
                                            </TableHead>
                                            <TableHead className="w-28 text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="[&_tr:last-child_td]:pb-2">
                                        {paginatedTasks.map((task) => {
                                            const sc = STATUS_CONFIG[task.status];
                                            const pc = PRIORITY_CONFIG[task.priority];
                                            const overdue = isOverdue(task);
                                            const isLocked = ["submitted", "verified", "cancelled", "rejected"].includes(task.status);

                                            return (
                                                <TableRow key={task.id} className="group">
                                                    <TableCell className="max-w-[180px] sm:max-w-[240px] xl:max-w-xs">
                                                        <span className="font-medium text-sm line-clamp-2 break-words block">
                                                            {task.title}
                                                        </span>
                                                        <p className="text-xs text-muted-foreground font-mono truncate">{task.id}</p>
                                                    </TableCell>
                                                    <TableCell className="hidden sm:table-cell max-w-[120px]">
                                                        <span className="text-xs text-muted-foreground truncate block">{getGroupName(task.groupId)}</span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className={`text-[10px] ${sc.color}`}>
                                                            {sc.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">
                                                        <span className="flex items-center gap-1.5 text-xs">
                                                            <span className={`h-2 w-2 rounded-full ${pc.dot}`} />
                                                            {pc.label}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="hidden lg:table-cell">
                                                        <div className="flex -space-x-1.5">
                                                            {task.assignedTo.slice(0, 4).map((empId) => {
                                                                const emp = employees.find((e) => e.id === empId);
                                                                return (
                                                                    <div key={empId} className="relative group/avatar">
                                                                        <Avatar className="h-6 w-6 border-2 border-card">
                                                                            <AvatarFallback className="text-[8px] bg-muted">
                                                                                {getInitials(getEmpName(empId))}
                                                                            </AvatarFallback>
                                                                        </Avatar>
                                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/avatar:block z-50">
                                                                            <div className="bg-popover border border-border rounded-md shadow-lg px-2.5 py-1.5 whitespace-nowrap text-[11px]">
                                                                                <p className="font-medium">{emp?.name ?? empId}</p>
                                                                                <p className="text-muted-foreground">{emp?.role ?? ""} · {emp?.department ?? ""}</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            {task.assignedTo.length > 4 && (
                                                                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-muted text-[8px] font-medium border-2 border-card">
                                                                    +{task.assignedTo.length - 4}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">
                                                        {task.startDate ? (
                                                            <span className="text-xs text-muted-foreground">{formatDate(task.startDate)}</span>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell">
                                                        {task.dueDate ? (
                                                            <span className={`text-xs ${overdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                                                                {overdue && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}
                                                                {formatDate(task.dueDate)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center gap-1 justify-end">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0"
                                                                title="View"
                                                                asChild
                                                            >
                                                                <Link href={roleHref(`/tasks/${task.id}`)}>
                                                                    <Eye className="h-4 w-4" />
                                                                </Link>
                                                            </Button>
                                                            {!isLocked && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 w-7 p-0"
                                                                    title="Edit"
                                                                    onClick={() => openEditDialog(task)}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                title="Delete"
                                                                onClick={() => setDeleteTaskId(task.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
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

                    {/* ═══════════════════════════════════════════════
                        BOARD VIEW (Kanban)
                    ═══════════════════════════════════════════════ */}
                    {taskViewMode === "board" && (
                        <AdminBoardView tasks={filteredTasks} roleHref={roleHref} getEmpName={getEmpName} isOverdue={isOverdue} />
                    )}
                </TabsContent>



                {/* ═══════════════════════════════════════════════
                    GROUPS VIEW
                ═══════════════════════════════════════════════ */}
                <TabsContent value="groups" className="mt-4 space-y-4">
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    value={groupSearch}
                                    onChange={(e) => setGroupSearch(e.target.value)}
                                    placeholder="Search groups..."
                                    className="pl-9"
                                />
                            </div>
                            <Button variant="outline" size="sm" onClick={openGroupCreate} className="gap-1.5">
                                <FolderPlus className="h-4 w-4" /> New Group
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                            {groups.length} group{groups.length !== 1 ? "s" : ""} configured
                        </p>

                        {groups.length === 0 ? (
                            <Card className="border border-border/50">
                                <CardContent className="p-10 text-center text-muted-foreground">
                                    <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                    <p className="text-sm">No groups yet. Create one to organize tasks.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {groups
                                    .filter((g) => !groupSearch || g.name.toLowerCase().includes(groupSearch.toLowerCase()) || g.description?.toLowerCase().includes(groupSearch.toLowerCase()))
                                    .map((group) => {
                                        const groupTasks = tasks.filter((t) => t.groupId === group.id);
                                        const openCount = groupTasks.filter((t) => t.status === "open").length;
                                        const inProgressCount = groupTasks.filter((t) => t.status === "in_progress").length;
                                        const doneCount = groupTasks.filter((t) => t.status === "verified").length;
                                        const linkedProject = projects.find((p) => p.id === group.projectId);

                                        return (
                                            <Card key={group.id} className="border border-border/50">
                                                <CardHeader className="pb-2">
                                                    <div className="flex items-start justify-between">
                                                        <div className="min-w-0 flex-1">
                                                            <CardTitle className="text-sm font-semibold truncate">
                                                                {group.name}
                                                            </CardTitle>
                                                            {group.description && (
                                                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                                                    {group.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => openGroupEdit(group)}>
                                                                    <Pencil className="h-4 w-4 mr-2" /> Edit
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:text-destructive"
                                                                    onClick={() => setDeleteGroupId(group.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="space-y-3">
                                                    {linkedProject && (
                                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <FolderOpen className="h-3 w-3" /> {linkedProject.name}
                                                        </div>
                                                    )}
                                                    <div className="flex gap-2 flex-wrap">
                                                        <Badge variant="secondary" className="text-[10px]">
                                                            {groupTasks.length} tasks
                                                        </Badge>
                                                        {openCount > 0 && (
                                                            <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                                {openCount} open
                                                            </Badge>
                                                        )}
                                                        {inProgressCount > 0 && (
                                                            <Badge variant="secondary" className="text-[10px] bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                                                {inProgressCount} active
                                                            </Badge>
                                                        )}
                                                        {doneCount > 0 && (
                                                            <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                                {doneCount} done
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <Users className="h-3 w-3 text-muted-foreground" />
                                                        <div className="flex -space-x-1">
                                                            {group.memberEmployeeIds.slice(0, 5).map((empId) => (
                                                                <Avatar key={empId} className="h-5 w-5 border border-card">
                                                                    <AvatarFallback className="text-[7px] bg-muted">
                                                                        {getInitials(getEmpName(empId))}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                            ))}
                                                        </div>
                                                        {group.memberEmployeeIds.length > 5 && (
                                                            <span className="text-[10px] text-muted-foreground ml-1">
                                                                +{group.memberEmployeeIds.length - 5}
                                                            </span>
                                                        )}
                                                        {group.memberEmployeeIds.length === 0 && (
                                                            <span className="text-[10px] text-muted-foreground">No members</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        Created {formatDate(group.createdAt)}
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* ═══════════════════════════════════════════════
                    CALENDAR TAB
                ═══════════════════════════════════════════════ */}
                <TabsContent value="calendar" className="mt-4">
                    <TaskCalendarView
                        tasks={filteredTasks}
                        getEmpName={getEmpName}
                        onStatusChange={(taskId, status) => {
                            updateTask(taskId, { status });
                            toast.success(`Task status changed to ${STATUS_CONFIG[status].label}`);
                        }}
                        roleHref={roleHref}
                    />
                </TabsContent>

                {/* ═══════════════════════════════════════════════
                    SETTINGS TAB — Tags management
                ═══════════════════════════════════════════════ */}
                <TabsContent value="settings" className="mt-4 space-y-6">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Tag className="h-4 w-4 text-muted-foreground" />
                                <p className="text-sm font-medium">
                                    Tags <span className="text-muted-foreground font-normal">({taskTags.length})</span>
                                </p>
                            </div>
                            <Button variant="outline" size="sm" onClick={openTagCreate} className="gap-1.5">
                                <Plus className="h-4 w-4" /> New Tag
                            </Button>
                        </div>

                        {taskTags.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-4">No tags yet. Create tags to categorise tasks.</p>
                        ) : (
                            <div className="flex gap-2 flex-wrap">
                                {taskTags.map((tag) => {
                                    const usageCount = tasks.filter((t) => t.tags?.includes(tag.name)).length;
                                    return (
                                        <div
                                            key={tag.id}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border/50 hover:border-border transition-colors group"
                                            style={{ backgroundColor: tag.color + "15", color: tag.color }}
                                        >
                                            <span
                                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                                style={{ backgroundColor: tag.color }}
                                            />
                                            {tag.name}
                                            <span className="text-[10px] opacity-60">({usageCount})</span>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="h-4 w-4 rounded hover:bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <MoreHorizontal className="h-3 w-3" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => openTagEdit(tag)}>
                                                        <Pencil className="h-4 w-4 mr-2" /> Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive"
                                                        onClick={() => setDeleteTagId(tag.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* ═══════════════════════════════════════════════════════
                DIALOGS
            ═══════════════════════════════════════════════════════ */}

            {/* Task Form Dialog (Create / Edit) */}
            <Dialog open={taskFormDialogOpen} onOpenChange={(v) => { if (!v) taskFormOnClose(); }}>
                <DialogContent className="max-w-2xl flex flex-col max-h-[90vh]">
                    <DialogHeader className="shrink-0">
                        <DialogTitle>{editTask ? "Edit Task" : "Create New Task"}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto space-y-4 py-2 px-1">
                        {editTask && (
                            <div className="text-xs text-muted-foreground font-mono bg-muted/50 rounded px-3 py-1.5">
                                {editTask.id}
                            </div>
                        )}
                        <div className="grid gap-1.5">
                            <label className="text-sm font-medium">Title</label>
                            <Input
                                value={taskForm.title ?? ""}
                                onChange={(e) => {
                                    if (e.target.value.length <= 50) {
                                        setTaskForm((p) => ({ ...p, title: e.target.value }));
                                    }
                                }}
                                placeholder="What needs to be done?"
                                maxLength={50}
                                autoFocus
                            />
                            <p className={`text-xs ${(50 - (taskForm.title?.length ?? 0)) <= 0 ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                                {50 - (taskForm.title?.length ?? 0)} characters remaining
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Description</label>
                            <Textarea
                                value={taskForm.description ?? ""}
                                onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))}
                                placeholder="Add a detailed description of the task"
                                rows={6}
                                className="resize-none max-h-[9rem] overflow-y-auto"
                            />
                        </div>

                        {/* Row 1: Group + Priority */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Group</label>
                                <Select
                                    value={taskForm.groupId || "none"}
                                    onValueChange={(v) => {
                                        const grp = groups.find((g) => g.id === v);
                                        setTaskForm((p) => ({
                                            ...p,
                                            groupId: v === "none" ? "" : v,
                                            assignedTo: v !== "none" && grp ? [...grp.memberEmployeeIds] : [],
                                            ...(grp?.projectId && !p.projectId
                                                ? { projectId: grp.projectId }
                                                : {}),
                                        }));
                                    }}
                                >
                                    <SelectTrigger className="w-full"><SelectValue placeholder="No group" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No Group</SelectItem>
                                        {groups.map((g) => (
                                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Priority</label>
                                <Select
                                    value={taskForm.priority}
                                    onValueChange={(v) => setTaskForm((p) => ({ ...p, priority: v as TaskPriority }))}
                                >
                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {(["low", "medium", "high", "urgent"] as TaskPriority[]).map((p) => (
                                            <SelectItem key={p} value={p}>
                                                <span className="flex items-center gap-2">
                                                    <span className={`h-2 w-2 rounded-full ${PRIORITY_CONFIG[p].dot}`} />
                                                    {PRIORITY_CONFIG[p].label}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Row 2: Start Date + Due Date */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium">Start Date</label>
                                <Input
                                    type="date"
                                    value={taskForm.startDate ?? ""}
                                    min={new Date().toISOString().split("T")[0]}
                                    onChange={(e) => setTaskForm((p) => ({ ...p, startDate: e.target.value }))}
                                />
                            </div>
                            <div className="grid gap-2">
                                <label className={`text-sm font-medium ${!taskForm.startDate ? "text-muted-foreground" : ""}`}>Due Date</label>
                                <Input
                                    type="date"
                                    value={taskForm.dueDate ?? ""}
                                    min={taskForm.startDate || new Date().toISOString().split("T")[0]}
                                    onChange={(e) => setTaskForm((p) => ({ ...p, dueDate: e.target.value }))}
                                    disabled={!taskForm.startDate}
                                    className={!taskForm.startDate ? "opacity-50 cursor-not-allowed" : ""}
                                />
                            </div>
                        </div>

                        {/* Assign Employees */}

                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">
                                    Assign Employees ({taskForm.assignedTo.length} selected)
                                </label>
                                {taskForm.groupId && (
                                    <span className="text-xs text-muted-foreground">
                                        Auto-assigned from group
                                    </span>
                                )}
                            </div>
                            {/* Search + dept filter */}
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        value={empSearch}
                                        onChange={(e) => setEmpSearch(e.target.value)}
                                        placeholder="Search employees..."
                                        className="pl-8 h-8 text-xs"
                                    />
                                </div>
                                <Select value={empDeptFilter} onValueChange={setEmpDeptFilter}>
                                    <SelectTrigger className="w-[130px] h-8 text-xs">
                                        <SelectValue placeholder="Department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Depts</SelectItem>
                                        {assignableDepts.map((d) => (
                                            <SelectItem key={d} value={d}>{d}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1">
                                {visibleEmployees.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-4">
                                        No employees match.
                                    </p>
                                ) : visibleEmployees.map((emp) => (
                                    <label
                                        key={emp.id}
                                        className={`flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 ${taskForm.groupId ? "opacity-60 cursor-default" : "cursor-pointer"}`}
                                    >
                                        <Checkbox
                                            checked={taskForm.assignedTo.includes(emp.id)}
                                            onCheckedChange={() => toggleAssignee(emp.id)}
                                            disabled={!!taskForm.groupId}
                                        />
                                        <Avatar className="h-6 w-6">
                                            <AvatarFallback className="text-[9px] bg-muted">
                                                {getInitials(emp.name)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm">{emp.name}</span>
                                        <span className="text-xs text-muted-foreground ml-auto">{emp.department}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Advanced section — collapsed by default */}
                        <details className="group">
                            <summary className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none flex items-center gap-1.5">
                                <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                                Advanced Options
                            </summary>
                            <div className="mt-3 space-y-4 pl-5 border-l-2 border-border/50">
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium">Project</label>
                                    <Select
                                        value={taskForm.projectId || "none"}
                                        onValueChange={(v) =>
                                            setTaskForm((p) => ({ ...p, projectId: v === "none" ? "" : v }))
                                        }
                                    >
                                        <SelectTrigger>
                                            <Briefcase className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                                            <SelectValue placeholder="No project" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No Project</SelectItem>
                                            {projects.map((proj) => (
                                                <SelectItem key={proj.id} value={proj.id}>
                                                    {proj.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2 relative">
                                    <label className="text-sm font-medium flex items-center gap-1.5">
                                        <Tag className="h-3.5 w-3.5" /> Tags
                                    </label>
                                    {/* Tag pills */}
                                    <div className="flex flex-wrap gap-1.5 min-h-[2rem] border rounded-md p-2 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
                                        {taskForm.tags.map((tag) => {
                                            const registryTag = taskTags.find((t) => t.name === tag);
                                            const color = registryTag?.color ?? "#6366f1";
                                            return (
                                                <span
                                                    key={tag}
                                                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium"
                                                    style={{ backgroundColor: color + "22", color, border: `1px solid ${color}55` }}
                                                >
                                                    {tag}
                                                    <button
                                                        type="button"
                                                        className="hover:opacity-70"
                                                        onClick={() => removeTagFromForm(tag)}
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            );
                                        })}
                                        <input
                                            value={tagInput}
                                            onChange={(e) => setTagInput(e.target.value)}
                                            onFocus={() => setShowTagSugs(true)}
                                            onBlur={() => setTimeout(() => setShowTagSugs(false), 150)}
                                            onKeyDown={(e) => {
                                                if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                                                    e.preventDefault();
                                                    addTagToForm(tagInput);
                                                }
                                            }}
                                            placeholder={taskForm.tags.length === 0 ? "Type and press Enter to add tags…" : ""}
                                            className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                                        />
                                    </div>
                                    {showTagSugs && tagSuggestions.length > 0 && (
                                        <div ref={tagSugRef} className="absolute top-full left-0 right-0 z-50 bg-popover border border-border rounded-md shadow-lg overflow-hidden mt-1">
                                            <p className="px-3 py-1.5 text-[10px] text-muted-foreground border-b font-medium uppercase tracking-wide">
                                                Suggestions
                                            </p>
                                            {tagSuggestions.map((tag) => {
                                                const registryTag = taskTags.find((t) => t.name === tag);
                                                return (
                                                    <button
                                                        key={tag}
                                                        type="button"
                                                        className="w-full px-3 py-1.5 text-sm text-left hover:bg-muted/80 flex items-center gap-2"
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => addTagToForm(tag)}
                                                    >
                                                        <span
                                                            className="h-3 w-3 rounded-full shrink-0"
                                                            style={{ backgroundColor: registryTag?.color ?? "#6366f1" }}
                                                        />
                                                        {tag}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="completion-required"
                                        checked={taskForm.completionRequired}
                                        onCheckedChange={(v) => setTaskForm((p) => ({ ...p, completionRequired: !!v }))}
                                    />
                                    <label htmlFor="completion-required" className="text-sm">
                                        Require evidence for Task Completion
                                    </label>
                                </div>
                            </div>
                        </details>
                    </div>
                    <DialogFooter className="shrink-0">
                        <Button variant="outline" onClick={taskFormOnClose}>Cancel</Button>
                        <Button onClick={handleSaveTask}>
                            {editTask ? "Save Changes" : "Create Task"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Task Confirmation */}
            <AlertDialog open={!!deleteTaskId} onOpenChange={(v) => { if (!v) setDeleteTaskId(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Task</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete this task, its completion reports, and all comments. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Group Form Dialog (Create / Edit) */}
            <Dialog open={groupFormDialogOpen} onOpenChange={(v) => { if (!v) groupFormOnClose(); }}>
                <DialogContent className="max-w-lg flex flex-col max-h-[90vh] p-0 gap-0">
                    {/* Accessible title required by Radix — hidden visually, shown to screen readers */}
                    <DialogHeader className="sr-only">
                        <DialogTitle>{editGroup ? "Edit Group" : "Create New Group"}</DialogTitle>
                    </DialogHeader>
                    {/* Sticky visual header */}
                    <div className="shrink-0 px-6 py-4 border-b">
                        <h2 className="text-lg font-semibold">{editGroup ? "Edit Group" : "Create New Group"}</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 py-4 grid gap-4">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Group Name</label>
                            <Input
                                value={groupForm.name}
                                onChange={(e) => setGroupForm((p) => ({ ...p, name: e.target.value }))}
                                placeholder="e.g., Marketing Campaign Q2"
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Description</label>
                            <Textarea
                                value={groupForm.description}
                                onChange={(e) => setGroupForm((p) => ({ ...p, description: e.target.value }))}
                                placeholder="Brief description of this group..."
                                rows={2}
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">
                                Linked Project{" "}
                                <span className="text-muted-foreground font-normal">(optional)</span>
                            </label>
                            <Select
                                value={groupForm.projectId || "none"}
                                onValueChange={(v) => setGroupForm((p) => ({ ...p, projectId: v === "none" ? "" : v }))}
                            >
                                <SelectTrigger><SelectValue placeholder="No project" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Project</SelectItem>
                                    {projects.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">
                                Members ({groupForm.memberEmployeeIds.length} selected)
                            </label>
                            {/* Search + dept filter */}
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        value={grpSearch}
                                        onChange={(e) => setGrpSearch(e.target.value)}
                                        placeholder="Search members..."
                                        className="pl-8 h-8 text-xs"
                                    />
                                </div>
                                <Select value={grpDeptFilter} onValueChange={setGrpDeptFilter}>
                                    <SelectTrigger className="w-[130px] h-8 text-xs">
                                        <SelectValue placeholder="Department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Depts</SelectItem>
                                        {[...new Set(activeEmployees.map((e) => e.department).filter(Boolean))].sort().map((d) => (
                                            <SelectItem key={d as string} value={d as string}>{d}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1">
                                {activeEmployees
                                    .filter((e) => {
                                        if (grpSearch.trim() && !e.name.toLowerCase().includes(grpSearch.toLowerCase())) return false;
                                        if (grpDeptFilter !== "all" && e.department !== grpDeptFilter) return false;
                                        return true;
                                    })
                                    .sort((a, b) => {
                                        const aChecked = groupForm.memberEmployeeIds.includes(a.id) ? 0 : 1;
                                        const bChecked = groupForm.memberEmployeeIds.includes(b.id) ? 0 : 1;
                                        return aChecked - bChecked || a.name.localeCompare(b.name);
                                    })
                                    .map((emp) => (
                                        <label
                                            key={emp.id}
                                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer"
                                        >
                                            <Checkbox
                                                checked={groupForm.memberEmployeeIds.includes(emp.id)}
                                                onCheckedChange={() => toggleGroupMember(emp.id)}
                                            />
                                            <Avatar className="h-6 w-6">
                                                <AvatarFallback className="text-[9px] bg-muted">
                                                    {getInitials(emp.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm">{emp.name}</span>
                                            <span className="text-xs text-muted-foreground ml-auto">{emp.department}</span>
                                        </label>
                                    ))}
                                {activeEmployees.filter((e) => {
                                    if (grpSearch.trim() && !e.name.toLowerCase().includes(grpSearch.toLowerCase())) return false;
                                    if (grpDeptFilter !== "all" && e.department !== grpDeptFilter) return false;
                                    return true;
                                }).length === 0 && (
                                        <p className="text-xs text-muted-foreground text-center py-4">No employees match.</p>
                                    )}
                            </div>
                        </div>
                    </div>
                    <div className="shrink-0 px-6 py-4 border-t flex justify-end gap-2">
                        <Button variant="outline" onClick={groupFormOnClose}>Cancel</Button>
                        <Button onClick={handleSaveGroup}>
                            {editGroup ? "Save Changes" : "Create Group"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Group Confirmation */}
            <AlertDialog open={!!deleteGroupId} onOpenChange={(v) => { if (!v) setDeleteGroupId(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Group</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will delete the group and all tasks within it. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reject Completion Dialog */}
            <Dialog open={!!rejectOpen} onOpenChange={(v) => { if (!v) { setRejectOpen(null); setRejectReason(""); } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Reject Completion Report</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Reason for rejection *</label>
                            <Textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Explain why the completion is being rejected..."
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setRejectOpen(null); setRejectReason(""); }}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim()}>
                            Reject
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Tag Form Dialog (Create / Edit) */}
            <Dialog open={tagFormDialogOpen} onOpenChange={(v) => { if (!v) tagFormOnClose(); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{editTag ? "Edit Tag" : "Create New Tag"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Tag Name *</label>
                            <Input
                                value={tagForm.name}
                                onChange={(e) => setTagForm((p) => ({ ...p, name: e.target.value }))}
                                placeholder="e.g. urgent, backend, design…"
                                maxLength={40}
                            />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Colour</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={tagForm.color}
                                    onChange={(e) => setTagForm((p) => ({ ...p, color: e.target.value }))}
                                    className="h-10 w-16 cursor-pointer rounded border border-border bg-transparent p-1"
                                />
                                <span
                                    className="flex-1 h-8 rounded-md border border-border/50"
                                    style={{ backgroundColor: tagForm.color }}
                                />
                                <span className="text-xs text-muted-foreground font-mono">{tagForm.color}</span>
                            </div>
                            <div className="flex gap-2 flex-wrap mt-1">
                                {["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16", "#f97316"].map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        className="h-6 w-6 rounded-full border-2 transition-all"
                                        style={{
                                            backgroundColor: c,
                                            borderColor: tagForm.color === c ? "currentColor" : "transparent",
                                            outline: tagForm.color === c ? "2px solid currentColor" : "none",
                                        }}
                                        onClick={() => setTagForm((p) => ({ ...p, color: c }))}
                                    />
                                ))}
                            </div>
                        </div>
                        {tagForm.name.trim() && (
                            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border border-border/50">
                                <span className="text-xs text-muted-foreground">Preview:</span>
                                <span
                                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                                    style={{ backgroundColor: tagForm.color + "22", color: tagForm.color, border: `1px solid ${tagForm.color}55` }}
                                >
                                    <Tag className="h-2.5 w-2.5" /> {tagForm.name.trim()}
                                </span>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={tagFormOnClose}>Cancel</Button>
                        <Button onClick={handleSaveTag}>
                            {editTag ? "Save Changes" : "Create Tag"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Tag Confirmation */}
            <AlertDialog open={!!deleteTagId} onOpenChange={(v) => { if (!v) setDeleteTagId(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Tag</AlertDialogTitle>
                        <AlertDialogDescription>
                            {(() => {
                                const tag = taskTags.find((t) => t.id === deleteTagId);
                                const count = tag ? tasks.filter((t) => t.tags?.includes(tag.name)).length : 0;
                                return count > 0
                                    ? `"${tag?.name}" is used on ${count} task${count !== 1 ? "s" : ""}. The tag will be removed from this registry but task tags won't be modified.`
                                    : `Delete tag "${tag?.name}"? This action cannot be undone.`;
                            })()}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteTag} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ── Admin Board View Sub-Component ──────────────────────────────────

const ADMIN_BOARD_STATUSES: TaskStatus[] = ["open", "in_progress", "submitted", "rejected", "verified", "cancelled"];

function AdminBoardView({
    tasks, roleHref, getEmpName, isOverdue,
}: {
    tasks: Task[];
    roleHref: (path: string) => string;
    getEmpName: (id: string) => string;
    isOverdue: (t: Task) => boolean | "" | undefined;
}) {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const toggle = (status: string) => setCollapsed((prev) => ({ ...prev, [status]: !prev[status] }));

    const renderTaskCard = (task: Task) => {
        const pc = PRIORITY_CONFIG[task.priority];
        const overdue = isOverdue(task);
        return (
            <Link key={task.id} href={roleHref(`/tasks/${task.id}`)}>
                <Card className="border border-border/50 hover:border-border active:scale-[0.99] transition-all cursor-pointer">
                    <CardContent className="p-3 space-y-1.5">
                        <p className="text-sm font-medium leading-snug line-clamp-2">{task.title}</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="secondary" className={`text-[10px] ${pc.color}`}>
                                {pc.label}
                            </Badge>
                            {overdue && (
                                <Badge variant="secondary" className="text-[10px] bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                    Overdue
                                </Badge>
                            )}
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
                            {task.assignedTo.length > 3 && (
                                <Avatar className="h-5 w-5 border-2 border-card">
                                    <AvatarFallback className="text-[7px] bg-muted">+{task.assignedTo.length - 3}</AvatarFallback>
                                </Avatar>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </Link>
        );
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ADMIN_BOARD_STATUSES.map((status) => {
                const cfg = STATUS_CONFIG[status];
                const Icon = cfg.icon;
                const columnTasks = tasks
                    .filter((t) => t.status === status)
                    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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

// ── Task Calendar Sub-Component ──────────────────────────────────

const TASK_STATUS_COLORS: Record<TaskStatus, CalendarItemColor> = {
    open: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" },
    in_progress: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400", dot: "bg-yellow-500" },
    submitted: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-400", dot: "bg-purple-500" },
    verified: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", dot: "bg-green-500" },
    rejected: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" },
    cancelled: { bg: "bg-gray-100 dark:bg-gray-900/30", text: "text-gray-700 dark:text-gray-400", dot: "bg-gray-400" },
};

const TASK_STATUS_OPTIONS: TaskStatus[] = ["open", "in_progress", "submitted", "verified", "rejected", "cancelled"];

interface TaskCalendarViewProps {
    tasks: Task[];
    getEmpName: (id: string) => string;
    onStatusChange: (taskId: string, status: TaskStatus) => void;
    roleHref: (path: string) => string;
}

function TaskCalendarView({ tasks, getEmpName, onStatusChange, roleHref }: TaskCalendarViewProps) {
    const [statusDialogTask, setStatusDialogTask] = useState<Task | null>(null);

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

    const handleItemClick = useCallback((item: CalendarItem) => {
        const task = tasks.find((t) => t.id === item.id);
        if (task) setStatusDialogTask(task);
    }, [tasks]);

    return (
        <>
            <Card className="border border-border/50 overflow-hidden">
                <FullScreenCalendar
                    items={calendarItems}
                    colorMap={TASK_STATUS_COLORS}
                    onItemClick={handleItemClick}
                    itemLabel="Tasks"
                />
            </Card>

            {/* Quick Status Change Dialog */}
            <Dialog open={!!statusDialogTask} onOpenChange={(v) => { if (!v) setStatusDialogTask(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-base">Change Task Status</DialogTitle>
                    </DialogHeader>
                    {statusDialogTask && (
                        <div className="space-y-4 pt-2">
                            <div className="space-y-1.5">
                                <Link
                                    href={roleHref(`/tasks/${statusDialogTask.id}`)}
                                    className="text-sm font-semibold hover:underline"
                                >
                                    {statusDialogTask.title}
                                </Link>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {statusDialogTask.dueDate && (
                                        <span>Due: {statusDialogTask.dueDate}</span>
                                    )}
                                    <span>•</span>
                                    <span className="capitalize">{statusDialogTask.priority}</span>
                                </div>
                                {statusDialogTask.assignedTo.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        Assigned: {statusDialogTask.assignedTo.slice(0, 3).map(getEmpName).join(", ")}
                                        {statusDialogTask.assignedTo.length > 3 && ` +${statusDialogTask.assignedTo.length - 3}`}
                                    </p>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {TASK_STATUS_OPTIONS.map((status) => {
                                    const isActive = statusDialogTask.status === status;
                                    const color = TASK_STATUS_COLORS[status];
                                    const cfg = STATUS_CONFIG[status];
                                    const Icon = cfg.icon;
                                    return (
                                        <Button
                                            key={status}
                                            variant={isActive ? "default" : "outline"}
                                            size="sm"
                                            className={`gap-1.5 justify-start text-xs ${isActive ? "" : `${color.text} hover:${color.bg}`}`}
                                            disabled={isActive}
                                            onClick={() => {
                                                onStatusChange(statusDialogTask.id, status);
                                                setStatusDialogTask(null);
                                            }}
                                        >
                                            <Icon className="h-3.5 w-3.5" />
                                            {cfg.label}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
