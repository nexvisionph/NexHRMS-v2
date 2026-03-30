"use client";

import { useParams } from "next/navigation";
import { useState, useMemo } from "react";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getInitials, formatCurrency, formatDate } from "@/lib/format";
import { Mail, MapPin, Phone, Briefcase, Calendar, DollarSign, FileText, Banknote } from "lucide-react";
import { toast } from "sonner";

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

export default function ViewerProfileView() {
    const { id } = useParams<{ id: string }>();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);
    const { hasPermission } = useRolesStore();
    const canViewSalary = hasPermission(currentUser.role, "employees:view_salary");
    const canViewPayroll = hasPermission(currentUser.role, "payroll:view_all");
    const canViewLoans = hasPermission(currentUser.role, "loans:view_all");
    const canViewAttendance = hasPermission(currentUser.role, "attendance:view_all");
    const canViewLeave = hasPermission(currentUser.role, "leave:view_all");
    const employee = employees.find((e) => e.id === id);
    const isSelf = employee?.email === currentUser.email;

    const attendanceLogs = useAttendanceStore((s) => s.logs);
    const leaveRequests = useLeaveStore((s) => s.requests);
    const payslips = usePayrollStore((s) => s.payslips);
    const allLoans = useLoansStore((s) => s.loans);

    const empAttendance = useMemo(() => attendanceLogs.filter((l) => l.employeeId === id).slice(0, 20), [attendanceLogs, id]);
    const empLeaves = useMemo(() => leaveRequests.filter((l) => l.employeeId === id), [leaveRequests, id]);
    const empPayslips = useMemo(() => payslips.filter((p) => p.employeeId === id), [payslips, id]);
    const empLoans = useMemo(() => allLoans.filter((l) => l.employeeId === id), [allLoans, id]);

    const [docName, setDocName] = useState("");
    const [docOpen, setDocOpen] = useState(false);
    const [mockDocs, setMockDocs] = useState<{ name: string; uploadedAt: string }[]>([]);

    const handleAddDoc = () => {
        if (!docName) { toast.error("Enter a document name"); return; }
        setMockDocs((prev) => [...prev, { name: docName, uploadedAt: new Date().toISOString() }]);
        toast.success(`"${docName}" uploaded`);
        setDocName("");
        setDocOpen(false);
    };

    if (!employee) {
        return <div className="flex items-center justify-center h-[60vh]"><p className="text-muted-foreground">Employee not found</p></div>;
    }

    return (
        <div className="space-y-6">
            {/* Header — read-only, no edit/deactivate buttons */}
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
                                {isSelf && <Badge className="bg-primary/15 text-primary">You</Badge>}
                            </div>
                            <p className="text-muted-foreground mt-1">{employee.role} · {employee.department}</p>
                            <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" />{employee.email}</span>
                                {employee.phone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" />{employee.phone}</span>}
                                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{employee.location}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabs — permission gated */}
            <Tabs defaultValue="overview">
                <TabsList className="w-full overflow-x-auto justify-start">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="employment">Employment</TabsTrigger>
                    {(canViewAttendance || isSelf) && <TabsTrigger value="attendance">Attendance</TabsTrigger>}
                    {(canViewLeave || isSelf) && <TabsTrigger value="leave">Leave</TabsTrigger>}
                    {(canViewPayroll || isSelf) && <TabsTrigger value="payslips">Payslips</TabsTrigger>}
                    {(canViewLoans || isSelf) && <TabsTrigger value="loans">Loans</TabsTrigger>}
                    <TabsTrigger value="documents">Documents</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="border border-border/50">
                            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Personal Information</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Role" value={employee.role} />
                                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Location" value={employee.location} />
                                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Birthday" value={employee.birthday ? formatDate(employee.birthday) : "—"} />
                                <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone" value={employee.phone || "—"} />
                                <InfoRow icon={<Phone className="h-4 w-4" />} label="Emergency Contact" value={employee.emergencyContact || "—"} />
                                <InfoRow icon={<MapPin className="h-4 w-4" />} label="Address" value={employee.address || "—"} />
                            </CardContent>
                        </Card>
                        <Card className="border border-border/50">
                            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Work Summary</CardTitle></CardHeader>
                            <CardContent className="space-y-3">
                                {(canViewSalary || isSelf) && (
                                    <InfoRow icon={<DollarSign className="h-4 w-4" />} label="Monthly Salary" value={`${formatCurrency(employee.salary)}/mo`} />
                                )}
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
                            <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Role" value={employee.role} />
                            <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Work Type" value={employee.workType} />
                            <InfoRow icon={<Calendar className="h-4 w-4" />} label="Joined" value={formatDate(employee.joinDate)} />
                            <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Team Leader" value={employee.teamLeader ? employees.find((e) => e.id === employee.teamLeader)?.name || "—" : "—"} />
                        </CardContent>
                    </Card>
                </TabsContent>

                {(canViewAttendance || isSelf) && (
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
                )}

                {(canViewLeave || isSelf) && (
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
                )}

                {(canViewPayroll || isSelf) && (
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
                )}

                {(canViewLoans || isSelf) && (
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
                )}

                <TabsContent value="documents" className="mt-4">
                    <Card className="border border-border/50">
                        <CardContent className="p-6">
                            {mockDocs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-6">
                                    <FileText className="h-12 w-12 text-muted-foreground/40" />
                                    <p className="text-muted-foreground mt-3">No documents uploaded yet</p>
                                </div>
                            ) : (
                                <div className="space-y-2 mb-4">
                                    {mockDocs.map((doc, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                                            <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{doc.name}</span></div>
                                            <span className="text-xs text-muted-foreground">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <Dialog open={docOpen} onOpenChange={setDocOpen}>
                                <Button variant="outline" size="sm" className="mt-2" onClick={() => setDocOpen(true)}>Upload Document</Button>
                                <DialogContent className="max-w-sm">
                                    <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
                                    <div className="space-y-4 pt-2">
                                        <div><label className="text-sm font-medium">Document Name</label><Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="e.g. Resume, ID, Contract" className="mt-1" /></div>
                                        <p className="text-xs text-muted-foreground">File upload is simulated for MVP. Only the document label is stored.</p>
                                        <Button onClick={handleAddDoc} className="w-full">Upload</Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
