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

    const handleCreateChannel = () => {
        if (!chName) { toast.error("Channel name is required"); return; }
        createChannel({
            name: chName.startsWith("#") ? chName : `#${chName}`,
            memberEmployeeIds: chMembers,
            createdBy: effectiveId,
        });
        toast.success(`Channel "${chName}" created`);
        setChName(""); setChMembers([]); setChannelOpen(false);
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
        setAnnGroupId(""); setAnnTaskId(""); setAnnEmpIds([]);
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
                                    <label className="text-sm font-medium">Channel Name *</label>
                                    <Input value={chName} onChange={(e) => setChName(e.target.value)} placeholder="#channel-name" className="mt-1" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Members</label>
                                    <ScrollArea className="h-40 rounded border mt-1 p-2">
                                        {employees.filter((e) => e.status === "active").map((emp) => (
                                            <div key={emp.id} className="flex items-center gap-2 py-1">
                                                <Checkbox
                                                    checked={chMembers.includes(emp.id)}
                                                    onCheckedChange={(checked) =>
                                                        setChMembers((prev) => checked ? [...prev, emp.id] : prev.filter((id) => id !== emp.id))
                                                    }
                                                />
                                                <span className="text-sm">{emp.name}</span>
                                                <span className="text-xs text-muted-foreground">({emp.department})</span>
                                            </div>
                                        ))}
                                    </ScrollArea>
                                </div>
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
                                    <label className="text-sm font-medium">Subject *</label>
                                    <Input value={annSubject} onChange={(e) => setAnnSubject(e.target.value)} placeholder="Announcement subject" className="mt-1" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Message *</label>
                                    <Textarea value={annBody} onChange={(e) => setAnnBody(e.target.value)} placeholder="Write your announcement..." className="mt-1" rows={4} />
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
                                        <label className="text-sm font-medium">Select Employees</label>
                                        <ScrollArea className="h-40 rounded border mt-1 p-2">
                                            {employees.filter((e) => e.status === "active").map((emp) => (
                                                <div key={emp.id} className="flex items-center gap-2 py-1">
                                                    <Checkbox
                                                        checked={annEmpIds.includes(emp.id)}
                                                        onCheckedChange={(checked) =>
                                                            setAnnEmpIds((prev) => checked ? [...prev, emp.id] : prev.filter((id) => id !== emp.id))
                                                        }
                                                    />
                                                    <span className="text-sm">{emp.name}</span>
                                                </div>
                                            ))}
                                        </ScrollArea>
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
                                            <div>
                                                <CardTitle className="text-sm font-semibold leading-none">{selectedChannel.name.replace("#", "")}</CardTitle>
                                                <p className="text-xs text-muted-foreground mt-0.5">{selectedChannel.memberEmployeeIds.length} members</p>
                                            </div>
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
        </div>
    );
}
