"use client";

import { use, useState } from "react";
import Link from "next/link";
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
import { ArrowLeft, Gavel, Mail, MessageSquare, ShieldAlert, CheckCircle2, FileText, X } from "lucide-react";
import { toast } from "sonner";
import type { NODDecision } from "@/types";

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

    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);

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

    if (!c) {
        return (
            <div className="p-6">
                <Card><CardContent className="p-8 text-center space-y-3">
                    <p className="text-muted-foreground">Case not found.</p>
                    <Link href={rh("/disciplinary")}>
                        <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-2" /> Back to cases</Button>
                    </Link>
                </CardContent></Card>
            </div>
        );
    }

    const emp = employees.find((e) => e.id === c.employeeId);
    void role;

    const handleIssueNTE = () => {
        const r = issueNTE(c.id, { responseDeadline: nteDeadline, issuedBy: currentUser.id });
        if (!r) { toast.error("NTE could not be issued"); return; }
        toast.success("NTE issued");
        setNteOpen(false);
    };

    const handleSubmitExplanation = () => {
        if (!nte) return;
        if (!explanationText.trim()) { toast.error("Explanation cannot be empty"); return; }
        submitExplanation(nte.id, explanationText.trim());
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

    return (
        <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <Button variant="ghost" size="sm" onClick={() => router.push(rh("/disciplinary"))}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Gavel className="h-6 w-6 text-primary" /> {c.caseNumber}
                    </h1>
                    <p className="text-sm text-muted-foreground">{emp?.name ?? c.employeeId} · {c.violationType}</p>
                </div>
                <Badge className="capitalize">{c.status.replace(/_/g, " ")}</Badge>
            </div>

            {/* Case details */}
            <Card>
                <CardHeader><CardTitle className="text-base">Case Details</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <Row label="Employee" value={emp?.name ?? c.employeeId} />
                    <Row label="Department" value={emp?.department ?? "—"} />
                    <Row label="Violation" value={c.violationType} />
                    <Row label="Policy Reference" value={c.policyReference ?? "—"} />
                    <Row label="Incident Date" value={new Date(c.incidentDate).toLocaleDateString()} />
                    <Row label="Location" value={c.incidentLocation ?? "—"} />
                    <div>
                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Description</div>
                        <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3">{c.description}</p>
                    </div>
                </CardContent>
            </Card>

            {/* Timeline / actions */}
            <Card>
                <CardHeader><CardTitle className="text-base">Timeline & Actions</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {/* Step: Issue NTE */}
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
                            ) : (
                                <Button size="sm" onClick={() => setNteOpen(true)}>Issue NTE</Button>
                            )
                        }
                    />

                    {/* Step: Acknowledge NTE */}
                    {nte && (
                        <Step
                            active={c.status === "nte_issued"}
                            done={c.status !== "nte_issued" && c.status !== "open"}
                            title="2. Employee Acknowledges NTE"
                            icon={CheckCircle2}
                            body={
                                nte.acknowledgedAt ? (
                                    <p className="text-sm text-muted-foreground">Acknowledged on {new Date(nte.acknowledgedAt).toLocaleString()}</p>
                                ) : (
                                    <Button size="sm" variant="outline" onClick={() => { acknowledgeNTE(nte.id); toast.success("Marked as acknowledged"); }}>
                                        Mark Acknowledged
                                    </Button>
                                )
                            }
                        />
                    )}

                    {/* Step: Submit Explanation */}
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
                                ) : (
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={() => setExplanationOpen(true)}>Record Explanation</Button>
                                        <Button size="sm" variant="outline" onClick={() => { markNoResponse(nte.id); toast.success("Marked as no-response"); }}>
                                            Mark No-Response
                                        </Button>
                                    </div>
                                )
                            }
                        />
                    )}

                    {/* Step: Move to Review */}
                    {(c.status === "explanation_submitted" || c.status === "no_response") && (
                        <Step active done={false} title="4. Review by HR" icon={FileText}
                            body={<Button size="sm" variant="outline" onClick={() => { moveToReview(c.id); toast.success("Moved to under review"); }}>Move to Under Review</Button>}
                        />
                    )}

                    {/* Step: Issue NOD */}
                    {!nod && (c.status === "under_review" || c.status === "explanation_submitted" || c.status === "no_response") && (
                        <Step active done={false} title="5. Issue Notice of Decision (NOD)" icon={ShieldAlert}
                            body={<Button size="sm" onClick={() => setNodOpen(true)}>Issue NOD</Button>}
                        />
                    )}

                    {/* Step: NOD details */}
                    {nod && (
                        <Step active={c.status === "nod_issued"} done={c.status !== "nod_issued"}
                            title="5. Notice of Decision Issued" icon={ShieldAlert}
                            body={
                                <div className="text-sm space-y-1">
                                    <div>Decision: <Badge variant="secondary" className="capitalize">{nod.decision.replace(/_/g, " ")}</Badge></div>
                                    <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3">{nod.decisionDetails}</p>
                                    {nod.sanctionStartDate && <div>Sanction: {nod.sanctionStartDate} → {nod.sanctionEndDate ?? "—"}</div>}
                                    {!nod.acknowledgedAt && nod.decision !== "no_violation" && (
                                        <Button size="sm" variant="outline" onClick={() => { acknowledgeNOD(nod.id); toast.success("Marked as acknowledged"); }}>
                                            Mark Acknowledged
                                        </Button>
                                    )}
                                    {nod.acknowledgedAt && <p className="text-xs text-muted-foreground">Acknowledged {new Date(nod.acknowledgedAt).toLocaleString()}</p>}
                                </div>
                            }
                        />
                    )}

                    {/* Close case */}
                    {c.status !== "closed" && (
                        <div className="pt-4 border-t">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm"><X className="h-4 w-4 mr-2" /> Close Case</Button>
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
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Issue NTE dialog */}
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

            {/* Explanation dialog */}
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

            {/* Issue NOD dialog */}
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
        <div className="flex justify-between gap-4 py-1 border-b last:border-0">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
            <span className="text-sm font-medium">{value}</span>
        </div>
    );
}

function Step({ active, done, title, icon: Icon, body }: { active: boolean; done: boolean; title: string; icon: typeof Mail; body: React.ReactNode }) {
    const tone = done ? "border-emerald-300 bg-emerald-50/40" : active ? "border-primary/40 bg-primary/5" : "border-muted bg-muted/30 opacity-70";
    return (
        <div className={`rounded-md border ${tone} p-3`}>
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${done ? "text-emerald-600" : active ? "text-primary" : "text-muted-foreground"}`} />
                <h3 className="font-medium text-sm">{title}</h3>
            </div>
            <div className="pl-6">{body}</div>
        </div>
    );
}
