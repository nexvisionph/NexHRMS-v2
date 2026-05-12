"use client";

import { useState, useMemo } from "react";
import { useDisciplinaryStore, type CaseStatus, type DisciplinaryCase } from "@/store/disciplinary.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, FileWarning, Scale, Shield, Search, Plus, Eye } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

const STATUS_LABELS: Record<CaseStatus, string> = {
  open: "Open",
  nte_issued: "NTE Issued",
  nte_acknowledged: "NTE Acknowledged",
  explanation_submitted: "Explanation Submitted",
  under_review: "Under Review",
  nod_issued: "NOD Issued",
  nod_acknowledged: "NOD Acknowledged",
  sanction_active: "Sanction Active",
  closed: "Closed",
};

const STATUS_COLORS: Record<CaseStatus, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  nte_issued: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  nte_acknowledged: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  explanation_submitted: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  under_review: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  nod_issued: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  nod_acknowledged: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  sanction_active: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  closed: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function DisciplinaryPage() {
  const params = useParams();
  const role = params.role as string;
  const { cases, createCase, getKPIs } = useDisciplinaryStore();
  const employees = useEmployeesStore((s) => s.employees);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Form state
  const [newCase, setNewCase] = useState({
    employeeId: "",
    incidentDate: "",
    incidentDescription: "",
    category: "",
    severity: "moderate" as "minor" | "moderate" | "major" | "grave",
  });

  const kpis = getKPIs();

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        return c.employeeName.toLowerCase().includes(q) || c.incidentDescription.toLowerCase().includes(q);
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [cases, filterStatus, search]);

  const handleCreateCase = () => {
    const emp = employees.find((e) => e.id === newCase.employeeId);
    if (!emp || !newCase.incidentDate || !newCase.incidentDescription) return;

    createCase({
      employeeId: newCase.employeeId,
      employeeName: emp.name,
      incidentDate: newCase.incidentDate,
      incidentDescription: newCase.incidentDescription,
      reportedBy: currentUser.name || "Admin",
      reportedAt: new Date().toISOString(),
      category: newCase.category || undefined,
      severity: newCase.severity,
    });

    setShowCreateDialog(false);
    setNewCase({ employeeId: "", incidentDate: "", incidentDescription: "", category: "", severity: "moderate" });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Disciplinary Management</h1>
          <p className="text-muted-foreground">NTE & NOD workflow for employee disciplinary cases.</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Case</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Disciplinary Case</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Employee</Label>
                <Select value={newCase.employeeId} onValueChange={(v) => setNewCase({ ...newCase, employeeId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.filter((e) => e.status === "active").map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Incident Date</Label>
                <Input type="date" value={newCase.incidentDate} onChange={(e) => setNewCase({ ...newCase, incidentDate: e.target.value })} />
              </div>
              <div>
                <Label>Severity</Label>
                <Select value={newCase.severity} onValueChange={(v) => setNewCase({ ...newCase, severity: v as typeof newCase.severity })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="major">Major</SelectItem>
                    <SelectItem value="grave">Grave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category (optional)</Label>
                <Input value={newCase.category} onChange={(e) => setNewCase({ ...newCase, category: e.target.value })} placeholder="e.g., Tardiness, Insubordination" />
              </div>
              <div>
                <Label>Incident Description</Label>
                <Textarea value={newCase.incidentDescription} onChange={(e) => setNewCase({ ...newCase, incidentDescription: e.target.value })} placeholder="Describe the incident..." rows={4} />
              </div>
              <Button onClick={handleCreateCase} className="w-full">Create Case</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{kpis.open}</p>
              <p className="text-xs text-muted-foreground">Open</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{kpis.awaitingExplanation}</p>
              <p className="text-xs text-muted-foreground">Awaiting Explanation</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{kpis.forReview}</p>
              <p className="text-xs text-muted-foreground">For Review</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{kpis.nodPending}</p>
              <p className="text-xs text-muted-foreground">NOD Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{kpis.suspensionsActive}</p>
              <p className="text-xs text-muted-foreground">Suspensions Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-600">{kpis.closed}</p>
              <p className="text-xs text-muted-foreground">Closed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search cases..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cases Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Incident Date</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No disciplinary cases found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.employeeName}</TableCell>
                    <TableCell>{c.incidentDate}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{c.severity || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[c.status]}>{STATUS_LABELS[c.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(c.reportedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Link href={`/${role}/disciplinary/${c.id}`}>
                        <Button size="sm" variant="outline"><Eye className="h-3 w-3 mr-1" />View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
