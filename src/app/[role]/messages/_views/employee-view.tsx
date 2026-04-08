"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useMessagingStore } from "@/store/messaging.store";
import { useTasksStore } from "@/store/tasks.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getInitials, formatDate } from "@/lib/format";
import { MessageSquare, Send, Hash, Megaphone, Mail, Smartphone, Globe, ArrowLeft } from "lucide-react";
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
        messages,
        getChannelsForEmployee, getChannelMessages, getUnreadCount,
        sendMessage, markMessageRead, markAnnouncementRead,
        getAnnouncementsForEmployee,
    } = useMessagingStore();
    const { groups, tasks } = useTasksStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);
    const accounts = useAuthStore((s) => s.accounts);

    // Resolve the employee record for the current auth user.
    // Channels use EMP-prefixed IDs; auth users have U-prefixed IDs.
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

    const myChannels = useMemo(
        () => getChannelsForEmployee(effectiveId),
        [getChannelsForEmployee, effectiveId],
    );

    const myAnnouncements = useMemo(
        () => getAnnouncementsForEmployee(
            effectiveId,
            groups.map((g) => ({ id: g.id, memberEmployeeIds: g.memberEmployeeIds })),
            tasks.map((t) => ({ id: t.id, assignedTo: t.assignedTo })),
        ),
        [getAnnouncementsForEmployee, effectiveId, groups, tasks],
    );

    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
    const [chatMessage, setChatMessage] = useState("");
    const chatEndRef = useRef<HTMLDivElement>(null);

    const selectedChannel = myChannels.find((c) => c.id === selectedChannelId);
    const channelMsgs = useMemo(
        () => (selectedChannelId ? getChannelMessages(selectedChannelId) : []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [selectedChannelId, getChannelMessages, messages],
    );

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

    const handleSend = () => {
        if (!chatMessage.trim() || !selectedChannelId) return;
        sendMessage({ channelId: selectedChannelId, employeeId: effectiveId, message: chatMessage.trim() });
        setChatMessage("");
    };

    const totalUnread = myChannels.reduce((sum, ch) => sum + getUnreadCount(ch.id, effectiveId), 0);
    const unreadAnn = myAnnouncements.filter((a) => !a.readBy.includes(effectiveId)).length;

    return (
        <div className="space-y-4 pb-6">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Messages</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    {myChannels.length} channel{myChannels.length !== 1 ? "s" : ""} &middot; {myAnnouncements.length} announcement{myAnnouncements.length !== 1 ? "s" : ""}
                </p>
            </div>

            <Tabs defaultValue="channels">
                <TabsList className="w-full sm:w-auto">
                    <TabsTrigger value="channels" className="flex-1 sm:flex-none gap-1.5 text-xs sm:text-sm">
                        Channels
                        {totalUnread > 0 && (
                            <Badge variant="default" className="text-[10px] h-4 min-w-4 justify-center px-1">{totalUnread}</Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="announcements" className="flex-1 sm:flex-none gap-1.5 text-xs sm:text-sm">
                        <span className="hidden sm:inline">Announcements</span>
                        <span className="sm:hidden">Announce</span>
                        {unreadAnn > 0 && (
                            <Badge variant="default" className="text-[10px] h-4 min-w-4 justify-center px-1">{unreadAnn}</Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* ── Channels tab with mobile panel-swap ─────────────────── */}
                <TabsContent value="channels" className="mt-3">
                    <Card className="border border-border/50 overflow-hidden"
                          style={{ height: "clamp(420px, calc(100svh - 220px), 640px)" }}>
                        <div className="h-full lg:grid lg:grid-cols-[260px_1fr] lg:divide-x lg:divide-border/50">

                            {/* Channel list — full page on mobile when no channel selected */}
                            <div className={`flex flex-col h-full ${selectedChannelId ? "hidden lg:flex" : "flex"}`}>
                                <div className="px-4 py-3 border-b shrink-0">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Channels</p>
                                </div>
                                <ScrollArea className="flex-1 min-h-0">
                                    {myChannels.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground">
                                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                            <p className="text-sm">No channels yet</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-border/50">
                                            {myChannels.map((ch) => {
                                                const unread = getUnreadCount(ch.id, effectiveId);
                                                return (
                                                    <button
                                                        key={ch.id}
                                                        onClick={() => setSelectedChannelId(ch.id)}
                                                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/50 active:bg-muted transition-colors touch-manipulation"
                                                    >
                                                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                            <Hash className="h-4 w-4 text-primary" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-medium truncate">{ch.name.replace("#", "")}</p>
                                                            <p className="text-xs text-muted-foreground">{ch.memberEmployeeIds.length} members</p>
                                                        </div>
                                                        {unread > 0 && (
                                                            <Badge variant="default" className="text-[10px] h-5 min-w-5 justify-center shrink-0">{unread}</Badge>
                                                        )}
                                                        <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180 shrink-0" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </ScrollArea>
                            </div>

                            {/* Chat panel — full page on mobile when channel is selected */}
                            <div className={`flex flex-col h-full min-h-0 ${selectedChannelId ? "flex" : "hidden lg:flex"}`}>
                                {selectedChannel ? (
                                    <>
                                        {/* Chat header */}
                                        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
                                            <button
                                                className="lg:hidden h-8 w-8 flex items-center justify-center rounded-md hover:bg-muted -ml-1 shrink-0"
                                                onClick={() => setSelectedChannelId(null)}
                                                aria-label="Back to channels"
                                            >
                                                <ArrowLeft className="h-4 w-4" />
                                            </button>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-semibold truncate">{selectedChannel.name}</p>
                                                <p className="text-xs text-muted-foreground">{selectedChannel.memberEmployeeIds.length} members</p>
                                            </div>
                                        </div>

                                        {/* Messages */}
                                        <ScrollArea className="flex-1 min-h-0">
                                            <div className="p-4 space-y-4">
                                                {channelMsgs.length === 0 && (
                                                    <p className="text-center text-xs text-muted-foreground py-6">No messages yet. Say hello!</p>
                                                )}
                                                {channelMsgs.map((msg) => {
                                                    const isMine = msg.employeeId === effectiveId;
                                                    return (
                                                        <div key={msg.id} className={`flex gap-2.5 ${isMine ? "flex-row-reverse" : ""}`}>
                                                            <Avatar className="h-8 w-8 shrink-0">
                                                                <AvatarFallback className="text-[9px] bg-muted">{getInitials(getEmpName(msg.employeeId))}</AvatarFallback>
                                                            </Avatar>
                                                            <div className={`max-w-[75%] sm:max-w-[65%] space-y-0.5 flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                                                                <div className={`flex items-center gap-1.5 ${isMine ? "flex-row-reverse" : ""}`}>
                                                                    {!isMine && <span className="text-xs font-medium">{getEmpName(msg.employeeId)}</span>}
                                                                    <span className="text-[10px] text-muted-foreground">{formatDate(msg.createdAt)}</span>
                                                                </div>
                                                                <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                                                                    isMine
                                                                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                                                                        : "bg-muted rounded-tl-sm"
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

                                        {/* Input bar */}
                                        <div className="p-3 border-t flex gap-2 shrink-0 bg-background">
                                            <Input
                                                value={chatMessage}
                                                onChange={(e) => setChatMessage(e.target.value)}
                                                placeholder="Type a message..."
                                                className="text-base"
                                                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                                            />
                                            <button
                                                onClick={handleSend}
                                                disabled={!chatMessage.trim()}
                                                className="h-10 w-10 shrink-0 rounded-md bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors"
                                                aria-label="Send"
                                            >
                                                <Send className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center">
                                        <div className="text-center text-muted-foreground">
                                            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                            <p className="text-sm">Select a channel to start chatting</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                </TabsContent>

                {/* ── Announcements tab ────────────────────────────────────── */}
                <TabsContent value="announcements" className="space-y-2.5 mt-3">
                    {myAnnouncements.length === 0 ? (
                        <Card className="border border-border/50">
                            <CardContent className="p-10 text-center text-muted-foreground">
                                <Megaphone className="h-9 w-9 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No announcements for you yet</p>
                            </CardContent>
                        </Card>
                    ) : (
                        [...myAnnouncements].reverse().map((ann) => {
                            const ChannelIcon = CHANNEL_ICONS[ann.channel];
                            const isRead = ann.readBy.includes(effectiveId);
                            return (
                                <Card
                                    key={ann.id}
                                    className={`border transition-colors cursor-pointer touch-manipulation active:scale-[0.99] ${
                                        isRead ? "border-border/50" : "border-primary/40 bg-primary/5"
                                    }`}
                                    onClick={() => { if (!isRead) markAnnouncementRead(ann.id, effectiveId); }}
                                >
                                    <CardContent className="p-4 space-y-2">
                                        <div className="flex items-start gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <h3 className="text-sm font-semibold">{ann.subject}</h3>
                                                    {!isRead && <Badge variant="default" className="text-[10px] shrink-0">New</Badge>}
                                                </div>
                                                <p className="text-sm text-muted-foreground leading-relaxed">{ann.body}</p>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] gap-1 shrink-0 mt-0.5">
                                                <ChannelIcon className="h-3 w-3" />
                                                <span className="hidden sm:inline">{CHANNEL_LABELS[ann.channel]}</span>
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            From <strong>{getEmpName(ann.sentBy)}</strong> &middot; {formatDate(ann.sentAt)}
                                        </p>
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