"use client";

import { useParams } from "next/navigation";
import { useState, useMemo } from "react";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { useLeaveStore } from "@/store/leave.store";
import { usePayrollStore } from "@/store/payroll.store";
import { useLoansStore } from "@/store/loans.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getInitials, formatCurrency, formatDate, validatePhone } from "@/lib/format";
import { ROLES, LOCATIONS } from "@/lib/constants";
import { useDepartmentsStore } from "@/store/departments.store";
import { useJobTitlesStore } from "@/store/job-titles.store";
import { Mail, MapPin, Phone, Briefcase, Calendar, DollarSign, FileText, Pencil, Banknote, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { useAuditStore } from "@/store/audit.store";
import type { WorkType, PayFrequency } from "@/types";

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</span>
            <span className="text-sm font-medium">{value}</span>
        </div>
    );
}

const statusColors: Record<string, string> = {
    present: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    absent: "bg-red-500/15 text-red-700 dark:text-red-400",
    on_leave: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

const leaveStatusColors: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    rejected: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export default function AdminProfileView() {
    const { id } = useParams<{ id: string }>();
    const employees = useEmployeesStore((s) => s.employees);
    const toggleStatus = useEmployeesStore((s) => s.toggleStatus);
    const updateEmployee = useEmployeesStore((s) => s.updateEmployee);
    const resignEmployee = useEmployeesStore((s) => s.resignEmployee);
    const addDocument = useEmployeesStore((s) => s.addDocument);
    const removeDocument = useEmployeesStore((s) => s.removeDocument);
    const getDocuments = useEmployeesStore((s) => s.getDocuments);
    const currentUser = useAuthStore((s) => s.currentUser);
    const attendanceLogs = useAttendanceStore((s) => s.logs);
    const leaveRequests = useLeaveStore((s) => s.requests);
    const payslips = usePayrollStore((s) => s.payslips);
    const paySchedule = usePayrollStore((s) => s.paySchedule);
    const computeFinalPay = usePayrollStore((s) => s.computeFinalPay);
    const allLoans = useLoansStore((s) => s.loans);
    const getActiveByEmployee = useLoansStore((s) => s.getActiveByEmployee);
    const getEmployeeBalances = useLeaveStore((s) => s.getEmployeeBalances);
    const departments = useDepartmentsStore((s) => s.departments);
    const activeDepartments = useMemo(() => departments.filter((d) => d.isActive), [departments]);
    const jobTitles = useJobTitlesStore((s) => s.jobTitles);

    const employee = employees.find((e) => e.id === id);
    const empAttendance = useMemo(() => attendanceLogs.filter((l) => l.employeeId === id).slice(0, 20), [attendanceLogs, id]);
    const empLeaves = useMemo(() => leaveRequests.filter((l) => l.employeeId === id), [leaveRequests, id]);
    const empPayslips = useMemo(() => payslips.filter((p) => p.employeeId === id), [payslips, id]);
    const empLoans = useMemo(() => allLoans.filter((l) => l.employeeId === id), [allLoans, id]);

    const [editOpen, setEditOpen] = useState(false);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editRole, setEditRole] = useState("");
    const [editJobTitle, setEditJobTitle] = useState("");
    const [editDept, setEditDept] = useState("");
    const [editWorkType, setEditWorkType] = useState<WorkType>("WFO");
    const [editSalary, setEditSalary] = useState("");
    const [editLocation, setEditLocation] = useState("");
    const [editPayFreq, setEditPayFreq] = useState<string>("company");
    const [docName, setDocName] = useState("");
    const [docOpen, setDocOpen] = useState(false);
    const [docFile, setDocFile] = useState<File | null>(null);
    const [docUploading, setDocUploading] = useState(false);
    const empDocs = id ? getDocuments(id) : [];

    const openEditDialog = () => {
        if (!employee) return;
        setEditName(employee.name);
        setEditEmail(employee.email);
        setEditPhone(employee.phone || "");
        setEditRole(employee.role);
        setEditJobTitle(employee.jobTitle || "");
        setEditDept(employee.department);
        setEditWorkType(employee.workType);
        setEditSalary(String(employee.salary));
        setEditLocation(employee.location);
        setEditPayFreq(employee.payFrequency || "company");
        setEditOpen(true);
    };

    const handleEditSave = () => {
        if (!employee || !editName || !editEmail) {
            toast.error("Name and email are required");
            return;
        }
        
        // Validate phone if provided
        let formattedPhone: string | undefined;
        if (editPhone) {
            const phoneResult = validatePhone(editPhone);
            if (!phoneResult.valid) {
                toast.error(phoneResult.warning || "Invalid phone format. Use +63 9XX XXX XXXX for PH mobile.");
                return;
            }
            formattedPhone = phoneResult.formatted;
        }
        
        updateEmployee(employee.id, {
            name: editName, email: editEmail, phone: formattedPhone,
            role: editRole, jobTitle: editJobTitle, department: editDept, workType: editWorkType,
            salary: Number(editSalary) || employee.salary, location: editLocation,
            payFrequency: editPayFreq !== "company" ? editPayFreq as PayFrequency : undefined,
        });
        useAuditStore.getState().log({ entityType: "employee", entityId: employee.id, action: "adjustment_applied", performedBy: currentUser.id, reason: "Profile updated" });
        toast.success("Profile updated successfully!");
        setEditOpen(false);
    };

    const handleAddDoc = async () => {
        if (!id) return;
        if (!docFile && !docName) { toast.error("Select a file or enter a document name"); return; }
        const name = docName || (docFile?.name ?? "Document");
        setDocUploading(true);
        try {
            if (docFile) {
                const dataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = () => reject(new Error("Failed to read file"));
                    reader.readAsDataURL(docFile);
                });
                addDocument(id, name, dataUrl, docFile.type);
            } else {
                addDocument(id, name);
            }
            toast.success(`"${name}" saved`);
            setDocName("");
            setDocFile(null);
            setDocOpen(false);
        } catch {
            toast.error("Failed to read file. Please try again.");
        } finally {
            setDocUploading(false);
        }
    };

    if (!employee) {
        return <div className="flex items-center justify-center h-[60vh]"><p className="text-muted-foreground">Employee not found</p></div>;
    }

    void currentUser;

    return (
        <div className="space-y-6">
            {/* Header — full edit capabilities */}
            <Card className="border border-border/50">
                <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <Avatar className="h-20 w-20">
                            <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">{getInitials(employee.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-2xl font-bold">{employee.name}</h1>
                                <Badge variant="secondary" className={employee.status === "active" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-red-500/15 text-red-700 dark:text-red-400"}>{employee.status}</Badge>
                                <Badge variant="outline">{employee.workType}</Badge>
                            </div>
                            <p className="text-muted-foreground mt-1">{employee.jobTitle || employee.role} · {employee.department}</p>
                            <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" />{employee.email}</span>
                                {employee.phone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />{employee.phone}</span>}
                                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{employee.location}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={openEditDialog}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                            <Button variant="outline" size="sm" onClick={() => { toggleStatus(employee.id); useAuditStore.getState().log({ entityType: "employee", entityId: employee.id, action: employee.status === "active" ? "employee_resigned" : "adjustment_applied", performedBy: currentUser.id, reason: employee.status === "active" ? "Deactivated" : "Activated" }); toast.success(`Employee ${employee.status === "active" ? "deactivated" : "activated"}`); }}>
                                {employee.status === "active" ? "Deactivate" : "Activate"}
                            </Button>
                            {employee.status === "active" && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild><Button variant="outline" size="sm" className="gap-1.5 text-orange-600 border-orange-200 hover:bg-orange-50"><UserMinus className="h-3.5 w-3.5" /> Resign</Button></AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Resign Employee</AlertDialogTitle><AlertDialogDescription>This will mark <strong>{employee.name}</strong> as resigned and compute their final pay including pro-rated salary, leave conversion, and loan offset.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction className="bg-orange-600 hover:bg-orange-700" onClick={() => {
                                                resignEmployee(employee.id);
                                                const loanBalance = getActiveByEmployee(employee.id).reduce((sum, l) => sum + l.remainingBalance, 0);
                                                const balances = getEmployeeBalances(employee.id, new Date().getFullYear());
                                                const leaveDays = balances.reduce((sum, b) => sum + b.remaining, 0);
                                                computeFinalPay({ employeeId: employee.id, resignedAt: new Date().toISOString(), salary: employee.salary, unpaidOTHours: 0, leaveDays, loanBalance });
                                                useAuditStore.getState().log({ entityType: "employee", entityId: employee.id, action: "employee_resigned", performedBy: currentUser.id, afterSnapshot: { finalPay: true } });
                                                toast.success(`${employee.name} resigned — final pay computed`);
                                            }}>Resign & Compute Final Pay</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* All tabs visible for admin/hr */}
            <Tabs defaultValue="overview">
                <TabsList className="w-full overflow-x-auto justify-start">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="employment">Employment</TabsTrigger>
                    <TabsTrigger value="attendance">Attendance</TabsTrigger>
                    <TabsTrigger value="leave">Leave</TabsTrigger>
                    <TabsTrigger value="payslips">Payslips</TabsTrigger>
                    <TabsTrigger value="loans">Loans</TabsTrigger>
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="border border-border/50">
                            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Personal Information</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Job Title" value={employee.jobTitle || employee.role} />
                                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={employee.location} />
                                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Birthday" value={employee.birthday ? formatDate(employee.birthday) : "—"} />
                                <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={employee.phone || "—"} />
                            </CardContent>
                        </Card>
                        <Card className="border border-border/50">
                            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Work Summary</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Monthly Salary" value={`${formatCurrency(employee.salary)}/mo`} />
                                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Join Date" value={formatDate(employee.joinDate)} />
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Productivity</span>
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-24 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full" style={{ width: `${employee.productivity}%` }} /></div>
                                        <span className="text-sm font-medium">{employee.productivity}%</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="employment" className="mt-4">
                    <Card className="border border-border/50">
                        <CardContent className="p-6 space-y-4">
                            <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Department" value={employee.department} />
                            <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Job Title" value={employee.jobTitle || "—"} />
                            <InfoRow icon={<Briefcase className="h-4 w-4" />} label="System Role" value={employee.role} />
                            <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Work Type" value={employee.workType} />
                            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Joined" value={formatDate(employee.joinDate)} />
                            <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Team Leader" value={employee.teamLeader ? employees.find((e) => e.id === employee.teamLeader)?.name || "—" : "—"} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="attendance" className="mt-4">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="text-xs">Date</TableHead><TableHead className="text-xs">Check In</TableHead><TableHead className="text-xs">Check Out</TableHead><TableHead className="text-xs">Hours</TableHead><TableHead className="text-xs">Status</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {empAttendance.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No attendance records</TableCell></TableRow>
                                        ) : empAttendance.map((log) => (
                                            <TableRow key={log.id}>
                                                <TableCell className="text-sm">{log.date}</TableCell>
                                                <TableCell className="text-sm">{log.checkIn || "—"}</TableCell>
                                                <TableCell className="text-sm">{log.checkOut || "—"}</TableCell>
                                                <TableCell className="text-sm">{log.hours || "—"}</TableCell>
                                                <TableCell><Badge variant="secondary" className={`text-[10px] ${statusColors[log.status]}`}>{log.status.replace("_", " ")}</Badge></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="leave" className="mt-4">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">From</TableHead><TableHead className="text-xs">To</TableHead><TableHead className="text-xs">Reason</TableHead><TableHead className="text-xs">Status</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {empLeaves.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No leave requests</TableCell></TableRow>
                                        ) : empLeaves.map((req) => (
                                            <TableRow key={req.id}>
                                                <TableCell><Badge variant="outline" className="text-[10px]">{req.type}</Badge></TableCell>
                                                <TableCell className="text-sm">{req.startDate}</TableCell>
                                                <TableCell className="text-sm">{req.endDate}</TableCell>
                                                <TableCell className="text-sm max-w-[200px] truncate">{req.reason}</TableCell>
                                                <TableCell><Badge variant="secondary" className={`text-[10px] ${leaveStatusColors[req.status]}`}>{req.status}</Badge></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="payslips" className="mt-4">
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="text-xs">Period</TableHead><TableHead className="text-xs">Net Pay</TableHead><TableHead className="text-xs">Issued</TableHead><TableHead className="text-xs">Status</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {empPayslips.length === 0 ? (
                                            <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No payslips</TableCell></TableRow>
                                        ) : empPayslips.map((ps) => (
                                            <TableRow key={ps.id}>
                                                <TableCell className="text-sm">{ps.periodStart} – {ps.periodEnd}</TableCell>
                                                <TableCell className="text-sm font-medium">{formatCurrency(ps.netPay)}</TableCell>
                                                <TableCell className="text-sm">{ps.issuedAt}</TableCell>
                                                <TableCell><Badge variant="secondary" className={`text-[10px] ${ps.status === "confirmed" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>{ps.status}</Badge></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="loans" className="mt-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <Card className="border border-blue-500/20 bg-blue-500/5">
                            <CardContent className="p-4">
                                <p className="text-xs text-muted-foreground font-medium">Active Loans</p>
                                <p className="text-2xl font-bold mt-1">{empLoans.filter((l) => l.status === "active").length}</p>
                            </CardContent>
                        </Card>
                        <Card className="border border-amber-500/20 bg-amber-500/5">
                            <CardContent className="p-4">
                                <p className="text-xs text-muted-foreground font-medium">Outstanding Balance</p>
                                <p className="text-2xl font-bold mt-1">₱{empLoans.filter((l) => l.status === "active").reduce((sum, l) => sum + l.remainingBalance, 0).toLocaleString()}</p>
                            </CardContent>
                        </Card>
                    </div>
                    <Card className="border border-border/50">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Amount</TableHead><TableHead className="text-xs">Balance</TableHead><TableHead className="text-xs">Monthly</TableHead><TableHead className="text-xs">Status</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {empLoans.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8"><Banknote className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />No loans</TableCell></TableRow>
                                        ) : empLoans.map((loan) => (
                                            <TableRow key={loan.id}>
                                                <TableCell className="text-sm capitalize">{loan.type.replace("_", " ")}</TableCell>
                                                <TableCell className="text-sm">₱{loan.amount.toLocaleString()}</TableCell>
                                                <TableCell className="text-sm font-medium">₱{loan.remainingBalance.toLocaleString()}</TableCell>
                                                <TableCell className="text-xs">₱{loan.monthlyDeduction.toLocaleString()}/mo</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className={`text-[10px] ${loan.status === "active" ? "bg-blue-500/15 text-blue-700 dark:text-blue-400" : loan.status === "settled" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}>{loan.status}</Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="documents" className="mt-4">
                    <Card className="border border-border/50">
                        <CardContent className="p-6">
                            {empDocs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6">
                                    <FileText className="h-12 w-12 text-muted-foreground/40" />
                                    <p className="text-muted-foreground mt-3">No documents uploaded yet</p>
                                </div>
                            ) : (
                                <div className="space-y-2 mb-4">
                                    {empDocs.map((doc) => (
                                        <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 group">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                                                {doc.fileUrl ? (
                                                    <a
                                                        href={doc.fileUrl}
                                                        download={doc.name}
                                                        className="text-sm font-medium text-primary hover:underline truncate"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {doc.name}
                                                    </a>
                                                ) : (
                                                    <span className="text-sm font-medium truncate">{doc.name}</span>
                                                )}
                                                {doc.fileType && (
                                                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                                                        {doc.fileType.split("/")[1]?.toUpperCase() ?? doc.fileType}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => { if (id) removeDocument(id, doc.id); }}><X className="h-3 w-3" /></Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <Dialog open={docOpen} onOpenChange={(open) => { setDocOpen(open); if (!open) { setDocName(""); setDocFile(null); } }}>
                                <Button variant="outline" size="sm" className="mt-2" onClick={() => setDocOpen(true)}>Upload Document</Button>
                                <DialogContent className="max-w-sm">
                                    <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
                                    <div className="space-y-4 pt-2">
                                        <div>
                                            <label className="text-sm font-medium">File</label>
                                            <div className="mt-1 flex items-center justify-center w-full">
                                                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors">
                                                    <div className="flex flex-col items-center justify-center pt-3 pb-3">
                                                        <FileText className="h-7 w-7 text-muted-foreground mb-1" />
                                                        {docFile ? (
                                                            <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{docFile.name}</p>
                                                        ) : (
                                                            <p className="text-sm text-muted-foreground">Click to select a file</p>
                                                        )}
                                                        <p className="text-xs text-muted-foreground/60 mt-0.5">PDF, DOC, PNG, JPG up to 10MB</p>
                                                    </div>
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,.xlsx,.csv"
                                                        onChange={(e) => {
                                                            const f = e.target.files?.[0] ?? null;
                                                            setDocFile(f);
                                                            if (f && !docName) setDocName(f.name.replace(/\.[^.]+$/, ""));
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium">Label <span className="text-muted-foreground font-normal">(optional)</span></label>
                                            <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="e.g. Resume, Government ID" className="mt-1" />
                                        </div>
                                        <Button onClick={handleAddDoc} className="w-full" disabled={docUploading || (!docFile && !docName)}>
                                            {docUploading ? "Saving..." : "Upload"}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Edit Profile Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>Edit Profile — {employee.name}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-sm font-medium">Name *</label><Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" /></div>
                            <div><label className="text-sm font-medium">Email *</label><Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="mt-1" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-sm font-medium">Role</label>
                                <Select value={editRole} onValueChange={setEditRole}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
                            </div>
                            <div><label className="text-sm font-medium">Job Title</label>
                                <Select value={editJobTitle} onValueChange={setEditJobTitle}><SelectTrigger className="mt-1"><SelectValue placeholder="Select title" /></SelectTrigger><SelectContent><SelectItem value="">— None —</SelectItem>{jobTitles.filter((jt) => jt.isActive).map((jt) => <SelectItem key={jt.id} value={jt.name}>{jt.name}</SelectItem>)}</SelectContent></Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-sm font-medium">Department</label>
                                <Select value={editDept} onValueChange={setEditDept}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{activeDepartments.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent></Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div><label className="text-sm font-medium">Work Type</label>
                                <Select value={editWorkType} onValueChange={(v) => setEditWorkType(v as WorkType)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="WFO">WFO</SelectItem><SelectItem value="WFH">WFH</SelectItem><SelectItem value="HYBRID">Hybrid</SelectItem></SelectContent></Select>
                            </div>
                            <div><label className="text-sm font-medium">Monthly Salary (₱)</label><Input type="number" value={editSalary} onChange={(e) => setEditSalary(e.target.value)} className="mt-1" /></div>
                            <div><label className="text-sm font-medium">Location</label>
                                <Select value={editLocation} onValueChange={setEditLocation}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-sm font-medium">Pay Frequency</label>
                                <Select value={editPayFreq} onValueChange={setEditPayFreq}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>
                                    <SelectItem value="company">Company Default ({paySchedule.defaultFrequency.replace("_", "-")})</SelectItem>
                                    <SelectItem value="monthly">Monthly</SelectItem><SelectItem value="semi_monthly">Semi-Monthly</SelectItem><SelectItem value="bi_weekly">Bi-Weekly</SelectItem><SelectItem value="weekly">Weekly</SelectItem>
                                </SelectContent></Select>
                            </div>
                            <div><label className="text-sm font-medium">Phone</label><Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="mt-1" /></div>
                        </div>
                        <Button onClick={handleEditSave} className="w-full">Save Changes</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
