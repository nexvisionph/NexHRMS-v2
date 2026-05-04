"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { usePerformanceStore } from "@/store/performance.store";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Plus, Edit2, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import type { PerformanceCycle, PerformanceCriterion, PerformanceSalaryBand } from "@/types";

export default function PerformanceManagementPage() {
  const role = useParams()?.role as string;
  const currentUser = useAuthStore((s) => s.currentUser);
  const {
    cycles,
    criteria,
    salaryBands,
    activeCycleId,
    setActiveCycle,
    setCycles,
    setCriteria,
    setSalaryBands,
    setLoading,
    isLoading,
  } = usePerformanceStore();

  const [showNewCycle, setShowNewCycle] = useState(false);
  const [showNewCriterion, setShowNewCriterion] = useState(false);
  const [showNewBand, setShowNewBand] = useState(false);
  const [newCycle, setNewCycle] = useState({
    name: "",
    description: "",
    period_start: "",
    period_end: "",
    review_start_date: "",
    review_end_date: "",
  });

  // Authorization check
  if (!["admin", "hr"].includes(currentUser?.role)) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-destructive">You don't have permission to access performance management.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    loadCycles();
  }, []);

  useEffect(() => {
    if (activeCycleId) {
      loadCycleDetails();
    }
  }, [activeCycleId]);

  const loadCycles = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/performance/cycles");
      const data = await res.json();
      setCycles(data);
    } catch (error) {
      toast.error("Failed to load cycles");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadCycleDetails = async () => {
    try {
      const [critRes, bandRes] = await Promise.all([
        fetch(`/api/performance/criteria?cycle_id=${activeCycleId}`),
        fetch(`/api/performance/salary-bands?cycle_id=${activeCycleId}`),
      ]);

      const crits = await critRes.json();
      const bands = await bandRes.json();

      setCriteria(crits);
      setSalaryBands(bands);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCreateCycle = async () => {
    if (!newCycle.name || !newCycle.period_start || !newCycle.period_end) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const res = await fetch("/api/performance/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCycle),
      });

      if (!res.ok) throw new Error("Failed to create cycle");

      const cycle = await res.json();
      toast.success("Cycle created successfully");
      setNewCycle({
        name: "",
        description: "",
        period_start: "",
        period_end: "",
        review_start_date: "",
        review_end_date: "",
      });
      setShowNewCycle(false);
      loadCycles();
      setActiveCycle(cycle.id);
    } catch (error) {
      toast.error("Failed to create cycle");
      console.error(error);
    }
  };

  const handleChangeCycleStatus = async (cycleId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/performance/cycles/${cycleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      toast.success(`Cycle status changed to ${newStatus}`);
      loadCycles();
    } catch (error) {
      toast.error("Failed to update cycle status");
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Performance Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage performance cycles, evaluation criteria, and salary adjustment bands
        </p>
      </div>

      <Tabs defaultValue="cycles" className="w-full">
        <TabsList>
          <TabsTrigger value="cycles">Review Cycles</TabsTrigger>
          <TabsTrigger value="criteria">Evaluation Criteria</TabsTrigger>
          <TabsTrigger value="bands">Salary Bands</TabsTrigger>
        </TabsList>

        {/* CYCLES TAB */}
        <TabsContent value="cycles" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Review Cycles</h2>
            <Button onClick={() => setShowNewCycle(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Cycle
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : cycles.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No cycles created yet</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {cycles.map((cycle) => (
                <Card
                  key={cycle.id}
                  className={`cursor-pointer transition-all ${
                    activeCycleId === cycle.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setActiveCycle(cycle.id)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{cycle.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          Period: {cycle.period_start} to {cycle.period_end}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            cycle.status === "active"
                              ? "bg-green-100 text-green-800"
                              : cycle.status === "draft"
                              ? "bg-gray-100 text-gray-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {cycle.status.charAt(0).toUpperCase() + cycle.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-4">{cycle.description}</p>
                    <div className="flex gap-2">
                      {cycle.status === "draft" && (
                        <>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleChangeCycleStatus(cycle.id, "active");
                            }}
                            className="gap-2"
                          >
                            <CheckCircle className="h-4 w-4" />
                            Activate
                          </Button>
                        </>
                      )}
                      {cycle.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleChangeCycleStatus(cycle.id, "finalized");
                          }}
                        >
                          Finalize
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* NEW CYCLE FORM */}
          {showNewCycle && (
            <Card>
              <CardHeader>
                <CardTitle>Create New Review Cycle</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Cycle Name</Label>
                  <Input
                    value={newCycle.name}
                    onChange={(e) => setNewCycle({ ...newCycle, name: e.target.value })}
                    placeholder="e.g., Q1 2025 Performance Review"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={newCycle.description}
                    onChange={(e) => setNewCycle({ ...newCycle, description: e.target.value })}
                    placeholder="Optional description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Period Start Date</Label>
                    <Input
                      type="date"
                      value={newCycle.period_start}
                      onChange={(e) => setNewCycle({ ...newCycle, period_start: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Period End Date</Label>
                    <Input
                      type="date"
                      value={newCycle.period_end}
                      onChange={(e) => setNewCycle({ ...newCycle, period_end: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Review Start Date</Label>
                    <Input
                      type="date"
                      value={newCycle.review_start_date}
                      onChange={(e) => setNewCycle({ ...newCycle, review_start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Review End Date</Label>
                    <Input
                      type="date"
                      value={newCycle.review_end_date}
                      onChange={(e) => setNewCycle({ ...newCycle, review_end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateCycle}>Create Cycle</Button>
                  <Button variant="outline" onClick={() => setShowNewCycle(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* CRITERIA TAB */}
        <TabsContent value="criteria" className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Evaluation Criteria</h2>
            {activeCycleId ? (
              <p className="text-sm text-muted-foreground mt-1">
                Managing criteria for: <strong>{cycles.find((c) => c.id === activeCycleId)?.name}</strong>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">Select a cycle first to manage criteria</p>
            )}
          </div>

          {activeCycleId ? (
            <>
              <Button onClick={() => setShowNewCriterion(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Criterion
              </Button>

              {criteria.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">No criteria defined for this cycle yet</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {criteria.map((crit) => (
                    <Card key={crit.id}>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold">{crit.name}</h3>
                            {crit.description && <p className="text-sm text-muted-foreground mt-1">{crit.description}</p>}
                            <p className="text-xs text-muted-foreground mt-2">
                              Weight: {crit.weight} | Sequence: {crit.sequence}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {showNewCriterion && (
                <Card>
                  <CardHeader>
                    <CardTitle>Add Evaluation Criterion</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Criterion Name</Label>
                      <Input placeholder="e.g., Communication Skills" />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input placeholder="Description of what this criterion measures" />
                    </div>
                    <div className="flex gap-2">
                      <Button>Add</Button>
                      <Button variant="outline" onClick={() => setShowNewCriterion(false)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Select a cycle from the Cycles tab to manage criteria</p>
            </Card>
          )}
        </TabsContent>

        {/* SALARY BANDS TAB */}
        <TabsContent value="bands" className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold">Salary Adjustment Bands</h2>
            {activeCycleId ? (
              <p className="text-sm text-muted-foreground mt-1">
                Managing bands for: <strong>{cycles.find((c) => c.id === activeCycleId)?.name}</strong>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">Select a cycle first to manage salary bands</p>
            )}
          </div>

          {activeCycleId ? (
            <>
              <Button onClick={() => setShowNewBand(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Salary Band
              </Button>

              {salaryBands.length === 0 ? (
                <Card className="p-8 text-center">
                  <p className="text-muted-foreground">No salary bands defined for this cycle yet</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {salaryBands.map((band) => (
                    <Card key={band.id}>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-center">
                          <div>
                            <h3 className="font-semibold">{band.band_name}</h3>
                            <p className="text-sm text-muted-foreground">
                              Rating: {band.min_rating} - {band.max_rating} → {band.adjustment_percentage}% adjustment
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {showNewBand && (
                <Card>
                  <CardHeader>
                    <CardTitle>Add Salary Adjustment Band</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Band Name</Label>
                      <Input placeholder="e.g., High Performer" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label>Min Rating</Label>
                        <Input type="number" placeholder="4.0" step="0.1" />
                      </div>
                      <div>
                        <Label>Max Rating</Label>
                        <Input type="number" placeholder="5.0" step="0.1" />
                      </div>
                      <div>
                        <Label>Adjustment %</Label>
                        <Input type="number" placeholder="5" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button>Add</Button>
                      <Button variant="outline" onClick={() => setShowNewBand(false)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Select a cycle from the Cycles tab to manage salary bands</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
