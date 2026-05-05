"use client";

import { useEffect, useState } from "react";
import { usePerformanceStore } from "@/store/performance.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, AlertCircle, CheckCircle2, X } from "lucide-react";
import type { PerformanceSalaryAdjustment } from "@/types";

export default function SalaryAdjustmentQueuePage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const { setLoading, isLoading } = usePerformanceStore();

  const [pendingAdjustments, setPendingAdjustments] = useState<PerformanceSalaryAdjustment[]>([]);
  const [selectedAdjustment, setSelectedAdjustment] = useState<PerformanceSalaryAdjustment | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [overrideAmount, setOverrideAmount] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const canAccess = ["finance", "finance_admin", "admin", "payroll_admin"].includes(currentUser?.role);

  useEffect(() => {
    if (!canAccess) return;
    loadAdjustments();
  }, [canAccess]);

  const loadAdjustments = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/performance/adjustments?status=pending");
      if (!res.ok) throw new Error("Failed to load adjustments");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid adjustments response");
      setPendingAdjustments(data);
    } catch (error) {
      toast.error("Failed to load adjustments");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (action: "approve" | "reject") => {
    if (!selectedAdjustment) return;

    setProcessing(true);
    try {
      const res = await fetch(`/api/performance/adjustments/${selectedAdjustment.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          finance_approved_amount: action === "approve" ? parseFloat(overrideAmount) || selectedAdjustment.recommended_amount : null,
          override_reason: overrideReason,
        }),
      });

      if (!res.ok) throw new Error(`Failed to ${action} adjustment`);

      toast.success(`Adjustment ${action}ed successfully`);
      setShowApproveDialog(false);
      setOverrideAmount("");
      setOverrideReason("");
      setSelectedAdjustment(null);
      loadAdjustments();
    } catch (error) {
      toast.error(`Failed to ${action} adjustment`);
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleOpenApprove = (adjustment: PerformanceSalaryAdjustment) => {
    setSelectedAdjustment(adjustment);
    setOverrideAmount(adjustment.recommended_amount?.toString() || "");
    setShowApproveDialog(true);
  };

  const calculateNewSalary = () => {
    if (!selectedAdjustment || !overrideAmount) return 0;
    const currentSalary = selectedAdjustment.employee?.current_salary || 0;
    const increase = parseFloat(overrideAmount) || 0;
    return currentSalary + increase;
  };

  if (!canAccess) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-destructive">You do not have permission to approve salary adjustments.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Salary Adjustment Queue</h1>
        <p className="text-muted-foreground mt-2">Review and approve recommended salary adjustments from performance reviews</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pending Approvals</p>
            <p className="text-3xl font-bold mt-2">
              {pendingAdjustments.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Recommended Increase</p>
            <p className="text-3xl font-bold mt-2">
              ₱{pendingAdjustments
                .reduce((sum, a) => sum + (a.recommended_amount || 0), 0)
                .toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Employees Affected</p>
            <p className="text-3xl font-bold mt-2">
              {new Set(pendingAdjustments.map((a) => a.employee_id)).size}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Adjustments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : pendingAdjustments.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
          <p className="text-muted-foreground">No pending salary adjustments</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingAdjustments.map((adj) => (
            <Card key={adj.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{adj.employee?.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Performance Rating: {adj.review?.overall_rating?.toFixed(2) || "N/A"} / 5.0
                    </p>
                  </div>
                  <Badge variant="outline">Pending</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Salary</p>
                    <p className="text-xl font-bold">
                      ₱{(adj.employee?.current_salary || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Recommended Adjustment</p>
                    <p className="text-xl font-bold text-green-600">
                      +₱{(adj.recommended_amount || 0).toLocaleString()} ({adj.band?.adjustment_percentage}%)
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">New Salary</p>
                    <p className="text-xl font-bold">
                      ₱{(
                        (adj.employee?.current_salary || 0) +
                        (adj.recommended_amount || 0)
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>

                {adj.band && (
                  <div className="p-3 bg-muted rounded">
                    <p className="text-sm">
                      <span className="font-semibold">Salary Band:</span> {adj.band.band_name}
                    </p>
                    {adj.band.description && (
                      <p className="text-sm text-muted-foreground mt-1">{adj.band.description}</p>
                    )}
                  </div>
                )}

                <Button
                  onClick={() => handleOpenApprove(adj)}
                  className="w-full gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Review & Approve/Reject
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approval Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Approve/Reject Salary Adjustment</DialogTitle>
          </DialogHeader>

          {selectedAdjustment && (
            <div className="space-y-6">
              <div className="p-4 bg-muted rounded space-y-2">
                <p className="font-semibold">{selectedAdjustment.employee?.name}</p>
                <p className="text-sm">
                  Current Salary: <span className="font-semibold">₱{(selectedAdjustment.employee?.current_salary || 0).toLocaleString()}</span>
                </p>
                <p className="text-sm">
                  Performance Rating: <span className="font-semibold">{selectedAdjustment.review?.overall_rating?.toFixed(2)} / 5.0</span>
                </p>
              </div>

              <div>
                <Label>Adjustment Amount (₱)</Label>
                <Input
                  type="number"
                  value={overrideAmount}
                  onChange={(e) => setOverrideAmount(e.target.value)}
                  placeholder="Enter adjustment amount"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  New Salary: ₱{calculateNewSalary().toLocaleString()}
                </p>
              </div>

              <div>
                <Label>Override Reason (if different from recommended)</Label>
                <Textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain any adjustments made..."
                  className="min-h-20"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => handleApprove("approve")}
                  disabled={processing || !overrideAmount}
                  className="flex-1 gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {processing ? "Processing..." : "Approve"}
                </Button>
                <Button
                  onClick={() => handleApprove("reject")}
                  disabled={processing}
                  variant="destructive"
                  className="flex-1 gap-2"
                >
                  <X className="h-4 w-4" />
                  {processing ? "Processing..." : "Reject"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
