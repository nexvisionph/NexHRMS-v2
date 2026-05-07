// Performance Management Types

export type PerformanceCycleStatus = "draft" | "active" | "finalized" | "closed";
export type ReviewStatus = "draft" | "submitted" | "acknowledged" | "finance_approved" | "finalized";
export type SalaryAdjustmentStatus = "pending" | "approved" | "rejected" | "applied" | "cancelled";

export interface PerformanceCycle {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  period_start: string; // ISO date
  period_end: string;
  review_start_date: string;
  review_end_date: string;
  rating_scale_min: number;
  rating_scale_max: number;
  status: PerformanceCycleStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PerformanceCriterion {
  id: string;
  company_id: string;
  cycle_id: string;
  name: string;
  description?: string;
  weight: number;
  sequence: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PerformanceSalaryBand {
  id: string;
  company_id: string;
  cycle_id: string;
  band_name: string;
  min_rating: number;
  max_rating: number;
  adjustment_percentage: number;
  description?: string;
  sequence: number;
  created_at: string;
}

export interface PerformanceRating {
  id: string;
  review_id: string;
  criterion_id: string;
  score: number;
  feedback?: string;
  created_at: string;
  updated_at: string;
  // For UI display
  criterion?: PerformanceCriterion;
}

export interface PerformanceReview {
  id: string;
  company_id: string;
  cycle_id: string;
  employee_id: string;
  manager_id: string;
  overall_rating?: number;
  manager_notes?: string;
  status: ReviewStatus;
  submitted_at?: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  finance_approved_at?: string;
  finance_approved_by?: string;
  created_at: string;
  updated_at: string;
  // For UI display
  employee?: { id: string; name: string; email: string };
  manager?: { id: string; name: string; email: string };
  ratings?: PerformanceRating[];
}

export interface PerformanceSalaryAdjustment {
  id: string;
  company_id: string;
  review_id: string;
  employee_id: string;
  recommended_band_id: string;
  recommended_percentage: number;
  recommended_amount?: number;
  finance_approved_amount?: number;
  finance_override_reason?: string;
  approved_by?: string;
  status: SalaryAdjustmentStatus;
  applied_in_payroll_run_id?: string;
  created_at: string;
  approved_at?: string;
  applied_at?: string;
  updated_at: string;
  // For UI display
  employee?: { id: string; name: string; email: string; current_salary?: number };
  band?: PerformanceSalaryBand;
  review?: PerformanceReview;
}

export interface PerformanceAuditLog {
  id: string;
  company_id: string;
  entity_type: "cycle" | "review" | "adjustment";
  entity_id: string;
  action: string;
  old_status?: string;
  new_status?: string;
  changed_by: string;
  timestamp: string;
  details?: Record<string, unknown>;
  reason?: string;
}

// API Request/Response types
export interface CreateCycleInput {
  name: string;
  description?: string;
  period_start: string;
  period_end: string;
  review_start_date: string;
  review_end_date: string;
  rating_scale_min?: number;
  rating_scale_max?: number;
}

export interface UpdateCycleInput extends Partial<CreateCycleInput> {
  status?: PerformanceCycleStatus;
}

export interface CreateCriterionInput {
  name: string;
  description?: string;
  weight?: number;
  sequence: number;
}

export interface CreateReviewInput {
  employee_id: string;
  ratings: Array<{
    criterion_id: string;
    score: number;
    feedback?: string;
  }>;
  manager_notes?: string;
}

export type SubmitReviewInput = Partial<CreateReviewInput>;

export interface AcknowledgeReviewInput {
  review_id: string;
}

export interface CreateSalaryBandInput {
  band_name: string;
  min_rating: number;
  max_rating: number;
  adjustment_percentage: number;
  description?: string;
  sequence: number;
}

export interface ApproveAdjustmentInput {
  adjustment_id: string;
  finance_approved_amount?: number;
  override_reason?: string;
}
