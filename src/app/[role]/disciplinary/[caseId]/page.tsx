"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDisciplinaryStore, type NODDecision } from "@/store/disciplinary.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, AlertTriangle, CheckCircle, Clock, Scale } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const NOD_DECISIONS: { value: NODDecision; label: string }[] = [
  { value: "no_violation", label: "No Violation Found" },
  { value: "verbal_warning", label: "Verbal Warning" },
  { value: "written_warning", label: "Written Warning" },
  { value: "final_warning", label: "Final Warning" },
  { value: "suspension", label: "Suspension" },
  { value: "termination", label: "Termination" },
  { value: "salary_deduction", label: "Salary Deduction" },
  { value: "training_required", label: "Training Required" },
  { value: "pip", label: "Performance Improvement Plan" },
];

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const role = params.role as string;
  const caseId = params.caseId as string;

  const { getCaseById, getNTEForCase, getNODForCase, issueNTE, acknowledgeNTE, submitExplanation, markNoResponse, moveToReview, issueNOD, acknowledgeNOD, closeCase } = useDisciplinaryStore();
  const currentUser = useAuthStore((s) => s.currentUser);

  const disciplinaryCase = getCaseById(caseId);
  const nte = getNTEForCase(caseId);
  const nod = getNODForCase(caseId);

  // NTE form
  const [nteAllegations, setNteAllegations] = useState("");
  const [nteDeadline, setNteDeadline] = useState("");

  // Explanation form
  const [explanation, setExplanation] = useState("");

  // NOD form
  const [nodDecision, setNodDecision] = useState<NODDecision>("verbal_warning");
  const [nodFindings, setNodFindings] = useState("");
  const [sanctionStart, setSanctionStart] = useState("");
  const [sanctionEnd, setSanctionEnd] = useState("");

  if (!disciplinaryCase) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Case not found.</p>
        <Link href={`/${role}/disciplinary`}>
          <Button variant="outline" className="mt-4"><ArrowLeft className="h-4 w-4 mr-2" />Back to Cases</Button>
        </Link>
      </div>
    );
  }

  const handleIssueNTE = () => {
    if (!nteAllegations || !nteDeadline) return;
    issueNTE({
      caseId,
      employeeId: disciplinaryCase.employeeId,
      issuedBy: currentUser.name || "Admin",
      issuedAt: new Date().toISOString(),
      responseDeadline: nteDeadline,
      allegations: nteAllegations,
    });
    setNteAllegations("");
    setNteDeadline("");
  };

  const handleSubmitExplanation = () => {
    if (!nte || !explanation) return;
    submitExplanation(nte.id, explanation);
    setExplanation("");
  };

  const handleIssueNOD = () => {
    if (!nodFindings) return;
    issueNOD({
      caseId,
      employeeId: disciplinaryCase.employeeId,
      issuedBy: currentUser.name || "Admin",
      issuedAt: new Date().toISOString(),
      decision: nodDecision,
      findings: nodFindings,
      sanctionStartDate: sanctionStart || undefined,
      sanctionEndDate: sanctionEnd || undefined,
    });
  };

  // Timeline events
  const timeline = useMemo(() => {
    const events: { date: string; label: string; icon: React.ReactNode; color: string }[] = [];
    events.push({ date: disciplinaryCase.reportedAt, label: "Case opened — incident reported", icon: <AlertTriangle className="h-4 w-4" />, color: "text-blue-500" });
    if (nte) {
      events.push({ date: nte.issuedAt, label: "NTE issued", icon: <FileText className="h-4 w-4" />, color: "text-yellow-500" });
      if (nte.acknowledgedAt) events.push({ date: nte.acknowledgedAt, label: "NTE acknowledged by employee", icon: <CheckCircle className="h-4 w-4" />, color: "text-green-500" });
      if (nte.explanationSubmittedAt) events.push({ date: nte.explanationSubmittedAt, label: "Explanation submitted", icon: <FileText className="h-4 w-4" />, color: "text-purple-500" });
      if (nte.noResponseMarkedAt) events.push({ date: nte.noResponseMarkedAt, label: "No response — moved to review", icon: <Clock className="h-4 w-4" />, color: "text-orange-500" });
    }
    if (nod) {
      events.push({ date: nod.issuedAt, label: `NOD issued — Decision: ${nod.decision.replace(/_/g, " ")}`, icon: <Scale className="h-4 w-4" />, color: "text-red-500" });
      if (nod.acknowledgedAt) events.push({ date: nod.acknowledgedAt, label: "NOD acknowledged by employee", icon: <CheckCircle className="h-4 w-4" />, color: "text-green-500" });
    }
    if (disciplinaryCase.closedAt) events.push({ date: disciplinaryCase.closedAt, label: "Case closed", icon: <CheckCircle className="h-4 w-4" />, color: "text-gray-500" });
    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [disciplinaryCase, nte, nod]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link href={`/${role}/disciplinary`}>
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Case: {disciplinaryCase.employeeName}</h1>
          <p className="text-muted-foreground">Status: <Badge className="ml-1">{disciplinaryCase.status.replace(/_/g, " ")}</Badge></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Case Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {timeline.map((event, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className={`mt-0.5 ${event.color}`}>{event.icon}</div>
                    <div>
                      <p className="text-sm font-medium">{event.label}</p>
                      <p className="text-xs text-muted-foreground">{new Date(event.date).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Incident Details */}
          <Card>
            <CardHeader><CardTitle>Incident Details</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p><strong>Date:</strong> {disciplinaryCase.incidentDate}</p>
              <p><strong>Severity:</strong> <Badge variant="outline" className="capitalize">{disciplinaryCase.severity}</Badge></p>
              {disciplinaryCase.category && <p><strong>Category:</strong> {disciplinaryCase.category}</p>}
              <p><strong>Description:</strong></p>
              <p className="text-sm bg-muted p-3 rounded-md">{disciplinaryCase.incidentDescription}</p>
            </CardContent>
          </Card>

          {/* NTE Details */}
          {nte && (
            <Card>
              <CardHeader><CardTitle>Notice to Explain (NTE)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p><strong>Allegations:</strong></p>
                <p className="text-sm bg-muted p-3 rounded-md">{nte.allegations}</p>
                <p><strong>Response Deadline:</strong> {nte.responseDeadline}</p>
                {nte.explanationText && (
                  <>
                    <p><strong>Employee Explanation:</strong></p>
                    <p className="text-sm bg-muted p-3 rounded-md">{nte.explanationText}</p>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* NOD Details */}
          {nod && (
            <Card>
              <CardHeader><CardTitle>Notice of Decision (NOD)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p><strong>Decision:</strong> <Badge>{nod.decision.replace(/_/g, " ")}</Badge></p>
                <p><strong>Findings:</strong></p>
                <p className="text-sm bg-muted p-3 rounded-md">{nod.findings}</p>
                {nod.sanctionStartDate && <p><strong>Sanction Start:</strong> {nod.sanctionStartDate}</p>}
                {nod.sanctionEndDate && <p><strong>Sanction End:</strong> {nod.sanctionEndDate}</p>}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Action Panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Issue NTE */}
              {disciplinaryCase.status === "open" && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Issue NTE</h4>
                  <Textarea placeholder="Allegations..." value={nteAllegations} onChange={(e) => setNteAllegations(e.target.value)} rows={3} />
                  <div>
                    <Label className="text-xs">Response Deadline</Label>
                    <Input type="date" value={nteDeadline} onChange={(e) => setNteDeadline(e.target.value)} />
                  </div>
                  <Button onClick={handleIssueNTE} className="w-full" size="sm">Issue NTE</Button>
                </div>
              )}

              {/* Acknowledge NTE (employee action) */}
              {disciplinaryCase.status === "nte_issued" && nte && !nte.acknowledgedAt && (
                <Button onClick={() => acknowledgeNTE(nte.id)} className="w-full" variant="outline">Acknowledge NTE</Button>
              )}

              {/* Submit Explanation */}
              {(disciplinaryCase.status === "nte_issued" || disciplinaryCase.status === "nte_acknowledged") && nte && !nte.explanationText && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Submit Explanation</h4>
                  <Textarea placeholder="Employee explanation..." value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={3} />
                  <Button onClick={handleSubmitExplanation} className="w-full" size="sm">Submit</Button>
                  <Button onClick={() => markNoResponse(nte.id)} variant="outline" className="w-full" size="sm">Mark No Response</Button>
                </div>
              )}

              {/* Move to Review */}
              {disciplinaryCase.status === "explanation_submitted" && (
                <Button onClick={() => moveToReview(caseId)} className="w-full">Move to Review</Button>
              )}

              {/* Issue NOD */}
              {disciplinaryCase.status === "under_review" && (
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">Issue NOD</h4>
                  <Select value={nodDecision} onValueChange={(v) => setNodDecision(v as NODDecision)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {NOD_DECISIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea placeholder="Findings..." value={nodFindings} onChange={(e) => setNodFindings(e.target.value)} rows={3} />
                  {(nodDecision === "suspension" || nodDecision === "termination") && (
                    <>
                      <Input type="date" placeholder="Sanction start" value={sanctionStart} onChange={(e) => setSanctionStart(e.target.value)} />
                      <Input type="date" placeholder="Sanction end" value={sanctionEnd} onChange={(e) => setSanctionEnd(e.target.value)} />
                    </>
                  )}
                  <Button onClick={handleIssueNOD} className="w-full" size="sm">Issue NOD</Button>
                </div>
              )}

              {/* Acknowledge NOD */}
              {disciplinaryCase.status === "nod_issued" && nod && !nod.acknowledgedAt && (
                <Button onClick={() => acknowledgeNOD(nod.id)} className="w-full" variant="outline">Acknowledge NOD</Button>
              )}

              {/* Close Case */}
              {disciplinaryCase.status !== "closed" && (
                <Button onClick={() => closeCase(caseId, currentUser.name || "Admin")} variant="outline" className="w-full text-gray-600">Close Case</Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
