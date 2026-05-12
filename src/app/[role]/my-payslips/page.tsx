"use client";

import { useMemo } from "react";
import { usePayrollStore } from "@/store/payroll.store";
import { useAuthStore } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Wallet, FileText, CheckCircle, PenTool } from "lucide-react";
import { PayslipDetail } from "@/components/payroll/payslip-detail";
import { useState } from "react";
import type { Payslip } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  published: "bg-blue-100 text-blue-700",
  signed: "bg-green-100 text-green-700",
  paid: "bg-emerald-100 text-emerald-700",
};

export default function MyPayslipsPage() {
  const { payslips, signPayslip, acknowledgePayslip } = usePayrollStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const employees = useEmployeesStore((s) => s.employees);

  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);

  // Find current employee
  const currentEmployee = useMemo(() => {
    return employees.find(
      (e) => e.profileId === currentUser.id || e.email?.toLowerCase() === currentUser.email?.toLowerCase()
    );
  }, [employees, currentUser]);

  // Get payslips for current employee
  const myPayslips = useMemo(() => {
    if (!currentEmployee) return [];
    return payslips
      .filter((ps) => ps.employeeId === currentEmployee.id)
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  }, [payslips, currentEmployee]);

  const handleSign = (payslipId: string) => {
    // In a real implementation, this would open a signature pad
    const signatureDataUrl = "data:image/png;base64,signature_placeholder";
    signPayslip(payslipId, signatureDataUrl);
  };

  const handleAcknowledge = (payslipId: string) => {
    if (!currentEmployee) return;
    acknowledgePayslip(payslipId, currentEmployee.id);
  };

  if (!currentEmployee) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">No employee profile linked to your account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">My Payslips</h1>
        <p className="text-muted-foreground">View, sign, and acknowledge your payslips.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Wallet className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{myPayslips.length}</p>
                <p className="text-sm text-muted-foreground">Total Payslips</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <PenTool className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{myPayslips.filter((p) => p.status === "published" && !p.signedAt).length}</p>
                <p className="text-sm text-muted-foreground">Awaiting Signature</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{myPayslips.filter((p) => p.acknowledgedAt).length}</p>
                <p className="text-sm text-muted-foreground">Acknowledged</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payslips Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Gross Pay</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net Pay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myPayslips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No payslips available yet.
                  </TableCell>
                </TableRow>
              ) : (
                myPayslips.map((ps) => {
                  const totalDeductions = ps.sssDeduction + ps.philhealthDeduction + ps.pagibigDeduction + ps.taxDeduction + ps.otherDeductions + ps.loanDeduction;
                  return (
                    <TableRow key={ps.id}>
                      <TableCell className="font-medium">
                        {ps.periodStart} — {ps.periodEnd}
                      </TableCell>
                      <TableCell>₱{ps.grossPay.toLocaleString()}</TableCell>
                      <TableCell className="text-red-600">₱{totalDeductions.toLocaleString()}</TableCell>
                      <TableCell className="font-bold">₱{ps.netPay.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[ps.status] || ""}>{ps.status}</Badge>
                        {ps.signedAt && <Badge variant="outline" className="ml-1 text-xs">Signed</Badge>}
                        {ps.acknowledgedAt && <Badge variant="outline" className="ml-1 text-xs">Ack</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" onClick={() => setSelectedPayslip(ps)}>
                                <FileText className="h-3 w-3 mr-1" />View
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Payslip Details</DialogTitle>
                              </DialogHeader>
                              {selectedPayslip && (
                                <PayslipDetail
                                  payslip={selectedPayslip}
                                  employeeName={currentEmployee.name}
                                  open={true}
                                  onClose={() => setSelectedPayslip(null)}
                                />
                              )}
                            </DialogContent>
                          </Dialog>
                          {ps.status === "published" && !ps.signedAt && (
                            <Button size="sm" onClick={() => handleSign(ps.id)}>
                              <PenTool className="h-3 w-3 mr-1" />Sign
                            </Button>
                          )}
                          {ps.status === "paid" && !ps.acknowledgedAt && (
                            <Button size="sm" variant="outline" onClick={() => handleAcknowledge(ps.id)}>
                              <CheckCircle className="h-3 w-3 mr-1" />Acknowledge
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
