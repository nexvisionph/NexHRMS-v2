"use client";

import { useState, useMemo } from "react";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useDocumentsStore, REQUIRED_201_DOC_TYPES } from "@/store/documents.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
    FolderArchive, Search, Upload, CheckCircle2, XCircle,
    FileText, Clock, AlertTriangle, ShieldCheck, TrendingUp,
} from "lucide-react";
import { getInitials } from "@/lib/format";
import { toast } from "sonner";
import type {
    Employee201Document, Employee201DocType, Document201Visibility,
} from "@/types";

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

const VISIBILITY_OPTIONS: Document201Visibility[] = [
    "hr_only", "manager", "employee", "payroll", "admin_only",
];

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

export default function Documents201AdminView() {
    const { employees } = useEmployeesStore();
    const currentUser = useAuthStore((s) => s.currentUser);
    const docs = useDocumentsStore((s) => s.documents);
    const upload = useDocumentsStore((s) => s.upload);
    const approve = useDocumentsStore((s) => s.approve);
    const reject = useDocumentsStore((s) => s.reject);
    const archive = useDocumentsStore((s) => s.archive);
    const setVisibility = useDocumentsStore((s) => s.setVisibility);
    const getStats = useDocumentsStore((s) => s.getStats);
    const getMissing = useDocumentsStore((s) => s.getMissingForEmployee);
    const getCompleteness = useDocumentsStore((s) => s.getCompletenessForEmployee);
    const getByEmployee = useDocumentsStore((s) => s.getByEmployee);

    // Compute stats in a memo so the selector never returns a new object reference
    // on every render (which would cause an infinite re-render loop).
    const stats = useMemo(() => getStats(), [docs, getStats]);

    const [search, setSearch] = useState("");
    const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadForm, setUploadForm] = useState({
        documentType: "employment_contract" as Employee201DocType,
        documentTitle: "",
        visibility: "hr_only" as Document201Visibility,
        expiryDate: "",
        remarks: "",
        filePath: "",
    });
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    const filteredEmployees = useMemo(() => {
        const q = search.trim().toLowerCase();
        return employees
            .filter((e) => e.status === "active")
            .filter((e) => !q || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.id.toLowerCase().includes(q))
            .map((e) => ({
                emp: e,
                completeness: getCompleteness(e.id),
                missing: getMissing(e.id),
                docCount: getByEmployee(e.id).length,
            }))
            .sort((a, b) => a.completeness - b.completeness);
    }, [employees, search, docs, getCompleteness, getMissing, getByEmployee]);

    const selectedEmp = selectedEmpId ? employees.find((e) => e.id === selectedEmpId) : null;
    const selectedDocs = selectedEmpId ? getByEmployee(selectedEmpId) : [];
    const selectedMissing = selectedEmpId ? getMissing(selectedEmpId) : [];

    const handleUpload = () => {
        if (!selectedEmpId) return;
        if (!uploadForm.documentTitle.trim()) {
            toast.error("Document title is required");
            return;
        }
        upload({
            employeeId: selectedEmpId,
            documentType: uploadForm.documentType,
            documentTitle: uploadForm.documentTitle.trim(),
            visibility: uploadForm.visibility,
            expiryDate: uploadForm.expiryDate || undefined,
            remarks: uploadForm.remarks || undefined,
            filePath: uploadForm.filePath || undefined,
            uploadedBy: currentUser.id,
            status: "for_review",
        });
        toast.success("Document uploaded — awaiting review");
        setUploadOpen(false);
        setUploadForm({
            documentType: "employment_contract",
            documentTitle: "",
            visibility: "hr_only",
            expiryDate: "",
            remarks: "",
            filePath: "",
        });
    };

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <FolderArchive className="h-6 w-6 text-primary" /> 201 Files
                    </h1>
                    <p className="text-sm text-muted-foreground">Centralized employee document repository</p>
                </div>
            </div>

            {/* Summary card */}
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

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search employee by name, email or ID…"
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Employee table */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Employees</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Employee</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead className="w-[200px]">Completeness</TableHead>
                                    <TableHead>Documents</TableHead>
                                    <TableHead>Missing</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEmployees.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                            No employees found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredEmployees.map(({ emp, completeness, missing, docCount }) => {
                                        const pct = Math.round(completeness * 100);
                                        const tone = pct >= 100 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500";
                                        return (
                                            <TableRow key={emp.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9">
                                                            <AvatarFallback>{getInitials(emp.name)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <div className="font-medium">{emp.name}</div>
                                                            <div className="text-xs text-muted-foreground">{emp.email}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm">{emp.department}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                                            <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
                                                        </div>
                                                        <span className="text-xs font-medium w-10 text-right">{pct}%</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell><Badge variant="secondary">{docCount}</Badge></TableCell>
                                                <TableCell>
                                                    {missing.length === 0 ? (
                                                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0">
                                                            <ShieldCheck className="h-3 w-3 mr-1" /> Complete
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">{missing.length} of {REQUIRED_201_DOC_TYPES.length} missing</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button size="sm" variant="outline" onClick={() => setSelectedEmpId(emp.id)}>
                                                        Open
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Drilldown dialog */}
            <Dialog open={!!selectedEmp} onOpenChange={(o) => !o && setSelectedEmpId(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    {selectedEmp && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <FolderArchive className="h-5 w-5" /> {selectedEmp.name} — 201 File
                                </DialogTitle>
                            </DialogHeader>

                            {/* Missing list */}
                            {selectedMissing.length > 0 && (
                                <Card className="border-amber-200 bg-amber-50">
                                    <CardContent className="pt-4 pb-3">
                                        <div className="text-sm font-medium text-amber-900 mb-2 flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4" /> Missing required documents
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedMissing.map((t) => (
                                                <Badge key={t} variant="outline" className="border-amber-300 text-amber-900">
                                                    {DOC_TYPE_LABELS[t]}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            <div className="flex justify-end">
                                <Button onClick={() => setUploadOpen(true)} size="sm">
                                    <Upload className="h-4 w-4 mr-2" /> Upload Document
                                </Button>
                            </div>

                            {/* Documents table */}
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Title</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Visibility</TableHead>
                                            <TableHead>Expiry</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedDocs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                                                    No documents on file yet.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            selectedDocs.map((d) => (
                                                <TableRow key={d.id}>
                                                    <TableCell className="font-medium">{d.documentTitle}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{DOC_TYPE_LABELS[d.documentType]}</TableCell>
                                                    <TableCell><StatusBadge status={d.status} /></TableCell>
                                                    <TableCell>
                                                        <Select value={d.visibility} onValueChange={(v) => setVisibility(d.id, v as Document201Visibility)}>
                                                            <SelectTrigger className="h-7 text-xs w-[110px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {VISIBILITY_OPTIONS.map((v) => (
                                                                    <SelectItem key={v} value={v}>{v.replace("_", " ")}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell className="text-xs">{d.expiryDate ?? "—"}</TableCell>
                                                    <TableCell className="text-right space-x-1">
                                                        {(d.status === "for_review" || d.status === "uploaded") && (
                                                            <>
                                                                <Button size="sm" variant="outline" className="h-7 px-2 text-emerald-700"
                                                                    onClick={() => { approve(d.id, currentUser.id); toast.success("Document approved"); }}>
                                                                    Approve
                                                                </Button>
                                                                <Button size="sm" variant="outline" className="h-7 px-2 text-red-700"
                                                                    onClick={() => { setRejectingId(d.id); setRejectReason(""); }}>
                                                                    Reject
                                                                </Button>
                                                            </>
                                                        )}
                                                        {d.status !== "archived" && (
                                                            <Button size="sm" variant="ghost" className="h-7 px-2"
                                                                onClick={() => { archive(d.id, currentUser.id); toast.success("Archived"); }}>
                                                                Archive
                                                            </Button>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Upload dialog */}
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
                                    {(Object.keys(DOC_TYPE_LABELS) as Employee201DocType[]).map((t) => (
                                        <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Document Title</Label>
                            <Input value={uploadForm.documentTitle}
                                onChange={(e) => setUploadForm((f) => ({ ...f, documentTitle: e.target.value }))}
                                placeholder="e.g. Employment Contract — signed Jan 2024" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Visibility</Label>
                                <Select value={uploadForm.visibility}
                                    onValueChange={(v) => setUploadForm((f) => ({ ...f, visibility: v as Document201Visibility }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {VISIBILITY_OPTIONS.map((v) => (
                                            <SelectItem key={v} value={v}>{v.replace("_", " ")}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Expiry (optional)</Label>
                                <Input type="date" value={uploadForm.expiryDate}
                                    onChange={(e) => setUploadForm((f) => ({ ...f, expiryDate: e.target.value }))} />
                            </div>
                        </div>
                        <div>
                            <Label>File Path / URL (optional)</Label>
                            <Input value={uploadForm.filePath}
                                onChange={(e) => setUploadForm((f) => ({ ...f, filePath: e.target.value }))}
                                placeholder="employee-documents/EMP-123/contract.pdf" />
                            <p className="text-xs text-muted-foreground mt-1">
                                Storage upload UI is coming. For now, paste the path of an already-uploaded file.
                            </p>
                        </div>
                        <div>
                            <Label>Remarks (optional)</Label>
                            <Textarea value={uploadForm.remarks}
                                onChange={(e) => setUploadForm((f) => ({ ...f, remarks: e.target.value }))} rows={2} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpload}>Upload</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject dialog */}
            <Dialog open={!!rejectingId} onOpenChange={(o) => !o && setRejectingId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Document</DialogTitle>
                    </DialogHeader>
                    <div>
                        <Label>Reason</Label>
                        <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3}
                            placeholder="Explain why this document is being rejected…" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectingId(null)}>Cancel</Button>
                        <Button variant="destructive" disabled={!rejectReason.trim()}
                            onClick={() => {
                                if (rejectingId) {
                                    reject(rejectingId, currentUser.id, rejectReason.trim());
                                    toast.success("Document rejected");
                                    setRejectingId(null);
                                }
                            }}>Reject</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

type DocAccent = "amber" | "orange" | "red" | "emerald" | "muted";
const DOC_ACCENT_STYLES: Record<DocAccent, { value: string; icon: string; dot: string }> = {
    amber:   { value: "text-amber-600",   icon: "text-amber-500",   dot: "bg-amber-500" },
    orange:  { value: "text-orange-600",  icon: "text-orange-500",  dot: "bg-orange-500" },
    red:     { value: "text-red-600",     icon: "text-red-500",     dot: "bg-red-500" },
    emerald: { value: "text-emerald-600", icon: "text-emerald-500", dot: "bg-emerald-500" },
    muted:   { value: "text-muted-foreground", icon: "text-muted-foreground/60", dot: "bg-muted-foreground/40" },
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
                {value > 0 && <span className={`mb-0.5 h-1.5 w-1.5 rounded-full ${s.dot}`} />}
            </div>
        </div>
    );
}

