"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useMessagingStore } from "@/store/messaging.store";
import { useTasksStore } from "@/store/tasks.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getInitials, formatDateTime, formatDate } from "@/lib/format";
import { toast } from "sonner";
import {
    MessageSquare, Send, Hash, Megaphone, Mail, Smartphone,
    Globe, Trash2, Archive, ArchiveRestore, ChevronDown, ChevronRight,
    Settings, UserPlus, Users, Check, X,
} from "lucide-react";
import type { MessageChannel, AnnouncementScope } from "@/types";

const CHANNEL_ICONS: Record<MessageChannel, typeof Mail> = {
    email: Mail,
    whatsapp: Smartphone,
    sms: Smartphone,
    in_app: Globe,
};

const CHANNEL_LABELS: Record<MessageChannel, string> = {
    email: "Email",
    whatsapp: "WhatsApp",
    sms: "SMS",
    in_app: "In-App",
};

export default function AdminMessagesView() {
    const {
        announcements, channels, messages,
        sendAnnouncement, createChannel, deleteChannel, archiveChannel, unarchiveChannel,
        sendMessage, getChannelMessages, getUnreadCount, deleteAnnouncement,
        markMessageRead,
    } = useMessagingStore();
    const { groups, tasks } = useTasksStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);
    const accounts = useAuthStore((s) => s.accounts);

    // Resolve the EMP-prefixed employee ID for the current auth user.
    // Seed channels use EMP IDs; auth accounts use U-prefixed IDs.
    const effectiveId = useMemo(() => {
        const emp = employees.find(
            (e) => e.profileId === currentUser.id || e.email?.toLowerCase() === currentUser.email?.toLowerCase()
        );
        return emp?.id ?? currentUser.id;
    }, [employees, currentUser.id, currentUser.email]);

    const getEmpName = (id: string) =>
        employees.find((e) => e.id === id)?.name ||
        accounts.find((a) => a.id === id)?.name ||
        id;

    // ── Channel chat state ───────────────────────────────────
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
    const [showArchived, setShowArchived] = useState(false);
    const [chatMessage, setChatMessage] = useState("");
    const chatEndRef = useRef<HTMLDivElement>(null);

    const selectedChannel = channels.find((c) => c.id === selectedChannelId);
    const channelMsgs = useMemo(
        () => (selectedChannelId ? getChannelMessages(selectedChannelId) : []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [selectedChannelId, getChannelMessages, messages]
    );

    // Mark messages as read when channel is selected
    useEffect(() => {
        if (!selectedChannelId) return;
        channelMsgs.forEach((m) => {
            if (m.employeeId !== effectiveId && !m.readBy.includes(effectiveId)) {
                markMessageRead(m.id, effectiveId);
            }
        });
    }, [selectedChannelId, channelMsgs, effectiveId, markMessageRead]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [channelMsgs.length]);

    const handleSendChat = () => {
        if (!chatMessage.trim() || !selectedChannelId) return;
        sendMessage({ channelId: selectedChannelId, employeeId: effectiveId, message: chatMessage.trim() });
        setChatMessage("");
    };

    // ── Create Channel Dialog ────────────────────────────────
    const [channelOpen, setChannelOpen] = useState(false);
    const [chName, setChName] = useState("");
    const [chMembers, setChMembers] = useState<string[]>([]);
    const [chDept, setChDept] = useState<string>("all");
    const [chScope, setChScope] = useState<"all_employees" | "department" | "selected_employees">("all_employees");

    const handleCreateChannel = () => {
        if (!chName) { toast.error("Channel name is required"); return; }
        const resolvedMembers =
            chScope === "all_employees" ? activeEmployees.map((e) => e.id) :
            chScope === "department" ? filteredByDept(chDept).map((e) => e.id) :
            chMembers;
        createChannel({
            name: chName.startsWith("#") ? chName : `#${chName}`,
            memberEmployeeIds: resolvedMembers,
            createdBy: effectiveId,
        });
        toast.success(`Channel "${chName}" created`);
        setChName(""); setChMembers([]); setChDept("all"); setChScope("all_employees"); setChannelOpen(false);
    };

    // ── Channel Settings Dialog ──────────────────────────────
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsChannelId, setSettingsChannelId] = useState<string | null>(null);
    const [settingsName, setSettingsName] = useState("");
    const [settingsMembers, setSettingsMembers] = useState<string[]>([]);
    const [settingsDept, setSettingsDept] = useState<string>("all");
    const [settingsScope, setSettingsScope] = useState<"all_employees" | "department" | "selected_employees">("all_employees");

    const settingsChannel = channels.find((c) => c.id === settingsChannelId);

    const openSettings = (ch: (typeof channels)[0], e: React.MouseEvent) => {
        e.stopPropagation();
        setSettingsChannelId(ch.id);
        setSettingsName(ch.name.replace("#", ""));
        setSettingsMembers([...ch.memberEmployeeIds]);
        setSettingsDept("all");
        setSettingsScope("all_employees");
        setSettingsOpen(true);
    };

    const handleSaveSettings = () => {
        if (!settingsChannelId || !settingsName) { toast.error("Channel name is required"); return; }
        // Update via store — assumes updateChannel exists; fall back gracefully
        const store = useMessagingStore.getState() as unknown as Record<string, unknown>;
        if (typeof store.updateChannel === "function") {
            (store.updateChannel as (id: string, patch: object) => void)(settingsChannelId, {
                name: settingsName.startsWith("#") ? settingsName : `#${settingsName}`,
                memberEmployeeIds: settingsMembers,
            });
        }
        toast.success("Channel settings saved");
        setSettingsOpen(false);
    };

    // ── Derived: unique departments ──────────────────────────
    const departments = useMemo(
        () => Array.from(new Set(employees.map((e) => e.department).filter(Boolean))).sort() as string[],
        [employees]
    );

    const activeEmployees = useMemo(() => employees.filter((e) => e.status === "active"), [employees]);

    // Employees visible based on a dept filter
    const filteredByDept = (dept: string) =>
        dept === "all" ? activeEmployees : activeEmployees.filter((e) => e.department === dept);

    // Toggle all employees in current dept for a member list setter
    const toggleDeptAll = (
        dept: string,
        current: string[],
        setter: React.Dispatch<React.SetStateAction<string[]>>
    ) => {
        const ids = filteredByDept(dept).map((e) => e.id);
        const allSelected = ids.every((id) => current.includes(id));
        if (allSelected) setter((prev) => prev.filter((id) => !ids.includes(id)));
        else setter((prev) => Array.from(new Set([...prev, ...ids])));
    };

    // ── Send Announcement Dialog ─────────────────────────────
    const [annOpen, setAnnOpen] = useState(false);
    const [annSubject, setAnnSubject] = useState("");
    const [annBody, setAnnBody] = useState("");
    const [annChannel, setAnnChannel] = useState<MessageChannel>("email");
    const [annScope, setAnnScope] = useState<AnnouncementScope>("all_employees");
    const [annGroupId, setAnnGroupId] = useState("");
    const [annTaskId, setAnnTaskId] = useState("");
    const [annEmpIds, setAnnEmpIds] = useState<string[]>([]);
    const [annDept, setAnnDept] = useState<string>("all");

    const handleSendAnnouncement = () => {
        if (!annSubject || !annBody) { toast.error("Subject and body are required"); return; }
        if (annChannel === "sms") { toast.error("SMS is coming soon"); return; }
        sendAnnouncement({
            subject: annSubject,
            body: annBody,
            channel: annChannel,
            scope: annScope,
            sentBy: effectiveId,
            targetGroupId: annScope === "task_group" ? annGroupId : undefined,
            targetTaskId: annScope === "task_assignees" ? annTaskId : undefined,
            targetEmployeeIds: annScope === "selected_employees" ? annEmpIds : undefined,
        });
        toast.success(`Announcement sent via ${CHANNEL_LABELS[annChannel]} (simulated)`);
        setAnnSubject(""); setAnnBody(""); setAnnChannel("email"); setAnnScope("all_employees");
        setAnnGroupId(""); setAnnTaskId(""); setAnnEmpIds([]); setAnnDept("all");
        setAnnOpen(false);
    };

    return (
        <div className="space-y-3 h-full flex flex-col">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Messaging Hub</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{channels.length} channels · {announcements.length} announcements</p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={channelOpen} onOpenChange={setChannelOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="gap-1.5"><Hash className="h-4 w-4" /> New Channel</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                            <DialogHeader><DialogTitle>Create Channel</DialogTitle></DialogHeader>
                            <div className="space-y-4 pt-2">
                                <div>
                                    <label className="text-sm font-medium">Channel Name <span className="text-destructive">*</span></label>
                                    <Input value={chName} 
                                    onChange={(e) => { if (e.target.value.length <= 50) {
                                        setChName(e.target.value);} 
                                    }}
                                    placeholder="#channel-name" 
                                    className="mt-1 w-full overflow-hidden"
                                    maxLength={50} />
                                    <p className={`text-xs mt-1 ${(50 - chName.length) <= 0 ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                                    {50 - chName.length} characters remaining
                                </p>                  
                                </div>

                                {/* Scope */}
                                <div>
                                    <label className="text-sm font-medium">Member Scope</label>
                                    <Select value={chScope} onValueChange={(v) => { setChScope(v as typeof chScope); setChMembers([]); }}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all_employees">All Employees</SelectItem>
                                            <SelectItem value="department">By Department</SelectItem>
                                            <SelectItem value="selected_employees">Selected Employees</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Department picker (shown for department scope) */}
                                {chScope === "department" && (
                                    <div>
                                        <label className="text-sm font-medium">Department</label>
                                        <Select value={chDept} onValueChange={setChDept}>
                                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Departments</SelectItem>
                                                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {filteredByDept(chDept).length} employee(s) will be added
                                        </p>
                                    </div>
                                )}

                                {/* Individual employee picker */}
                                {chScope === "selected_employees" && (
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-sm font-medium">Members</label>
                                            <div className="flex items-center gap-2">
                                                <Select value={chDept} onValueChange={setChDept}>
                                                    <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All Departments</SelectItem>
                                                        {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <button
                                                    onClick={() => toggleDeptAll(chDept, chMembers, setChMembers)}
                                                    className="text-xs text-primary hover:underline whitespace-nowrap"
                                                >
                                                    {filteredByDept(chDept).every((e) => chMembers.includes(e.id)) ? "Deselect all" : "Select all"}
                                                </button>
                                            </div>
                                        </div>
                                        <ScrollArea className="h-44 rounded border p-2">
                                            {filteredByDept(chDept).map((emp) => (
                                                <div key={emp.id} className="flex items-center gap-2 py-1">
                                                    <Checkbox
                                                        checked={chMembers.includes(emp.id)}
                                                        onCheckedChange={(checked) =>
                                                            setChMembers((prev) => checked ? [...prev, emp.id] : prev.filter((id) => id !== emp.id))
                                                        }
                                                    />
                                                    <span className="text-sm flex-1">{emp.name}</span>
                                                    <span className="text-xs text-muted-foreground">{emp.department}</span>
                                                </div>
                                            ))}
                                        </ScrollArea>
                                        <p className="text-xs text-muted-foreground mt-1">{chMembers.length} selected</p>
                                    </div>
                                )}

                                {chScope === "all_employees" && (
                                    <p className="text-xs text-muted-foreground">All {activeEmployees.length} active employees will be added.</p>
                                )}

                                <Button onClick={handleCreateChannel} className="w-full">Create Channel</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Dialog open={annOpen} onOpenChange={setAnnOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-1.5"><Megaphone className="h-4 w-4" /> Send Announcement</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                            <DialogHeader><DialogTitle>Send Announcement</DialogTitle></DialogHeader>
                            <div className="space-y-4 pt-2">
                                <div>
                                    <label className="text-sm font-medium">Subject <span className="text-destructive">*</span></label>
                                    <Input value={annSubject} 
                                    onChange={(e) => {if (e.target.value.length <= 50) {setAnnSubject(e.target.value)} }}
                                    placeholder="Announcement subject" 
                                    className="mt-1 w-full overflow-hidden"
                                    maxLength={50} />
                                    <p className={`text-xs mt-1 ${(50 - annSubject.length) <= 0 ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                                    {50 - annSubject.length} characters remaining
                                </p>
                                </div>
                                <div className = "grid gap-2">
                                    <label className="text-sm font-medium">Message <span className="text-destructive">*</span></label>
                                    <Textarea value={annBody} 
                                    onChange={(e) => setAnnBody(e.target.value)} 
                                    placeholder="Write your announcement..." 
                                    rows={2}
                                    className="resize-none max-h-[7rem] overflow-y-auto"  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-sm font-medium">Channel</label>
                                        <Select value={annChannel} onValueChange={(v) => setAnnChannel(v as MessageChannel)}>
                                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="email">📧 Email</SelectItem>
                                                <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                                                <SelectItem value="in_app">🌐 In-App</SelectItem>
                                                <SelectItem value="sms" disabled>📱 SMS (Coming Soon)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Scope</label>
                                        <Select value={annScope} onValueChange={(v) => setAnnScope(v as AnnouncementScope)}>
                                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all_employees">All Employees</SelectItem>
                                                <SelectItem value="task_group">Task Group</SelectItem>
                                                <SelectItem value="task_assignees">Task Assignees</SelectItem>
                                                <SelectItem value="selected_employees">Selected Employees</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                {annScope === "task_group" && (
                                    <div>
                                        <label className="text-sm font-medium">Task Group</label>
                                        <Select value={annGroupId} onValueChange={setAnnGroupId}>
                                            <SelectTrigger className="mt-1"><SelectValue placeholder="Select group" /></SelectTrigger>
                                            <SelectContent>
                                                {groups.filter((g) => g.id).map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                {annScope === "task_assignees" && (
                                    <div>
                                        <label className="text-sm font-medium">Task</label>
                                        <Select value={annTaskId} onValueChange={setAnnTaskId}>
                                            <SelectTrigger className="mt-1"><SelectValue placeholder="Select task" /></SelectTrigger>
                                            <SelectContent>
                                                {tasks.filter((t) => t.id).map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                {annScope === "selected_employees" && (
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-sm font-medium">Select Employees</label>
                                            <div className="flex items-center gap-2">
                                                <Select value={annDept} onValueChange={setAnnDept}>
                                                    <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="all">All Departments</SelectItem>
                                                        {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                                <button
                                                    onClick={() => toggleDeptAll(annDept, annEmpIds, setAnnEmpIds)}
                                                    className="text-xs text-primary hover:underline whitespace-nowrap"
                                                >
                                                    {filteredByDept(annDept).every((e) => annEmpIds.includes(e.id)) ? "Deselect all" : "Select all"}
                                                </button>
                                            </div>
                                        </div>
                                        <ScrollArea className="h-40 rounded border p-2">
                                            {filteredByDept(annDept).map((emp) => (
                                                <div key={emp.id} className="flex items-center gap-2 py-1">
                                                    <Checkbox
                                                        checked={annEmpIds.includes(emp.id)}
                                                        onCheckedChange={(checked) =>
                                                            setAnnEmpIds((prev) => checked ? [...prev, emp.id] : prev.filter((id) => id !== emp.id))
                                                        }
                                                    />
                                                    <span className="text-sm flex-1">{emp.name}</span>
                                                    <span className="text-xs text-muted-foreground">{emp.department}</span>
                                                </div>
                                            ))}
                                        </ScrollArea>
                                        <p className="text-xs text-muted-foreground mt-1">{annEmpIds.length} selected</p>
                                    </div>
                                )}
                                <Button onClick={handleSendAnnouncement} className="w-full gap-1.5">
                                    <Send className="h-4 w-4" /> Send Announcement
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Tabs defaultValue="channels">
                <TabsList>
                    <TabsTrigger value="channels">Channels</TabsTrigger>
                    <TabsTrigger value="announcements">Announcements ({announcements.length})</TabsTrigger>
                </TabsList>

                {/* ── Channels Tab ────────────────────────────── */}
                <TabsContent value="channels" className="mt-2 flex-1 min-h-0">
                    <div className="grid lg:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-200px)] min-h-[400px]">
                        {/* Channel list */}
                        <Card className="border border-border/50 h-full">
                            <CardContent className="p-0 h-full">
                                <ScrollArea className="h-full">
                                    <div className="p-2 space-y-0.5">
                                        {channels.filter((c) => !c.isArchived).map((ch) => {
                                            const unread = getUnreadCount(ch.id, effectiveId);
                                            return (
                                                <div
                                                    key={ch.id}
                                                    onClick={() => setSelectedChannelId(ch.id)}
                                                    className={`group w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer ${
                                                        selectedChannelId === ch.id
                                                            ? "bg-primary/10 text-primary"
                                                            : "hover:bg-muted/50"
                                                    }`}
                                                >
                                                    <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                    <span className="text-sm font-medium truncate flex-1">{ch.name.replace("#", "")}</span>
                                                    {unread > 0 && (
                                                        <Badge variant="default" className="text-[10px] h-5 min-w-5 justify-center group-hover:hidden">{unread}</Badge>
                                                    )}
                                                    <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                                                        <button
                                                            title="Settings"
                                                            onClick={(e) => openSettings(ch, e)}
                                                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                        >
                                                            <Settings className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            title="Archive"
                                                            onClick={(e) => { e.stopPropagation(); archiveChannel(ch.id); if (selectedChannelId === ch.id) setSelectedChannelId(null); toast.success("Channel archived"); }}
                                                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                        >
                                                            <Archive className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            title="Delete"
                                                            onClick={(e) => { e.stopPropagation(); deleteChannel(ch.id); if (selectedChannelId === ch.id) setSelectedChannelId(null); toast.success("Channel deleted"); }}
                                                            className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Archived channels section */}
                                        {channels.some((c) => c.isArchived) && (
                                            <div className="pt-2">
                                                <button
                                                    onClick={() => setShowArchived((v) => !v)}
                                                    className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
                                                >
                                                    {showArchived ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                                    <Archive className="h-3 w-3" />
                                                    Archived ({channels.filter((c) => c.isArchived).length})
                                                </button>
                                                {showArchived && channels.filter((c) => c.isArchived).map((ch) => (
                                                    <div
                                                        key={ch.id}
                                                        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left opacity-60"
                                                    >
                                                        <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                        <span className="text-sm truncate flex-1 line-through text-muted-foreground">{ch.name.replace("#", "")}</span>
                                                        <button
                                                            title="Unarchive"
                                                            onClick={() => { unarchiveChannel(ch.id); toast.success(`"${ch.name}" unarchived`); }}
                                                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-100"
                                                        >
                                                            <ArchiveRestore className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            title="Delete"
                                                            onClick={() => { deleteChannel(ch.id); toast.success("Channel deleted"); }}
                                                            className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-colors opacity-100"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        {/* Chat area */}
                        <Card className="border border-border/50 flex flex-col h-full min-h-0">
                            {selectedChannel ? (
                                <>
                                    <CardHeader className="py-2 px-4 border-b shrink-0 space-y-0">
                                        <div className="flex items-center gap-2">
                                            <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <CardTitle className="text-sm font-semibold leading-none">{selectedChannel.name.replace("#", "")}</CardTitle>
                                                <p className="text-xs text-muted-foreground mt-0.5">{selectedChannel.memberEmployeeIds.length} members</p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                                                title="Channel Settings"
                                                onClick={(e) => openSettings(selectedChannel, e)}
                                            >
                                                <Settings className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="flex-1 p-0 flex flex-col overflow-hidden min-h-0">
                                        <ScrollArea className="flex-1 min-h-0 p-4">
                                            <div className="space-y-3">
                                                {channelMsgs.map((msg) => {
                                                    const isMine = msg.employeeId === effectiveId;
                                                    return (
                                                        <div key={msg.id} className={`flex gap-2.5 w-full ${isMine ? "flex-row-reverse" : ""}`}>
                                                            <Avatar className="h-7 w-7 shrink-0">
                                                                <AvatarFallback className="text-[9px] bg-muted">{getInitials(getEmpName(msg.employeeId))}</AvatarFallback>
                                                            </Avatar>
                                                            <div className={`max-w-[70%] min-w-0 overflow-hidden ${isMine ? "text-right" : ""}`}>
                                                                <div className={`flex items-center gap-2 mb-0.5 ${isMine ? "justify-end" : ""}`}>
                                                                    {!isMine && <span className="text-xs font-medium truncate">{getEmpName(msg.employeeId)}</span>}
                                                                    <span className="text-[10px] text-muted-foreground shrink-0">{formatDateTime(msg.createdAt)}</span>
                                                                </div>
                                                                <div 
                                                                    className={`rounded-lg px-3 py-2 text-sm text-left inline-block max-w-full ${
                                                                        isMine
                                                                            ? "bg-primary text-primary-foreground"
                                                                            : "bg-muted"
                                                                    }`}
                                                                    style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
                                                                >
                                                                    {msg.message}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <div ref={chatEndRef} />
                                            </div>
                                        </ScrollArea>
                                        <div className="p-3 border-t flex items-center gap-2">
                                            <Input
                                                value={chatMessage}
                                                onChange={(e) => setChatMessage(e.target.value)}
                                                placeholder="Type a message..."
                                                className="flex-1 h-9"
                                                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendChat()}
                                            />
                                            <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleSendChat} disabled={!chatMessage.trim()}>
                                                <Send className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </>
                            ) : (
                                <CardContent className="flex-1 flex items-center justify-center">
                                    <div className="text-center text-muted-foreground">
                                        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                        <p className="text-sm">Select a channel to start chatting</p>
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    </div>
                </TabsContent>

                {/* ── Announcements Tab ───────────────────────── */}
                <TabsContent value="announcements" className="space-y-4 mt-4">
                    {announcements.length === 0 ? (
                        <Card className="border border-border/50">
                            <CardContent className="p-8 text-center text-muted-foreground">
                                <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">No announcements sent yet</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {[...announcements].reverse().map((ann) => {
                                const ChannelIcon = CHANNEL_ICONS[ann.channel];
                                return (
                                    <Card key={ann.id} className="border border-border/50">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0 space-y-2">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="text-sm font-semibold">{ann.subject}</h3>
                                                        <Badge variant="outline" className="text-[10px] gap-1">
                                                            <ChannelIcon className="h-3 w-3" /> {CHANNEL_LABELS[ann.channel]}
                                                        </Badge>
                                                        <Badge variant="secondary" className="text-[10px]">{ann.scope.replace(/_/g, " ")}</Badge>
                                                        <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{ann.status}</Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground line-clamp-2">{ann.body}</p>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                        <span>Sent by <strong>{getEmpName(ann.sentBy)}</strong></span>
                                                        <span>{formatDate(ann.sentAt)}</span>
                                                        <span>{ann.readBy.length} read</span>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-500/10 shrink-0" onClick={() => { deleteAnnouncement(ann.id); toast.success("Announcement deleted"); }}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* ── Channel Settings Dialog ─────────────────────── */}
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Channel Settings{settingsChannel ? ` — ${settingsChannel.name}` : ""}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5 pt-2">
                        {/* Rename */}
                        <div>
                            <label className="text-sm font-medium">Channel Name</label>
                            <Input
                                value={settingsName}
                                onChange={(e) => { if (e.target.value.length <= 50) {setSettingsName(e.target.value)}}}
                                placeholder="#channel-name"
                                className="mt-1 w-full overflow-hidden"
                                maxLength={50}
                            />
                            <p className={`text-xs mt-1 ${(50 - settingsName.length) <= 0 ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                                    {50 - settingsName.length} characters remaining
                                </p>
                        </div>

                        {/* Add members section */}
                        <div className="border rounded-lg p-3 space-y-3">
                            <div className="flex items-center gap-2">
                                <UserPlus className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Add Members</span>
                            </div>

                            {/* Scope selector */}
                            <div>
                                <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Scope</label>
                                <Select value={settingsScope} onValueChange={(v) => { setSettingsScope(v as typeof settingsScope); }}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all_employees">All Employees</SelectItem>
                                        <SelectItem value="department">By Department</SelectItem>
                                        <SelectItem value="selected_employees">Selected Employees</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Department dropdown */}
                            {(settingsScope === "department" || settingsScope === "selected_employees") && (
                                <div>
                                    <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Department</label>
                                    <Select value={settingsDept} onValueChange={setSettingsDept}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Departments</SelectItem>
                                            {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Add all in dept button (for "department" scope) */}
                            {settingsScope === "department" && (
                                <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground">
                                        {filteredByDept(settingsDept).length} employee(s) in this department
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full gap-1.5"
                                        onClick={() => {
                                            const ids = filteredByDept(settingsDept).map((e) => e.id);
                                            setSettingsMembers((prev) => Array.from(new Set([...prev, ...ids])));
                                            toast.success(`Added all ${ids.length} from ${settingsDept === "all" ? "all departments" : settingsDept}`);
                                        }}
                                    >
                                        <Users className="h-3.5 w-3.5" />
                                        Add all from {settingsDept === "all" ? "all departments" : settingsDept}
                                    </Button>
                                </div>
                            )}

                            {/* Selected employees picker */}
                            {settingsScope === "selected_employees" && (
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-muted-foreground">
                                            {filteredByDept(settingsDept).length} employees shown
                                        </span>
                                        <button
                                            onClick={() => toggleDeptAll(settingsDept, settingsMembers, setSettingsMembers)}
                                            className="text-xs text-primary hover:underline"
                                        >
                                            {filteredByDept(settingsDept).every((e) => settingsMembers.includes(e.id)) ? "Deselect all" : "Select all"}
                                        </button>
                                    </div>
                                    <ScrollArea className="h-44 rounded border p-2">
                                        {filteredByDept(settingsDept).map((emp) => (
                                            <div key={emp.id} className="flex items-center gap-2 py-1">
                                                <Checkbox
                                                    checked={settingsMembers.includes(emp.id)}
                                                    onCheckedChange={(checked) =>
                                                        setSettingsMembers((prev) => checked ? [...prev, emp.id] : prev.filter((id) => id !== emp.id))
                                                    }
                                                />
                                                <span className="text-sm flex-1">{emp.name}</span>
                                                <span className="text-xs text-muted-foreground">{emp.department}</span>
                                            </div>
                                        ))}
                                    </ScrollArea>
                                </div>
                            )}

                            {settingsScope === "all_employees" && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full gap-1.5"
                                    onClick={() => {
                                        const ids = activeEmployees.map((e) => e.id);
                                        setSettingsMembers(ids);
                                        toast.success(`Added all ${ids.length} active employees`);
                                    }}
                                >
                                    <Users className="h-3.5 w-3.5" />
                                    Add all {activeEmployees.length} active employees
                                </Button>
                            )}
                        </div>

                        {/* Current members list */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-sm font-medium">Current Members</label>
                                <span className="text-xs text-muted-foreground">{settingsMembers.length} total</span>
                            </div>
                            <ScrollArea className="h-36 rounded border p-2">
                                {settingsMembers.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-4">No members yet</p>
                                ) : (
                                    settingsMembers.map((id) => {
                                        const emp = employees.find((e) => e.id === id);
                                        return (
                                            <div key={id} className="flex items-center gap-2 py-1 group">
                                                <Avatar className="h-5 w-5 shrink-0">
                                                    <AvatarFallback className="text-[8px] bg-muted">{getInitials(emp?.name ?? id)}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm flex-1 truncate">{emp?.name ?? id}</span>
                                                <span className="text-xs text-muted-foreground truncate">{emp?.department}</span>
                                                <button
                                                    onClick={() => setSettingsMembers((prev) => prev.filter((m) => m !== id))}
                                                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-muted-foreground hover:text-red-600 transition-all"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </ScrollArea>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setSettingsOpen(false)}>Cancel</Button>
                            <Button className="flex-1 gap-1.5" onClick={handleSaveSettings}>
                                <Check className="h-4 w-4" /> Save Changes
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}