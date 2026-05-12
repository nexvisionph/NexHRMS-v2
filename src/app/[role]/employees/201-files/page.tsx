"use client";

import { useState, useMemo } from "react";
import { useDocumentsStore, DOCUMENT_TYPE_LABELS, REQUIRED_DOCUMENTS, type DocumentType, type DocumentStatus, type Employee201Document } from "@/store/documents.store";
import { useEmployeesStore } from "@/store/employees.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Upload, AlertTriangle, CheckCircle, Clock, Search, Plus } from "lucide-react";

const STATUS_COLORS: Record<DocumentStatus, string> = {
  pending_upload: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  uploaded: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  for_review: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  expired: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  archived: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export default function EmployeeDocumentsPage() {
  const { documents, addDocument, approveDocument, rejectDocument, getMissingDocuments, getExpiringDocuments } = useDocumentsStore();
  const employees = useEmployeesStore((s) => s.employees);

  const [search, setSearch] = useState("");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Form state
  const [newDoc, setNewDoc] = useState({
    employeeId: "",
    documentType: "other" as DocumentType,
    title: "",
    description: "",
    visibility: "hr_only" as const,
    expiryDate: "",
  });

  // Gap analysis
  const gapAnalysis = useMemo(() => {
    return employees
      .filter((e) => e.status === "active")
      .map((emp) => ({
        employee: emp,
        missing: getMissingDocuments(emp.id),
      }))
      .filter((g) => g.missing.length > 0);
  }, [employees, getMissingDocuments]);

  const expiringDocs = getExpiringDocuments(30);

  // Filtered documents
  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (filterEmployee !== "all" && d.employeeId !== filterEmployee) return false;
      if (filterStatus !== "all" && d.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        const empName = employees.find((e) => e.id === d.employeeId)?.name?.toLowerCase() || "";
        return d.title.toLowerCase().includes(q) || empName.includes(q) || DOCUMENT_TYPE_LABELS[d.documentType].toLowerCase().includes(q);
      }
      return true;
    });
  }, [documents, filterEmployee, filterStatus, search, employees]);

  const handleAddDocument = () => {
    if (!newDoc.employeeId || !newDoc.title) return;
    addDocument({
      ...newDoc,
      status: "uploaded",
      expiryDate: newDoc.expiryDate || undefined,
    });
    setShowAddDialog(false);
    setNewDoc({ employeeId: "", documentType: "other", title: "", description: "", visibility: "hr_only", expiryDate: "" });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">201 Files / Document Center</h1>
          <p className="text-muted-foreground">Manage employee documents, track compliance, and identify gaps.</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Document</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Employee</Label>
                <Select value={newDoc.employeeId} onValueChange={(v) => setNewDoc({ ...newDoc, employeeId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.filter((e) => e.status === "active").map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Document Type</Label>
                <Select value={newDoc.documentType} onValueChange={(v) => setNewDoc({ ...newDoc, documentType: v as DocumentType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOCUMENT_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title</Label>
                <Input value={newDoc.title} onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })} placeholder="Document title" />
              </div>
              <div>
                <Label>Description (optional)</Label>
                <Textarea value={newDoc.description} onChange={(e) => setNewDoc({ ...newDoc, description: e.target.value })} />
              </div>
              <div>
                <Label>Expiry Date (optional)</Label>
                <Input type="date" value={newDoc.expiryDate} onChange={(e) => setNewDoc({ ...newDoc, expiryDate: e.target.value })} />
              </div>
              <Button onClick={handleAddDocument} className="w-full">Upload Document</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{documents.length}</p>
                <p className="text-sm text-muted-foreground">Total Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{documents.filter((d) => d.status === "for_review").length}</p>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{gapAnalysis.length}</p>
                <p className="text-sm text-muted-foreground">Employees with Gaps</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{documents.filter((d) => d.status === "approved").length}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gap Analysis Alert */}
      {gapAnalysis.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="text-orange-600 dark:text-orange-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Document Gap Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {gapAnalysis.slice(0, 5).map((g) => (
                <div key={g.employee.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="font-medium">{g.employee.name}</span>
                  <div className="flex gap-1 flex-wrap">
                    {g.missing.map((docType) => (
                      <Badge key={docType} variant="outline" className="text-xs">{DOCUMENT_TYPE_LABELS[docType]}</Badge>
                    ))}
                  </div>
                </div>
              ))}
              {gapAnalysis.length > 5 && (
                <p className="text-sm text-muted-foreground">...and {gapAnalysis.length - 5} more employees</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expiring Documents Alert */}
      {expiringDocs.length > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader>
            <CardTitle className="text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Expiring Soon ({expiringDocs.length} documents)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringDocs.slice(0, 3).map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <span className="font-medium">{d.title}</span>
                    <span className="text-sm text-muted-foreground ml-2">({employees.find((e) => e.id === d.employeeId)?.name})</span>
                  </div>
                  <Badge variant="outline">Expires: {d.expiryDate}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Employees" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees.filter((e) => e.status === "active").map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending_upload">Pending Upload</SelectItem>
            <SelectItem value="uploaded">Uploaded</SelectItem>
            <SelectItem value="for_review">For Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Documents Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Document Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No documents found. Upload documents to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{employees.find((e) => e.id === doc.employeeId)?.name || "Unknown"}</TableCell>
                    <TableCell>{DOCUMENT_TYPE_LABELS[doc.documentType]}</TableCell>
                    <TableCell>{doc.title}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[doc.status]}>{doc.status.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {doc.status === "for_review" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => approveDocument(doc.id, "admin")}>Approve</Button>
                            <Button size="sm" variant="outline" className="text-red-600" onClick={() => rejectDocument(doc.id, "admin", "Does not meet requirements")}>Reject</Button>
                          </>
                        )}
                      </div>
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
