"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDisciplinaryStore } from "@/store/disciplinary.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useRoleHref } from "@/lib/hooks/use-role-href";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Gavel, Mail, MessageSquare, ShieldAlert, CheckCircle2, FileText, X, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { NODDecision } from "@/types";
import Link from "next/link";

export default function DisciplinaryCasePage({ params }: { params: Promise<{ role: string; caseId: string }> }) {
    const { role, caseId } = use(params);
    const router = useRouter();
    const rh = useRoleHref();

    const c = useDisciplinaryStore((s) => s.getCase(caseId));
    const nte = useDisciplinaryStore((s) => s.getNTEByCase(caseId));
    const nod = useDisciplinaryStore((s) => s.getNODByCase(caseId));
    const issueNTE = useDisciplinaryStore((s) => s.issueNTE);
    const acknowledgeNTE = useDisciplinaryStore((s) => s.acknowledgeNTE);
    const submitExplanation = useDisciplinaryStore((s) => s.submitExplanation);
    const markNoResponse = useDisciplinaryStore((s) => s.markNoResponse);
    const moveToReview = useDisciplinaryStore((s) => s.moveToReview);
    const issueNOD = useDisciplinaryStore((s) => s.issueNOD);
    const acknowledgeNOD = useDisciplinaryStore((s) => s.acknowledgeNOD);
    const closeCase = useDisciplinaryStore((s) => s.closeCase);
    const deleteCase = useDisciplinaryStore((s) => s.deleteCase);
    const submitCase = useDisciplinaryStore((s) => s.submitCase);
    const completeSanction = useDisciplinaryStore((s) => s.completeSanction);
    const addNote = useDisciplinaryStore((s) => s.addNote);
    const getNotesByCase = useDisciplinaryStore((s) => s.getNotesByCase);
    const notes = useDisciplinaryStore((s) => s.notes);

    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);
    const currentEmployee = useMemo(
        () => employees.find(
            (e) =>
                e.profileId === currentUser.id ||
                e.email?.trim().toLowerCase() === currentUser.email?.trim().toLowerCase() ||
                e.name?.trim().toLowerCase() === currentUser.name?.trim().toLowerCase(),
        ),
        [employees, currentUser],
    );

    const [nteOpen, setNteOpen] = useState(false);
    const [nteDeadline, setNteDeadline] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 5);
        return d.toISOString().slice(0, 10);
    });
    const [explanationOpen, setExplanationOpen] = useState(false);
    const [explanationText, setExplanationText] = useState("");

    const [nodOpen, setNodOpen] = useState(false);
    const [nodForm, setNodForm] = useState<{ decision: NODDecision; details: string; start: string; end: string; rtw: string }>({
        decision: "written_warning",
        details: "",
        start: "",
        end: "",
        rtw: "",
    });

    const [noteBody, setNoteBody] = useState("");
    const [sanctionCompleteOpen, setSanctionCompleteOpen] = useState(false);
    const [selectedResult, setSelectedResult] = useState<string>("");
    const [resultError, setResultError] = useState("");

    const caseNotes = useMemo(() => getNotesByCase(caseId), [notes, getNotesByCase, caseId]);
    const sortedNotes = useMemo(() => [...caseNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [caseNotes]);

    if (!c) {
        return (
            <div className="p-6">
                <Card className="border border-border/50">
                    <CardContent className="p-8 text-center space-y-3">
                        <p className="text-muted-foreground">Case not found.</p>
                        <Link href={rh("/disciplinary")}>
                            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" /> Back to cases</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const emp = employees.find((e) => e.id === c.employeeId);
    const isStaff = currentUser.role === "admin" || currentUser.role === "hr";
    const isCaseEmployee = currentEmployee?.id === c.employeeId;
    const isClosed = c.status === "closed";
    void role;

    if (!isStaff && !isCaseEmployee) {
        return (
            <div className="p-6">
                <Card className="border border-border/50">
                    <CardContent className="p-8 text-center space-y-3">
                        <ShieldAlert className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                        <p className="text-muted-foreground">You can only view disciplinary cases linked to your employee record.</p>
                        <Link href={rh("/disciplinary")}>
                            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" /> Back to my cases</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const handleIssueNTE = () => {
        const r = issueNTE(c.id, { responseDeadline: nteDeadline, issuedBy: currentUser.id });
        if (!r) { toast.error("NTE could not be issued"); return; }
        toast.success("NTE issued");
        setNteOpen(false);
    };

    const handleSubmitExplanation = () => {
        if (!nte) return;
        if (!explanationText.trim()) { toast.error("Explanation cannot be empty"); return; }
        submitExplanation(nte.id, explanationText.trim(), currentEmployee?.id ?? currentUser.id);
        toast.success("Explanation recorded");
        setExplanationOpen(false);
        setExplanationText("");
    };

    const handleIssueNOD = () => {
        if (!nodForm.details.trim()) { toast.error("Decision details are required"); return; }
        const r = issueNOD(c.id, {
            decision: nodForm.decision,
            decisionDetails: nodForm.details.trim(),
            issuedBy: currentUser.id,
            sanctionStartDate: nodForm.start || undefined,
            sanctionEndDate: nodForm.end || undefined,
            returnToWorkDate: nodForm.rtw || undefined,
        });
        if (!r) { toast.error("NOD could not be issued"); return; }
        toast.success(nodForm.decision === "no_violation" ? "Case closed — no violation" : "NOD issued");
        setNodOpen(false);
    };

    const statusVariantMap: Record<string, string> = {
        open: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
        closed: "bg-muted text-muted-foreground",
        nte_issued: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        nod_issued: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    };
    const statusClass = statusVariantMap[c.status] ?? "bg-muted text-muted-foreground";

    return (
        <div className="space-y-6">
            {/* ── Hero / header card ─────────────────────────────── */}
            <Card className="border border-border/50">
                <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        {/* Icon blob */}
                        <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Gavel className="h-7 w-7 text-primary" />
                        </div>

                        {/* Title block */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-2xl font-bold">{c.caseNumber}</h1>
                                <Badge variant="secondary" className={`${statusClass}`}>
                                    {c.status === "nte_issued" ? "NTE Issued"
                                        : c.status === "nod_issued" ? "NOD Issued"
                                        : c.status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                                </Badge>
                            </div>
                            <p className="text-muted-foreground mt-1 text-sm">
                                {emp?.name ?? c.employeeId} · {c.violationType}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Incident: {new Date(c.incidentDate).toLocaleDateString()}
                            </p>
                        </div>

                        {/* Action buttons */}
                        {isStaff && (() => {
                            return (
                                <div className="flex items-center gap-2 shrink-0">
                                    {/* Submit Case (Draft only) */}
                                    {c.status === "draft" && (
                                        <Button size="sm" onClick={async () => {
                                            await submitCase(c.id, currentUser.id);
                                            toast.success("Case submitted");
                                        }}>
                                            Submit Case
                                        </Button>
                                    )}

                                    {/* Edit */}
                                    {!isClosed && (
                                        <Button variant="outline" size="sm" className="gap-1.5">
                                            <Pencil className="h-3.5 w-3.5" /> Edit
                                        </Button>
                                    )}

                                    {/* Delete */}
                                    {!isClosed && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="outline" size="sm" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30">
                                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete this case?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete {c.caseNumber} and all associated records. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        className="bg-red-600 hover:bg-red-700"
                                                        onClick={() => {
                                                            deleteCase(c.id, currentUser.id);
                                                            toast.success("Case deleted");
                                                            router.push(rh("/disciplinary"));
                                                        }}
                                                    >
                                                        Delete Case
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}

                                    {/* Close Case */}
                                    {!isClosed && c.status !== "draft" && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button size="sm" className="gap-1.5 bg-black hover:bg-black/80 text-white dark:bg-white dark:text-black dark:hover:bg-white/80">
                                                    <X className="h-3.5 w-3.5" /> Close Case
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Close this case?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This marks {c.caseNumber} as closed. You can still view it in audit logs.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => { closeCase(c.id, currentUser.id); toast.success("Case closed"); }}>
                                                        Close Case
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </CardContent>
            </Card>

            {/* ── Two-column body ────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left — Case Details */}
                <Card className="border border-border/50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <FileText className="h-4 w-4" /> Case Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-0 text-sm">
                        <Row label="Employee" value={emp?.name ?? c.employeeId} />
                        <Row label="Department" value={emp?.department ?? "—"} />
                        <Row label="Violation" value={c.violationType} />
                        <Row label="Severity" value={c.severityLevel ?? "—"} />
                        <Row label="Witnesses" value={c.witnesses || "—"} />
                        {c.status === "closed" && <Row label="Outcome" value={(() => { try { return c.result ?? "—"; } catch { return "—"; } })()} />}
                        <Row label="Policy Reference" value={c.policyReference ?? "—"} />
                        <Row label="Incident Date" value={new Date(c.incidentDate).toLocaleDateString()} />
                        <Row label="Location" value={c.incidentLocation ?? "—"} />
                        <div className="py-2 border-b last:border-0">
                            <span className="text-xs uppercase tracking-wide text-muted-foreground block mb-1.5">Description</span>
                            <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm leading-relaxed">{c.description}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Right — Timeline & Actions */}
                <Card className="border border-border/50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Gavel className="h-4 w-4" /> Timeline &amp; Actions
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {/* Step 1: Issue NTE */}
                        {c.status !== "draft" && (
                            <Step
                                active={c.status === "open"}
                                done={!!nte}
                                title="1. Issue Notice to Explain (NTE)"
                                icon={Mail}
                                body={
                                    nte ? (
                                        <div className="text-sm space-y-1">
                                            <div>Deadline: <span className="font-medium">{new Date(nte.responseDeadline).toLocaleDateString()}</span></div>
                                            <div>Issued: <span className="text-muted-foreground">{new Date(nte.issuedAt).toLocaleString()}</span></div>
                                            {nte.acknowledgedAt && <div>Acknowledged: <span className="text-muted-foreground">{new Date(nte.acknowledgedAt).toLocaleString()}</span></div>}
                                        </div>
                                    ) : !isClosed && isStaff ? (
                                        <Button size="sm" onClick={() => setNteOpen(true)}>Issue NTE</Button>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">{isClosed ? "No notice issued." : "Waiting for HR to issue the notice."}</p>
                                    )
                                }
                            />
                        )}

                        {/* Step 2: Acknowledge NTE */}
                        {nte && (
                            <Step
                                active={c.status === "nte_issued"}
                                done={c.status !== "nte_issued" && c.status !== "open"}
                                title="2. Employee Acknowledges NTE"
                                icon={CheckCircle2}
                                body={
                                    nte.acknowledgedAt ? (
                                        <p className="text-sm text-muted-foreground">Acknowledged on {new Date(nte.acknowledgedAt).toLocaleString()}</p>
                                    ) : !isClosed && (isStaff || isCaseEmployee) ? (
                                        <Button size="sm" variant="outline" onClick={() => { acknowledgeNTE(nte.id); toast.success(isStaff ? "Marked as acknowledged" : "NTE acknowledged"); }}>
                                            {isStaff ? "Mark Acknowledged" : "Acknowledge NTE"}
                                        </Button>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">{isClosed ? "Not acknowledged before closure." : "Waiting for employee acknowledgment."}</p>
                                    )
                                }
                            />
                        )}

                        {/* Step 3: Submit Explanation */}
                        {nte && nte.acknowledgedAt && (
                            <Step
                                active={c.status === "nte_acknowledged"}
                                done={["explanation_submitted", "no_response", "under_review", "nod_issued", "nod_acknowledged", "sanction_active", "closed"].includes(c.status)}
                                title="3. Employee Submits Explanation"
                                icon={MessageSquare}
                                body={
                                    nte.employeeExplanation ? (
                                        <div className="text-sm">
                                            <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 mb-1">{nte.employeeExplanation}</p>
                                            <p className="text-xs text-muted-foreground">Submitted {new Date(nte.explanationSubmittedAt!).toLocaleString()}</p>
                                        </div>
                                    ) : nte.status === "no_response" ? (
                                        <p className="text-sm text-orange-700">Marked as no-response.</p>
                                    ) : !isClosed && (isStaff || isCaseEmployee) ? (
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => setExplanationOpen(true)}>{isStaff ? "Record Explanation" : "Submit Explanation"}</Button>
                                            {isStaff && (
                                                <Button size="sm" variant="outline" onClick={() => { markNoResponse(nte.id); toast.success("Marked as no-response"); }}>
                                                    Mark No-Response
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">{isClosed ? "No explanation submitted before closure." : "Waiting for employee explanation."}</p>
                                    )
                                }
                            />
                        )}

                        {/* Step 4: Move to Review */}
                        {isStaff && (c.status === "explanation_submitted" || c.status === "no_response") && !isClosed && (
                            <Step active={c.status === "under_review"} done={false} title="4. Review by HR" icon={FileText}
                                body={<Button size="sm" variant="outline" onClick={() => { moveToReview(c.id); toast.success("Moved to under review"); }}>Move to Under Review</Button>}
                            />
                        )}

                        {/* Step 5: Issue NOD */}
                        {isStaff && !nod && (c.status === "under_review" || c.status === "explanation_submitted" || c.status === "no_response") && !isClosed && (
                            <Step active done={false} title="5. Issue Notice of Decision (NOD)" icon={ShieldAlert}
                                body={<Button size="sm" onClick={() => setNodOpen(true)}>Issue NOD</Button>}
                            />
                        )}

                        {/* Step 5: NOD details */}
                        {nod && (
                            <Step active={c.status === "nod_issued"} done={c.status !== "nod_issued"}
                                title="5. Notice of Decision Issued" icon={ShieldAlert}
                                body={
                                    <div className="text-sm space-y-1">
                                        <div>Decision: <Badge variant="secondary" className="capitalize">{nod.decision.replace(/_/g, " ")}</Badge></div>
                                        <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3">{nod.decisionDetails}</p>
                                        {nod.sanctionStartDate && <div>Sanction: {nod.sanctionStartDate} → {nod.sanctionEndDate ?? "—"}</div>}
                                        {!nod.acknowledgedAt && nod.decision !== "no_violation" && !isClosed && (isStaff || isCaseEmployee) && (
                                            <Button size="sm" variant="outline" onClick={() => { acknowledgeNOD(nod.id); toast.success(isStaff ? "Marked as acknowledged" : "NOD acknowledged"); }}>
                                                {isStaff ? "Mark Acknowledged" : "Acknowledge NOD"}
                                            </Button>
                                        )}
                                        {nod.acknowledgedAt && <p className="text-xs text-muted-foreground">Acknowledged {new Date(nod.acknowledgedAt).toLocaleString()}</p>}
                                    </div>
                                }
                            />
                        )}

                        {/* Step 6: Sanction active (Mark Sanction Completed) */}
                        {nod && (nod.decision === "suspension" || nod.decision === "training_required" || nod.decision === "pip" || nod.decision === "salary_deduction") && nod.status === "sanction_active" && (
                            <Step
                                active={c.status === "sanction_active"}
                                done={c.status === "closed"}
                                title="6. Sanction Execution"
                                icon={Gavel}
                                body={
                                    c.status === "sanction_active" ? (
                                        isStaff && !isClosed ? (
                                            <Button size="sm" onClick={() => setSanctionCompleteOpen(true)}>
                                                Mark Sanction Completed
                                            </Button>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">Sanction is currently active.</p>
                                        )
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Sanction completed and case closed.</p>
                                    )
                                }
                            />
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Investigation Notes Section */}
            {isStaff && (
                <Card className="border border-border/50">
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" /> Investigation Notes
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Add Note Form */}
                        {c.status === "under_review" && (
                            <div className="space-y-2 border-b pb-4">
                                <Label htmlFor="new-note-body">Add Investigation Note</Label>
                                <Textarea
                                    id="new-note-body"
                                    rows={3}
                                    placeholder="Enter case note details..."
                                    value={noteBody}
                                    onChange={(e) => setNoteBody(e.target.value)}
                                />
                                <Button
                                    size="sm"
                                    onClick={() => {
                                        if (!noteBody || !noteBody.trim()) {
                                            toast.error("Note cannot be empty");
                                            return;
                                        }
                                        addNote(c.id, noteBody.trim(), currentUser.id);
                                        toast.success("Note saved");
                                        setNoteBody("");
                                    }}
                                >
                                    Save Note
                                </Button>
                            </div>
                        )}

                        {/* Notes List */}
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                            {sortedNotes.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">No notes recorded yet.</p>
                            ) : (
                                sortedNotes.map((n) => {
                                    const author = employees.find((e) => e.id === n.authorId);
                                    const authorName = author ? author.name : n.authorId;
                                    return (
                                        <div key={n.id} className="rounded-md bg-muted/30 p-3 border border-border/30 space-y-1">
                                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                <span className="font-semibold text-foreground/80">{authorName}</span>
                                                <span>{new Date(n.createdAt).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{n.body}</p>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Dialogs ────────────────────────────────────────── */}

            {/* Mark Sanction Completed Dialog */}
            <Dialog open={sanctionCompleteOpen} onOpenChange={(v) => { setSanctionCompleteOpen(v); if (!v) { setSelectedResult(""); setResultError(""); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Mark Sanction Completed</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Marking the sanction as completed will resolve and close the case. Please select the final case outcome.
                        </p>
                        <div>
                            <Label htmlFor="case-result-select">Case Result <span className="text-red-500">*</span></Label>
                            <Select value={selectedResult} onValueChange={(v) => { setSelectedResult(v); setResultError(""); }}>
                                <SelectTrigger id="case-result-select" className="mt-1">
                                    <SelectValue placeholder="Select outcome result" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DISMISSED">Dismissed</SelectItem>
                                    <SelectItem value="VERBAL_WARNING">Verbal Warning</SelectItem>
                                    <SelectItem value="WRITTEN_WARNING">Written Warning</SelectItem>
                                    <SelectItem value="FINAL_WARNING">Final Warning</SelectItem>
                                    <SelectItem value="SUSPENSION">Suspension</SelectItem>
                                    <SelectItem value="TERMINATION">Termination</SelectItem>
                                    <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
                                    <SelectItem value="SETTLED">Settled</SelectItem>
                                </SelectContent>
                            </Select>
                            {resultError && <p className="text-xs text-red-500 mt-1">{resultError}</p>}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSanctionCompleteOpen(false)}>Cancel</Button>
                        <Button
                            onClick={async () => {
                                if (!selectedResult) {
                                    setResultError("Case result is required");
                                    return;
                                }
                                try {
                                    await completeSanction(c.id, selectedResult as any, currentUser.id);
                                    toast.success("Sanction marked completed and case closed");
                                    setSanctionCompleteOpen(false);
                                } catch {
                                    toast.error("Failed to complete sanction");
                                }
                            }}
                        >
                            Confirm Completion
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Issue NTE */}
            <Dialog open={nteOpen} onOpenChange={setNteOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Issue NTE</DialogTitle></DialogHeader>
                    <div>
                        <Label>Response Deadline</Label>
                        <Input type="date" value={nteDeadline} onChange={(e) => setNteDeadline(e.target.value)} />
                        <p className="text-xs text-muted-foreground mt-1">Standard: 5 calendar days from issuance.</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNteOpen(false)}>Cancel</Button>
                        <Button onClick={handleIssueNTE}>Issue</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Explanation */}
            <Dialog open={explanationOpen} onOpenChange={setExplanationOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Record Employee Explanation</DialogTitle></DialogHeader>
                    <Textarea rows={5} value={explanationText} onChange={(e) => setExplanationText(e.target.value)}
                        placeholder="Type or paste the employee's written explanation…" />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setExplanationOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmitExplanation}>Submit</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Issue NOD */}
            <Dialog open={nodOpen} onOpenChange={setNodOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader><DialogTitle>Issue Notice of Decision</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label>Decision</Label>
                            <Select value={nodForm.decision} onValueChange={(v) => setNodForm((f) => ({ ...f, decision: v as NODDecision }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="no_violation">No Violation (close case)</SelectItem>
                                    <SelectItem value="verbal_warning">Verbal Warning</SelectItem>
                                    <SelectItem value="written_warning">Written Warning</SelectItem>
                                    <SelectItem value="final_warning">Final Warning</SelectItem>
                                    <SelectItem value="suspension">Suspension</SelectItem>
                                    <SelectItem value="termination">Termination</SelectItem>
                                    <SelectItem value="salary_deduction">Salary Deduction</SelectItem>
                                    <SelectItem value="training_required">Training Required</SelectItem>
                                    <SelectItem value="pip">Performance Improvement Plan</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Decision Details</Label>
                            <Textarea rows={4} value={nodForm.details} onChange={(e) => setNodForm((f) => ({ ...f, details: e.target.value }))} />
                        </div>
                        {(nodForm.decision === "suspension" || nodForm.decision === "training_required" || nodForm.decision === "pip") && (
                            <div className="grid grid-cols-3 gap-3">
                                <div><Label>Start</Label><Input type="date" value={nodForm.start} onChange={(e) => setNodForm((f) => ({ ...f, start: e.target.value }))} /></div>
                                <div><Label>End</Label><Input type="date" value={nodForm.end} onChange={(e) => setNodForm((f) => ({ ...f, end: e.target.value }))} /></div>
                                <div><Label>Return to Work</Label><Input type="date" value={nodForm.rtw} onChange={(e) => setNodForm((f) => ({ ...f, rtw: e.target.value }))} /></div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNodOpen(false)}>Cancel</Button>
                        <Button onClick={handleIssueNOD}>Issue NOD</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b last:border-0">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium text-right max-w-[60%] break-words">{value}</span>
        </div>
    );
}

function Step({ active, done, title, icon: Icon, body }: { active: boolean; done: boolean; title: string; icon: typeof Mail; body: React.ReactNode }) {
    const tone = done
        ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20"
        : active
            ? "border-amber-400 bg-amber-50/40 dark:border-amber-600 dark:bg-amber-950/20"
            : "border-muted bg-muted/30 opacity-70";
    return (
        <div className={`rounded-md border ${tone} p-3`}>
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${done ? "text-emerald-600" : active ? "text-amber-500" : "text-muted-foreground"}`} />
                <h3 className="font-medium text-sm">{title}</h3>
            </div>
            <div className="pl-6">{body}</div>
        </div>
    );
}