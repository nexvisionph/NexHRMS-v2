"use client";

import { useState, useMemo, useEffect } from "react";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useDocumentsStore, REQUIRED_201_DOC_TYPES } from "@/store/documents.store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    FolderArchive, Search, Upload, CheckCircle2, XCircle,
    FileText, Clock, AlertTriangle, ShieldCheck, TrendingUp,
    ChevronLeft, ChevronRight, Eye, Download, X, Loader2, Pencil, Trash2,
} from "lucide-react";
import { getInitials } from "@/lib/format";
import { toast } from "sonner";
import type {
    Employee201Document, Employee201DocType, Document201Visibility,
} from "@/types";
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

const VISIBILITY_OPTIONS: Document201Visibility[] = [
    "hr_only", "manager", "employee", "payroll", "admin_only",
];

const ITEMS_PER_PAGE = 10;
const PAGE_SIZES = [10, 20, 50];

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
    const updateDocument = useDocumentsStore((s) => s.updateDocument);
    const removeDoc = useDocumentsStore((s) => s.remove);
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
    const [departmentFilter, setDepartmentFilter] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(ITEMS_PER_PAGE);
    const [isHydrated, setIsHydrated] = useState(false);
    const [hydrationTimedOut, setHydrationTimedOut] = useState(false);

    // Hydration detection (Req 11.1–11.5)
    // The documents store is hydrated via the sync service (hydrateAllStores),
    // not via Zustand persist middleware. We detect hydration by checking if
    // the component has mounted on the client (stores are populated on login/mount).
    useEffect(() => {
        // If employees are already loaded, hydration is complete
        if (employees.length > 0 || docs.length > 0) {
            setIsHydrated(true);
            return;
        }

        // Subscribe to store changes to detect when hydration completes
        const unsubEmployees = useEmployeesStore.subscribe((state) => {
            if (state.employees.length > 0) {
                setIsHydrated(true);
            }
        });
        const unsubDocs = useDocumentsStore.subscribe((state) => {
            if (state.documents.length > 0) {
                setIsHydrated(true);
            }
        });

        // 30-second timeout fallback for stalled hydration (Req 11.5)
        const timeout = setTimeout(() => {
            setIsHydrated((prev) => {
                if (!prev) setHydrationTimedOut(true);
                return prev;
            });
        }, 30_000);

        // Also mark hydrated after a short delay if stores remain empty
        // (legitimate case: no employees/documents exist yet)
        const emptyCheck = setTimeout(() => {
            setIsHydrated(true);
        }, 2_000);

        return () => {
            unsubEmployees();
            unsubDocs();
            clearTimeout(timeout);
            clearTimeout(emptyCheck);
        };
    }, []);

    const uniqueDepartments = useMemo(() =>
        [...new Set(
            employees.filter(e => e.status === "active").map(e => e.department).filter(Boolean)
        )].sort(),
    [employees]);

    // Reset page to 1 whenever filters change (Req 5.4, 8.1, 8.2, 8.3)
    useEffect(() => {
        setCurrentPage(1);
    }, [departmentFilter, search, pageSize]);

    const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
    // uploadEmpId is set when Upload is triggered directly from the employee row
    // (without opening the drilldown). handleUpload resolves: uploadEmpId ?? selectedEmpId.
    const [uploadEmpId, setUploadEmpId] = useState<string | null>(null);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadFiles, setUploadFiles] = useState<UploadedFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadForm, setUploadForm] = useState({
        documentType: "" as Employee201DocType | "",
        documentTitle: "",
        visibility: "hr_only" as Document201Visibility,
        expiryDate: "",
        remarks: "",
    });
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [editingDoc, setEditingDoc] = useState<Employee201Document | null>(null);
    const [editForm, setEditForm] = useState({ documentTitle: "", expiryDate: "", remarks: "" });
    const [deletingDoc, setDeletingDoc] = useState<Employee201Document | null>(null);

    // ── Upload Logs tab state ──
    const [logSearch, setLogSearch] = useState("");
    const [logStatusFilter, setLogStatusFilter] = useState<string>("all");
    const [logPage, setLogPage] = useState(1);
    const [logPageSize, setLogPageSize] = useState(ITEMS_PER_PAGE);
    const [viewingDoc, setViewingDoc] = useState<Employee201Document | null>(null);
    const [previewDoc, setPreviewDoc] = useState<Employee201Document | null>(null);
    const [logRejectingId, setLogRejectingId] = useState<string | null>(null);
    const [logRejectReason, setLogRejectReason] = useState("");

    // Reset log page on filter change
    useEffect(() => {
        setLogPage(1);
    }, [logSearch, logStatusFilter, logPageSize]);

    const empMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

    // Upload logs: all non-archived docs, sorted newest first
    const uploadLogs = useMemo(() => {
        const q = logSearch.trim().toLowerCase();
        return docs
            .filter((d) => d.status !== "archived")
            .filter((d) => {
                if (logStatusFilter === "all") return true;
                return d.status === logStatusFilter;
            })
            .filter((d) => {
                if (!q) return true;
                const emp = empMap.get(d.employeeId);
                const name = emp?.name?.toLowerCase() ?? "";
                return (
                    name.includes(q) ||
                    d.documentTitle.toLowerCase().includes(q) ||
                    d.documentType.replace(/_/g, " ").includes(q)
                );
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [docs, logSearch, logStatusFilter, empMap]);

    const logTotalPages = Math.max(1, Math.ceil(uploadLogs.length / logPageSize));

    useEffect(() => {
        if (logPage > logTotalPages) setLogPage(logTotalPages);
    }, [logPage, logTotalPages]);

    const paginatedLogs = uploadLogs.slice(
        (logPage - 1) * logPageSize,
        logPage * logPageSize
    );

    const filteredEmployees = useMemo(() => {
        const q = search.trim().toLowerCase();
        return employees
            .filter((e) => e.status === "active")
            .filter((e) => {
                if (departmentFilter === "all") return true;
                if (!e.department) return false;
                return e.department === departmentFilter;
            })
            .filter((e) => !q || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.id.toLowerCase().includes(q))
            .map((e) => ({
                emp: e,
                completeness: getCompleteness(e.id),
                missing: getMissing(e.id),
                docCount: getByEmployee(e.id).length,
            }))
            .sort((a, b) => a.completeness - b.completeness);
    }, [employees, search, departmentFilter, docs, getCompleteness, getMissing, getByEmployee]);

    const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));

    // Clamp currentPage to totalPages when it exceeds after filter changes
    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const paginatedEmployees = filteredEmployees.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    const selectedEmp = selectedEmpId ? employees.find((e) => e.id === selectedEmpId) : null;
    const selectedDocs = selectedEmpId ? getByEmployee(selectedEmpId) : [];
    const selectedMissing = selectedEmpId ? getMissing(selectedEmpId) : [];

    const handleUpload = async () => {
        const targetEmpId = uploadEmpId ?? selectedEmpId;
        if (!targetEmpId) return;
        if (!uploadForm.documentType) {
            toast.error("Please select a document type");
            return;
        }
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
            const result = await uploadDocumentFiles(uploadFiles, targetEmpId);
            if (!result) {
                toast.error("File upload failed");
                return;
            }

            upload({
                employeeId: targetEmpId,
                documentType: uploadForm.documentType as Employee201DocType,
                documentTitle: uploadForm.documentTitle.trim(),
                visibility: uploadForm.visibility,
                expiryDate: uploadForm.expiryDate || undefined,
                remarks: uploadForm.remarks || undefined,
                filePath: result.paths.join(","),
                fileType: result.fileType,
                fileSize: result.totalSize,
                uploadedBy: currentUser.id,
                status: "for_review",
            });
            toast.success("Document uploaded — awaiting review");
            setUploadOpen(false);
            setUploadEmpId(null);
            setUploadFiles([]);
            setUploadForm({
                documentType: "",
                documentTitle: "",
                visibility: "hr_only",
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
                        201 Files
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

            {/* ── Tabs ──────────────────────────────────────────── */}
            <Tabs defaultValue="201files" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="201files">201 Files</TabsTrigger>
                    <TabsTrigger value="upload-logs">
                        Upload Logs
                        {stats.forReview > 0 && (
                            <Badge className="ml-2 bg-amber-500 text-white hover:bg-amber-500 border-0 h-5 px-1.5 text-[10px]">{stats.forReview}</Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* ════════════ TAB 1: 201 Files (existing) ════════════ */}
                <TabsContent value="201files" className="space-y-4">
                    {/* Search + Department Filter */}
                    <div className="flex items-center gap-3">
                        <div className="relative max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search employee by name, email or ID…"
                                className="pl-9"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="All Departments" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Departments</SelectItem>
                                {uniqueDepartments.map((dept) => (
                                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Employee table */}
                    <Card>
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
                                        {!isHydrated && hydrationTimedOut ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center text-destructive py-8">
                                                    Employee data could not be loaded
                                                </TableCell>
                                            </TableRow>
                                        ) : !isHydrated ? (
                                            <TableSkeleton />
                                        ) : paginatedEmployees.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                                    No employees found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            paginatedEmployees.map(({ emp, completeness, missing, docCount }) => {
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
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button size="icon" variant="ghost" className="h-8 w-8" title="View 201 file" onClick={() => setSelectedEmpId(emp.id)}>
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                                <Button size="icon" variant="ghost" className="h-8 w-8" title="Upload document" onClick={() => { setUploadEmpId(emp.id); setUploadOpen(true); }}>
                                                                    <Upload className="h-4 w-4" />
                                                                </Button>
                                                                <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit documents" onClick={() => setSelectedEmpId(emp.id)}>
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete documents" onClick={() => setSelectedEmpId(emp.id)}>
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
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

                    {/* Pagination footer */}
                    {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Rows per page:</span>
                                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                                    <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                                    <SelectContent>{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
                                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}><ChevronRight className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    )}
                </TabsContent>

                {/* ════════════ TAB 2: Upload Logs ════════════ */}
                <TabsContent value="upload-logs" className="space-y-4">
                    {/* Search + Status filter */}
                    <div className="flex items-center gap-3">
                        <div className="relative max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by employee name or document…"
                                className="pl-9"
                                value={logSearch}
                                onChange={(e) => setLogSearch(e.target.value)}
                            />
                        </div>
                        <Select value={logStatusFilter} onValueChange={setLogStatusFilter}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="uploaded">Uploaded</SelectItem>
                                <SelectItem value="for_review">For Review</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Upload logs table */}
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Employee</TableHead>
                                            <TableHead>Document</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Date Uploaded</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedLogs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                                    No upload logs found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            paginatedLogs.map((d) => {
                                                const emp = empMap.get(d.employeeId);
                                                return (
                                                    <TableRow key={d.id}>
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                <Avatar className="h-8 w-8">
                                                                    <AvatarFallback className="text-xs">{getInitials(emp?.name ?? "?")}</AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <div className="font-medium text-sm">{emp?.name ?? d.employeeId}</div>
                                                                    <div className="text-xs text-muted-foreground">{emp?.department ?? ""}</div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div>
                                                                <div className="text-sm font-medium">{d.documentTitle}</div>
                                                                <div className="text-xs text-muted-foreground">{DOC_TYPE_LABELS[d.documentType]}</div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell><StatusBadge status={d.status} /></TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {new Date(d.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-0.5">
                                                                <Button size="sm" variant="ghost" className="h-7 px-2" title="View" onClick={() => setViewingDoc(d)}>
                                                                    <Eye className="h-3.5 w-3.5" />
                                                                </Button>
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
                                                                <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:text-destructive" title="Delete"
                                                                    onClick={() => setDeletingDoc(d)}>
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
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

                    {/* Upload logs pagination */}
                    {logTotalPages > 1 && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Rows per page:</span>
                                <Select value={String(logPageSize)} onValueChange={(v) => { setLogPageSize(Number(v)); setLogPage(1); }}>
                                    <SelectTrigger className="w-[70px] h-8"><SelectValue /></SelectTrigger>
                                    <SelectContent>{PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Page {logPage} of {logTotalPages}</span>
                                <Button variant="outline" size="icon" className="h-8 w-8" disabled={logPage <= 1} onClick={() => setLogPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
                                <Button variant="outline" size="icon" className="h-8 w-8" disabled={logPage >= logTotalPages} onClick={() => setLogPage((p) => Math.min(logTotalPages, p + 1))}><ChevronRight className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* ── Employee drilldown dialog ─────────────────────── */}
            <Dialog open={!!selectedEmp} onOpenChange={(o) => !o && setSelectedEmpId(null)}>
                <DialogContent className="max-w-5xl max-h-[80vh] flex flex-col overflow-hidden">
                    {selectedEmp && (
                        <>
                            <DialogHeader className="shrink-0">
                                <DialogTitle className="flex items-center gap-2">
                                    <FolderArchive className="h-5 w-5" /> {selectedEmp.name} — 201 File
                                </DialogTitle>
                            </DialogHeader>

                            {/* Missing list */}
                            {selectedMissing.length > 0 && (
                                <Card className="border-amber-200 bg-amber-50 shrink-0">
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

                            {/* Documents table — scrollable within the fixed-height modal */}
                            <div className="border rounded-md overflow-auto flex-1 min-h-0">
                                <Table className="table-fixed w-full">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[28%]">Title</TableHead>
                                            <TableHead className="w-[18%]">Type</TableHead>
                                            <TableHead className="w-[24%]">Status</TableHead>
                                            <TableHead className="w-[18%]">Visibility</TableHead>
                                            <TableHead className="w-[12%]">Expiry</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedDocs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                                    No documents on file yet.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            selectedDocs.map((d) => (
                                                <TableRow key={d.id}>
                                                    <TableCell className="font-medium truncate max-w-0">{d.documentTitle}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground truncate max-w-0">{DOC_TYPE_LABELS[d.documentType]}</TableCell>
                                                    <TableCell><StatusBadge status={d.status} /></TableCell>
                                                    <TableCell className="text-xs capitalize">{d.visibility.replace(/_/g, " ")}</TableCell>
                                                    <TableCell className="text-xs">{d.expiryDate ?? "—"}</TableCell>
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

            {/* ── Upload dialog ─────────────────────────────────── */}
            <Dialog open={uploadOpen} onOpenChange={(o) => { setUploadOpen(o); if (!o) setUploadEmpId(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload 201 Document</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label>Document Type</Label>
                            <Select value={uploadForm.documentType}
                                onValueChange={(v) => setUploadForm((f) => ({ ...f, documentType: v as Employee201DocType }))}>
                                <SelectTrigger><SelectValue placeholder="Select document type" /></SelectTrigger>
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
                            <Label>Files</Label>
                            <DocumentFileUpload
                                files={uploadFiles}
                                onChange={setUploadFiles}
                                disabled={uploading}
                            />
                        </div>
                        <div>
                            <Label>Remarks (optional)</Label>
                            <Textarea
                                value={uploadForm.remarks}
                                onChange={(e) => setUploadForm((f) => ({ ...f, remarks: e.target.value }))}
                                rows={5}
                                className="resize-none overflow-y-auto"
                                placeholder="Any notes or context for this document…"
                            />
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

            {/* ── Reject dialog (employee drilldown) ────────────── */}
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

            {/* ── View Document modal (Upload Logs) ─────────────── */}
            <Dialog open={!!viewingDoc} onOpenChange={(o) => !o && setViewingDoc(null)}>
                <DialogContent className="max-w-lg">
                    {viewingDoc && (() => {
                        const emp = empMap.get(viewingDoc.employeeId);
                        return (
                            <>
                                <DialogHeader>
                                    <DialogTitle>Document Details</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                    {/* Summary grid */}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                        <div>
                                            <p className="text-xs text-muted-foreground">Employee</p>
                                            <p className="font-medium">{emp?.name ?? viewingDoc.employeeId}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Status</p>
                                            <StatusBadge status={viewingDoc.status} />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Document Type</p>
                                            <p className="font-medium">{DOC_TYPE_LABELS[viewingDoc.documentType]}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Document Title</p>
                                            <p className="font-medium">{viewingDoc.documentTitle}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Visibility</p>
                                            <p className="capitalize">{viewingDoc.visibility.replace("_", " ")}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Expiry Date</p>
                                            <p>{viewingDoc.expiryDate ?? "—"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Uploaded</p>
                                            <p>{new Date(viewingDoc.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">Uploaded By</p>
                                            <p>{viewingDoc.uploadedBy ? (empMap.get(viewingDoc.uploadedBy)?.name ?? viewingDoc.uploadedBy) : "—"}</p>
                                        </div>
                                        {viewingDoc.remarks && (
                                            <div className="col-span-2">
                                                <p className="text-xs text-muted-foreground">Remarks</p>
                                                <p className="text-sm">{viewingDoc.remarks}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* File section */}
                                    {viewingDoc.filePath && (
                                        <Card className="border">
                                            <CardContent className="p-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        <button
                                                            className="text-sm text-primary hover:underline truncate cursor-pointer"
                                                            onClick={() => { setViewingDoc(null); setPreviewDoc(viewingDoc); }}
                                                        >
                                                            {viewingDoc.filePath.split(",")[0].split("/").pop() ?? viewingDoc.filePath}
                                                        </button>
                                                    </div>
                                                    <Button size="sm" variant="ghost" className="h-7 px-2 shrink-0" onClick={() => { setViewingDoc(null); setPreviewDoc(viewingDoc); }}>
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                                <DialogFooter>
                                    {(viewingDoc.status === "for_review" || viewingDoc.status === "uploaded") && (
                                        <>
                                            <Button
                                                variant="destructive"
                                                onClick={() => { setViewingDoc(null); setLogRejectingId(viewingDoc.id); setLogRejectReason(""); }}
                                            >
                                                Reject
                                            </Button>
                                            <Button
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                onClick={() => { approve(viewingDoc.id, currentUser.id); toast.success("Document approved"); setViewingDoc(null); }}
                                            >
                                                Approve
                                            </Button>
                                        </>
                                    )}
                                    <Button variant="outline" onClick={() => setViewingDoc(null)}>Close</Button>
                                </DialogFooter>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* ── Reject dialog (Upload Logs) ───────────────────── */}
            <Dialog open={!!logRejectingId} onOpenChange={(o) => !o && setLogRejectingId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Document</DialogTitle>
                    </DialogHeader>
                    <div>
                        <Label>Reason</Label>
                        <Textarea value={logRejectReason} onChange={(e) => setLogRejectReason(e.target.value)} rows={3}
                            placeholder="Explain why this document is being rejected…" />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setLogRejectingId(null)}>Cancel</Button>
                        <Button variant="destructive" disabled={!logRejectReason.trim()}
                            onClick={() => {
                                if (logRejectingId) {
                                    reject(logRejectingId, currentUser.id, logRejectReason.trim());
                                    toast.success("Document rejected");
                                    setLogRejectingId(null);
                                }
                            }}>Reject</Button>
                    </DialogFooter>
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
                                onChange={(e) => setEditForm((f) => ({ ...f, remarks: e.target.value }))} rows={3}
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

            {/* ── File Preview modal ────────────────────────────── */}
            <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
                <DialogContent className="max-w-3xl">
                    {previewDoc && <AdminFilePreviewContent doc={previewDoc} empMap={empMap} />}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function AdminFilePreviewContent({ doc, empMap }: { doc: Employee201Document; empMap: Map<string, { name: string }> }) {
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

                {/* Preview area — fixed height, no scroll */}
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
                        <p className="text-xs text-muted-foreground">Employee</p>
                        <p>{empMap.get(doc.employeeId)?.name ?? doc.employeeId}</p>
                    </div>
                </div>
            </div>
        </>
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
            </div>
        </div>
    );
}

function TableSkeleton() {
    return (
        <>
            {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                    <TableCell>
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-9 w-9 rounded-full" />
                            <div className="space-y-1.5">
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-3 w-36" />
                            </div>
                        </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-2 flex-1 rounded-full" />
                            <Skeleton className="h-3 w-8" />
                        </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-5 w-8 rounded-md" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-14 ml-auto rounded-md" /></TableCell>
                </TableRow>
            ))}
        </>
    );
}
