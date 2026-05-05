"use client";

import { useEffect, useMemo, useState } from "react";
import { usePerformanceStore } from "@/store/performance.store";
import { useAuthStore } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, AlertCircle, CheckCircle2, Eye } from "lucide-react";
import type { PerformanceReview } from "@/types";

export default function MyReviewsPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const employees = useEmployeesStore((s) => s.employees);
  const { setLoading, isLoading } = usePerformanceStore();

  const [myReviews, setMyReviews] = useState<PerformanceReview[]>([]);
  const [selectedReview, setSelectedReview] = useState<PerformanceReview | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
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
    if (!currentEmployee) return;
    loadMyReviews();
  }, [currentEmployee]);

  const loadMyReviews = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/performance/reviews?employee_id=${currentEmployee?.id}`);
      if (!res.ok) throw new Error("Failed to load your reviews");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid reviews response");
      setMyReviews(data);
    } catch (error) {
      toast.error("Failed to load your reviews");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (review: PerformanceReview) => {
    if (review.status !== "submitted") {
      toast.error("This review cannot be acknowledged");
      return;
    }

    setAcknowledging(true);
    try {
      const res = await fetch(`/api/performance/reviews/${review.id}/acknowledge`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to acknowledge");

      toast.success("Review acknowledged successfully");
      loadMyReviews();
      setShowDetail(false);
    } catch (error) {
      toast.error("Failed to acknowledge review");
      console.error(error);
    } finally {
      setAcknowledging(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "submitted":
        return "bg-blue-100 text-blue-800";
      case "acknowledged":
        return "bg-green-100 text-green-800";
      case "finance_approved":
        return "bg-purple-100 text-purple-800";
      case "finalized":
        return "bg-emerald-100 text-emerald-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft":
        return "Draft (Manager)";
      case "submitted":
        return "Awaiting Your Acknowledgement";
      case "acknowledged":
        return "Acknowledged";
      case "finance_approved":
        return "Finance Approved";
      case "finalized":
        return "Finalized";
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Performance Reviews</h1>
        <p className="text-muted-foreground mt-2">View your performance evaluations and salary adjustment status</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : myReviews.length === 0 ? (
        <Card className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No performance reviews found</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {myReviews.map((review) => (
            <Card key={review.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {review.manager?.name || "Your Manager"} Review
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Rating: <span className="font-semibold">{review.overall_rating?.toFixed(2) || "N/A"} / 5.0</span>
                    </p>
                  </div>
                  <Badge className={getStatusColor(review.status)}>
                    {getStatusLabel(review.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {review.manager_notes && (
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Manager Comments</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.manager_notes}</p>
                  </div>
                )}

                <div className="pt-4 border-t flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedReview(review);
                      setShowDetail(true);
                    }}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View Details
                  </Button>

                  {review.status === "submitted" && (
                    <Button
                      onClick={() => handleAcknowledge(review)}
                      disabled={acknowledging}
                      className="gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {acknowledging ? "Acknowledging..." : "Acknowledge Review"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Details</DialogTitle>
          </DialogHeader>

          {selectedReview && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Evaluation Ratings</h3>
                <div className="space-y-3">
                  {selectedReview.ratings?.map((rating) => (
                    <div key={rating.id} className="flex justify-between items-center p-3 bg-muted rounded">
                      <div>
                        <p className="font-medium">{rating.criterion?.name}</p>
                        {rating.feedback && (
                          <p className="text-sm text-muted-foreground">{rating.feedback}</p>
                        )}
                      </div>
                      <span className="text-lg font-bold">{rating.score?.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Overall Rating</h3>
                <p className="text-3xl font-bold">
                  {selectedReview.overall_rating?.toFixed(2)} <span className="text-lg">/ 5.0</span>
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Salary Adjustment Status</h3>
                <Card className="bg-muted p-4">
                  <p className="text-sm mb-2">Your rating qualifies you for a salary review.</p>
                  <p className="text-sm text-muted-foreground">
                    Status: <span className="font-semibold">Pending Finance Approval</span>
                  </p>
                </Card>
              </div>

              {selectedReview.status === "submitted" && (
                <Button
                  onClick={() => handleAcknowledge(selectedReview)}
                  disabled={acknowledging}
                  className="w-full gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {acknowledging ? "Acknowledging..." : "Acknowledge This Review"}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
