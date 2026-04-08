"use client";

import { useState, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import { useTasksStore } from "@/store/tasks.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
import { useMessagingStore } from "@/store/messaging.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { getInitials, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import Link from "next/link";
import {
    ArrowLeft, Camera, MapPin, CheckCircle2, XCircle,
    ArrowUpRight, Eye, Send, AlertTriangle, Image as ImageIcon, Megaphone,
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

export default function TaskDetailPage() {
    const params = useParams();
    const taskId = params.id as string;
    const {
        getTaskById, changeStatus,
        submitCompletion, verifyCompletion, rejectCompletion, addComment,
        groups, completionReports, comments: allComments,
    } = useTasksStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);
    const hasPermission = useRolesStore((s) => s.hasPermission);
    const roleHref = useRoleHref();

    const task = getTaskById(taskId);
    const comments = useMemo(() => allComments.filter((c) => c.taskId === taskId), [allComments, taskId]);
    const report = useMemo(() => completionReports.find((r) => r.taskId === taskId), [completionReports, taskId]);
    const group = task ? groups.find((g) => g.id === task.groupId) : undefined;

    // Resolve HR employee record by email (DemoUser "U004" ↔ Employee "EMP026")
    const myEmployeeId = useMemo(
        () => employees.find((e) => e.profileId === currentUser.id || e.email?.toLowerCase() === currentUser.email?.toLowerCase() || e.name === currentUser.name)?.id ?? currentUser.id,
        [employees, currentUser.email, currentUser.name, currentUser.id],
    );

    const canVerify = hasPermission(currentUser.role, "tasks:verify");
    const canAnnounce = hasPermission(currentUser.role, "messages:send_announcement");
    const isAssigned = task?.assignedTo.includes(myEmployeeId);

    // ── Comment state ────────────────────────────────────────
    const [commentText, setCommentText] = useState("");
    const handleAddComment = () => {
        if (!commentText.trim()) return;
        addComment({ taskId, employeeId: myEmployeeId, message: commentText.trim() });
        setCommentText("");
        toast.success("Comment added");
    };

    // ── Completion submission state ──────────────────────────
    const [submitOpen, setSubmitOpen] = useState(false);
    const [photoData, setPhotoData] = useState<string | null>(null);
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
    const [completionNotes, setCompletionNotes] = useState("");
    const [gpsLoading, setGpsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setPhotoData(reader.result as string);
        reader.readAsDataURL(file);
    };

    const captureGPS = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGpsData({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                });
                setGpsLoading(false);
                toast.success("Location captured");
            },
            () => {
                setGpsLoading(false);
                toast.error("Unable to get your location. Please enable GPS.");
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleSubmitCompletion = () => {
        if (!task) return;
        if (task.completionRequired && !photoData) { toast.error("Photo proof is required"); return; }
        submitCompletion({
            taskId: task.id,
            employeeId: myEmployeeId,
            photoDataUrl: photoData || undefined,
            gpsLat: gpsData?.lat,
            gpsLng: gpsData?.lng,
            gpsAccuracyMeters: gpsData?.accuracy,
            reverseGeoAddress: gpsData ? `${gpsData.lat.toFixed(4)}°N, ${gpsData.lng.toFixed(4)}°E` : undefined,
            notes: completionNotes || undefined,
        });
        toast.success("Completion report submitted for review");
        setPhotoData(null); setGpsData(null); setCompletionNotes("");
        setSubmitOpen(false);
    };

    // ── Rejection dialog ─────────────────────────────────────
    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const handleReject = () => {
        if (!report || !rejectReason.trim()) { toast.error("Please provide a reason"); return; }
        rejectCompletion(report.id, rejectReason.trim());
        toast.success("Completion rejected");
        setRejectReason(""); setRejectOpen(false);
    };

    // ── Notify Assignees ─────────────────────────────────────
    const { sendAnnouncement } = useMessagingStore();
    const [notifyOpen, setNotifyOpen] = useState(false);
    const [notifySubject, setNotifySubject] = useState("");
    const [notifyBody, setNotifyBody] = useState("");
    const [notifyChannel, setNotifyChannel] = useState<"email" | "whatsapp" | "in_app">("in_app");
    const handleNotifyAssignees = () => {
        if (!task || !notifySubject.trim() || !notifyBody.trim()) { toast.error("Subject and message are required"); return; }
        sendAnnouncement({
            subject: notifySubject.trim(),
            body: notifyBody.trim(),
            channel: notifyChannel,
            scope: "task_assignees",
            targetTaskId: task.id,
            sentBy: myEmployeeId,
        });
        toast.success("Announcement sent to task assignees");
        setNotifySubject(""); setNotifyBody(""); setNotifyOpen(false);
    };

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;

    if (!task) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mb-3 opacity-40" />
                <p className="text-lg font-medium">Task not found</p>
                <Button variant="ghost" className="mt-3" asChild>
                    <Link href={roleHref("/tasks")}><ArrowLeft className="h-4 w-4 mr-2" /> Back to Tasks</Link>
                </Button>
            </div>
        );
    }

    const sc = STATUS_CONFIG[task.status];
    const pc = PRIORITY_CONFIG[task.priority];
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !["verified", "cancelled"].includes(task.status);

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Back link */}
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2" asChild>
                <Link href={roleHref("/tasks")}><ArrowLeft className="h-4 w-4" /> Tasks</Link>
            </Button>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">{task.title}</h1>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className={`text-xs ${sc.color}`}>{sc.label}</Badge>
                        <Badge variant="secondary" className={`text-xs ${pc.color}`}>{pc.label}</Badge>
                        {task.completionRequired && <Badge variant="outline" className="text-xs gap-1"><Camera className="h-3 w-3" /> Proof Required</Badge>}
                        {task.tags?.map((tag) => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{task.id} · {group?.name}</p>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 shrink-0 flex-wrap">
                    {canAnnounce && task.assignedTo.length > 0 && (
                        <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-1.5"><Megaphone className="h-4 w-4" /> Notify Assignees</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-lg">
                                <DialogHeader><DialogTitle>📢 Notify Assignees</DialogTitle></DialogHeader>
                                <div className="space-y-4 pt-2">
                                    <p className="text-xs text-muted-foreground">Send an announcement to all {task.assignedTo.length} employee{task.assignedTo.length !== 1 ? "s" : ""} assigned to this task.</p>
                                    <div>
                                        <label className="text-sm font-medium">Channel</label>
                                        <Select value={notifyChannel} onValueChange={(v) => setNotifyChannel(v as "email" | "whatsapp" | "in_app")}>
                                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="in_app">🔔 In-App</SelectItem>
                                                <SelectItem value="email">✉️ Email (simulated)</SelectItem>
                                                <SelectItem value="whatsapp">💬 WhatsApp (simulated)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Subject</label>
                                        <Input value={notifySubject} onChange={(e) => setNotifySubject(e.target.value)} placeholder={`Re: ${task.title}`} className="mt-1" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Message</label>
                                        <Textarea value={notifyBody} onChange={(e) => setNotifyBody(e.target.value)} placeholder="Write your message to assignees..." className="mt-1" rows={4} />
                                    </div>
                                    <Button onClick={handleNotifyAssignees} className="w-full gap-1.5" disabled={!notifySubject.trim() || !notifyBody.trim()}>
                                        <Megaphone className="h-4 w-4" /> Send Announcement
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                    {canVerify && task.status !== "verified" && task.status !== "cancelled" && (
                        <Select value={task.status} onValueChange={(v) => { changeStatus(task.id, v as TaskStatus); toast.success(`Status changed to ${STATUS_CONFIG[v as TaskStatus].label}`); }}>
                            <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="cancelled">Cancel</SelectItem>
                            </SelectContent>
                        </Select>
                    )}
                    {isAssigned && ["open", "in_progress", "rejected"].includes(task.status) && (
                        <>
                            {task.status === "open" && (
                                <Button variant="outline" size="sm" onClick={() => { changeStatus(task.id, "in_progress"); toast.success("Marked as in progress"); }}>
                                    <ArrowUpRight className="h-4 w-4 mr-1.5" /> Start
                                </Button>
                            )}
                            <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm" className="gap-1.5"><CheckCircle2 className="h-4 w-4" /> Submit Completion</Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                                    <DialogHeader><DialogTitle>Submit Task Completion</DialogTitle></DialogHeader>
                                    <div className="space-y-4 pt-2">
                                        {task.completionRequired && (
                                            <>
                                                <div>
                                                    <label className="text-sm font-medium">Photo Proof *</label>
                                                    <div className="mt-2">
                                                        {photoData ? (
                                                            <div className="relative">
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img src={photoData} alt="Proof" className="rounded-lg border max-h-48 w-full object-cover" />
                                                                <Button variant="secondary" size="sm" className="absolute top-2 right-2" onClick={() => { setPhotoData(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                                                                    Change
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Button variant="outline" className="w-full h-24 gap-2" onClick={() => fileInputRef.current?.click()}>
                                                                <Camera className="h-5 w-5" /> Take Photo or Upload
                                                            </Button>
                                                        )}
                                                        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-sm font-medium">GPS Location</label>
                                                    <div className="mt-2">
                                                        {gpsData ? (
                                                            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                                                                <MapPin className="h-4 w-4" />
                                                                <span>{gpsData.lat.toFixed(4)}°N, {gpsData.lng.toFixed(4)}°E</span>
                                                                <span className="text-xs text-muted-foreground">(±{Math.round(gpsData.accuracy)}m)</span>
                                                            </div>
                                                        ) : (
                                                            <Button variant="outline" className="w-full gap-2" onClick={captureGPS} disabled={gpsLoading}>
                                                                <MapPin className="h-4 w-4" /> {gpsLoading ? "Getting location..." : "Capture Location"}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        <div>
                                            <label className="text-sm font-medium">Notes</label>
                                            <Textarea value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} placeholder="Any notes about the completed task..." className="mt-1" rows={3} />
                                        </div>
                                        <Button onClick={handleSubmitCompletion} className="w-full gap-1.5">
                                            <Send className="h-4 w-4" /> Submit for Review
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </>
                    )}
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Description */}
                    {task.description && (
                        <Card className="border border-border/50">
                            <CardHeader className="pb-2"><CardTitle className="text-sm">Description</CardTitle></CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Completion Report */}
                    {report && (
                        <Card className="border border-border/50">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm">Completion Report</CardTitle>
                                    {report.verifiedBy ? (
                                        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs gap-1">
                                            <CheckCircle2 className="h-3 w-3" /> Verified
                                        </Badge>
                                    ) : report.rejectionReason ? (
                                        <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs gap-1">
                                            <XCircle className="h-3 w-3" /> Rejected
                                        </Badge>
                                    ) : (
                                        <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs gap-1">
                                            <Eye className="h-3 w-3" /> Awaiting Review
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="text-xs text-muted-foreground">
                                    Submitted by <strong>{getEmpName(report.employeeId)}</strong> on {formatDate(report.submittedAt)}
                                </div>
                                {report.photoDataUrl && (
                                    <div>
                                        <p className="text-xs font-medium mb-1 flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Photo Proof</p>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={report.photoDataUrl} alt="Task proof" className="rounded-lg border max-h-64 w-full object-cover" />
                                    </div>
                                )}
                                {report.gpsLat != null && report.gpsLng != null && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                        <MapPin className="h-3.5 w-3.5" />
                                        <span>{report.reverseGeoAddress || `${report.gpsLat.toFixed(4)}°N, ${report.gpsLng.toFixed(4)}°E`}</span>
                                        {report.gpsAccuracyMeters && <span>(±{Math.round(report.gpsAccuracyMeters)}m)</span>}
                                    </div>
                                )}
                                {report.notes && <p className="text-sm text-muted-foreground">{report.notes}</p>}
                                {report.rejectionReason && (
                                    <div className="bg-red-50 dark:bg-red-900/20 rounded p-3 text-sm text-red-700 dark:text-red-400">
                                        <strong>Rejection reason:</strong> {report.rejectionReason}
                                    </div>
                                )}

                                {/* Verify / Reject buttons for admins */}
                                {canVerify && !report.verifiedBy && !report.rejectionReason && (
                                    <div className="flex gap-2 pt-2">
                                        <Button size="sm" className="gap-1.5" onClick={() => { verifyCompletion(report.id, myEmployeeId); toast.success("Task verified!"); }}>
                                            <CheckCircle2 className="h-4 w-4" /> Verify
                                        </Button>
                                        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                                            <DialogTrigger asChild>
                                                <Button variant="destructive" size="sm" className="gap-1.5"><XCircle className="h-4 w-4" /> Reject</Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader><DialogTitle>Reject Completion</DialogTitle></DialogHeader>
                                                <div className="space-y-4 pt-2">
                                                    <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Explain why this completion is being rejected..." rows={3} />
                                                    <Button variant="destructive" onClick={handleReject} className="w-full">Confirm Rejection</Button>
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Comments */}
                    <Card className="border border-border/50">
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Comments ({comments.length})</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            {comments.length === 0 && (
                                <p className="text-sm text-muted-foreground">No comments yet</p>
                            )}
                            {comments.map((c) => (
                                <div key={c.id} className="flex gap-3">
                                    <Avatar className="h-7 w-7 shrink-0">
                                        <AvatarFallback className="text-[9px] bg-muted">{getInitials(getEmpName(c.employeeId))}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">{getEmpName(c.employeeId)}</span>
                                            <span className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground mt-0.5">{c.message}</p>
                                    </div>
                                </div>
                            ))}
                            <Separator />
                            <div className="flex gap-2">
                                <Input
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    placeholder="Write a comment..."
                                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddComment()}
                                />
                                <Button size="sm" onClick={handleAddComment} disabled={!commentText.trim()}>
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    <Card className="border border-border/50">
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Details</CardTitle></CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Status</span>
                                <Badge variant="secondary" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Priority</span>
                                <Badge variant="secondary" className={`text-[10px] ${pc.color}`}>{pc.label}</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Group</span>
                                <span className="font-medium">{group?.name || "—"}</span>
                            </div>
                            {task.dueDate && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Due Date</span>
                                    <span className={isOverdue ? "text-red-600 font-medium" : "font-medium"}>
                                        {isOverdue && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}
                                        {formatDate(task.dueDate)}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Created</span>
                                <span>{formatDate(task.createdAt)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Created By</span>
                                <span>{getEmpName(task.createdBy)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border border-border/50">
                        <CardHeader className="pb-2"><CardTitle className="text-sm">Assigned To</CardTitle></CardHeader>
                        <CardContent>
                            {task.assignedTo.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No one assigned</p>
                            ) : (
                                <div className="space-y-2">
                                    {task.assignedTo.map((empId) => {
                                        const emp = employees.find((e) => e.id === empId);
                                        return (
                                            <div key={empId} className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6">
                                                    <AvatarFallback className="text-[8px] bg-muted">{getInitials(emp?.name || empId)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-medium">{emp?.name || empId}</p>
                                                    <p className="text-xs text-muted-foreground">{emp?.department}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
