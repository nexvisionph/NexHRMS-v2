"use client";

import { useEffect, useMemo, useState } from "react";
import { usePerformanceStore } from "@/store/performance.store";
import { useAuthStore } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Loader2, AlertCircle, CheckCircle2, Send } from "lucide-react";
import type { Employee, PerformanceReview, PerformanceCriterion, PerformanceRating } from "@/types";

export default function MyTeamReviewsPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const employees = useEmployeesStore((s) => s.employees);
  const {
    cycles,
    criteria,
    reviews,
    activeCycleId,
    setActiveCycle,
    setCycles,
    setCriteria,
    setReviews,
    setLoading,
    isLoading,
  } = usePerformanceStore();

  const [directReports, setDirectReports] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [managerNotes, setManagerNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingReview, setExistingReview] = useState<PerformanceReview | null>(null);

  const canAccess = ["admin", "hr", "supervisor", "manager"].includes(currentUser?.role);
  const currentEmployee = useMemo(
    () =>
      employees.find(
        (employee) =>
          employee.profileId === currentUser?.id ||
          employee.id === currentUser?.id ||
          employee.email.toLowerCase() === currentUser?.email?.toLowerCase()
      ),
    [employees, currentUser]
  );

  useEffect(() => {
    if (!canAccess) return;
    loadData();
  }, [canAccess]);

  useEffect(() => {
    if (!canAccess) return;
    // Find direct reports for current user
    const reports = ["admin", "hr"].includes(currentUser?.role)
      ? employees.filter((employee) => employee.status === "active")
      : employees.filter(
          (employee) =>
            employee.teamLeader &&
            currentEmployee &&
            employee.teamLeader.toLowerCase() === currentEmployee.id.toLowerCase()
        );
    setDirectReports(reports);
  }, [canAccess, employees, currentUser, currentEmployee]);

  useEffect(() => {
    if (canAccess && activeCycleId && selectedEmployee) {
      loadEmployeeReview();
    }
  }, [canAccess, activeCycleId, selectedEmployee]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cyclesRes, reviewsRes] = await Promise.all([
        fetch("/api/performance/cycles"),
        fetch("/api/performance/reviews"),
      ]);

      if (!cyclesRes.ok || !reviewsRes.ok) throw new Error("Failed to load performance data");
      const cyclesData = await cyclesRes.json();
      const reviewsData = await reviewsRes.json();
      if (!Array.isArray(cyclesData) || !Array.isArray(reviewsData)) {
        throw new Error("Invalid performance data response");
      }

      setCycles(cyclesData);
      setReviews(reviewsData);

      // Set active cycle to first active one, or first one
      const activeCycle = cyclesData.find((c) => c.status === "active") || cyclesData[0];
      if (activeCycle) {
        setActiveCycle(activeCycle.id);
      }
    } catch (error) {
      toast.error("Failed to load performance data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeeReview = async () => {
    try {
      const res = await fetch(
        `/api/performance/reviews?cycle_id=${activeCycleId}&employee_id=${selectedEmployee?.id}`
      );
      if (!res.ok) throw new Error("Failed to load employee review");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid review response");

      if (data.length > 0) {
        const review = data[0] as PerformanceReview;
        setExistingReview(review);
        // Populate ratings from existing review
        const ratingMap: Record<string, number> = {};
        review.ratings?.forEach((r: PerformanceRating) => {
          ratingMap[r.criterion_id] = r.score;
        });
        setRatings(ratingMap);
        setManagerNotes(review.manager_notes || "");
      } else {
        setExistingReview(null);
        setRatings({});
        setManagerNotes("");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleLoadCycleDetails = async (cycleId: string) => {
    try {
      const res = await fetch(`/api/performance/criteria?cycle_id=${cycleId}`);
      if (!res.ok) throw new Error("Failed to load criteria");
      const crits = await res.json();
      setCriteria(Array.isArray(crits) ? crits : []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSaveReview = async (submit: boolean = false) => {
    if (!activeCycleId || !selectedEmployee) {
      toast.error("Please select a cycle and employee");
      return;
    }

    if (criteria.length === 0) {
      toast.error("Please rate all criteria");
      return;
    }

    setSubmitting(true);
    try {
      const ratingsList = criteria.map((c: PerformanceCriterion) => ({
        criterion_id: c.id,
        score: ratings[c.id] || 3,
        feedback: "",
      }));
      let reviewIdToSubmit = existingReview?.id;

      if (existingReview) {
        // Update existing review
        const res = await fetch(`/api/performance/reviews/${existingReview.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ratings: ratingsList,
            manager_notes: managerNotes,
            overall_rating: ratingsList.reduce((sum, r) => sum + r.score, 0) / ratingsList.length,
          }),
        });

        if (!res.ok) throw new Error("Failed to update review");

        toast.success("Review updated");
      } else {
        // Create new review
        const res = await fetch("/api/performance/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cycle_id: activeCycleId,
            employee_id: selectedEmployee.id,
            ratings: ratingsList,
            manager_notes: managerNotes,
          }),
        });

        if (!res.ok) throw new Error("Failed to create review");
        const createdReview = await res.json();
        reviewIdToSubmit = createdReview.id;

        toast.success("Review created");
      }

      // If submitting, transition status
      if (submit && reviewIdToSubmit) {
        const res = await fetch(`/api/performance/reviews/${reviewIdToSubmit}/submit`, {
          method: "POST",
        });

        if (!res.ok) throw new Error("Failed to submit review");

        toast.success("Review submitted successfully");
      }

      loadEmployeeReview();
    } catch (error) {
      toast.error("Failed to save review");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const activeCycle = cycles.find((c) => c.id === activeCycleId);
  const cycleIsActive = activeCycle?.status === "active";

  if (!canAccess) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-destructive">You do not have permission to access team reviews.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Team Reviews</h1>
        <p className="text-muted-foreground mt-2">Score and provide feedback for your direct reports</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT PANEL: Cycles & Direct Reports */}
          <div className="space-y-6">
            {/* Cycles */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Review Cycles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {cycles.filter((c) => c.status === "active").length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active cycles</p>
                ) : (
                  cycles
                    .filter((c) => c.status === "active")
                    .map((cycle) => (
                      <button
                        key={cycle.id}
                        onClick={() => {
                          setActiveCycle(cycle.id);
                          handleLoadCycleDetails(cycle.id);
                        }}
                        className={`w-full text-left p-3 rounded-lg transition-all ${
                          activeCycleId === cycle.id
                            ? "bg-primary text-white"
                            : "bg-muted hover:bg-muted/80"
                        }`}
                      >
                        <p className="font-semibold text-sm">{cycle.name}</p>
                        <p className="text-xs opacity-75">{cycle.period_start} to {cycle.period_end}</p>
                      </button>
                    ))
                )}
              </CardContent>
            </Card>

            {/* Direct Reports */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Team</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {directReports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No direct reports</p>
                ) : (
                  directReports.map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => setSelectedEmployee(emp)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        selectedEmployee?.id === emp.id
                          ? "bg-primary text-white"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      <p className="font-semibold text-sm">{emp.name}</p>
                      <p className="text-xs opacity-75">{emp.jobTitle || emp.department}</p>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL: Review Form */}
          <div className="lg:col-span-2 space-y-6">
            {!selectedEmployee ? (
              <Card className="p-8 text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select an employee to begin their review</p>
              </Card>
            ) : (
              <>
                {/* Employee Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedEmployee.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedEmployee.jobTitle} • {selectedEmployee.department}
                    </p>
                  </CardHeader>
                </Card>

                {!cycleIsActive ? (
                  <Card className="p-8 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
                    <p className="text-destructive font-semibold">No active review cycle</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Activate a cycle to begin reviews
                    </p>
                  </Card>
                ) : (
                  <>
                    {/* Scoring */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Evaluation Criteria</CardTitle>
                        {existingReview && (
                          <p className="text-sm text-muted-foreground mt-2">
                            Status: <span className="font-semibold">{existingReview.status}</span>
                          </p>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {criteria.length === 0 ? (
                          <p className="text-muted-foreground text-center py-8">
                            No evaluation criteria defined for this cycle
                          </p>
                        ) : (
                          criteria.map((crit) => (
                            <div key={crit.id} className="space-y-2">
                              <Label className="text-base font-semibold">{crit.name}</Label>
                              {crit.description && (
                                <p className="text-sm text-muted-foreground">{crit.description}</p>
                              )}
                              <div className="flex items-center gap-4">
                                <Slider
                                  min={1}
                                  max={5}
                                  step={0.5}
                                  value={[ratings[crit.id] || 3]}
                                  onValueChange={(value) =>
                                    setRatings({ ...ratings, [crit.id]: value[0] })
                                  }
                                  className="flex-1"
                                />
                                <span className="text-lg font-bold w-12 text-center">
                                  {ratings[crit.id]?.toFixed(1) || "3.0"}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    {/* Manager Notes */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Manager Comments</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          placeholder="Add your observations, strengths, areas for improvement, and development recommendations..."
                          value={managerNotes}
                          onChange={(e) => setManagerNotes(e.target.value)}
                          className="min-h-24"
                        />
                      </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleSaveReview(false)}
                        disabled={submitting || criteria.length === 0}
                        variant="outline"
                      >
                        Save as Draft
                      </Button>
                      <Button
                        onClick={() => handleSaveReview(true)}
                        disabled={
                          submitting || criteria.length === 0 || (existingReview !== null && existingReview.status !== "draft")
                        }
                        className="gap-2"
                      >
                        <Send className="h-4 w-4" />
                        {submitting ? "Submitting..." : "Submit Review"}
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
