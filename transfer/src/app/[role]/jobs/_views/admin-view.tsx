"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useJobsStore } from "@/store/jobs.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
    Briefcase, Plus, Search, Users, CheckCircle2, Clock, TrendingUp,
    MoreHorizontal, ChevronRight, MapPin, Building2, Banknote,
    CalendarDays, ArrowUpRight, UserCheck, XCircle, PauseCircle,
    FileText, Phone, Mail, Link as LinkIcon, ChevronDown, Inbox,
    Upload, Trash2, Download, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { DEPARTMENTS } from "@/lib/constants";
import type { JobPosting, JobApplication, JobStatus, JobType, JobPriority, ApplicationStatus } from "@/types";

// ── label maps ───────────────────────────────────────────────────────────────

const JOB_STATUS_LABELS: Record<JobStatus, string> = {
    draft: "Draft",
    open: "Open",
    on_hold: "On Hold",
    closed: "Closed",
};

const JOB_STATUS_STYLES: Record<JobStatus, string> = {
    draft: "bg-slate-100 text-slate-600",
    open: "bg-emerald-100 text-emerald-700",
    on_hold: "bg-amber-100 text-amber-700",
    closed: "bg-zinc-100 text-zinc-600",
};

const JOB_TYPE_LABELS: Record<JobType, string> = {
    full_time: "Full-time",
    part_time: "Part-time",
    contract: "Contract",
    internship: "Internship",
    freelance: "Freelance",
};

const JOB_PRIORITY_STYLES: Record<JobPriority, string> = {
    low: "bg-slate-100 text-slate-500",
    medium: "bg-blue-100 text-blue-700",
    high: "bg-orange-100 text-orange-700",
    urgent: "bg-red-100 text-red-700",
};

const APP_STATUS_LABELS: Record<ApplicationStatus, string> = {
    applied: "Applied",
    screening: "Screening",
    interview: "Interview",
    offer: "Offer Sent",
    hired: "Hired",
    rejected: "Rejected",
    withdrawn: "Withdrawn",
};

const APP_STATUS_STYLES: Record<ApplicationStatus, string> = {
    applied: "bg-slate-100 text-slate-600",
    screening: "bg-blue-100 text-blue-700",
    interview: "bg-purple-100 text-purple-700",
    offer: "bg-amber-100 text-amber-800",
    hired: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
    withdrawn: "bg-zinc-100 text-zinc-500",
};

const APP_STATUS_PIPELINE: ApplicationStatus[] = [
    "applied", "screening", "interview", "offer", "hired",
];

const SOURCES = [
    "LinkedIn", "JobStreet", "Indeed", "Referral", "Walk-in",
    "Company Website", "Kalibrr", "Facebook", "Other",
];

// ── small helpers ─────────────────────────────────────────────────────────────

function fmtSalary(min?: number, max?: number) {
    if (!min && !max) return null;
    const fmt = (n: number) =>
        n >= 1000 ? `₱${(n / 1000).toFixed(0)}k` : `₱${n.toLocaleString()}`;
    if (min && max) return `${fmt(min)} – ${fmt(max)}`;
    if (min) return `From ${fmt(min)}`;
    return `Up to ${fmt(max!)}`;
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-PH", {
        month: "short", day: "numeric", year: "numeric",
    });
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: JobStatus }) {
    return (
        <Badge className={`${JOB_STATUS_STYLES[status]} border-0 hover:${JOB_STATUS_STYLES[status]}`}>
            {JOB_STATUS_LABELS[status]}
        </Badge>
    );
}

function AppStatusBadge({ status }: { status: ApplicationStatus }) {
    return (
        <Badge className={`${APP_STATUS_STYLES[status]} border-0 hover:${APP_STATUS_STYLES[status]}`}>
            {APP_STATUS_LABELS[status]}
        </Badge>
    );
}

// ── main view ─────────────────────────────────────────────────────────────────

export default function JobsAdminView() {
    const jobs = useJobsStore((s) => s.jobs);
    const applications = useJobsStore((s) => s.applications);
    const createJob = useJobsStore((s) => s.createJob);
    const updateJob = useJobsStore((s) => s.updateJob);
    const setJobStatus = useJobsStore((s) => s.setJobStatus);
    const deleteJob = useJobsStore((s) => s.deleteJob);
    const addApplication = useJobsStore((s) => s.addApplication);
    const setApplicationStatus = useJobsStore((s) => s.setApplicationStatus);
    const deleteApplication = useJobsStore((s) => s.deleteApplication);
    const uploadResume = useJobsStore((s) => s.uploadResume);
    const deleteResume = useJobsStore((s) => s.deleteResume);
    const getStats = useJobsStore((s) => s.getStats);
    const getApplicationsByJob = useJobsStore((s) => s.getApplicationsByJob);
    const fetchJobs = useJobsStore((s) => s.fetchJobs);
    const fetchApplications = useJobsStore((s) => s.fetchApplications);
    const currentUser = useAuthStore((s) => s.currentUser);

    // ── fetch from DB on mount ────────────────────────────────────────────────
    useEffect(() => {
        void fetchJobs();
    }, [fetchJobs]);

    // ── filters ──────────────────────────────────────────────────────────────
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");

    // ── dialogs / sheets ─────────────────────────────────────────────────────
    const [jobOpen, setJobOpen] = useState(false);
    const [editingJob, setEditingJob] = useState<JobPosting | null>(null);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [appOpen, setAppOpen] = useState(false);
    const [viewingAppId, setViewingAppId] = useState<string | null>(null);
    const [isUploadingResume, setIsUploadingResume] = useState(false);

    // Fetch applications for selected job when it changes
    useEffect(() => {
        if (selectedJobId) void fetchApplications(selectedJobId);
    }, [selectedJobId, fetchApplications]);

    const stats = useMemo(() => getStats(), [jobs, applications, getStats]);

    // ── job form ─────────────────────────────────────────────────────────────
    const BLANK_JOB = {
        title: "", department: DEPARTMENTS[0] as string, location: "",
        type: "full_time" as JobType, status: "open" as JobStatus,
        priority: "medium" as JobPriority, headcount: 1,
        salaryMin: "" as unknown as number, salaryMax: "" as unknown as number,
        description: "", requirements: "", responsibilities: "", deadline: "",
    };
    const [jobForm, setJobForm] = useState(BLANK_JOB);
    const setJF = (patch: Partial<typeof BLANK_JOB>) => setJobForm((f) => ({ ...f, ...patch }));

    // ── application form ─────────────────────────────────────────────────────
    const BLANK_APP = {
        applicantName: "", applicantEmail: "", applicantPhone: "",
        resumeUrl: "", coverLetter: "", source: "LinkedIn", notes: "",
    };
    const [appForm, setAppForm] = useState(BLANK_APP);
    const setAF = (patch: Partial<typeof BLANK_APP>) => setAppForm((f) => ({ ...f, ...patch }));

    // ── derived ───────────────────────────────────────────────────────────────
    const filteredJobs = useMemo(() => {
        const q = search.trim().toLowerCase();
        return jobs
            .filter((j) => statusFilter === "all" || j.status === statusFilter)
            .filter((j) =>
                !q ||
                j.title.toLowerCase().includes(q) ||
                j.department.toLowerCase().includes(q) ||
                j.location.toLowerCase().includes(q)
            )
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }, [jobs, search, statusFilter]);

    const selectedJob = selectedJobId ? jobs.find((j) => j.id === selectedJobId) ?? null : null;
    const selectedJobApps = useMemo(
        () => (selectedJobId ? getApplicationsByJob(selectedJobId) : []),
        [applications, selectedJobId, getApplicationsByJob]
    );
    const viewingApp = viewingAppId
        ? applications.find((a) => a.id === viewingAppId) ?? null
        : null;

    // ── handlers ──────────────────────────────────────────────────────────────
    const openCreate = useCallback(() => {
        setEditingJob(null);
        setJobForm(BLANK_JOB);
        setJobOpen(true);
    }, []);

    const openEdit = useCallback((job: JobPosting) => {
        setEditingJob(job);
        setJobForm({
            title: job.title,
            department: job.department,
            location: job.location,
            type: job.type,
            status: job.status,
            priority: job.priority,
            headcount: job.headcount,
            salaryMin: job.salaryMin ?? ("" as unknown as number),
            salaryMax: job.salaryMax ?? ("" as unknown as number),
            description: job.description,
            requirements: job.requirements,
            responsibilities: job.responsibilities,
            deadline: job.deadline ?? "",
        });
        setJobOpen(true);
    }, []);

    const handleSaveJob = useCallback(() => {
        if (!jobForm.title.trim()) { toast.error("Job title is required"); return; }
        if (!jobForm.location.trim()) { toast.error("Location is required"); return; }
        if (!jobForm.description.trim()) { toast.error("Description is required"); return; }

        const payload = {
            title: jobForm.title.trim(),
            department: jobForm.department,
            location: jobForm.location.trim(),
            type: jobForm.type,
            status: jobForm.status,
            priority: jobForm.priority,
            headcount: Number(jobForm.headcount) || 1,
            salaryMin: jobForm.salaryMin ? Number(jobForm.salaryMin) : undefined,
            salaryMax: jobForm.salaryMax ? Number(jobForm.salaryMax) : undefined,
            description: jobForm.description.trim(),
            requirements: jobForm.requirements.trim(),
            responsibilities: jobForm.responsibilities.trim(),
            deadline: jobForm.deadline || undefined,
            createdBy: currentUser.id,
        };

        if (editingJob) {
            updateJob(editingJob.id, payload);
            toast.success("Job posting updated");
        } else {
            const job = createJob(payload);
            toast.success(`Job "${job.title}" created`);
        }
        setJobOpen(false);
    }, [jobForm, editingJob, createJob, updateJob, currentUser.id]);

    const handleAddApplication = useCallback(() => {
        if (!selectedJobId) return;
        if (!appForm.applicantName.trim()) { toast.error("Applicant name is required"); return; }
        if (!appForm.applicantEmail.trim()) { toast.error("Email is required"); return; }

        addApplication({
            jobId: selectedJobId,
            applicantName: appForm.applicantName.trim(),
            applicantEmail: appForm.applicantEmail.trim(),
            applicantPhone: appForm.applicantPhone.trim() || undefined,
            resumeUrl: appForm.resumeUrl.trim() || undefined,
            coverLetter: appForm.coverLetter.trim() || undefined,
            source: appForm.source,
            status: "applied",
            notes: appForm.notes.trim() || undefined,
        });
        toast.success("Application added");
        setAppOpen(false);
        setAppForm(BLANK_APP);
    }, [selectedJobId, appForm, addApplication]);

    // ── render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6 p-4 md:p-6">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Briefcase className="h-6 w-6 text-primary" /> Jobs
                    </h1>
                    <p className="text-sm text-muted-foreground">Talent acquisition — manage openings and track applicants</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" /> New Job Posting
                </Button>
            </div>

            {/* Summary */}
            <Card className="border">
                <CardContent className="p-0">
                    <div className="flex items-center gap-3 border-b px-5 py-3.5">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold text-foreground">Overview</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                            {stats.total} posting{stats.total !== 1 ? "s" : ""} total
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x">
                        <SummaryTile label="Open Positions" value={stats.open} icon={Briefcase} accent={stats.open > 0 ? "emerald" : "muted"} />
                        <SummaryTile label="Total Applicants" value={stats.totalApplications} icon={Users} accent={stats.totalApplications > 0 ? "blue" : "muted"} />
                        <SummaryTile label="In Pipeline" value={stats.inProgress} icon={Clock} accent={stats.inProgress > 0 ? "amber" : "muted"} />
                        <SummaryTile label="Hired" value={stats.hired} icon={UserCheck} accent="emerald" isLast />
                    </div>
                </CardContent>
            </Card>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by title, department, or location…"
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                    <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {(Object.keys(JOB_STATUS_LABELS) as JobStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>{JOB_STATUS_LABELS[s]}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Job listings */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Job Postings</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Position</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Applicants</TableHead>
                                    <TableHead>Deadline</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredJobs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                                            <div className="flex flex-col items-center gap-2">
                                                <Briefcase className="h-8 w-8 text-muted-foreground/30" />
                                                <span>{jobs.length === 0 ? "No job postings yet. Create your first one." : "No postings match your filters."}</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredJobs.map((job) => {
                                        const appCount = applications.filter((a) => a.jobId === job.id).length;
                                        const salary = fmtSalary(job.salaryMin, job.salaryMax);
                                        return (
                                            <TableRow key={job.id} className="group">
                                                <TableCell>
                                                    <div>
                                                        <div className="font-medium group-hover:text-primary transition-colors">{job.title}</div>
                                                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                                                            <MapPin className="h-3 w-3" />
                                                            <span>{job.location}</span>
                                                            {salary && (
                                                                <>
                                                                    <span className="mx-0.5">·</span>
                                                                    <Banknote className="h-3 w-3" />
                                                                    <span>{salary}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5 text-sm">
                                                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                        {job.department}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm">{JOB_TYPE_LABELS[job.type]}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <StatusBadge status={job.status} />
                                                        <Badge className={`${JOB_PRIORITY_STYLES[job.priority]} border-0 text-[10px] px-1.5 py-0 hover:${JOB_PRIORITY_STYLES[job.priority]} w-fit`}>
                                                            {job.priority}
                                                        </Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <button
                                                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                                                        onClick={() => setSelectedJobId(job.id)}
                                                    >
                                                        <Users className="h-3.5 w-3.5" />
                                                        {appCount}
                                                        <ChevronRight className="h-3 w-3" />
                                                    </button>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {job.deadline ? (
                                                        <div className="flex items-center gap-1">
                                                            <CalendarDays className="h-3 w-3" />
                                                            {fmtDate(job.deadline)}
                                                        </div>
                                                    ) : "—"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8"
                                                            onClick={() => setSelectedJobId(job.id)}
                                                        >
                                                            View
                                                            <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                                                        </Button>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => openEdit(job)}>
                                                                    Edit posting
                                                                </DropdownMenuItem>
                                                                {job.status !== "open" && (
                                                                    <DropdownMenuItem onClick={() => { setJobStatus(job.id, "open"); toast.success("Posting set to Open"); }}>
                                                                        Set as Open
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {job.status !== "on_hold" && (
                                                                    <DropdownMenuItem onClick={() => { setJobStatus(job.id, "on_hold"); toast.success("Posting put on Hold"); }}>
                                                                        <PauseCircle className="h-4 w-4 mr-2" /> Put on Hold
                                                                    </DropdownMenuItem>
                                                                )}
                                                                {job.status !== "closed" && (
                                                                    <DropdownMenuItem onClick={() => { setJobStatus(job.id, "closed"); toast.success("Posting closed"); }}>
                                                                        <XCircle className="h-4 w-4 mr-2" /> Close posting
                                                                    </DropdownMenuItem>
                                                                )}
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="text-red-600"
                                                                    onClick={() => { deleteJob(job.id); toast.success("Posting deleted"); }}
                                                                >
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
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

            {/* ── Job detail sheet ── */}
            <Sheet open={!!selectedJob} onOpenChange={(o) => { if (!o) setSelectedJobId(null); }}>
                <SheetContent className="w-full sm:max-w-2xl overflow-y-auto flex flex-col gap-0 p-0">
                    {selectedJob && (
                        <>
                            <SheetHeader className="px-6 pt-6 pb-4 border-b">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1">
                                        <SheetTitle className="text-xl">{selectedJob.title}</SheetTitle>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{selectedJob.department}</span>
                                            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{selectedJob.location}</span>
                                            <span>{JOB_TYPE_LABELS[selectedJob.type]}</span>
                                            {fmtSalary(selectedJob.salaryMin, selectedJob.salaryMax) && (
                                                <span className="flex items-center gap-1"><Banknote className="h-3.5 w-3.5" />{fmtSalary(selectedJob.salaryMin, selectedJob.salaryMax)}</span>
                                            )}
                                        </div>
                                    </div>
                                    <StatusBadge status={selectedJob.status} />
                                </div>
                                <div className="flex items-center gap-2 pt-2">
                                    {selectedJob.deadline && (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <CalendarDays className="h-3.5 w-3.5" /> Deadline: {fmtDate(selectedJob.deadline)}
                                        </span>
                                    )}
                                    <span className="text-xs text-muted-foreground ml-auto">
                                        {selectedJob.headcount} slot{selectedJob.headcount !== 1 ? "s" : ""}
                                    </span>
                                </div>
                            </SheetHeader>

                            {/* Job description */}
                            <div className="px-6 py-4 space-y-4 border-b">
                                {selectedJob.description && (
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Description</p>
                                        <p className="text-sm whitespace-pre-wrap text-foreground/80">{selectedJob.description}</p>
                                    </div>
                                )}
                                {selectedJob.responsibilities && (
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Responsibilities</p>
                                        <p className="text-sm whitespace-pre-wrap text-foreground/80">{selectedJob.responsibilities}</p>
                                    </div>
                                )}
                                {selectedJob.requirements && (
                                    <div>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Requirements</p>
                                        <p className="text-sm whitespace-pre-wrap text-foreground/80">{selectedJob.requirements}</p>
                                    </div>
                                )}
                            </div>

                            {/* Applications */}
                            <div className="px-6 py-4 flex-1">
                                <div className="flex items-center justify-between mb-4">
                                    <p className="text-sm font-semibold">
                                        Applications
                                        <span className="ml-2 text-xs font-normal text-muted-foreground">({selectedJobApps.length})</span>
                                    </p>
                                    <Button size="sm" onClick={() => { setAppForm(BLANK_APP); setAppOpen(true); }}>
                                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Applicant
                                    </Button>
                                </div>

                                {/* Pipeline progress bar */}
                                {selectedJobApps.length > 0 && (
                                    <div className="mb-5 p-3.5 bg-muted/40 rounded-lg border">
                                        <div className="flex items-center justify-between mb-2">
                                            {APP_STATUS_PIPELINE.map((stage, i) => {
                                                const count = selectedJobApps.filter((a) => a.status === stage).length;
                                                return (
                                                    <div key={stage} className="flex-1 text-center">
                                                        <div className={`text-lg font-bold ${count > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>{count}</div>
                                                        <div className="text-[10px] text-muted-foreground leading-tight">{APP_STATUS_LABELS[stage]}</div>
                                                        {i < APP_STATUS_PIPELINE.length - 1 && (
                                                            <div className="hidden" />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden mt-2">
                                            {APP_STATUS_PIPELINE.map((stage) => {
                                                const count = selectedJobApps.filter((a) => a.status === stage).length;
                                                const pct = selectedJobApps.length ? (count / selectedJobApps.length) * 100 : 0;
                                                const colors: Record<ApplicationStatus, string> = {
                                                    applied: "bg-slate-400", screening: "bg-blue-500",
                                                    interview: "bg-purple-500", offer: "bg-amber-500",
                                                    hired: "bg-emerald-500", rejected: "bg-red-400", withdrawn: "bg-zinc-300",
                                                };
                                                return pct > 0 ? (
                                                    <div key={stage} className={`${colors[stage]} h-full`} style={{ width: `${pct}%` }} />
                                                ) : null;
                                            })}
                                        </div>
                                    </div>
                                )}

                                {selectedJobApps.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground border border-dashed rounded-lg">
                                        <Inbox className="h-8 w-8 mb-2 text-muted-foreground/30" />
                                        <p className="text-sm">No applicants yet.</p>
                                        <p className="text-xs mt-1">Click &quot;Add Applicant&quot; to log an application.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {selectedJobApps
                                            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                                            .map((app) => (
                                                <ApplicationRow
                                                    key={app.id}
                                                    app={app}
                                                    onView={() => setViewingAppId(app.id)}
                                                    onStatusChange={(status) => {
                                                        setApplicationStatus(app.id, status, currentUser.id);
                                                        toast.success(`Status updated to "${APP_STATUS_LABELS[status]}"`);
                                                    }}
                                                    onDelete={() => {
                                                        deleteApplication(app.id);
                                                        toast.success("Application removed");
                                                    }}
                                                />
                                            ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            {/* ── Applicant detail sheet ── */}
            <Sheet open={!!viewingApp} onOpenChange={(o) => { if (!o) setViewingAppId(null); }}>
                <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
                    {viewingApp && (
                        <>
                            <SheetHeader className="px-6 pt-6 pb-4 border-b">
                                <SheetTitle>{viewingApp.applicantName}</SheetTitle>
                                <AppStatusBadge status={viewingApp.status} />
                            </SheetHeader>
                            <div className="px-6 py-5 space-y-5">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="space-y-0.5">
                                        <p className="text-xs text-muted-foreground">Email</p>
                                        <p className="flex items-center gap-1.5 font-medium">
                                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                            {viewingApp.applicantEmail}
                                        </p>
                                    </div>
                                    {viewingApp.applicantPhone && (
                                        <div className="space-y-0.5">
                                            <p className="text-xs text-muted-foreground">Phone</p>
                                            <p className="flex items-center gap-1.5 font-medium">
                                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                                {viewingApp.applicantPhone}
                                            </p>
                                        </div>
                                    )}
                                    <div className="space-y-0.5">
                                        <p className="text-xs text-muted-foreground">Source</p>
                                        <p className="font-medium">{viewingApp.source}</p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-xs text-muted-foreground">Applied</p>
                                        <p className="font-medium">{fmtDate(viewingApp.createdAt)}</p>
                                    </div>
                                    {viewingApp.interviewDate && (
                                        <div className="space-y-0.5 col-span-2">
                                            <p className="text-xs text-muted-foreground">Interview Date</p>
                                            <p className="font-medium flex items-center gap-1.5">
                                                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                                                {fmtDate(viewingApp.interviewDate)}
                                            </p>
                                        </div>
                                    )}
                                    {viewingApp.offerSalary && (
                                        <div className="space-y-0.5 col-span-2">
                                            <p className="text-xs text-muted-foreground">Offered Salary</p>
                                            <p className="font-medium">₱{viewingApp.offerSalary.toLocaleString()}</p>
                                        </div>
                                    )}
                                </div>
                                {viewingApp.resumeUrl && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Resume Link</p>
                                        <a
                                            href={viewingApp.resumeUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                                        >
                                            <LinkIcon className="h-3.5 w-3.5" /> Open Link
                                        </a>
                                    </div>
                                )}

                                {/* ── Resume file upload section ── */}
                                <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                        <FileText className="h-3.5 w-3.5" /> Resume / CV File
                                    </p>
                                    {viewingApp.resumeStoragePath ? (
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm text-emerald-700 font-medium flex items-center gap-1.5">
                                                <CheckCircle2 className="h-4 w-4" /> Resume uploaded
                                            </span>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8"
                                                onClick={async () => {
                                                    const jobId = viewingApp.jobId;
                                                    const res = await fetch(
                                                        `/api/jobs/${encodeURIComponent(jobId)}/applications/${encodeURIComponent(viewingApp.id)}/resume`
                                                    );
                                                    const json = await res.json() as { ok: boolean; signedUrl?: string };
                                                    if (json.ok && json.signedUrl) {
                                                        window.open(json.signedUrl, "_blank", "noopener,noreferrer");
                                                    } else {
                                                        toast.error("Could not generate download link");
                                                    }
                                                }}
                                            >
                                                <Download className="h-3.5 w-3.5 mr-1.5" /> Download
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                disabled={isUploadingResume}
                                                onClick={async () => {
                                                    setIsUploadingResume(true);
                                                    await deleteResume(viewingApp.id, viewingApp.jobId);
                                                    setIsUploadingResume(false);
                                                    toast.success("Resume deleted");
                                                }}
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                                            </Button>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">No file uploaded yet.</p>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <label className="flex-1">
                                            <input
                                                type="file"
                                                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                                className="hidden"
                                                disabled={isUploadingResume}
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    if (file.size > 10 * 1024 * 1024) {
                                                        toast.error("File too large. Max size is 10 MB.");
                                                        return;
                                                    }
                                                    setIsUploadingResume(true);
                                                    const signedUrl = await uploadResume(viewingApp.id, viewingApp.jobId, file);
                                                    setIsUploadingResume(false);
                                                    if (signedUrl !== null) {
                                                        toast.success("Resume uploaded successfully");
                                                    } else {
                                                        toast.error("Upload failed. Check file type (PDF/DOC/DOCX only).");
                                                    }
                                                    // reset input so same file can be re-uploaded
                                                    e.target.value = "";
                                                }}
                                            />
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 w-full pointer-events-none"
                                                asChild
                                            >
                                                <span>
                                                    {isUploadingResume ? (
                                                        <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Uploading…</>
                                                    ) : (
                                                        <><Upload className="h-3.5 w-3.5 mr-1.5" /> {viewingApp.resumeStoragePath ? "Replace File" : "Upload PDF / DOCX"}</>
                                                    )}
                                                </span>
                                            </Button>
                                        </label>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">Accepted: PDF, DOC, DOCX · Max 10 MB · File stored privately in secure cloud storage.</p>
                                </div>
                                {viewingApp.coverLetter && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Cover Letter</p>
                                        <p className="text-sm whitespace-pre-wrap text-foreground/80 border rounded-md p-3 bg-muted/30">
                                            {viewingApp.coverLetter}
                                        </p>
                                    </div>
                                )}
                                {viewingApp.notes && (
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Internal Notes</p>
                                        <p className="text-sm whitespace-pre-wrap text-foreground/80 border rounded-md p-3 bg-muted/30">
                                            {viewingApp.notes}
                                        </p>
                                    </div>
                                )}

                                <Separator />
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Update Stage</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(Object.keys(APP_STATUS_LABELS) as ApplicationStatus[]).map((s) => (
                                            <Button
                                                key={s}
                                                size="sm"
                                                variant={viewingApp.status === s ? "default" : "outline"}
                                                className="justify-start"
                                                onClick={() => {
                                                    setApplicationStatus(viewingApp.id, s, currentUser.id);
                                                    toast.success(`Moved to "${APP_STATUS_LABELS[s]}"`);
                                                }}
                                            >
                                                {APP_STATUS_LABELS[s]}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            {/* ── Create / Edit Job dialog ── */}
            <Dialog open={jobOpen} onOpenChange={setJobOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingJob ? "Edit Job Posting" : "New Job Posting"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-1">
                        {/* Title + Status row */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <Label>Job Title <span className="text-red-500">*</span></Label>
                                <Input
                                    placeholder="e.g. Senior Frontend Developer"
                                    value={jobForm.title}
                                    onChange={(e) => setJF({ title: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Department + Location */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Department</Label>
                                <Select value={jobForm.department} onValueChange={(v) => setJF({ department: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Location <span className="text-red-500">*</span></Label>
                                <Input
                                    placeholder="e.g. Manila, Remote"
                                    value={jobForm.location}
                                    onChange={(e) => setJF({ location: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Type + Priority + Status + Headcount */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <Label>Job Type</Label>
                                <Select value={jobForm.type} onValueChange={(v) => setJF({ type: v as JobType })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {(Object.keys(JOB_TYPE_LABELS) as JobType[]).map((t) => (
                                            <SelectItem key={t} value={t}>{JOB_TYPE_LABELS[t]}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Priority</Label>
                                <Select value={jobForm.priority} onValueChange={(v) => setJF({ priority: v as JobPriority })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Status</Label>
                                <Select value={jobForm.status} onValueChange={(v) => setJF({ status: v as JobStatus })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {(Object.keys(JOB_STATUS_LABELS) as JobStatus[]).map((s) => (
                                            <SelectItem key={s} value={s}>{JOB_STATUS_LABELS[s]}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Headcount</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={jobForm.headcount}
                                    onChange={(e) => setJF({ headcount: Number(e.target.value) })}
                                />
                            </div>
                        </div>

                        {/* Salary range + Deadline */}
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <Label>Salary Min (₱)</Label>
                                <Input
                                    type="number"
                                    placeholder="e.g. 30000"
                                    value={jobForm.salaryMin || ""}
                                    onChange={(e) => setJF({ salaryMin: e.target.value as unknown as number })}
                                />
                            </div>
                            <div>
                                <Label>Salary Max (₱)</Label>
                                <Input
                                    type="number"
                                    placeholder="e.g. 60000"
                                    value={jobForm.salaryMax || ""}
                                    onChange={(e) => setJF({ salaryMax: e.target.value as unknown as number })}
                                />
                            </div>
                            <div>
                                <Label>Deadline</Label>
                                <Input
                                    type="date"
                                    value={jobForm.deadline}
                                    onChange={(e) => setJF({ deadline: e.target.value })}
                                />
                            </div>
                        </div>

                        <Separator />

                        {/* Description */}
                        <div>
                            <Label>Job Description <span className="text-red-500">*</span></Label>
                            <Textarea
                                rows={3}
                                placeholder="Brief overview of the role and what this person will work on…"
                                value={jobForm.description}
                                onChange={(e) => setJF({ description: e.target.value })}
                            />
                        </div>

                        {/* Responsibilities */}
                        <div>
                            <Label>Key Responsibilities</Label>
                            <Textarea
                                rows={3}
                                placeholder="• Lead feature development&#10;• Collaborate with design team&#10;• Participate in sprint planning…"
                                value={jobForm.responsibilities}
                                onChange={(e) => setJF({ responsibilities: e.target.value })}
                            />
                        </div>

                        {/* Requirements */}
                        <div>
                            <Label>Requirements / Qualifications</Label>
                            <Textarea
                                rows={3}
                                placeholder="• 3+ years experience in React&#10;• Bachelor's degree in CS or related&#10;• Strong communication skills…"
                                value={jobForm.requirements}
                                onChange={(e) => setJF({ requirements: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setJobOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveJob}>
                            {editingJob ? "Save Changes" : "Create Posting"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Add Application dialog ── */}
            <Dialog open={appOpen} onOpenChange={setAppOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Add Applicant</DialogTitle>
                        {selectedJob && (
                            <p className="text-sm text-muted-foreground">{selectedJob.title}</p>
                        )}
                    </DialogHeader>
                    <div className="space-y-3 py-1">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <Label>Full Name <span className="text-red-500">*</span></Label>
                                <Input
                                    placeholder="Juan dela Cruz"
                                    value={appForm.applicantName}
                                    onChange={(e) => setAF({ applicantName: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Email <span className="text-red-500">*</span></Label>
                                <Input
                                    type="email"
                                    placeholder="juan@email.com"
                                    value={appForm.applicantEmail}
                                    onChange={(e) => setAF({ applicantEmail: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>Phone</Label>
                                <Input
                                    placeholder="+63 9XX XXX XXXX"
                                    value={appForm.applicantPhone}
                                    onChange={(e) => setAF({ applicantPhone: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Source</Label>
                                <Select value={appForm.source} onValueChange={(v) => setAF({ source: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Resume URL</Label>
                                <Input
                                    placeholder="https://drive.google.com/…"
                                    value={appForm.resumeUrl}
                                    onChange={(e) => setAF({ resumeUrl: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>Cover Letter</Label>
                            <Textarea
                                rows={3}
                                placeholder="Paste or type cover letter…"
                                value={appForm.coverLetter}
                                onChange={(e) => setAF({ coverLetter: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label>Internal Notes</Label>
                            <Textarea
                                rows={2}
                                placeholder="Recruiter notes (not visible to applicant)…"
                                value={appForm.notes}
                                onChange={(e) => setAF({ notes: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAppOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddApplication}>Add Applicant</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}

// ── ApplicationRow ────────────────────────────────────────────────────────────

function ApplicationRow({
    app, onView, onStatusChange, onDelete,
}: {
    app: JobApplication;
    onView: () => void;
    onStatusChange: (s: ApplicationStatus) => void;
    onDelete: () => void;
}) {
    return (
        <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors group">
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-semibold text-muted-foreground">
                {app.applicantName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{app.applicantName}</p>
                <p className="text-xs text-muted-foreground truncate">{app.applicantEmail} · {app.source}</p>
            </div>
            <AppStatusBadge status={app.status} />
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={onView}>
                    <FileText className="h-3.5 w-3.5" />
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 px-2">
                            <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {(Object.keys(APP_STATUS_LABELS) as ApplicationStatus[]).map((s) => (
                            <DropdownMenuItem key={s} onClick={() => onStatusChange(s)}
                                className={app.status === s ? "font-semibold" : ""}>
                                {APP_STATUS_LABELS[s]}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={onDelete}>
                            Remove
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

// ── SummaryTile ───────────────────────────────────────────────────────────────

type TileAccent = "emerald" | "blue" | "amber" | "muted";
const TILE_STYLES: Record<TileAccent, { value: string; icon: string; dot: string }> = {
    emerald: { value: "text-emerald-600", icon: "text-emerald-500", dot: "bg-emerald-500" },
    blue:    { value: "text-blue-600",    icon: "text-blue-500",    dot: "bg-blue-500" },
    amber:   { value: "text-amber-600",   icon: "text-amber-500",   dot: "bg-amber-500" },
    muted:   { value: "text-muted-foreground", icon: "text-muted-foreground/60", dot: "bg-muted-foreground/40" },
};

function SummaryTile({
    label, value, icon: Icon, accent, isLast = false,
}: {
    label: string; value: number; icon: React.ElementType;
    accent: TileAccent; isLast?: boolean;
}) {
    const s = TILE_STYLES[accent];
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
