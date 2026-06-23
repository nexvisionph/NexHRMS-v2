"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth.store";
import { useDisciplinaryStore } from "@/store/disciplinary.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ChevronRight, FileText, Gavel, Hourglass, RefreshCw, ShieldAlert } from "lucide-react";
import { disciplinaryDb } from "@/services/db.service";
import type { DisciplinaryCaseStatus } from "@/types";

/** Merge an incoming DB snapshot with the current store list, preferring
 *  the freshest row by `updatedAt` for matching IDs. */
function mergeById<T extends { id: string; updatedAt?: string }>(
    current: T[],
    incoming: T[],
): T[] {
    if (incoming.length === 0) return current;
    const byId = new Map<string, T>(current.map((row) => [row.id, row]));
    for (const row of incoming) {
        const existing = byId.get(row.id);
        if (!existing || (row.updatedAt && (!existing.updatedAt || row.updatedAt > existing.updatedAt))) {
            byId.set(row.id, row);
        }
    }
    return Array.from(byId.values());
}

const STATUS_LABELS: Record<DisciplinaryCaseStatus, string> = {
    draft: "Draft",
    open: "Open",
    nte_issued: "NTE Issued",
    nte_acknowledged: "NTE Acknowledged",
    explanation_submitted: "Explanation Submitted",
    no_response: "No Response",
    under_review: "Under Review",
    nod_issued: "NOD Issued",
    nod_acknowledged: "NOD Acknowledged",
    sanction_active: "Sanction Active",
    closed: "Closed",
};

const STATUS_TONE: Record<DisciplinaryCaseStatus, string> = {
    draft: "bg-slate-100 text-slate-500 border border-dashed",
    open: "bg-slate-100 text-slate-700",
    nte_issued: "bg-blue-100 text-blue-700",
    nte_acknowledged: "bg-cyan-100 text-cyan-700",
    explanation_submitted: "bg-purple-100 text-purple-700",
    no_response: "bg-orange-100 text-orange-700",
    under_review: "bg-amber-100 text-amber-800",
    nod_issued: "bg-red-100 text-red-700",
    nod_acknowledged: "bg-rose-100 text-rose-700",
    sanction_active: "bg-red-200 text-red-900",
    closed: "bg-emerald-100 text-emerald-800",
};

function getNextAction(status: DisciplinaryCaseStatus) {
    if (status === "nte_issued") return "Acknowledge NTE";
    if (status === "nte_acknowledged") return "Submit explanation";
    if (status === "no_response") return "View details";
    if (status === "explanation_submitted") return "Awaiting HR review";
    if (status === "under_review") return "Under HR review";
    if (status === "nod_issued") return "Acknowledge NOD";
    if (status === "nod_acknowledged") return "Awaiting decision";
    if (status === "sanction_active") return "Sanction active";
    if (status === "closed") return "View record";
    return "View details";
}

export default function DisciplinaryEmployeeView() {
    const currentUser = useAuthStore((s) => s.currentUser);
    const employees = useEmployeesStore((s) => s.employees);
    const cases = useDisciplinaryStore((s) => s.cases);
    const ntes = useDisciplinaryStore((s) => s.ntes);
    const nods = useDisciplinaryStore((s) => s.nods);
    const notes = useDisciplinaryStore((s) => s.notes);
    const setCases = useDisciplinaryStore((s) => s.setCases);
    const setNTEs = useDisciplinaryStore((s) => s.setNTEs);
    const setNODs = useDisciplinaryStore((s) => s.setNODs);
    const setNotes = useDisciplinaryStore((s) => s.setNotes);
    const rh = useRoleHref();
    const [refreshing, setRefreshing] = useState(false);

    const empRecord = useMemo(
        () => employees.find(
            (e) =>
                e.profileId === currentUser.id ||
                e.email?.trim().toLowerCase() === currentUser.email?.trim().toLowerCase() ||
                e.name?.trim().toLowerCase() === currentUser.name?.trim().toLowerCase(),
        ),
        [employees, currentUser],
    );

    const myCases = useMemo(() => {
        if (!empRecord) return [];
        return cases
            .filter((c) => c.employeeId === empRecord.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }, [cases, empRecord]);

    const openCases = myCases.filter((c) => c.status !== "closed").length;
    const awaitingMe = myCases.filter((c) => ["nte_issued", "nte_acknowledged", "nod_issued"].includes(c.status)).length;
    const closedCases = myCases.length - openCases;

    // Re-fetch disciplinary cases (and related NTE/NOD) on mount and on
    // window focus. This is a safety net for when realtime postgres_changes
    // events are missed (e.g. admin publishes a case from a different
    // session before the realtime channel is active, or the realtime
    // publication doesn't include the disciplinary tables).
    //
    // RLS policies already scope the query to the current employee's own
    // records ("disc cases employee read own"), so this is safe to call
    // from any role.
    const fetchMyDisciplinaryRecords = async () => {
        if (refreshing) return;
        setRefreshing(true);
        try {
            const [fetchedCases, fetchedNTEs, fetchedNODs, fetchedNotes] = await Promise.all([
                disciplinaryDb.fetchCases(),
                disciplinaryDb.fetchNTEs(),
                disciplinaryDb.fetchNODs(),
                disciplinaryDb.fetchNotes(),
            ]);
            // Merge with existing store entries so we never drop a row that
            // arrived through realtime between renders.
            if (fetchedCases.length > 0 || fetchedNTEs.length > 0 || fetchedNODs.length > 0 || fetchedNotes.length > 0) {
                setCases(
                    fetchedCases.length > 0
                        ? mergeById(cases, fetchedCases)
                        : cases,
                );
                setNTEs(
                    fetchedNTEs.length > 0
                        ? mergeById(ntes, fetchedNTEs)
                        : ntes,
                );
                setNODs(
                    fetchedNODs.length > 0
                        ? mergeById(nods, fetchedNODs)
                        : nods,
                    );
                setNotes(
                    fetchedNotes.length > 0
                        ? mergeById(notes, fetchedNotes)
                        : notes,
                );
            }
        } catch (err) {
            console.warn("[disciplinary] Failed to refresh cases:", err);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        void fetchMyDisciplinaryRecords();
        const onFocus = () => void fetchMyDisciplinaryRecords();
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [empRecord?.id]);

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Gavel className="h-6 w-6 text-primary" /> My Disciplinary Cases
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Cases, notices, explanations, and decisions filed to your employee record.</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 w-full sm:w-auto"
                    onClick={fetchMyDisciplinaryRecords}
                    disabled={refreshing}
                >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                    {refreshing ? "Refreshing…" : "Refresh"}
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard label="Open Cases" value={openCases} icon={AlertTriangle} tone="text-amber-600 bg-amber-500/10" />
                <SummaryCard label="Needs My Action" value={awaitingMe} icon={Hourglass} tone="text-blue-600 bg-blue-500/10" />
                <SummaryCard label="Closed Cases" value={closedCases} icon={CheckCircle2} tone="text-emerald-600 bg-emerald-500/10" />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Filed Cases</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {!empRecord ? (
                        <div className="py-8 text-center">
                            <ShieldAlert className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                            <p className="text-sm text-muted-foreground mt-2">Your login is not linked to an employee record yet.</p>
                        </div>
                    ) : myCases.length === 0 ? (
                        <div className="py-8 text-center">
                            <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                            <p className="text-sm text-muted-foreground mt-2">No disciplinary cases have been filed to your record.</p>
                        </div>
                    ) : (
                        myCases.map((c) => (
                            <Link key={c.id} href={rh(`/disciplinary/${c.id}`)} className="block">
                                <div className="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-mono text-sm font-medium">{c.caseNumber}</span>
                                            <Badge className={`${STATUS_TONE[c.status]} border-0 hover:${STATUS_TONE[c.status]}`}>
                                                {STATUS_LABELS[c.status]}
                                            </Badge>
                                        </div>
                                        <p className="text-sm font-medium">{c.violationType}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Incident: {new Date(c.incidentDate).toLocaleDateString()} - Filed: {new Date(c.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <Button size="sm" variant="outline" className="w-full sm:w-auto">
                                        {getNextAction(c.status)}
                                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                                    </Button>
                                </div>
                            </Link>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function SummaryCard({
    label,
    value,
    icon: Icon,
    tone,
}: {
    label: string;
    value: number;
    icon: typeof AlertTriangle;
    tone: string;
}) {
    return (
        <Card className="border border-border/50">
            <CardContent className="p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">{label}</p>
                        <p className="text-3xl font-bold mt-1">{value}</p>
                    </div>
                    <div className={`rounded-lg p-2 ${tone}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}