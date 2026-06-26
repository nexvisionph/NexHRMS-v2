"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle,
  XCircle,
  Edit,
  MessageSquare,
  RefreshCw,
  Loader2,
  MapPin,
  Clock,
  Users,
  AlertCircle,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { useDepartmentsStore } from "@/store/departments.store";

interface AttendanceReviewRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  source: "biometric" | "mobile_gps" | "web" | "manual";
  locationLat: number | null;
  locationLng: number | null;
  selfieUrl: string | null;
  distanceMeters: number | null;
  isWithinGeofence: boolean | null;
  status: "pending" | "approved" | "rejected" | "edited";
}

const SOURCE_CONFIG = {
  biometric: { label: "Biometric", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-300/50" },
  mobile_gps: { label: "Mobile GPS", className: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-300/50" },
  web: { label: "Web / QR", className: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-300/50" },
  manual: { label: "Manual", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300/50" },
};

const STATUS_CONFIG = {
  pending: { label: "Pending", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300/50" },
  approved: { label: "Approved", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300/50" },
  rejected: { label: "Rejected", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-300/50" },
  edited: { label: "Edited", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-300/50" },
};

function StatusBadge({ status }: { status: AttendanceReviewRecord["status"] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <Badge variant="outline" className={`text-[10px] font-semibold border ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

function SourceBadge({ source }: { source: AttendanceReviewRecord["source"] }) {
  const cfg = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.web;
  return (
    <Badge variant="outline" className={`text-[10px] font-semibold border ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

export default function AttendanceReviewPage() {
  const departments = useDepartmentsStore((s) => s.departments);

  const [records, setRecords] = useState<AttendanceReviewRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const today = format(new Date(), "yyyy-MM-dd");
  const twoWeeksAgo = format(subDays(new Date(), 14), "yyyy-MM-dd");
  const [startDate, setStartDate] = useState(twoWeeksAgo);
  const [endDate, setEndDate] = useState(today);
  const [deptFilter, setDeptFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Dialogs
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    record: AttendanceReviewRecord | null;
  }>({ open: false, record: null });
  const [remarksDialog, setRemarksDialog] = useState<{
    open: boolean;
    record: AttendanceReviewRecord | null;
  }>({ open: false, record: null });
  const [confirmAction, setConfirmAction] = useState<{
    open: boolean;
    record: AttendanceReviewRecord | null;
    action: "approve" | "reject";
  }>({ open: false, record: null, action: "approve" });

  // Edit form state
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editRemarks, setEditRemarks] = useState("");

  // Remarks form state
  const [remarksText, setRemarksText] = useState("");

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        ...(deptFilter !== "all" && { departmentId: deptFilter }),
        ...(sourceFilter !== "all" && { source: sourceFilter }),
        ...(statusFilter !== "all" && { status: statusFilter }),
      });
      const res = await fetch(`/api/attendance/review?${params.toString()}`);
      const data = await res.json();
      if (data.ok) setRecords(data.records ?? []);
      else toast.error(data.message || "Failed to fetch records");
    } catch {
      toast.error("Failed to fetch attendance records");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, deptFilter, sourceFilter, statusFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const filteredRecords = useMemo(() => {
    if (!search) return records;
    const q = search.toLowerCase();
    return records.filter((r) => r.employeeName.toLowerCase().includes(q) || r.date.includes(q));
  }, [records, search]);

  async function doAction(
    id: string,
    action: "approve" | "reject" | "edit" | "add_remarks",
    extra?: { editedClockIn?: string; editedClockOut?: string; remarks?: string }
  ) {
    setActionLoading(id);
    try {
      const res = await fetch("/api/attendance/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message || "Action applied");
        fetchRecords();
      } else {
        toast.error(data.message || "Action failed");
      }
    } catch {
      toast.error("Request failed");
    } finally {
      setActionLoading(null);
    }
  }

  const stats = useMemo(() => ({
    pending: records.filter((r) => r.status === "pending").length,
    approved: records.filter((r) => r.status === "approved").length,
    rejected: records.filter((r) => r.status === "rejected").length,
    edited: records.filter((r) => r.status === "edited").length,
  }), [records]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance Review</h1>
        <p className="text-muted-foreground mt-1">
          Review mobile GPS, biometric, and manual attendance records before payroll integration.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Pending", value: stats.pending, icon: AlertCircle, color: "text-amber-600 dark:text-amber-400" },
          { label: "Approved", value: stats.approved, icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Rejected", value: stats.rejected, icon: XCircle, color: "text-red-600 dark:text-red-400" },
          { label: "Edited", value: stats.edited, icon: Edit, color: "text-blue-600 dark:text-blue-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-5 w-5 ${color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1 min-w-[140px]">
              <Label className="text-xs text-muted-foreground">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[140px]">
              <Label className="text-xs text-muted-foreground">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[160px]">
              <Label className="text-xs text-muted-foreground">Department</Label>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.filter((d) => d.isActive).map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 min-w-[140px]">
              <Label className="text-xs text-muted-foreground">Source</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="biometric">Biometric</SelectItem>
                  <SelectItem value="mobile_gps">Mobile GPS</SelectItem>
                  <SelectItem value="web">Web / QR</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 min-w-[130px]">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="edited">Edited</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1 min-w-[180px] flex-1">
              <Label className="text-xs text-muted-foreground">Search Employee</Label>
              <Input
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={fetchRecords}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Attendance Records
            <Badge variant="secondary" className="ml-auto">{filteredRecords.length} records</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Geofence</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>Selfie</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Filter className="h-8 w-8 opacity-30" />
                        <p className="text-sm">No records found for the selected filters.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => {
                    const isActioning = actionLoading === record.id;
                    return (
                      <TableRow key={record.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="pl-4 font-medium text-sm">{record.employeeName}</TableCell>
                        <TableCell className="text-sm">{record.date}</TableCell>
                        <TableCell>
                          {record.clockIn ? (
                            <span className="flex items-center gap-1 text-sm">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {record.clockIn}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {record.clockOut ? (
                            <span className="flex items-center gap-1 text-sm">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {record.clockOut}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <SourceBadge source={record.source} />
                        </TableCell>
                        <TableCell>
                          {record.isWithinGeofence === null ? (
                            <span className="text-muted-foreground text-xs">N/A</span>
                          ) : record.isWithinGeofence ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                              <MapPin className="h-3 w-3" /> Pass
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                              <MapPin className="h-3 w-3" /> Fail
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.distanceMeters != null
                            ? `${Math.round(record.distanceMeters)}m`
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell>
                          {record.selfieUrl ? (
                            <a
                              href={record.selfieUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              View
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={record.status} />
                        </TableCell>
                        <TableCell className="pr-4">
                          <div className="flex gap-1.5 justify-end">
                            {record.status === "pending" && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                  disabled={isActioning}
                                  title="Approve"
                                  onClick={() =>
                                    setConfirmAction({ open: true, record, action: "approve" })
                                  }
                                >
                                  {isActioning ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                  disabled={isActioning}
                                  title="Reject"
                                  onClick={() =>
                                    setConfirmAction({ open: true, record, action: "reject" })
                                  }
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              disabled={isActioning}
                              title="Edit times"
                              onClick={() => {
                                setEditClockIn(record.clockIn ?? "");
                                setEditClockOut(record.clockOut ?? "");
                                setEditRemarks("");
                                setEditDialog({ open: true, record });
                              }}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              disabled={isActioning}
                              title="Add remarks"
                              onClick={() => {
                                setRemarksText("");
                                setRemarksDialog({ open: true, record });
                              }}
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
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

      {/* Approve/Reject Confirm Dialog */}
      <AlertDialog
        open={confirmAction.open}
        onOpenChange={(open) =>
          !open && setConfirmAction((s) => ({ ...s, open: false }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction.action === "approve" ? "Approve" : "Reject"} Attendance Record
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction.action === "approve"
                ? `Approve attendance for ${confirmAction.record?.employeeName} on ${confirmAction.record?.date}? This will mark the record as present.`
                : `Reject attendance for ${confirmAction.record?.employeeName} on ${confirmAction.record?.date}? This will mark the day as absent.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmAction.action === "reject"
                  ? "bg-red-600 hover:bg-red-700"
                  : ""
              }
              onClick={() => {
                if (confirmAction.record) {
                  doAction(confirmAction.record.id, confirmAction.action);
                }
                setConfirmAction((s) => ({ ...s, open: false }));
              }}
            >
              {confirmAction.action === "approve" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Times Dialog */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(open) => !open && setEditDialog({ open: false, record: null })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-4 w-4" /> Edit Attendance Times
            </DialogTitle>
          </DialogHeader>
          {editDialog.record && (
            <div className="space-y-4 pt-2">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{editDialog.record.employeeName}</span>
                {" — "}{editDialog.record.date}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Clock In</Label>
                  <Input
                    type="time"
                    value={editClockIn}
                    onChange={(e) => setEditClockIn(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Clock Out</Label>
                  <Input
                    type="time"
                    value={editClockOut}
                    onChange={(e) => setEditClockOut(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Remarks (optional)</Label>
                <Textarea
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="Reason for manual edit..."
                  rows={3}
                  className="text-sm resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditDialog({ open: false, record: null })}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (editDialog.record) {
                      doAction(editDialog.record.id, "edit", {
                        editedClockIn: editClockIn || undefined,
                        editedClockOut: editClockOut || undefined,
                        remarks: editRemarks || undefined,
                      });
                      setEditDialog({ open: false, record: null });
                    }
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Remarks Dialog */}
      <Dialog
        open={remarksDialog.open}
        onOpenChange={(open) => !open && setRemarksDialog({ open: false, record: null })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Add Remarks
            </DialogTitle>
          </DialogHeader>
          {remarksDialog.record && (
            <div className="space-y-4 pt-2">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{remarksDialog.record.employeeName}</span>
                {" — "}{remarksDialog.record.date}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Remarks</Label>
                <Textarea
                  value={remarksText}
                  onChange={(e) => setRemarksText(e.target.value)}
                  placeholder="Add a note or annotation..."
                  rows={4}
                  className="text-sm resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRemarksDialog({ open: false, record: null })}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!remarksText.trim()}
                  onClick={() => {
                    if (remarksDialog.record && remarksText.trim()) {
                      doAction(remarksDialog.record.id, "add_remarks", {
                        remarks: remarksText,
                      });
                      setRemarksDialog({ open: false, record: null });
                    }
                  }}
                >
                  Save Remarks
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
