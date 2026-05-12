"use client";

/**
 * BIR Compliance Dashboard
 * --------------------------------------------------------------
 * Single page that surfaces:
 *   1. Year selector + role gate
 *   2. Employee tax-profile grid (TIN coverage, MWE flag, etc.)
 *   3. Annual summary table per employee with Rebuild / Finalize / 2316 actions
 *   4. Alphalist preview + validation issues + export buttons
 *
 * Auth: admin / finance / payroll_admin only — others get redirected.
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useBIRComplianceStore } from "@/store/bir-compliance.store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
    ArrowLeft,
    AlertCircle,
    CheckCircle2,
    Download,
    FileText,
    RefreshCw,
    Save,
    ShieldAlert,
    UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { Form2316Dialog } from "@/components/payroll/form-2316";
import {
    exportAlphalistCsv,
    exportAlphalistDat,
    exportAlphalistXlsx,
    downloadFile,
} from "@/lib/bir-export";
import type {
    Employee,
    EmployeeTaxProfile,
    AnnualTaxSummary,
    AlphalistRow,
    AlphalistScheduleType,
    BIRValidationIssue,
} from "@/types";

const ALLOWED_ROLES = ["admin", "finance", "payroll_admin"];

const EMPLOYER_DEFAULT = {
    name: "Soren Data Solutions Inc.",
    tin: "000-000-000-000",
    address: "Manila, Philippines",
};

export default function BIRCompliancePage() {
    const params = useParams<{ role: string }>();
    const router = useRouter();
    const role = useAuthStore((s) => s.currentUser.role);
    const employees = useEmployeesStore((s) => s.employees);

    const {
        taxProfiles,
        annualSummaries,
        form2316Records,
        setTaxProfiles,
        setAnnualSummaries,
        setForm2316Records,
        upsertTaxProfile,
    } = useBIRComplianceStore();

    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("profiles");
    const [alphalistRows, setAlphalistRows] = useState<{
        schedule1: AlphalistRow[];
        schedule2: AlphalistRow[];
    }>({ schedule1: [], schedule2: [] });
    const [alphalistIssues, setAlphalistIssues] = useState<BIRValidationIssue[]>([]);
    const [alphalistSchedule, setAlphalistSchedule] =
        useState<AlphalistScheduleType>("both");
    const [profileEditOpen, setProfileEditOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<EmployeeTaxProfile | null>(
        null,
    );
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [form2316Open, setForm2316Open] = useState(false);
    const [form2316Data, setForm2316Data] = useState<{
        summary: AnnualTaxSummary;
        employee: Employee;
        profile: EmployeeTaxProfile;
    } | null>(null);

    // ── Role gate ────────────────────────────────────────────
    useEffect(() => {
        if (role && !ALLOWED_ROLES.includes(role)) {
            toast.error("BIR Compliance is restricted to admin / finance / payroll.");
            router.replace(`/${params?.role ?? role}/payroll`);
        }
    }, [role, params?.role, router]);

    // ── Load profiles + summaries + 2316 records ─────────────
    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const [pRes, sRes, fRes] = await Promise.all([
                fetch(`/api/payroll/bir/tax-profile`),
                fetch(`/api/payroll/bir/annual-summary?year=${year}`),
                fetch(`/api/payroll/bir/form-2316?year=${year}`),
            ]);
            const [p, s, f] = await Promise.all([
                pRes.json(),
                sRes.json(),
                fRes.json(),
            ]);
            if (p.ok) setTaxProfiles(p.data.map(profileFromRow));
            if (s.ok) setAnnualSummaries(s.data.map(summaryFromRow));
            if (f.ok) setForm2316Records(f.data.map(form2316FromRow));
        } catch (e) {
            console.error(e);
            toast.error("Failed to load BIR data.");
        } finally {
            setLoading(false);
        }
    }, [year, setTaxProfiles, setAnnualSummaries, setForm2316Records]);

    useEffect(() => {
        if (role && ALLOWED_ROLES.includes(role)) void refresh();
    }, [role, refresh]);

    // ── Derived ──────────────────────────────────────────────
    const profileByEmp = useMemo(
        () => new Map(taxProfiles.map((p) => [p.employeeId, p])),
        [taxProfiles],
    );
    const summaryByEmp = useMemo(
        () => new Map(annualSummaries.map((s) => [s.employeeId, s])),
        [annualSummaries],
    );

    const tinCoverage = useMemo(() => {
        const total = employees.length;
        const withTin = employees.filter((e) => profileByEmp.get(e.id)?.tin).length;
        return { total, withTin, pct: total ? Math.round((withTin / total) * 100) : 0 };
    }, [employees, profileByEmp]);

    // ── Profile editor ───────────────────────────────────────
    const openProfileEditor = (emp: Employee) => {
        setEditingEmployee(emp);
        setEditingProfile(
            profileByEmp.get(emp.id) ?? {
                id: `ETP-${emp.id}`,
                employeeId: emp.id,
                employmentClassification: "R",
                isMWE: false,
                substitutedFiling: false,
                taxStatus: "S",
                taxResidency: "resident",
                prev2316Received: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        );
        setProfileEditOpen(true);
    };

    const saveProfile = async () => {
        if (!editingProfile) return;
        try {
            const r = await fetch("/api/payroll/bir/tax-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editingProfile),
            });
            const json = await r.json();
            if (!json.ok) throw new Error(json.message);
            upsertTaxProfile(profileFromRow(json.data));
            toast.success("Tax profile saved.");
            setProfileEditOpen(false);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Save failed");
        }
    };

    // ── Annual summary actions ───────────────────────────────
    const callSummaryAction = async (
        employeeId: string,
        action: "rebuild" | "finalize" | "reopen",
    ) => {
        try {
            const r = await fetch("/api/payroll/bir/annual-summary", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ employeeId, year, action }),
            });
            const json = await r.json();
            if (!json.ok) throw new Error(json.message);
            toast.success(`Summary ${action}d.`);
            await refresh();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : `${action} failed`);
        }
    };

    // ── Alphalist load + export ──────────────────────────────
    const loadAlphalist = useCallback(async () => {
        const r = await fetch(
            `/api/payroll/bir/alphalist?year=${year}&schedule=${alphalistSchedule}`,
        );
        const json = await r.json();
        if (!json.ok) {
            toast.error(json.message ?? "Alphalist load failed");
            return;
        }
        setAlphalistRows({
            schedule1: json.data.schedule1,
            schedule2: json.data.schedule2,
        });
        setAlphalistIssues(json.data.issues ?? []);
    }, [year, alphalistSchedule]);

    useEffect(() => {
        if (activeTab === "alphalist" && role && ALLOWED_ROLES.includes(role)) {
            void loadAlphalist();
        }
    }, [activeTab, loadAlphalist, role]);

    const doExport = async (format: "csv" | "xlsx" | "dat") => {
        const r = await fetch("/api/payroll/bir/alphalist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                year,
                schedule: alphalistSchedule,
                exportFormat: format,
                employerTin: EMPLOYER_DEFAULT.tin,
                employerName: EMPLOYER_DEFAULT.name,
            }),
        });
        const json = await r.json();
        if (!json.ok) {
            toast.error(json.message ?? "Export rejected");
            return;
        }
        const allRows: AlphalistRow[] = [
            ...json.data.rows.schedule1,
            ...json.data.rows.schedule2,
        ];
        const opts = {
            year,
            schedule: alphalistSchedule,
            employerTin: EMPLOYER_DEFAULT.tin,
            employerName: EMPLOYER_DEFAULT.name,
        };
        if (format === "csv") {
            downloadFile(
                exportAlphalistCsv(allRows, opts),
                `alphalist_${year}_${alphalistSchedule}.csv`,
                "text/csv",
            );
        } else if (format === "xlsx") {
            downloadFile(
                exportAlphalistXlsx(allRows, opts),
                `alphalist_${year}_${alphalistSchedule}.xls`,
                "application/vnd.ms-excel",
            );
        } else {
            downloadFile(
                exportAlphalistDat(allRows, opts),
                `alphalist_${year}_${alphalistSchedule}.dat`,
                "text/plain",
            );
        }
        toast.success(`Alphalist ${format.toUpperCase()} downloaded.`);
        await refresh();
    };

    const openForm2316 = (emp: Employee) => {
        const summary = summaryByEmp.get(emp.id);
        const profile = profileByEmp.get(emp.id);
        if (!summary || !profile) {
            toast.error("Build & finalize the annual summary first.");
            return;
        }
        setForm2316Data({ summary, employee: emp, profile });
        setForm2316Open(true);
    };

    if (!role || !ALLOWED_ROLES.includes(role)) return null;

    const errorCount = alphalistIssues.filter((i) => i.severity === "error").length;
    const warnCount = alphalistIssues.filter((i) => i.severity === "warning").length;

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href={`/${params?.role ?? role}/payroll`}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">BIR Compliance</h1>
                        <p className="text-sm text-muted-foreground">
                            Tax profiles, annual summaries, Form 2316, and Alphalist export.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Label htmlFor="year">Year</Label>
                    <Input
                        id="year"
                        type="number"
                        className="w-24"
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        min={2020}
                        max={2100}
                    />
                    <Button variant="outline" onClick={refresh} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-xs text-muted-foreground">TIN coverage</div>
                        <div className="text-2xl font-bold">
                            {tinCoverage.withTin} / {tinCoverage.total}
                        </div>
                        <Badge variant={tinCoverage.pct === 100 ? "default" : "secondary"}>
                            {tinCoverage.pct}% complete
                        </Badge>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-xs text-muted-foreground">Annual summaries</div>
                        <div className="text-2xl font-bold">{annualSummaries.length}</div>
                        <span className="text-xs text-muted-foreground">
                            for FY {year}
                        </span>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-xs text-muted-foreground">Finalized</div>
                        <div className="text-2xl font-bold">
                            {annualSummaries.filter((s) => s.status === "finalized" || s.status === "exported").length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-xs text-muted-foreground">Form 2316 issued</div>
                        <div className="text-2xl font-bold">{form2316Records.length}</div>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="profiles">Tax Profiles</TabsTrigger>
                    <TabsTrigger value="summaries">Annual Summaries</TabsTrigger>
                    <TabsTrigger value="alphalist">Alphalist & Export</TabsTrigger>
                </TabsList>

                {/* ─── Tab: Profiles ───────────────────────── */}
                <TabsContent value="profiles">
                    <Card>
                        <CardHeader>
                            <CardTitle>Employee Tax Profiles</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Employee</TableHead>
                                        <TableHead>TIN</TableHead>
                                        <TableHead>Class</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>MWE</TableHead>
                                        <TableHead>Substituted Filing</TableHead>
                                        <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {employees.map((emp) => {
                                        const p = profileByEmp.get(emp.id);
                                        return (
                                            <TableRow key={emp.id}>
                                                <TableCell>
                                                    <div className="font-medium">{emp.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {emp.department}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">
                                                    {p?.tin ?? (
                                                        <Badge variant="destructive">missing</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>{p?.employmentClassification ?? "—"}</TableCell>
                                                <TableCell>{p?.taxStatus ?? "—"}</TableCell>
                                                <TableCell>
                                                    {p?.isMWE ? (
                                                        <Badge>Yes</Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {p?.substitutedFiling ? "Yes" : "No"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => openProfileEditor(emp)}
                                                    >
                                                        <UserCog className="h-3 w-3 mr-1" />
                                                        {p ? "Edit" : "Create"}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ─── Tab: Summaries ─────────────────────── */}
                <TabsContent value="summaries">
                    <Card>
                        <CardHeader>
                            <CardTitle>Annual Tax Summaries — FY {year}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Employee</TableHead>
                                        <TableHead className="text-right">Taxable</TableHead>
                                        <TableHead className="text-right">Tax Withheld</TableHead>
                                        <TableHead className="text-right">Tax Due</TableHead>
                                        <TableHead className="text-right">Adjustment</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {employees.map((emp) => {
                                        const s = summaryByEmp.get(emp.id);
                                        return (
                                            <TableRow key={emp.id}>
                                                <TableCell>
                                                    <div className="font-medium">{emp.name}</div>
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {s ? s.totalTaxableComp.toFixed(2) : "—"}
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {s ? s.totalTaxWithheld.toFixed(2) : "—"}
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {s?.annualTaxDue?.toFixed(2) ?? "—"}
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {s ? (
                                                        <span
                                                            className={
                                                                s.adjustmentType === "over_withheld"
                                                                    ? "text-emerald-600"
                                                                    : s.adjustmentType === "under_withheld"
                                                                      ? "text-amber-600"
                                                                      : ""
                                                            }
                                                        >
                                                            {(s.adjustmentAmount ?? 0).toFixed(2)}
                                                        </span>
                                                    ) : (
                                                        "—"
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {s ? (
                                                        <Badge
                                                            variant={
                                                                s.status === "finalized" ||
                                                                s.status === "exported"
                                                                    ? "default"
                                                                    : "secondary"
                                                            }
                                                        >
                                                            {s.status}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline">none</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => callSummaryAction(emp.id, "rebuild")}
                                                            title="Rebuild from payslips"
                                                        >
                                                            <RefreshCw className="h-3 w-3" />
                                                        </Button>
                                                        {s?.status === "reconciled" && (
                                                            <Button
                                                                size="sm"
                                                                variant="default"
                                                                onClick={() =>
                                                                    callSummaryAction(emp.id, "finalize")
                                                                }
                                                            >
                                                                Finalize
                                                            </Button>
                                                        )}
                                                        {(s?.status === "finalized" ||
                                                            s?.status === "exported") && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => openForm2316(emp)}
                                                                title="Form 2316"
                                                            >
                                                                <FileText className="h-3 w-3" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ─── Tab: Alphalist ─────────────────────── */}
                <TabsContent value="alphalist">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>Alphalist Preview & Export — FY {year}</span>
                                <div className="flex items-center gap-2">
                                    <Select
                                        value={alphalistSchedule}
                                        onValueChange={(v) => setAlphalistSchedule(v as AlphalistScheduleType)}
                                    >
                                        <SelectTrigger className="w-44">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="both">Both schedules</SelectItem>
                                            <SelectItem value="schedule_1">Schedule 1 (active)</SelectItem>
                                            <SelectItem value="schedule_2">Schedule 2 (separated)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button variant="outline" onClick={loadAlphalist}>
                                        Reload
                                    </Button>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Validation summary */}
                            {(errorCount > 0 || warnCount > 0) && (
                                <div
                                    className={`p-3 rounded-md text-sm ${
                                        errorCount > 0
                                            ? "bg-red-50 text-red-700"
                                            : "bg-amber-50 text-amber-800"
                                    }`}
                                >
                                    <div className="flex items-center gap-2 font-medium">
                                        {errorCount > 0 ? (
                                            <ShieldAlert className="h-4 w-4" />
                                        ) : (
                                            <AlertCircle className="h-4 w-4" />
                                        )}
                                        {errorCount > 0
                                            ? `${errorCount} error(s) — export blocked`
                                            : `${warnCount} warning(s) — review before export`}
                                    </div>
                                    <ul className="mt-2 space-y-1 list-disc list-inside max-h-48 overflow-y-auto">
                                        {alphalistIssues.slice(0, 20).map((i, idx) => (
                                            <li key={idx}>
                                                <code className="text-xs">{i.code}</code> — {i.message}
                                            </li>
                                        ))}
                                        {alphalistIssues.length > 20 && (
                                            <li className="italic">
                                                …and {alphalistIssues.length - 20} more
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            )}
                            {errorCount === 0 && warnCount === 0 && alphalistIssues.length === 0 && (
                                <div className="flex items-center gap-2 text-emerald-700 text-sm">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Validation passed — ready for export.
                                </div>
                            )}

                            <div className="flex gap-2">
                                <Button
                                    onClick={() => doExport("csv")}
                                    disabled={errorCount > 0}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export CSV
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => doExport("xlsx")}
                                    disabled={errorCount > 0}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export XLSX
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => doExport("dat")}
                                    disabled={errorCount > 0}
                                >
                                    <Download className="h-4 w-4 mr-2" />
                                    Export DAT (eFPS)
                                </Button>
                            </div>

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>#</TableHead>
                                        <TableHead>TIN</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Class</TableHead>
                                        <TableHead className="text-right">Gross</TableHead>
                                        <TableHead className="text-right">Taxable</TableHead>
                                        <TableHead className="text-right">Withheld</TableHead>
                                        <TableHead className="text-right">Due</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[...alphalistRows.schedule1, ...alphalistRows.schedule2].map((r) => (
                                        <TableRow key={`${r.tin}-${r.sequenceNumber}`}>
                                            <TableCell>{r.sequenceNumber}</TableCell>
                                            <TableCell className="font-mono text-xs">{r.tin}</TableCell>
                                            <TableCell>
                                                {r.lastName}, {r.firstName} {r.middleName}
                                            </TableCell>
                                            <TableCell>{r.employmentClassification}</TableCell>
                                            <TableCell className="text-right font-mono">
                                                {r.grossCompensation.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {r.taxableCompensation.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {r.taxWithheld.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                                {r.taxDue.toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Profile editor */}
            <Dialog open={profileEditOpen} onOpenChange={setProfileEditOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>BIR Tax Profile</DialogTitle>
                        <DialogDescription>
                            {editingEmployee?.name}
                        </DialogDescription>
                    </DialogHeader>
                    {editingProfile && (
                        <div className="space-y-3">
                            <div>
                                <Label>TIN (NNN-NNN-NNN-NNN)</Label>
                                <Input
                                    value={editingProfile.tin ?? ""}
                                    onChange={(e) =>
                                        setEditingProfile({ ...editingProfile, tin: e.target.value })
                                    }
                                    placeholder="123-456-789-000"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Classification</Label>
                                    <Select
                                        value={editingProfile.employmentClassification}
                                        onValueChange={(v) =>
                                            setEditingProfile({
                                                ...editingProfile,
                                                employmentClassification: v as EmployeeTaxProfile["employmentClassification"],
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="R">Regular</SelectItem>
                                            <SelectItem value="C">Casual</SelectItem>
                                            <SelectItem value="CP">Contractual / Project</SelectItem>
                                            <SelectItem value="S">Seasonal</SelectItem>
                                            <SelectItem value="P">Probationary</SelectItem>
                                            <SelectItem value="AL">Apprentice / Learner</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Tax Status</Label>
                                    <Select
                                        value={editingProfile.taxStatus}
                                        onValueChange={(v) =>
                                            setEditingProfile({
                                                ...editingProfile,
                                                taxStatus: v as EmployeeTaxProfile["taxStatus"],
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="S">Single</SelectItem>
                                            <SelectItem value="M">Married</SelectItem>
                                            <SelectItem value="ME">Married, Employed Spouse</SelectItem>
                                            <SelectItem value="MX">Married, Multiple Exemptions</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <Label>Minimum Wage Earner</Label>
                                <Switch
                                    checked={editingProfile.isMWE}
                                    onCheckedChange={(v) =>
                                        setEditingProfile({ ...editingProfile, isMWE: v })
                                    }
                                />
                            </div>
                            {editingProfile.isMWE && (
                                <div>
                                    <Label>Regional MWE Daily Rate</Label>
                                    <Input
                                        type="number"
                                        value={editingProfile.mweDailyRate ?? ""}
                                        onChange={(e) =>
                                            setEditingProfile({
                                                ...editingProfile,
                                                mweDailyRate: Number(e.target.value),
                                            })
                                        }
                                    />
                                </div>
                            )}
                            <div className="flex items-center justify-between">
                                <Label>Substituted Filing (employer files in lieu of 1700)</Label>
                                <Switch
                                    checked={editingProfile.substitutedFiling}
                                    onCheckedChange={(v) =>
                                        setEditingProfile({
                                            ...editingProfile,
                                            substitutedFiling: v,
                                        })
                                    }
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={() => setProfileEditOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={saveProfile}>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Form 2316 dialog */}
            <Form2316Dialog
                open={form2316Open}
                onClose={() => setForm2316Open(false)}
                data={
                    form2316Data
                        ? {
                              summary: form2316Data.summary,
                              employee: form2316Data.employee,
                              profile: form2316Data.profile,
                              prevEmployers: [],
                              employer: {
                                  name: EMPLOYER_DEFAULT.name,
                                  tin: EMPLOYER_DEFAULT.tin,
                                  address: EMPLOYER_DEFAULT.address,
                              },
                              signatoryName: "Authorized Officer",
                              signatoryPosition: "Payroll / Finance Head",
                              signatoryDate: new Date().toISOString().slice(0, 10),
                          }
                        : null
                }
            />
        </div>
    );
}

// ── Row mappers (snake → camel) ─────────────────────────────
type RawProfile = Record<string, unknown>;
function profileFromRow(r: RawProfile): EmployeeTaxProfile {
    return {
        id: String(r.id),
        employeeId: String(r.employee_id),
        tin: (r.tin as string) ?? undefined,
        employmentClassification: (r.employment_classification as EmployeeTaxProfile["employmentClassification"]) ?? "R",
        isMWE: !!r.is_mwe,
        mweDailyRate: (r.mwe_daily_rate as number) ?? undefined,
        substitutedFiling: !!r.substituted_filing,
        taxStatus: (r.tax_status as EmployeeTaxProfile["taxStatus"]) ?? "S",
        taxResidency: (r.tax_residency as EmployeeTaxProfile["taxResidency"]) ?? "resident",
        prev2316Received: !!r.prev_2316_received,
        prevEmployerName: (r.prev_employer_name as string) ?? undefined,
        prevEmployerTin: (r.prev_employer_tin as string) ?? undefined,
        prevIncome: (r.prev_income as number) ?? undefined,
        prevTaxWithheld: (r.prev_tax_withheld as number) ?? undefined,
        separationDate: (r.separation_date as string) ?? undefined,
        separationType: (r.separation_type as EmployeeTaxProfile["separationType"]) ?? undefined,
        createdAt: String(r.created_at ?? new Date().toISOString()),
        updatedAt: String(r.updated_at ?? new Date().toISOString()),
    };
}

type RawSummary = Record<string, unknown>;
function summaryFromRow(r: RawSummary): AnnualTaxSummary {
    return {
        id: String(r.id),
        employeeId: String(r.employee_id),
        year: Number(r.year),
        totalTaxableComp: Number(r.total_taxable_comp ?? 0),
        totalNonTaxableComp: Number(r.total_non_taxable_comp ?? 0),
        totalDeMinimis: Number(r.total_de_minimis ?? 0),
        totalSSS: Number(r.total_sss ?? 0),
        totalPhilHealth: Number(r.total_philhealth ?? 0),
        totalPagIBIG: Number(r.total_pagibig ?? 0),
        total13thNonTaxable: Number(r.total_13th_non_taxable ?? 0),
        total13thTaxable: Number(r.total_13th_taxable ?? 0),
        totalOtherBenefits: Number(r.total_other_benefits ?? 0),
        totalTaxWithheld: Number(r.total_tax_withheld ?? 0),
        prevEmployerIncome: Number(r.prev_employer_income ?? 0),
        prevEmployerTax: Number(r.prev_employer_tax ?? 0),
        annualTaxDue: r.annual_tax_due == null ? undefined : Number(r.annual_tax_due),
        adjustmentType: (r.adjustment_type as AnnualTaxSummary["adjustmentType"]) ?? undefined,
        adjustmentAmount: r.adjustment_amount == null ? undefined : Number(r.adjustment_amount),
        status: (r.status as AnnualTaxSummary["status"]) ?? "open",
        finalizedAt: (r.finalized_at as string) ?? undefined,
        finalizedBy: (r.finalized_by as string) ?? undefined,
        createdAt: String(r.created_at ?? new Date().toISOString()),
        updatedAt: String(r.updated_at ?? new Date().toISOString()),
    };
}

type RawForm2316 = Record<string, unknown>;
function form2316FromRow(r: RawForm2316) {
    return {
        id: String(r.id),
        employeeId: String(r.employee_id),
        year: Number(r.year),
        annualSummaryId: (r.annual_summary_id as string) ?? undefined,
        generatedAt: String(r.generated_at),
        generatedBy: (r.generated_by as string) ?? undefined,
        employerSignedAt: (r.employer_signed_at as string) ?? undefined,
        employerSignedBy: (r.employer_signed_by as string) ?? undefined,
        employerSignatureUrl: (r.employer_signature_url as string) ?? undefined,
        employeeSignedAt: (r.employee_signed_at as string) ?? undefined,
        employeeSignatureUrl: (r.employee_signature_url as string) ?? undefined,
        pdfUrl: (r.pdf_url as string) ?? undefined,
        documentHash: (r.document_hash as string) ?? undefined,
        status: (r.status as "draft" | "for_signature" | "released" | "downloaded" | "revoked") ?? "draft",
        releasedAt: (r.released_at as string) ?? undefined,
        downloadedAt: (r.downloaded_at as string) ?? undefined,
        downloadedBy: (r.downloaded_by as string) ?? undefined,
        revokedAt: (r.revoked_at as string) ?? undefined,
        revokedBy: (r.revoked_by as string) ?? undefined,
        revokeReason: (r.revoke_reason as string) ?? undefined,
        createdAt: String(r.created_at),
    };
}
