"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useMessagingStore } from "@/store/messaging.store";
import { useTasksStore } from "@/store/tasks.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getInitials, formatDate } from "@/lib/format";
import {
    MessageSquare, Send, Hash, Megaphone, Mail, Smartphone, Globe,
} from "lucide-react";
import type { MessageChannel } from "@/types";

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

export default function EmployeeMessagesView() {
    const {
        getChannelsForEmployee, getChannelMessages, getUnreadCount,
        sendMessage, markMessageRead, markAnnouncementRead,
        getAnnouncementsForEmployee,
    } = useMessagingStore();
    const { groups, tasks } = useTasksStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);

    const myChannels = useMemo(
        () => getChannelsForEmployee(currentUser.id),
        [getChannelsForEmployee, currentUser.id]
    );

    const myAnnouncements = useMemo(
        () => getAnnouncementsForEmployee(
            currentUser.id,
            groups.map((g) => ({ id: g.id, memberEmployeeIds: g.memberEmployeeIds })),
            tasks.map((t) => ({ id: t.id, assignedTo: t.assignedTo }))
        ),
        [getAnnouncementsForEmployee, currentUser.id, groups, tasks]
    );

    // ── Channel chat state ───────────────────────────────────
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
    const [chatMessage, setChatMessage] = useState("");
    const chatEndRef = useRef<HTMLDivElement>(null);

    const selectedChannel = myChannels.find((c) => c.id === selectedChannelId);
    const channelMsgs = useMemo(
        () => (selectedChannelId ? getChannelMessages(selectedChannelId) : []),
        [selectedChannelId, getChannelMessages]
    );

    useEffect(() => {
        if (!selectedChannelId) return;
        channelMsgs.forEach((m) => {
            if (m.employeeId !== currentUser.id && !m.readBy.includes(currentUser.id)) {
                markMessageRead(m.id, currentUser.id);
            }
        });
    }, [selectedChannelId, channelMsgs, currentUser.id, markMessageRead]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [channelMsgs.length]);

    const handleSendChat = () => {
        if (!chatMessage.trim() || !selectedChannelId) return;
        sendMessage({ channelId: selectedChannelId, employeeId: currentUser.id, message: chatMessage.trim() });
        setChatMessage("");
    };

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;

    const totalUnread = myChannels.reduce((sum, ch) => sum + getUnreadCount(ch.id, currentUser.id), 0);
    const unreadAnnouncements = myAnnouncements.filter((a) => !a.readBy.includes(currentUser.id)).length;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Messages</h1>
                <p className="text-sm text-muted-foreground mt-0.5">{myChannels.length} channels · {myAnnouncements.length} announcements</p>
            </div>

            <Tabs defaultValue="channels">
                <TabsList>
                    <TabsTrigger value="channels" className="gap-1.5">
                        Channels
                        {totalUnread > 0 && <Badge variant="default" className="text-[10px] h-5 min-w-5 justify-center">{totalUnread}</Badge>}
                    </TabsTrigger>
                    <TabsTrigger value="announcements" className="gap-1.5">
                        Announcements
                        {unreadAnnouncements > 0 && <Badge variant="default" className="text-[10px] h-5 min-w-5 justify-center">{unreadAnnouncements}</Badge>}
                    </TabsTrigger>
                </TabsList>

                {/* ── Channels Tab ────────────────────────────── */}
                <TabsContent value="channels" className="mt-4">
                    <div className="grid lg:grid-cols-[260px_1fr] gap-4 h-[550px]">
                        <Card className="border border-border/50">
                            <CardContent className="p-0">
                                <ScrollArea className="h-[550px]">
                                    <div className="p-2 space-y-0.5">
                                        {myChannels.length === 0 ? (
                                            <div className="p-4 text-center text-muted-foreground text-sm">No channels</div>
                                        ) : myChannels.map((ch) => {
                                            const unread = getUnreadCount(ch.id, currentUser.id);
                                            return (
                                                <button
                                                    key={ch.id}
                                                    onClick={() => setSelectedChannelId(ch.id)}
                                                    className={`w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-left transition-colors ${
                                                        selectedChannelId === ch.id
                                                            ? "bg-primary/10 text-primary"
                                                            : "hover:bg-muted/50"
                                                    }`}
                                                >
                                                    <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                    <span className="text-sm font-medium truncate flex-1">{ch.name.replace("#", "")}</span>
                                                    {unread > 0 && (
                                                        <Badge variant="default" className="text-[10px] h-5 min-w-5 justify-center">{unread}</Badge>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        <Card className="border border-border/50 flex flex-col">
                            {selectedChannel ? (
                                <>
                                    <CardHeader className="pb-2 border-b">
                                        <CardTitle className="text-base">{selectedChannel.name}</CardTitle>
                                        <p className="text-xs text-muted-foreground">{selectedChannel.memberEmployeeIds.length} members</p>
                                    </CardHeader>
                                    <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
                                        <ScrollArea className="flex-1 p-4">
                                            <div className="space-y-3">
                                                {channelMsgs.map((msg) => {
                                                    const isMine = msg.employeeId === currentUser.id;
                                                    return (
                                                        <div key={msg.id} className={`flex gap-2.5 ${isMine ? "flex-row-reverse" : ""}`}>
                                                            <Avatar className="h-7 w-7 shrink-0">
                                                                <AvatarFallback className="text-[9px] bg-muted">{getInitials(getEmpName(msg.employeeId))}</AvatarFallback>
                                                            </Avatar>
                                                            <div className={`max-w-[70%] ${isMine ? "text-right" : ""}`}>
                                                                <div className="flex items-center gap-2 mb-0.5">
                                                                    {!isMine && <span className="text-xs font-medium">{getEmpName(msg.employeeId)}</span>}
                                                                    <span className="text-[10px] text-muted-foreground">{formatDate(msg.createdAt)}</span>
                                                                </div>
                                                                <div className={`inline-block rounded-lg px-3 py-2 text-sm ${
                                                                    isMine ? "bg-primary text-primary-foreground" : "bg-muted"
                                                                }`}>
                                                                    {msg.message}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                <div ref={chatEndRef} />
                                            </div>
                                        </ScrollArea>
                                        <div className="p-3 border-t flex gap-2">
                                            <Input
                                                value={chatMessage}
                                                onChange={(e) => setChatMessage(e.target.value)}
                                                placeholder="Type a message..."
                                                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendChat()}
                                            />
                                            <Button size="sm" onClick={handleSendChat} disabled={!chatMessage.trim()}>
                                                <Send className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </>
                            ) : (
                                <CardContent className="flex-1 flex items-center justify-center">
                                    <div className="text-center text-muted-foreground">
                                        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                        <p className="text-sm">Select a channel to view messages</p>
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    </div>
                </TabsContent>

                {/* ── Announcements Tab ───────────────────────── */}
                <TabsContent value="announcements" className="space-y-3 mt-4">
                    {myAnnouncements.length === 0 ? (
                        <Card className="border border-border/50">
                            <CardContent className="p-8 text-center text-muted-foreground">
                                <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">No announcements for you</p>
                            </CardContent>
                        </Card>
                    ) : (
                        [...myAnnouncements].reverse().map((ann) => {
                            const ChannelIcon = CHANNEL_ICONS[ann.channel];
                            const isRead = ann.readBy.includes(currentUser.id);
                            return (
                                <Card
                                    key={ann.id}
                                    className={`border transition-colors cursor-pointer ${isRead ? "border-border/50" : "border-primary/30 bg-primary/5"}`}
                                    onClick={() => { if (!isRead) markAnnouncementRead(ann.id, currentUser.id); }}
                                >
                                    <CardContent className="p-4 space-y-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-sm font-semibold">{ann.subject}</h3>
                                            {!isRead && <Badge variant="default" className="text-[10px]">New</Badge>}
                                            <Badge variant="outline" className="text-[10px] gap-1">
                                                <ChannelIcon className="h-3 w-3" /> {CHANNEL_LABELS[ann.channel]}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{ann.body}</p>
                                        <div className="text-xs text-muted-foreground">
                                            From <strong>{getEmpName(ann.sentBy)}</strong> · {formatDate(ann.sentAt)}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
