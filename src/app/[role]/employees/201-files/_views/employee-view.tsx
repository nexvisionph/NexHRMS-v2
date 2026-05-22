"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useDocumentsStore, REQUIRED_201_DOC_TYPES } from "@/store/documents.store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    FileText, Clock, AlertTriangle, ShieldCheck, TrendingUp,
    CheckCircle2, Upload, HelpCircle, Info, XCircle, Loader2, Eye, Download,
    Pencil, Trash2, Search,
} from "lucide-react";
import { toast } from "sonner";
import type { Employee201Document, Employee201DocType } from "@/types";
import { DocumentFileUpload, uploadDocumentFiles, type UploadedFile } from "../_components/document-file-upload";
import { useSignedUrl } from "../_components/use-signed-url";

const DOC_TYPE_LABELS: Record<Employee201DocType, string> = {
    personal_info: "Personal Info Sheet",
    employment_contract: "Employment Contract",
    government_id: "Government ID",
    resume: "Resume / CV",
    application_form: "Application Form",
    job_offer: "Job Offer Letter",
    medical: "Medical Clearance",
    training_certificate: "Training Certificate",
    performance_evaluation: "Performance Evaluation",
    payslip: "Payslip",
    leave_record: "Leave Record",
    warning: "Warning",
    nte: "NTE",
    nod: "NOD",
    clearance: "Clearance",
    resignation_letter: "Resignation Letter",
    coe: "Certificate of Employment",
    final_pay_document: "Final Pay Document",
    other: "Other",
};

function StatusBadge({ status }: { status: Employee201Document["status"] }) {
    const map: Record<Employee201Document["status"], string> = {
        pending_upload: "bg-slate-100 text-slate-700",
        uploaded: "bg-blue-100 text-blue-700",
        for_review: "bg-amber-100 text-amber-800",
        approved: "bg-emerald-100 text-emerald-800",
        rejected: "bg-red-100 text-red-700",
        expired: "bg-orange-100 text-orange-800",
        archived: "bg-zinc-100 text-zinc-600",
    };
    return <Badge className={`${map[status]} hover:${map[status]} border-0 capitalize`}>{status.replace("_", " ")}</Badge>;
}

// ── Allowed document types for employee self-upload ──────────
const EMPLOYEE_UPLOAD_TYPES: Employee201DocType[] = [
    "personal_info", "government_id", "resume", "application_form",
    "medical", "training_certificate", "clearance", "other",
];

export default function Documents201EmployeeView() {
    const currentUser = useAuthStore((s) => s.currentUser);
    const allDocs = useDocumentsStore((s) => s.documents);
    const upload = useDocumentsStore((s) => s.upload);
    const updateDocument = useDocumentsStore((s) => s.updateDocument);
    const removeDoc = useDocumentsStore((s) => s.remove);

    const [helpOpen, setHelpOpen] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);
    const [uploadFiles, setUploadFiles] = useState<UploadedFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<Employee201Document | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [editingDoc, setEditingDoc] = useState<Employee201Document | null>(null);
    const [editForm, setEditForm] = useState({ documentTitle: "", expiryDate: "", remarks: "" });
    const [deletingDoc, setDeletingDoc] = useState<Employee201Document | null>(null);
    const [uploadForm, setUploadForm] = useState({
        documentType: "government_id" as Employee201DocType,
        documentTitle: "",
        expiryDate: "",
        remarks: "",
    });

    // Hydration detection
    useEffect(() => {
        if (allDocs.length > 0) { setIsHydrated(true); return; }
        const unsub = useDocumentsStore.subscribe((state) => {
            if (state.documents.length > 0) setIsHydrated(true);
        });
        const fallback = setTimeout(() => setIsHydrated(true), 2_000);
        return () => { unsub(); clearTimeout(fallback); };
    }, []);

    // Employee sees own docs: visible-to-employee OR self-uploaded
    const myDocs = useMemo(() =>
        allDocs.filter(
            (d) =>
                d.employeeId === currentUser.id &&
                d.status !== "archived" &&
                (d.visibility === "employee" || d.uploadedBy === currentUser.id)
        ),
    [allDocs, currentUser.id]);

    // Filtered docs (search + status filter)
    const filteredDocs = useMemo(() => {
        let result = myDocs;
        if (statusFilter !== "all") {
            result = result.filter((d) => d.status === statusFilter);
        }
        const q = search.trim().toLowerCase();
        if (q) {
            result = result.filter((d) =>
                d.documentTitle.toLowerCase().includes(q) ||
                d.documentType.replace(/_/g, " ").toLowerCase().includes(q)
            );
        }
        return result;
    }, [myDocs, statusFilter, search]);

    const approvedTypes = useMemo(() =>
        new Set(myDocs.filter((d) => d.status === "approved").map((d) => d.documentType)),
    [myDocs]);

    const completePct = useMemo(() => {
        const met = REQUIRED_201_DOC_TYPES.filter((t) => approvedTypes.has(t)).length;
        return Math.round((met / REQUIRED_201_DOC_TYPES.length) * 100);
    }, [approvedTypes]);

    const missingRequired = useMemo(() =>
        REQUIRED_201_DOC_TYPES.filter((t) => !approvedTypes.has(t)),
    [approvedTypes]);

    const expiringCount = useMemo(() => {
        const now = Date.now();
        const cutoff = now + 30 * 86_400_000;
        return myDocs.filter((d) => {
            if (!d.expiryDate || d.status === "expired") return false;
            const t = Date.parse(d.expiryDate);
            return Number.isFinite(t) && t >= now && t <= cutoff;
        }).length;
    }, [myDocs]);

    const stats = useMemo(() => ({
        total: myDocs.length,
        forReview: myDocs.filter((d) => d.status === "for_review" || d.status === "uploaded").length,
        approved: myDocs.filter((d) => d.status === "approved").length,
        rejected: myDocs.filter((d) => d.status === "rejected").length,
        expiring30: expiringCount,
    }), [myDocs, expiringCount]);

    const tone = completePct >= 100 ? "bg-emerald-500" : completePct >= 60 ? "bg-amber-500" : "bg-red-500";

    const handleUpload = async () => {
        if (!uploadForm.documentTitle.trim()) {
            toast.error("Document title is required");
            return;
        }
        if (uploadFiles.length === 0) {
            toast.error("Please select at least one file to upload");
            return;
        }

        setUploading(true);
        try {
            const result = await uploadDocumentFiles(uploadFiles, currentUser.id);
            if (!result) {
                toast.error("File upload failed");
                return;
            }

            upload({
                employeeId: currentUser.id,
                documentType: uploadForm.documentType,
                documentTitle: uploadForm.documentTitle.trim(),
                visibility: "employee",
                expiryDate: uploadForm.expiryDate || undefined,
                remarks: uploadForm.remarks || undefined,
                filePath: result.paths.join(","),
                fileType: result.fileType,
                fileSize: result.totalSize,
                uploadedBy: currentUser.id,
                status: "for_review",
            });
            toast.success("Document uploaded — awaiting HR review");
            setUploadOpen(false);
            setUploadFiles([]);
            setUploadForm({
                documentType: "government_id",
                documentTitle: "",
                expiryDate: "",
                remarks: "",
            });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">
                        My 201 File
                    </h1>
                    <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">Your personal document records</p>
                        <button
                            onClick={() => setHelpOpen(true)}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
                        >
                            <HelpCircle className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
                <Button onClick={() => setUploadOpen(true)} size="sm">
                    <Upload className="h-4 w-4 mr-2" /> Upload Document
                </Button>
            </div>

            {/* Summary card — mirrors admin DocTile layout */}
            <Card className="border">
                <CardContent className="p-0">
                    <div className="flex items-center gap-3 border-b px-5 py-3.5">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold text-foreground">Document Overview</span>
                        <span className="ml-auto text-xs text-muted-foreground">{stats.total} document{stats.total !== 1 ? "s" : ""} on file</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 divide-y sm:divide-y-0 divide-x-0 sm:divide-x">
                        <DocTile label="For Review" value={stats.forReview} icon={Clock} accent={stats.forReview > 0 ? "amber" : "muted"} />
                        <DocTile label="Approved" value={stats.approved} icon={CheckCircle2} accent="emerald" />
                        <DocTile label="Rejected" value={stats.rejected} icon={XCircle} accent={stats.rejected > 0 ? "red" : "muted"} />
                        <DocTile label="Expiring in 30d" value={stats.expiring30} icon={AlertTriangle} accent={stats.expiring30 > 0 ? "orange" : "muted"} />
                        <DocTile label="Total on File" value={stats.total} icon={FileText} accent="muted" isLast />
                    </div>
                </CardContent>
            </Card>

            {/* Completeness */}
            <Card>
                <CardContent className="pt-5 pb-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <ShieldCheck className="h-4 w-4" /> Required Documents Completeness
                        </div>
                        <span className="text-sm font-bold tabular-nums">{completePct}%</span>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${tone} transition-all duration-500`} style={{ width: `${completePct}%` }} />
                    </div>
                    {missingRequired.length > 0 ? (
                        <div className="mt-3">
                            <p className="text-xs text-muted-foreground mb-2">
                                {missingRequired.length} of {REQUIRED_201_DOC_TYPES.length} required documents not yet on file:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {missingRequired.map((t) => (
                                    <Badge key={t} variant="outline" className="border-amber-300 text-amber-900 dark:text-amber-200 text-xs">
                                        {DOC_TYPE_LABELS[t]}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> All required documents are on file.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Documents table */}
            <Card>
                <CardContent className="p-0">
                    {/* Search + Status filter toolbar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 px-4 py-3 border-b">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search documents…"
                                className="pl-8 h-9"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full sm:w-[160px] h-9">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="for_review">For Review</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="uploaded">Uploaded</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Expiry</TableHead>
                                    <TableHead>Last Updated</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!isHydrated ? (
                                    <TableSkeleton />
                                ) : filteredDocs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                            {myDocs.length === 0
                                                ? "No documents on file yet. Upload your first document above."
                                                : "No documents match your search."}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredDocs.map((d) => (
                                        <TableRow key={d.id}>
                                            <TableCell className="font-medium">{d.documentTitle}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{DOC_TYPE_LABELS[d.documentType]}</TableCell>
                                            <TableCell><StatusBadge status={d.status} /></TableCell>
                                            <TableCell className="text-xs">
                                                {d.expiryDate ? <ExpiryCell date={d.expiryDate} /> : "—"}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {new Date(d.updatedAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-0.5">
                                                    {d.filePath && (
                                                        <Button size="sm" variant="ghost" className="h-7 px-2" title="View file" onClick={() => setPreviewDoc(d)}>
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                    {d.uploadedBy === currentUser.id && d.status !== "approved" && (
                                                        <>
                                                            <Button size="sm" variant="ghost" className="h-7 px-2" title="Edit" onClick={() => {
                                                                setEditingDoc(d);
                                                                setEditForm({
                                                                    documentTitle: d.documentTitle,
                                                                    expiryDate: d.expiryDate ?? "",
                                                                    remarks: d.remarks ?? "",
                                                                });
                                                            }}>
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" title="Delete" onClick={() => setDeletingDoc(d)}>
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* ── Upload dialog ─────────────────────────────────── */}
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload 201 Document</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label>Document Type</Label>
                            <Select value={uploadForm.documentType}
                                onValueChange={(v) => setUploadForm((f) => ({ ...f, documentType: v as Employee201DocType }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {EMPLOYEE_UPLOAD_TYPES.map((t) => (
                                        <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Document Title</Label>
                            <Input value={uploadForm.documentTitle}
                                onChange={(e) => setUploadForm((f) => ({ ...f, documentTitle: e.target.value }))}
                                placeholder="e.g. SSS ID — front and back scan" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Expiry (optional)</Label>
                                <Input type="date" value={uploadForm.expiryDate}
                                    onChange={(e) => setUploadForm((f) => ({ ...f, expiryDate: e.target.value }))} />
                            </div>
                        </div>
                        <div>
                            <Label>Files</Label>
                            <DocumentFileUpload
                                files={uploadFiles}
                                onChange={setUploadFiles}
                                disabled={uploading}
                            />
                        </div>
                        <div>
                            <Label>Remarks (optional)</Label>
                            <Textarea value={uploadForm.remarks}
                                onChange={(e) => setUploadForm((f) => ({ ...f, remarks: e.target.value }))} rows={2}
                                placeholder="Any notes for HR…" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>Cancel</Button>
                        <Button onClick={handleUpload} disabled={uploading}>
                            {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</> : "Upload"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── File Preview modal ────────────────────────────── */}
            <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
                <DialogContent className="max-w-3xl">
                    {previewDoc && <FilePreviewContent doc={previewDoc} />}
                </DialogContent>
            </Dialog>

            {/* ── Edit document dialog ──────────────────────────── */}
            <Dialog open={!!editingDoc} onOpenChange={(o) => !o && setEditingDoc(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Document</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label>Document Title</Label>
                            <Input value={editForm.documentTitle}
                                onChange={(e) => setEditForm((f) => ({ ...f, documentTitle: e.target.value }))}
                                placeholder="Document title" />
                        </div>
                        <div>
                            <Label>Expiry Date (optional)</Label>
                            <Input type="date" value={editForm.expiryDate}
                                onChange={(e) => setEditForm((f) => ({ ...f, expiryDate: e.target.value }))} />
                        </div>
                        <div>
                            <Label>Remarks (optional)</Label>
                            <Textarea value={editForm.remarks}
                                onChange={(e) => setEditForm((f) => ({ ...f, remarks: e.target.value }))} rows={2}
                                placeholder="Any notes…" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingDoc(null)}>Cancel</Button>
                        <Button onClick={() => {
                            if (!editingDoc) return;
                            if (!editForm.documentTitle.trim()) {
                                toast.error("Document title is required");
                                return;
                            }
                            updateDocument(editingDoc.id, {
                                documentTitle: editForm.documentTitle.trim(),
                                expiryDate: editForm.expiryDate || undefined,
                                remarks: editForm.remarks || undefined,
                            });
                            toast.success("Document updated");
                            setEditingDoc(null);
                        }}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete confirmation dialog ────────────────────── */}
            <Dialog open={!!deletingDoc} onOpenChange={(o) => !o && setDeletingDoc(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Document</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Are you sure you want to delete <strong className="text-foreground">{deletingDoc?.documentTitle}</strong>? This action cannot be undone.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletingDoc(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => {
                            if (!deletingDoc) return;
                            removeDoc(deletingDoc.id);
                            toast.success("Document deleted");
                            setDeletingDoc(null);
                        }}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Help modal ───────────────────────────────────── */}
            <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Info className="h-5 w-5 text-primary" /> What is a 201 File?
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 text-sm text-muted-foreground">
                        <p>
                            Your <strong className="text-foreground">201 file</strong> is your official employment
                            record maintained by HR. It is named after the traditional filing system used in
                            Philippine companies.
                        </p>
                        <p>It typically contains:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Employment contract</li>
                            <li>Government-issued IDs (SSS, PhilHealth, Pag-IBIG, TIN)</li>
                            <li>Resume / Application form</li>
                            <li>Medical clearance</li>
                            <li>Training certificates</li>
                            <li>Performance evaluations</li>
                            <li>Leave records and payslips</li>
                        </ul>
                        <p>
                            Only documents marked as <em>visible to you</em> by HR appear here.
                            You can also upload documents for HR review. Contact HR if you believe
                            a document is missing from your file.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setHelpOpen(false)}>Got it</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ── DocTile — matches admin-view styling ─────────────────── */

type DocAccent = "amber" | "orange" | "red" | "emerald" | "muted";
const DOC_ACCENT_STYLES: Record<DocAccent, { value: string; icon: string }> = {
    amber:   { value: "text-amber-600",   icon: "text-amber-500" },
    orange:  { value: "text-orange-600",  icon: "text-orange-500" },
    red:     { value: "text-red-600",     icon: "text-red-500" },
    emerald: { value: "text-emerald-600", icon: "text-emerald-500" },
    muted:   { value: "text-muted-foreground", icon: "text-muted-foreground/60" },
};

function DocTile({
    label, value, icon: Icon, accent, isLast = false,
}: {
    label: string; value: number; icon: typeof FileText;
    accent: DocAccent; isLast?: boolean;
}) {
    const s = DOC_ACCENT_STYLES[accent];
    return (
        <div className={`flex flex-col gap-3 px-5 py-4 ${isLast ? "" : "border-b sm:border-b-0 sm:border-r last:border-0"}`.trim()}>
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground leading-tight">{label}</p>
                <Icon className={`h-4 w-4 shrink-0 ${s.icon}`} />
            </div>
            <div className="flex items-end gap-2">
                <span className={`text-3xl font-bold tabular-nums leading-none ${s.value}`}>{value}</span>
            </div>
        </div>
    );
}

function ExpiryCell({ date }: { date: string }) {
    const ms = Date.parse(date);
    if (!Number.isFinite(ms)) return <span className="text-muted-foreground">—</span>;
    const daysLeft = Math.ceil((ms - Date.now()) / 86_400_000);
    if (daysLeft < 0) return <span className="text-red-600 font-medium">Expired</span>;
    if (daysLeft <= 30) return <span className="text-orange-600 font-medium">{new Date(date).toLocaleDateString()} ({daysLeft}d)</span>;
    return <span>{new Date(date).toLocaleDateString()}</span>;
}

function TableSkeleton() {
    return (
        <>
            {Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-md" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-7 w-7 ml-auto rounded-md" /></TableCell>
                </TableRow>
            ))}
        </>
    );
}

function FilePreviewContent({ doc }: { doc: Employee201Document }) {
    const { url: signedUrl, loading, error } = useSignedUrl(doc.filePath);
    const fileName = doc.filePath?.split(",")[0]?.split("/").pop() ?? doc.filePath;
    const isImage = fileName?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
    const isPdf = fileName?.match(/\.pdf$/i);

    return (
        <>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" /> {doc.documentTitle}
                </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
                {/* File info bar */}
                <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
                    <div className="text-sm truncate mr-3">
                        <span className="text-muted-foreground">File: </span>
                        <span className="font-mono text-xs">{fileName}</span>
                    </div>
                    {signedUrl && (
                        <Button size="sm" variant="outline" asChild className="shrink-0">
                            <a href={signedUrl} download={fileName} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4 mr-2" /> Download
                            </a>
                        </Button>
                    )}
                </div>

                {/* Preview area — fixed height */}
                <div className="border rounded-lg bg-muted/30 flex items-center justify-center h-[450px] overflow-hidden">
                    {loading ? (
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Loading preview…</p>
                        </div>
                    ) : error || !signedUrl ? (
                        <div className="text-center py-12">
                            <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                            <p className="text-sm text-muted-foreground mb-1">File not available for preview</p>
                            <p className="text-xs text-muted-foreground font-mono">{fileName}</p>
                        </div>
                    ) : isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={signedUrl}
                            alt={doc.documentTitle}
                            className="max-w-full max-h-full object-contain"
                        />
                    ) : isPdf ? (
                        <iframe
                            src={signedUrl}
                            className="w-full h-full rounded"
                            title={doc.documentTitle}
                        />
                    ) : (
                        <div className="text-center py-12">
                            <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                            <p className="text-sm text-muted-foreground mb-1">Preview not available for this file type</p>
                            <p className="text-xs text-muted-foreground font-mono">{fileName}</p>
                        </div>
                    )}
                </div>

                {/* Document metadata */}
                <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                        <p className="text-xs text-muted-foreground">Type</p>
                        <p>{DOC_TYPE_LABELS[doc.documentType]}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <StatusBadge status={doc.status} />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">Uploaded</p>
                        <p>{new Date(doc.createdAt).toLocaleDateString()}</p>
                    </div>
                </div>
                {doc.remarks && (
                    <div className="text-sm">
                        <p className="text-xs text-muted-foreground mb-1">Remarks</p>
                        <p className="text-muted-foreground">{doc.remarks}</p>
                    </div>
                )}
            </div>
        </>
    );
}
