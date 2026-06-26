// ─── Core Types ──────────────────────────────────────────────

export type Role = "admin" | "hr" | "finance" | "employee" | "supervisor" | "payroll_admin" | "auditor" | "support_admin" | "finance_admin" | "analyst";

export type EmployeeStatus = "active" | "inactive" | "resigned";
export type WorkType = "WFH" | "WFO" | "HYBRID" | "ONSITE";
export type AttendanceStatus = "present" | "absent" | "on_leave";
export type LeaveType = "SL" | "VL" | "EL" | "OTHER" | "ML" | "PL" | "SPL";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type PayslipStatus = "draft" | "published" | "signed" | "paid" | "payment_hold";
export type PayrollRunStatus = "draft" | "locked" | "published" | "ended" | "completed";

// ─── Custom Deduction Templates ──────────────────────────────
export type DeductionTemplateType = "deduction" | "allowance";
export type DeductionCalculationMode = "fixed" | "percentage" | "daily" | "hourly";

export interface DeductionCondition {
  department?: string;
  role?: string;
  project?: string;
  minSalary?: number;
  maxSalary?: number;
}

export interface DeductionTemplate {
  id: string;
  name: string;
  type: DeductionTemplateType;
  calculationMode: DeductionCalculationMode;
  value: number;
  conditions?: DeductionCondition;
  appliesToAll?: boolean;
  isActive: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmployeeDeductionAssignment {
  id: string;
  employeeId: string;
  templateId: string;
  overrideValue?: number;
  effectiveFrom: string;
  effectiveUntil?: string;
  isActive: boolean;
  assignedBy?: string;
  createdAt?: string;
  template?: DeductionTemplate;  // joined from query
}

export interface PayslipLineItem {
  id: string;
  payslipId: string;
  label: string;
  type: "earning" | "deduction" | "government" | "loan";
  amount: number;
  templateId?: string;
  calculationDetail?: string;
}
export type LoanStatus = "active" | "settled" | "frozen" | "cancelled";
export type OvertimeStatus = "pending" | "approved" | "rejected";

// ─── OT Review Layer ─────────────────────────────────────────

export type OTRecordStatus =
  | "pending"
  | "approved"
  | "partially_approved"
  | "rejected"
  | "locked"
  | "included_in_payroll";

export type OTType =
  | "regular"
  | "rest_day"
  | "regular_holiday"
  | "special_holiday"
  | "night_differential"
  | "rest_day_holiday";

export interface OTRecord {
  id: string;
  employeeId: string;
  attendanceId?: string;
  payrollPeriodId?: string;   // e.g. "2026-06-01/2026-06-15"
  otDate: string;             // ISO date
  scheduledTimeOut?: string;  // "HH:mm" from shift
  actualTimeOut?: string;     // "HH:mm" from attendance log
  computedOtHours: number;
  approvedOtHours?: number;
  otType: OTType;
  computedAmount: number;
  approvedAmount?: number;
  status: OTRecordStatus;
  reviewedBy?: string;        // employee_id
  reviewedAt?: string;
  remarks?: string;
  companyId?: string;
  createdAt: string;
  updatedAt: string;
  // joined data (not stored in DB column)
  employee?: Pick<Employee, "id" | "name" | "department" | "jobTitle">;
}

export interface OTAuditLog {
  id: string;
  otRecordId: string;
  action: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  performedBy: string;
  performedAt: string;
  remarks?: string;
  ipAddress?: string;
}

export interface OTSettings {
  enableOtReview: boolean;
  minimumOtMinutes: number;
  otGracePeriodMinutes: number;
  requireSupervisorApproval: boolean;
  allowPartialApproval: boolean;
  allowPayrollOfficerOverride: boolean;
  includePendingInPayroll: boolean;
}

// ─── Payroll Rules Engine ─────────────────────────────────────

export type PayrollComplianceMode = "ph_dole" | "custom";

/** Maps to public.payroll_rules — one row per company (id='default'). */
export interface PayrollRules {
  id: string;
  companyId?: string;

  /** 'ph_dole' = DOLE PH standard defaults. 'custom' = admin-configured. */
  complianceMode: PayrollComplianceMode;

  // ─── OT multipliers (total factor applied to hourly_rate) ─
  // e.g. 1.25 = hourly_rate × 1.25 per OT hour (base pay + 25% premium)
  // Set to 1.00 to disable premium entirely (company policy, no DOLE premium)
  regularOtMultiplier: number;       // DOLE default: 1.25
  restdayOtMultiplier: number;       // DOLE default: 1.30
  specialHolidayMultiplier: number;  // DOLE default: 1.30
  regularHolidayMultiplier: number;  // DOLE default: 2.00
  restdayHolidayMultiplier: number;  // DOLE default: 1.50

  // ─── Night differential ───────────────────────────────────
  nightDiffMultiplier: number;       // DOLE default: 1.10
  enableNightDiff: boolean;
  nightDiffStart: string;            // "22:00"
  nightDiffEnd: string;              // "06:00"

  // ─── OT threshold & rounding ─────────────────────────────
  minimumOtMinutes: number;
  gracePeriodMinutes: number;
  roundingRule: "none" | "nearest_15" | "nearest_30" | "floor_15" | "floor_30";

  // ─── Review gates ─────────────────────────────────────────
  requireOtReview: boolean;
  requireSupervisorReview: boolean;
  allowPartialOt: boolean;
  includePendingInPayroll: boolean;

  // ─── Work days / hours divisor ────────────────────────────
  workDaysDivisor: number;           // daily_rate = monthly_salary / workDaysDivisor
  hoursPerDay: number;               // hourly_rate = daily_rate / hoursPerDay

  // ─── Compliance confirmation ──────────────────────────────
  complianceModeConfirmedBy?: string;
  complianceModeConfirmedAt?: string;

  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** DOLE PH Standard defaults — used as fallback if payroll_rules not loaded. */
export const DOLE_PH_DEFAULTS: Omit<PayrollRules, "id" | "companyId" | "createdAt" | "updatedAt"> = {
  complianceMode: "ph_dole",
  regularOtMultiplier: 1.25,
  restdayOtMultiplier: 1.30,
  specialHolidayMultiplier: 1.30,
  regularHolidayMultiplier: 2.00,
  restdayHolidayMultiplier: 1.50,
  nightDiffMultiplier: 1.10,
  enableNightDiff: true,
  nightDiffStart: "22:00",
  nightDiffEnd: "06:00",
  minimumOtMinutes: 30,
  gracePeriodMinutes: 0,
  roundingRule: "none",
  requireOtReview: true,
  requireSupervisorReview: false,
  allowPartialOt: true,
  includePendingInPayroll: false,
  workDaysDivisor: 22,
  hoursPerDay: 8,
};

export type AdjustmentType = "earnings" | "deduction" | "net_correction" | "statutory_correction";
export type AdjustmentStatus = "pending" | "approved" | "applied" | "rejected";
export type SalaryChangeStatus = "pending" | "approved" | "rejected";
export type AttendanceFlag = "missing_in" | "missing_out" | "out_of_geofence" | "duplicate_scan" | "device_mismatch" | "overtime_without_approval" | "late_arrival" | "early_departure" | "suspicious_activity";
export type AttendanceEventType =
  | "IN" | "OUT" | "BREAK_START" | "BREAK_END"
  | "OVERRIDE" | "BULK_OVERRIDE"
  | "MARK_ABSENT" | "MARK_PRESENT"
  | "OT_APPROVED" | "OT_REJECTED" | "OT_SUBMITTED"
  | "EXCEPTION_RESOLVED" | "EXCEPTION_SCANNED" | "EXCEPTION_REOPENED" | "EXCEPTION_DELETED" | "EXCEPTION_UPDATED"
  | "HOLIDAY_ADDED" | "HOLIDAY_UPDATED" | "HOLIDAY_DELETED"
  | "CSV_IMPORTED" | "CSV_EXPORTED"
  | "PENALTY_APPLIED" | "PENALTY_CLEARED" | "CHEAT_DETECTED"
  | "SHIFT_ASSIGNED" | "DATA_RESET";
export type TimesheetStatus = "computed" | "submitted" | "approved" | "rejected";
export type AccrualFrequency = "monthly" | "annual";
export type PayFrequency = "monthly" | "semi_monthly" | "bi_weekly" | "weekly";
export type AuditAction =
  | "salary_proposed" | "salary_approved" | "salary_rejected"
  | "leave_approved" | "leave_rejected"
  | "overtime_approved" | "overtime_rejected"
  | "payroll_locked" | "payroll_published" | "payroll_paid" | "payroll_ended" | "payroll_completed"
  | "adjustment_created" | "adjustment_approved" | "adjustment_applied"
  | "loan_created" | "loan_frozen" | "loan_unfrozen" | "loan_settled"
  | "payment_recorded" | "employee_resigned" | "employee_deleted" | "final_pay_created"
  | "timesheet_approved" | "timesheet_rejected"
  | "kiosk_registered" | "attendance_correction" | "cheat_detected"
  | "mark_absent" | "bulk_mark_absent"
  | "task_created" | "task_assigned" | "task_completed" | "task_verified" | "task_rejected"
  | "tag_created" | "tag_updated" | "tag_deleted"
  | "announcement_sent" | "channel_created"
  | "doc_uploaded" | "doc_approved" | "doc_rejected" | "doc_archived" | "doc_requested"
  | "case_created" | "nte_issued" | "nte_acknowledged" | "nte_explained"
  | "nod_issued" | "nod_acknowledged" | "case_closed";

// ─── Holiday Type ────────────────────────────────────────────

export type HolidayType = "regular" | "special" | "special_non_working" | "special_working" | "declared_half_day";

export interface Holiday {
  id: string;
  date: string;           // "YYYY-MM-DD"
  name: string;
  type: HolidayType;
  year?: number;
  multiplier?: number;    // override DOLE multiplier
  isCustom?: boolean;     // user-added vs default
}

// ─── Employee Document ───────────────────────────────────────

export interface EmployeeDocument {
  id: string;
  employeeId?: string;
  name: string;
  uploadedAt: string;
  fileUrl?: string;
  fileType?: string;
}

// ─── 201 File Document Center ────────────────────────────────

export type Employee201DocType =
  | "personal_info" | "employment_contract" | "government_id"
  | "resume" | "application_form" | "job_offer" | "medical"
  | "training_certificate" | "performance_evaluation"
  | "payslip" | "leave_record" | "warning" | "nte" | "nod"
  | "clearance" | "resignation_letter" | "coe"
  | "final_pay_document" | "other";

export type Document201Status =
  | "pending_upload" | "uploaded" | "for_review" | "approved"
  | "rejected" | "expired" | "archived";

export type Document201Visibility =
  | "hr_only" | "manager" | "employee" | "payroll" | "admin_only";

export interface Employee201Document {
  id: string;
  employeeId: string;
  documentType: Employee201DocType;
  documentTitle: string;
  filePath?: string;
  fileType?: string;
  fileSize?: number;
  status: Document201Status;
  visibility: Document201Visibility;
  expiryDate?: string;
  remarks?: string;
  uploadedBy?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  caseId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Disciplinary (NTE / NOD) ────────────────────────────────

export type DisciplinaryCaseStatus =
  | "open" | "nte_issued" | "nte_acknowledged" | "explanation_submitted"
  | "no_response" | "under_review" | "nod_issued" | "nod_acknowledged"
  | "sanction_active" | "closed";

export interface DisciplinaryCase {
  id: string;
  caseNumber: string;
  employeeId: string;
  violationType: string;
  policyReference?: string;
  incidentDate: string;
  incidentLocation?: string;
  description: string;
  evidenceUrls: string[];
  status: DisciplinaryCaseStatus;
  assignedHr?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type NTEStatus =
  | "draft" | "issued" | "acknowledged" | "explanation_submitted"
  | "no_response" | "under_review" | "closed" | "moved_to_nod";

export interface NTERecord {
  id: string;
  caseId: string;
  employeeId: string;
  responseDeadline: string;
  documentId?: string;
  issuedBy: string;
  issuedAt: string;
  acknowledgedAt?: string;
  employeeExplanation?: string;
  explanationSubmittedAt?: string;
  status: NTEStatus;
  createdAt: string;
  updatedAt: string;
}

export type NODDecision =
  | "no_violation" | "verbal_warning" | "written_warning"
  | "final_warning" | "suspension" | "termination"
  | "salary_deduction" | "training_required" | "pip";

export type NODStatus =
  | "draft" | "issued" | "acknowledged" | "sanction_active" | "completed" | "closed";

export interface NODRecord {
  id: string;
  caseId: string;
  employeeId: string;
  decision: NODDecision;
  sanctionStartDate?: string;
  sanctionEndDate?: string;
  returnToWorkDate?: string;
  decisionDetails: string;
  documentId?: string;
  issuedBy: string;
  issuedAt: string;
  acknowledgedAt?: string;
  status: NODStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Job Title ───────────────────────────────────────────────

export interface JobTitle {
  id: string;
  name: string;
  description?: string;
  department?: string;
  isActive: boolean;
  isLead: boolean;
  color: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Department ──────────────────────────────────────────────

export interface Department {
  id: string;
  name: string;
  description?: string;
  headId?: string;        // employee ID of department head
  color: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Pay Schedule Configuration ──────────────────────────────

export interface PayScheduleConfig {
  defaultFrequency: PayFrequency;
  semiMonthlyFirstCutoff: number;   // day of month end of 1st period (default 15)
  semiMonthlyFirstPayDay: number;   // pay day for 1st cutoff (default 20)
  semiMonthlySecondPayDay: number;  // pay day for 2nd cutoff (default 5 of next month)
  monthlyPayDay: number;            // pay day for monthly (default 30)
  biWeeklyStartDate: string;        // ISO reference date for bi-weekly
  weeklyPayDay: number;             // 0=Sun … 6=Sat (default 5=Fri)
  deductGovFrom: "first" | "second" | "both"; // which cutoff gets gov deductions (semi-monthly)
  // ─── Auto-deduction toggles (migration 055) ───
  autoDeductLate: boolean;          // auto-compute late-arrival deduction
  autoDeductAbsent: boolean;        // auto-compute absent-day deduction
  autoDeductUndertime: boolean;     // auto-compute undertime (shift_hours - actual_hours) deduction
  autoAddOvertime: boolean;         // auto-add approved OT hours to payslip earnings
  workDaysPerMonth: number;         // for daily_rate = monthly_salary / workDaysPerMonth (default 22)
}

// ─── Payroll Signature Configuration ─────────────────────────

export interface PayrollSignatureConfig {
  mode: "auto" | "manual";          // auto = use saved signature; manual = leave blank for physical signature
  signatoryName: string;            // name displayed under authorized signature
  signatoryTitle: string;           // title displayed under authorized signature (e.g. "Finance Manager")
  signatureDataUrl?: string;        // base64 data URL of the signature image
}

// ─── Government Deduction Overrides (Philippine Standard) ────
// Supports SSS, PhilHealth, Pag-IBIG, and BIR withholding tax

export type DeductionType = "sss" | "philhealth" | "pagibig" | "bir";
export type DeductionOverrideMode = "auto" | "exempt" | "percentage" | "fixed";

export interface DeductionOverride {
  employeeId: string;
  deductionType: DeductionType;
  mode: DeductionOverrideMode;      // auto = standard calc; exempt = 0; percentage = custom %; fixed = flat amount
  percentage?: number;              // when mode = "percentage" (0-100)
  fixedAmount?: number;             // when mode = "fixed" (absolute ₱ amount)
  notes?: string;                   // reason for override (e.g., "Minimum wage earner", "Senior citizen", "PWD")
}

export interface DeductionGlobalDefault {
  id?: string;
  deductionType: DeductionType;
  enabled: boolean;                 // toggle on/off for entire company
  mode: DeductionOverrideMode;      // auto = standard calc; exempt = 0; percentage = custom %; fixed = flat amount
  percentage?: number;
  fixedAmount?: number;
  notes?: string;
}

// Common Philippine exemption reasons
export const PH_EXEMPTION_REASONS = [
  "Minimum wage earner",
  "Senior citizen (60+)",
  "Person with disability (PWD)",
  "Solo parent",
  "Tax treaty beneficiary",
  "Voluntary higher contribution",
  "Fixed withholding agreement",
  "Multiple employer arrangement",
  "Special arrangement",
  "Other",
] as const;

export interface Employee {
  id: string;
  profileId?: string;     // links to auth.profiles(id)
  name: string;
  email: string;
  role: string;           // system access role: admin | hr | finance | employee | supervisor | payroll_admin | auditor
  jobTitle?: string;      // display position/title: e.g. "DevOps Engineer", "HR Manager"
  department: string;
  status: EmployeeStatus;
  workType: WorkType;
  salary: number;  // ★ MONTHLY salary (₱)
  joinDate: string;
  productivity: number;
  location: string;
  phone?: string;
  birthday?: string;
  teamLeader?: string;
  avatarUrl?: string;
  pin?: string; // employee PIN for kiosk
  nfcId?: string; // NFC badge ID for kiosk scan
  biometricId?: string; // user ID stored in the physical biometric scanner
  resignedAt?: string;
  shiftId?: string;
  payFrequency?: PayFrequency; // per-employee override (falls back to company default)
  workDays?: string[]; // e.g. ["Mon","Tue","Wed","Thu","Fri"]
  emergencyContact?: string;
  address?: string;
  whatsappNumber?: string;
  preferredChannel?: MessageChannel;
  deductionExempt?: boolean;       // true = skip ALL government deductions (contract-based employees)
  deductionExemptReason?: string;  // reason for exemption (e.g., "Contract-based", "Minimum wage earner")
  otExempt?: boolean;              // true = skip OT computation (consultants/managerial — flat salary only)
  notificationPreferences?: Record<string, boolean>; // per-employee notification opt-outs (from DB jsonb column)
  // ─── BIR Compliance (migration 056) ──
  tin?: string;                                  // 12-digit BIR TIN (NNN-NNN-NNN-NNN)
  employmentClassification?: BIREmploymentClassification;
  isMWE?: boolean;
  mweDailyRate?: number;
  substitutedFiling?: boolean;                   // employer files in lieu of 1700
  taxStatus?: BIRTaxStatus;
  taxResidency?: BIRTaxResidency;
  separationDate?: string;
  separationType?: BIRSeparationType;
  createdAt?: string;     // ISO timestamptz from DB
  updatedAt?: string;     // ISO timestamptz from DB
}

// ─── Salary Change Request ───────────────────────────────────

export interface SalaryChangeRequest {
  id: string;
  employeeId: string;
  oldSalary: number;
  proposedSalary: number;
  effectiveDate: string;
  reason: string;
  proposedBy: string;
  proposedAt: string;
  status: SalaryChangeStatus;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface SalaryHistoryEntry {
  id: string;
  employeeId: string;
  monthlySalary: number;  // monthly (same unit as Employee.salary)
  effectiveFrom: string;
  effectiveTo?: string;
  approvedBy: string;
  reason: string;
}

// ─── Attendance — Append-Only Event Ledger (§2) ─────────────

export interface AttendanceEvent {
  id: string;
  employeeId: string;
  eventType: AttendanceEventType;
  timestampUTC: string; // ISO 8601
  projectId?: string;
  deviceId?: string;
  performedBy?: string;   // admin/system who triggered the event
  description?: string;   // human-readable summary
  metadata?: Record<string, unknown>; // extra context (old/new values, counts, etc.)
  createdAt: string;
}

export interface AttendanceEvidence {
  id: string;
  eventId: string;
  gpsLat?: number;
  gpsLng?: number;
  gpsAccuracyMeters?: number;
  geofencePass?: boolean;
  qrTokenId?: string;
  deviceIntegrityResult?: string; // "pass" | "fail" | "mock"
  faceVerified?: boolean;
  mockLocationDetected?: boolean;
}

export interface AttendanceException {
  id: string;
  eventId?: string;
  employeeId: string;
  date: string;
  flag: AttendanceFlag;
  autoGenerated: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  notes?: string;
  createdAt: string;
}

// ─── Anti-Cheat Penalty Record ───────────────────────────────

export interface PenaltyRecord {
  id: string;
  employeeId: string;
  reason: string;
  triggeredAt: string;   // ISO timestamp
  penaltyUntil: string;  // ISO timestamp = triggeredAt + penaltyMinutes
  resolved: boolean;     // admin can manually clear
}

/** Attendance method used for check-in/out */
export type AttendanceMethod = "biometric" | "web_face" | "qr" | "manual" | "self_checkin";

/** Computed daily summary — derived from events + rule set + shift */
export interface AttendanceLog {
  id: string;
  employeeId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  hours?: number;
  status: AttendanceStatus;
  projectId?: string;
  locationSnapshot?: {
    lat: number;
    lng: number;
  };
  faceVerified?: boolean;
  lateMinutes?: number;
  approvedOTHours?: number;
  checkInMethod?: AttendanceMethod;   // Method used for Time IN
  checkOutMethod?: AttendanceMethod;  // Method used for Time OUT
  shiftId?: string;
  flags?: AttendanceFlag[];
  otDescription?: string;  // HR-filled OT description (e.g. "Extended site visit")
  createdAt?: string;  // ISO 8601
  updatedAt?: string;  // ISO 8601
}

export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string; // "09:00"
  endTime: string;   // "18:00"
  gracePeriod: number; // minutes before late kicks in
  breakDuration: number; // minutes
  workDays: number[]; // 1=Mon ... 5=Fri
  createdAt?: string;
  updatedAt?: string;
}

export interface OvertimeRequest {
  id: string;
  employeeId: string;
  date: string;
  hoursRequested: number;
  reason: string;
  projectId?: string;
  status: OvertimeStatus;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

// ─── Timesheet Computation Layer (§3) ────────────────────────

export interface AttendanceRuleSet {
  id: string;
  name: string;
  standardHoursPerDay: number;
  graceMinutes: number;
  roundingPolicy: "none" | "nearest_15" | "nearest_30";
  overtimeRequiresApproval: boolean;
  nightDiffStart?: string; // e.g. "22:00"
  nightDiffEnd?: string;   // e.g. "06:00"
  holidayMultiplier: number;
  // ─── OT multipliers (migration 055) — DOLE PH defaults ───
  otMultiplierRegular: number;        // default 1.25 — OT on regular workday
  otMultiplierRestDay: number;        // default 1.30 — OT on rest day
  otMultiplierSpecialHoliday: number; // default 1.30 — OT on special non-working holiday
  otMultiplierRegularHoliday: number; // default 2.00 — OT on regular holiday
  otMultiplierNightDiff: number;      // default 1.10 — night differential
}

export interface TimesheetSegment {
  id: string;
  timesheetId: string;
  segmentType: "regular" | "overtime" | "night_diff" | "holiday" | "break";
  startTime: string;
  endTime: string;
  hours: number;
  multiplier: number;
}

export interface Timesheet {
  id: string;
  employeeId: string;
  date: string;
  ruleSetId: string;
  shiftId?: string;
  regularHours: number;
  overtimeHours: number;
  nightDiffHours: number;
  totalHours: number;
  lateMinutes: number;
  undertimeMinutes: number;
  segments: TimesheetSegment[];
  status: TimesheetStatus;
  computedAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

// ─── Leave Engine (§9) ───────────────────────────────────────

export interface LeavePolicy {
  id: string;
  leaveType: LeaveType;
  name: string;
  accrualFrequency: AccrualFrequency;
  annualEntitlement: number; // days per year
  carryForwardAllowed: boolean;
  maxCarryForward: number;
  maxBalance: number;
  expiryMonths: number; // 0 = no expiry
  negativeLeaveAllowed: boolean;
  attachmentRequired: boolean;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveType: LeaveType;
  year: number;
  entitled: number;
  used: number;
  carriedForward: number;
  remaining: number;
  lastAccruedAt?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  /** Leave duration type: full day, half day (AM/PM), or hourly */
  duration: LeaveDuration;
  /** Number of hours for hourly leave (only used when duration = "hourly") */
  hours?: number;
  reason: string;
  status: LeaveStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  attachmentUrl?: string;
}

/** Leave duration options for half-day support */
export type LeaveDuration = "full_day" | "half_day_am" | "half_day_pm" | "hourly";

export interface LoanDeduction {
  id: string;
  loanId: string;
  payslipId: string;
  amount: number;
  deductedAt: string;
  remainingAfter: number;
}

// ─── Loan Engine (§13) ──────────────────────────────────────

export interface LoanRepaymentSchedule {
  id: string;
  loanId: string;
  dueDate: string;
  amount: number;
  paid: boolean;
  payslipId?: string;
  skippedReason?: string; // "insufficient_net_pay" | "frozen"
}

export interface LoanBalanceHistory {
  id: string;
  loanId: string;
  date: string;
  previousBalance: number;
  deductionAmount: number;
  newBalance: number;
  payslipId?: string;
  notes?: string;
}

export interface Loan {
  id: string;
  employeeId: string;
  type: string;          // "cash_advance" | "salary_loan" | "other"
  amount: number;
  remainingBalance: number;
  monthlyDeduction: number;
  deductionCapPercent: number; // default 30 — max % of net pay
  status: LoanStatus;
  approvedBy: string;
  createdAt: string;
  remarks?: string;
  deductions?: LoanDeduction[];
  lastDeductedAt?: string;
  repaymentSchedule?: LoanRepaymentSchedule[];
  balanceHistory?: LoanBalanceHistory[];
}

// ─── Payslip & Payroll (§4, §8) ─────────────────────────────

export interface Payslip {
  id: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  payFrequency?: PayFrequency;  // recorded at time of issuance for audit
  grossPay: number;
  allowances: number;
  sssDeduction: number;
  philhealthDeduction: number;
  pagibigDeduction: number;
  taxDeduction: number;
  otherDeductions: number;
  loanDeduction: number;
  holidayPay?: number;      // supplement for holidays in period (DOLE multipliers)
  netPay: number;
  issuedAt: string;
  status: PayslipStatus;
  confirmedAt?: string;
  publishedAt?: string;
  paidAt?: string;
  paymentMethod?: "bank_transfer" | "gcash" | "cash" | "check";
  bankReferenceId?: string;  // Reference: Bank ref, GCash ID, Check number
  paymentProofUrl?: string;  // URL to uploaded proof image
  cashAmount?: number;       // For cash payments, actual amount given
  payrollBatchId?: string;
  pdfHash?: string;
  notes?: string;
  signedAt?: string;
  signatureDataUrl?: string;
  ackTextVersion?: string;
  adjustmentRef?: string;
  // ─── Payslip Signing Workflow ──
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  paidConfirmedBy?: string;
  paidConfirmedAt?: string;
  // ─── Custom Deductions ──
  customDeductions?: number;
  lineItemsJson?: PayslipLineItem[];
  // ─── Hold Metadata ──
  holdNote?: string;
  heldAt?: string;
  // ─── Itemized auto-deductions (migration 055) ──
  lateDeduction?: number;        // auto: (late_minutes/60) * hourly_rate
  absentDeduction?: number;      // auto: absent_days * daily_rate
  undertimeDeduction?: number;   // auto: (shift_hours - actual_hours) * hourly_rate
  overtimePay?: number;          // auto: ot_hours * hourly_rate * multiplier
  dailyRate?: number;            // snapshot at issuance
  hourlyRate?: number;           // snapshot at issuance
  // ─── Attendance snapshot (for receipt display) ──
  attendanceDaysPresent?: number;    // # of present logs in period
  attendanceDaysAbsent?: number;     // # of absent logs in period
  attendanceLateMinutes?: number;    // total late minutes in period
  attendanceUndertimeHours?: number; // total undertime hours in period (shift - actual)
  // ─── Gross override ──
  grossOverrideApplied?: boolean;    // true when admin manually overrode gross for this payslip
  // ─── BIR Compliance (migration 056) ──
  taxCategories?: TaxCategoryBreakdown;          // BIR earnings categorization
  taxableCompensation?: number;                  // taxable total this period
  nonTaxableCompensation?: number;               // non-taxable total this period
  // ─── Imported payroll support (migration 063) ──
  source?: "system" | "imported";   // 'imported' = figures came from an uploaded file (final, not recomputed)
  computedExternally?: boolean;      // when true, payroll engine must NOT recompute from attendance
  importedFileName?: string | null;  // original filename for the receipt banner
  importedAt?: string | null;        // when the import happened
  // DTR snapshot from import — RECEIPT ONLY, never written to attendance_logs
  dtrDaysPresent?: number | null;
  dtrDaysAbsent?: number | null;
  dtrLateMinutes?: number | null;
  dtrOtHours?: number | null;
  dtrTardHours?: number | null;
  dtrPerDayJson?: PayslipDtrDay[] | null;  // per-day rows if available from the import file
  // ─── Computation Engine Fields (payroll-computation-engine) ──
  regOtHours?: number;            // regular day OT hours (integer part)
  regOtMinutes?: number;          // regular day OT minutes (fractional → minutes)
  satOtHours?: number;            // Saturday/Sunday/holiday OT hours
  satOtMinutes?: number;          // Saturday/Sunday/holiday OT minutes
  computeSource?: "attendance_engine" | "manual";  // how this payslip was generated
  computeWorkDays?: number;       // rate divisor used (21.5 for computation engine)
}

// Per-day DTR row carried on imported payslips (receipt rendering only)
export interface PayslipDtrDay {
  date: string;        // ISO date or display date as supplied by the file
  day?: string;        // weekday label (Mon/Tue/...)
  timeIn?: string;
  timeOut?: string;
  totalHrs?: number;
  otHrs?: number;
  tardinessHr?: number;
  tardinessMin?: number;
  absences?: number;
  // ─── Computation engine fields (payroll-computation-engine) ──
  dayType?: ComputeDayType;           // REG, SAT, SUN, SPEC_HOL, REG_HOL
  effectiveIn?: string;               // after cap logic (HH:mm)
  undertimeHours?: number;
  otPay?: number;                     // OT pay for this specific day
  otDescription?: string;             // HR-filled description (from attendance_logs.ot_description)
  dayStatus?: string;                 // Present, Absent, Rest Day, Holiday
}

// ─── Payroll Computation Engine Types ────────────────────────

export type ComputeDayType = "REG" | "SAT" | "SUN" | "SPEC_HOL" | "REG_HOL";

export interface ComputedPayroll {
  employeeId: string;
  employeeName: string;
  position: string;
  department: string;
  periodStart: string;
  periodEnd: string;
  monthlySalary: number;
  ratePerDay: number;
  ratePerHour: number;
  semiMonthlyBasic: number;
  absentDays: number;
  absentDeduction: number;
  undertimeHours: number;
  undertimeDeduction: number;
  totalBasic: number;
  regOtHours: number;
  regOtMinutes: number;
  satOtHours: number;
  satOtMinutes: number;
  totalOtPay: number;
  withholdingTax: number;
  sss: number;
  philhealth: number;
  pagibig: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  dailyBreakdown: PayslipDtrDay[];
  daysPresent: number;
}

export interface PolicySnapshot {
  taxTableVersion: string;
  sssVersion: string;
  philhealthVersion: string;
  pagibigVersion: string;
  holidayListVersion: string;
  formulaVersion: string;
  ruleSetVersion: string;
  lockedBy: string;
}

export interface PayrollRun {
  id: string;
  periodLabel: string;
  createdAt: string;
  status: PayrollRunStatus;
  locked: boolean;
  lockedAt?: string;
  publishedAt?: string;
  paidAt?: string;
  payslipIds: string[];
  policySnapshot?: PolicySnapshot;
  runType?: "regular" | "adjustment" | "13th_month" | "final_pay";
  completedAt?: string;
  // ─── Customizable cut-off period (migration 055) ──
  periodStart?: string;          // ISO date, e.g. "2026-04-16"
  periodEnd?: string;            // ISO date, e.g. "2026-04-30"
  // ─── Imported payroll support (migration 063) ──
  source?: "system" | "imported";    // 'imported' = run created from an uploaded payroll file
  importedFileName?: string | null;  // original filename of the imported payroll file
}

// ─── Payroll Adjustments (§5) ────────────────────────────────

export interface PayrollAdjustment {
  id: string;
  payrollRunId: string;
  employeeId: string;
  adjustmentType: AdjustmentType;
  referencePayslipId: string;
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  appliedRunId?: string;
  status: AdjustmentStatus;
}

// ─── Audit Logging (§11) ────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  entityType: string;   // "payroll" | "salary" | "leave" | "overtime" | "loan" | "attendance" | "employee"
  entityId: string;
  action: AuditAction;
  performedBy: string;
  timestamp: string;
  reason?: string;
  beforeSnapshot?: Record<string, unknown>;
  afterSnapshot?: Record<string, unknown>;
}

// ─── Kiosk Hardening (§12) ──────────────────────────────────

export interface KioskDevice {
  id: string;
  name: string;
  registeredAt: string;
  projectId?: string;
  isActive: boolean;
}

export interface QRToken {
  id: string;
  deviceId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
}

// ─── Final Pay (§14) ────────────────────────────────────────

export interface FinalPayComputation {
  id: string;
  employeeId: string;
  resignedAt: string;
  proRatedSalary: number;
  unpaidOT: number;
  leavePayout: number;
  remainingLoanBalance: number;
  grossFinalPay: number;
  deductions: number;
  netFinalPay: number;
  status: PayrollRunStatus;
  createdAt: string;
  payslipId?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  date: string;
  type?: string;
}

export interface DemoUser {
  id: string;
  name: string;
  role: Role;
  email: string;
  avatarUrl?: string;
  // Auth & account management
  passwordHash?: string;
  mustChangePassword?: boolean;
  profileComplete?: boolean;
  createdAt?: string;
  createdBy?: string;
  // Profile fields (editable via onboarding / settings)
  phone?: string;
  department?: string;
  birthday?: string;
  address?: string;
  emergencyContact?: string;
}

// ─── Project & Geofencing ────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description?: string;
  location: {
    lat: number;
    lng: number;
    radius: number;
    address?: string;
  };
  assignedEmployeeIds: string[];
  status?: "active" | "completed" | "on_hold";
  createdAt: string;
  // Extended fields (migration 027) — DB columns: require_geofence, verification_method, geofence_radius_meters
  requireGeofence?: boolean;
  verificationMethod?: "face_only" | "qr_only" | "face_or_qr" | "manual_only";
  geofenceRadiusMeters?: number;
  // ─── Per-project fixed QR (migration 055) ──
  qrSecret?: string;             // SERVER-ONLY — never expose to unauthenticated clients
  qrEnabled?: boolean;           // when false, kiosk rejects this project's QR
}

// ─── Notification System ─────────────────────────────────────

export type NotificationType =
    | "assignment" | "reassignment" | "absence"
    | "task_assigned" | "task_submitted" | "task_verified" | "task_rejected"
    | "payslip_published" | "payslip_signed" | "payslip_unsigned_reminder" | "payment_confirmed" | "payslip_on_hold"
    | "leave_submitted" | "leave_approved" | "leave_rejected"
    | "attendance_missing" | "geofence_violation" | "location_disabled" | "cheat_detected"
    | "loan_reminder" | "overtime_submitted"
    | "disciplinary_explanation_submitted"
    | "birthday" | "contract_expiry" | "daily_summary"
    // ─── Admin/HR → Employee notifications ──────────────────────
    | "employee_added" | "status_changed" | "resignation"
    | "loan_created" | "loan_settled" | "loan_frozen" | "loan_unfrozen"
    | "disciplinary_case_created" | "nte_issued" | "nod_issued"
    | "salary_approved" | "salary_rejected";

export type NotificationChannel = "email" | "sms" | "both" | "in_app";

export type NotificationTrigger = NotificationType;

export interface NotificationLog {
  id: string;
  employeeId: string;
  type: NotificationType;
  channel: NotificationChannel;
  subject: string;
  body: string;
  sentAt: string;
  status: "sent" | "failed" | "simulated";
  recipientEmail?: string;
  recipientPhone?: string;
  errorMessage?: string;
  /** Whether the notification has been read (for in-app notifications) */
  read?: boolean;
  /** ISO timestamp when the notification was read */
  readAt?: string;
  /** Route link (without role prefix) for navigation when clicked */
  link?: string;
}

export interface NotificationRule {
  id: string;
  trigger: NotificationTrigger;
  enabled: boolean;
  channel: NotificationChannel;
  recipientRoles: string[];
  timing: "immediate" | "scheduled";
  scheduleTime?: string;
  reminderDays?: number[];
  subjectTemplate: string;
  bodyTemplate: string;
  smsTemplate?: string;
}

// ─── Government Table Versioning (§7) ───────────────────────

export interface GovTableVersion {
  id: string;
  tableName: "sss" | "philhealth" | "pagibig" | "tax";
  version: string;
  effectiveDate: string;
  snapshotJson: string;    // JSON stringified table data
  createdAt: string;
}

// ─── Customization System: Permissions, Roles, Widgets, Pages ─

export type Permission =
  // Page access
  | "page:dashboard" | "page:employees" | "page:attendance"
  | "page:leave" | "page:payroll" | "page:loans" | "page:projects"
  | "page:reports" | "page:kiosk" | "page:notifications"
  | "page:audit" | "page:settings" | "page:timesheets" | "page:events"
  // Employee actions
  | "employees:view" | "employees:create" | "employees:edit" | "employees:delete"
  | "employees:view_salary" | "employees:approve_salary"
  // Attendance
  | "attendance:view_all" | "attendance:edit" | "attendance:approve_overtime"
  // Leave
  | "leave:view_all" | "leave:approve" | "leave:manage_policies"
  // Payroll
  | "payroll:view_all" | "payroll:generate" | "payroll:lock" | "payroll:issue"
  | "payroll:view_own"
  // Loans
  | "loans:view_all" | "loans:approve" | "loans:view_own"
  // Audit
  | "audit:view"
  // Settings
  | "settings:roles" | "settings:organization" | "settings:shifts"
  // Projects
  | "projects:manage"
  // Reports
  | "reports:view" | "reports:government"
  // Notifications
  | "notifications:manage"
  // Timesheets
  | "timesheets:view_all" | "timesheets:approve"
  // Task Management
  | "page:tasks" | "tasks:view" | "tasks:create" | "tasks:assign" | "tasks:verify"
  | "tasks:delete" | "tasks:manage_groups"
  // Messaging
  | "page:messages" | "messages:send_announcement" | "messages:manage_channels"
  | "messages:send_whatsapp" | "messages:send_email"
  | "page:jobs" | "jobs:create" | "jobs:edit" | "jobs:close"
  | "jobs:view_applications" | "jobs:manage_applications"
  // Events
  | "events:manage";

// System role slug union (never changes — always recognized)
export type SystemRoleSlug = "admin" | "hr" | "finance" | "employee" | "supervisor" | "payroll_admin" | "auditor";

export interface CustomRole {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string;
  isSystem: boolean;
  permissions: Permission[];
  dashboardLayout?: DashboardLayout;
  createdAt: string;
  updatedAt?: string;
}

export interface DashboardLayout {
  roleId: string;
  widgets: WidgetConfig[];
}

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title?: string;
  colSpan: 1 | 2 | 3 | 4;
  order: number;
  config?: Record<string, unknown>;
}

export type WidgetType =
  // KPIs
  | "kpi_active_employees" | "kpi_present_today" | "kpi_absent_today" | "kpi_on_leave"
  | "kpi_pending_leaves" | "kpi_outstanding_loans" | "kpi_pending_ot"
  | "kpi_payslips_issued" | "kpi_confirmed_payslips" | "kpi_paid_payslips"
  | "kpi_locked_runs" | "kpi_pending_adjustments"
  | "kpi_audit_total" | "kpi_audit_today" | "kpi_unique_actions" | "kpi_unique_actors"
  // Charts
  | "chart_team_performance" | "chart_dept_distribution"
  // Tables
  | "table_employee_status" | "table_recent_audit"
  // Personal
  | "my_attendance_status" | "my_leave_balance" | "my_latest_payslip" | "my_leave_requests"
  // General
  | "events_widget" | "events_widget_readonly" | "birthdays_widget"
  // Attendance
  | "attendance_live_stats" | "enrollment_reminder";

// ─── Custom Page (Page Builder) ──────────────────────────────

export interface CustomPage {
  id: string;
  title: string;
  slug: string;
  icon: string;
  description?: string;
  allowedRoles: string[];
  widgets: WidgetConfig[];
  showInSidebar: boolean;
  order: number;
  createdAt: string;
}

// ─── Site Survey Photo ───────────────────────────────────────

export interface SiteSurveyPhoto {
  id: string;
  eventId: string;
  employeeId: string;
  photoDataUrl: string;
  gpsLat: number;
  gpsLng: number;
  gpsAccuracyMeters: number;
  reverseGeoAddress?: string;
  capturedAt: string;
  geofencePass?: boolean;
  projectId?: string;
}

// ─── Break Record ────────────────────────────────────────────

export interface BreakRecord {
  id: string;
  employeeId: string;
  date: string;
  breakType: "lunch" | "other";
  startTime: string;
  endTime?: string;
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
  endGeofencePass?: boolean;
  distanceFromSite?: number;
  duration?: number;
  overtime?: boolean;
}

// ─── Location Ping ───────────────────────────────────────────

export interface LocationPing {
  id: string;
  employeeId: string;
  timestamp: string;
  lat: number;
  lng: number;
  accuracyMeters: number;
  withinGeofence: boolean;
  projectId?: string;
  distanceFromSite?: number;
  source: "auto" | "manual" | "break_end";
}

// ─── Location Tracking Config ────────────────────────────────

export interface LocationTrackingConfig {
  enabled: boolean;
  pingIntervalMinutes: number;
  requireLocation: boolean;
  warnEmployeeOutOfFence: boolean;
  alertAdminOutOfFence: boolean;
  alertAdminLocationDisabled: boolean;
  trackDuringBreaks: boolean;
  retainDays: number;
  // Selfie / Site Survey
  requireSelfie: boolean;
  selfieRequiredProjects: string[];
  selfieMaxAge: number;
  showReverseGeocode: boolean;
  selfieCompressionQuality: number;
  // Break / Lunch
  lunchDuration: number;
  lunchGeofenceRequired: boolean;
  lunchOvertimeThreshold: number;
  alertAdminOnGeofenceViolation: boolean;
  allowedBreaksPerDay: number;
  breakGracePeriod: number;
}

// ─── Task Management ─────────────────────────────────────────

export type TaskStatus = "open" | "in_progress" | "submitted" | "verified" | "rejected" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type AnnouncementPermission = "admin_only" | "group_leads" | "all_members";

export interface TaskGroup {
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  createdBy: string;
  memberEmployeeIds: string[];
  announcementPermission: AnnouncementPermission;
  createdAt: string;
}

export interface Task {
  id: string;
  groupId?: string;
  projectId?: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  startDate?: string;
  dueDate?: string;
  assignedTo: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completionRequired: boolean;
  tags?: string[];
}

export interface TaskCompletionReport {
  id: string;
  taskId: string;
  employeeId: string;
  photoDataUrl?: string;
  gpsLat?: number;
  gpsLng?: number;
  gpsAccuracyMeters?: number;
  reverseGeoAddress?: string;
  notes?: string;
  submittedAt: string;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  employeeId: string;
  message: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface TaskTag {
  id: string;
  name: string;
  color: string;
  createdBy: string;
  createdAt: string;
}

// ─── Jobs / Talent Acquisition ──────────────────────────────

export type JobStatus = "draft" | "open" | "on_hold" | "closed";
export type JobType = "full_time" | "part_time" | "contract" | "internship" | "freelance";
export type JobPriority = "low" | "medium" | "high" | "urgent";
export type ApplicationStatus =
  | "applied" | "screening" | "interview" | "offer" | "hired" | "rejected" | "withdrawn";

export interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  headcount: number;            // number of open slots
  salaryMin?: number;
  salaryMax?: number;
  description: string;
  requirements: string;         // freeform text
  responsibilities: string;     // freeform text
  deadline?: string;            // ISO date string
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobApplication {
  id: string;
  jobId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  resumeUrl?: string;
  resumeStoragePath?: string;   // private bucket path in "job-resumes"
  coverLetter?: string;
  source: string;               // e.g. "LinkedIn", "Referral", "Walk-in"
  status: ApplicationStatus;
  interviewDate?: string;       // ISO datetime
  offerSalary?: number;
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Multi-Channel Messaging ─────────────────────────────────

export type MessageChannel = "email" | "whatsapp" | "sms" | "in_app";
export type MessageStatus = "sent" | "delivered" | "read" | "failed" | "simulated";
export type AnnouncementScope = "all_employees" | "selected_employees" | "task_group" | "task_assignees";

export interface Announcement {
  id: string;
  subject: string;
  body: string;
  channel: MessageChannel;
  scope: AnnouncementScope;
  targetEmployeeIds?: string[];
  targetGroupId?: string;
  targetTaskId?: string;
  sentBy: string;
  sentAt: string;
  status: MessageStatus;
  readBy: string[];
  attachmentUrl?: string;
}

export interface TextChannel {
  id: string;
  name: string;
  groupId?: string;
  memberEmployeeIds: string[];
  createdBy: string;
  createdAt: string;
  isArchived: boolean;
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  employeeId: string;
  message: string;
  attachmentUrl?: string;
  createdAt: string;
  editedAt?: string;
  readBy: string[];
}

// ─── Service Layer Types ─────────────────────────────────────

/** Standard result type for server actions */
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ─── Kiosk Face Recognition & Enhanced Attendance ────────────────────────────

export type VerificationMethod = "face_only" | "qr_only" | "face_or_qr" | "manual_only";

export interface FaceEnrollment {
  id: string;
  employeeId: string;
  faceTemplateHash: string;
  /** 128-dimensional face embedding from face-api.js */
  embedding?: number[];
  enrollmentDate: string;
  lastVerified?: string;
  verificationCount: number;
  isActive: boolean;
  enrolledBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectVerificationMethod {
  id: string;
  projectId: string;
  verificationMethod: VerificationMethod;
  requireGeofence: boolean;
  geofenceRadiusMeters: number;
  allowManualOverride: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QRTokenRow {
  id: string;
  deviceId: string;
  employeeId?: string;
  token: string;
  expiresAt: string;
  used: boolean;
  usedAt?: string;
  usedByKioskId?: string;
  createdAt: string;
}

export interface ManualCheckinReason {
  id: string;
  reason: string;
  isActive: boolean;
  createdAt: string;
}

export interface ManualCheckin {
  id: string;
  employeeId: string;
  eventType: "IN" | "OUT";
  reasonId?: string;
  customReason?: string;
  performedBy: string;
  timestampUtc: string;
  projectId?: string;
  notes?: string;
  createdAt: string;
}

export interface KioskPin {
  id: string;
  kioskDeviceId: string;
  pinHash: string;
  createdBy: string;
  createdAt: string;
  lastUsedAt?: string;
  isActive: boolean;
}

export interface FaceVerificationResult {
  verified: boolean;
  confidence: "high" | "medium" | "low";
  livenessScore?: number;
  faceDetected?: boolean;
  reason: string;
  spoofIndicators?: string[];
}

// Project interface is defined above (line ~681) with all verification fields included.

// ─── BIR Compliance Engine ───────────────────────────────────
// Types backing migration 056 + bir_alphalist.md plan.

export type BIREmploymentClassification = "R" | "C" | "CP" | "S" | "P" | "AL";
export type BIRTaxStatus = "S" | "M" | "ME" | "MX";
export type BIRTaxResidency = "resident" | "non_resident";
export type BIRSeparationType = "resigned" | "terminated" | "end_of_contract";

/**
 * BIR earnings categorization on a single payslip.
 * Persisted in payslips.tax_categories (jsonb).
 */
export interface TaxCategoryBreakdown {
  // Basic compensation
  basicPay: number;                      // taxable basic salary
  mweBasic: number;                      // basic exempt under MWE rules

  // Time-based earnings
  overtimePay: number;                   // taxable OT
  mweOvertimePay: number;                // OT exempt under MWE
  holidayPay: number;                    // taxable holiday
  mweHolidayPay: number;                 // holiday exempt under MWE
  nightDiff: number;                     // taxable night-diff
  mweNightDiff: number;                  // exempt under MWE
  hazardPay: number;                     // taxable hazard
  mweHazardPay: number;                  // exempt under MWE

  // 13th month + bonuses (₱90k ceiling under TRAIN)
  thirteenthMonth: number;               // total 13th month + Christmas bonus
  thirteenthMonthTaxable: number;        // amount above ₱90k ceiling
  thirteenthMonthNonTaxable: number;     // up to ₱90k

  // De minimis benefits (RR 11-2018)
  deMinimisRiceSubsidy: number;          // up to ₱2,000/month
  deMinimisMedicalAllowance: number;     // up to ₱1,500/qtr
  deMinimisLaundryAllowance: number;     // up to ₱300/month
  deMinimisUniformAllowance: number;     // up to ₱6,000/yr
  deMinimisMealAllowance: number;        // up to 25% of basic min wage
  deMinimisOther: number;
  deMinimisExcess: number;               // amount above caps → taxable

  // Allowances / fringe
  taxableAllowances: number;             // fully taxable allowances
  nonTaxableAllowances: number;

  // Government statutory contributions (employee share — non-taxable)
  sssContribution: number;
  philhealthContribution: number;
  pagibigContribution: number;
  unionDues: number;

  // Tax computed
  withholdingTax: number;                // BIR tax withheld this period

  // Roll-up totals (precomputed for convenience)
  taxableTotal: number;                  // sum of taxable items
  nonTaxableTotal: number;               // sum of non-taxable items + MWE exempt + de minimis within cap
}

// ─── BIR Compliance Engine (continued) ──────────────────────

export type AnnualTaxStatus = "open" | "reconciled" | "finalized" | "exported";
export type AnnualTaxAdjustmentType = "over_withheld" | "under_withheld" | "balanced";
export type Form2316Status = "draft" | "for_signature" | "released" | "downloaded" | "revoked";
export type AlphalistScheduleType = "schedule_1" | "schedule_2" | "both";
export type AlphalistExportFormat = "csv" | "xlsx" | "dat";
export type AlphalistValidationStatus = "passed" | "has_warnings" | "has_errors";
export type EFPSStatus = "draft" | "validated" | "ready" | "submitted" | "payment_pending" | "paid" | "completed";

/** Per-employee BIR profile (1:1 with employees). */
export interface EmployeeTaxProfile {
  id: string;
  employeeId: string;
  tin?: string;                          // 12-digit (NNN-NNN-NNN-NNN)
  employmentClassification: BIREmploymentClassification;
  isMWE: boolean;
  mweDailyRate?: number;
  substitutedFiling: boolean;
  taxStatus: BIRTaxStatus;
  taxResidency: BIRTaxResidency;
  prevEmployerTin?: string;
  prevEmployerName?: string;
  prevIncome?: number;
  prevTaxWithheld?: number;
  prev2316Received: boolean;
  separationDate?: string;
  separationType?: BIRSeparationType;
  createdAt: string;
  updatedAt: string;
}

/** Annual aggregated taxable summary used to issue Form 2316. */
export interface AnnualTaxSummary {
  id: string;
  employeeId: string;
  year: number;
  totalTaxableComp: number;
  totalNonTaxableComp: number;
  totalDeMinimis: number;
  totalSSS: number;
  totalPhilHealth: number;
  totalPagIBIG: number;
  total13thNonTaxable: number;           // up to ₱90k
  total13thTaxable: number;              // excess above ₱90k
  totalOtherBenefits: number;
  totalTaxWithheld: number;
  prevEmployerIncome: number;            // copied from PreviousEmployerRecord(s)
  prevEmployerTax: number;
  annualTaxDue?: number;                 // computed via annual TRAIN brackets
  adjustmentType?: AnnualTaxAdjustmentType;
  adjustmentAmount?: number;             // signed: + = under-withheld owed; - = over-withheld refund
  status: AnnualTaxStatus;
  finalizedAt?: string;
  finalizedBy?: string;
  createdAt: string;
  updatedAt: string;
}

/** Previous employer income record (mid-year hires). */
export interface PreviousEmployerRecord {
  id: string;
  employeeId: string;
  year: number;
  employerName: string;
  employerTin?: string;
  employerAddress?: string;
  totalIncome: number;
  totalTaxWithheld: number;
  reference2316?: string;                // BIR Form 2316 reference number
  submittedAt: string;
  submittedBy?: string;
  createdAt: string;
}

/** BIR Form 2316 issuance record. */
export interface Form2316Record {
  id: string;
  employeeId: string;
  year: number;
  annualSummaryId?: string;
  generatedAt: string;
  generatedBy?: string;
  employerSignedAt?: string;
  employerSignedBy?: string;
  employerSignatureUrl?: string;
  employeeSignedAt?: string;
  employeeSignatureUrl?: string;
  pdfUrl?: string;
  documentHash?: string;                 // SHA-256 of the rendered PDF for tamper-detection
  status: Form2316Status;
  releasedAt?: string;
  downloadedAt?: string;
  downloadedBy?: string;
  revokedAt?: string;
  revokedBy?: string;
  revokeReason?: string;
  createdAt: string;
}

/** Alphalist export header / metadata. */
export interface AlphalistExport {
  id: string;
  year: number;
  scheduleType: AlphalistScheduleType;
  generatedAt: string;
  generatedBy?: string;
  employeeCount: number;
  totalTaxableComp: number;
  totalTaxWithheld: number;
  validationStatus: AlphalistValidationStatus;
  validationErrors?: BIRValidationIssue[];
  exportFormat: AlphalistExportFormat;
  fileUrl?: string;
  efpsStatus: EFPSStatus;
  submittedAt?: string;
  submittedBy?: string;
  createdAt: string;
}

/** Validation finding emitted by BIR validators. */
export interface BIRValidationIssue {
  severity: "error" | "warning" | "info";
  code: string;                          // machine code e.g. "TIN_MISSING"
  message: string;                       // human-readable
  employeeId?: string;
  field?: string;
  value?: unknown;
  suggestedFix?: string;
}

/** Single row in Alphalist Schedule 1 (active employees). */
export interface AlphalistRow {
  sequenceNumber: number;
  tin: string;
  lastName: string;
  firstName: string;
  middleName: string;
  employmentClassification: BIREmploymentClassification;
  taxStatus: BIRTaxStatus;
  isMWE: boolean;
  grossCompensation: number;
  nonTaxableCompensation: number;
  taxableCompensation: number;
  taxWithheld: number;
  taxDue: number;
  overUnderWithheld: number;             // signed
  prevEmployerIncome: number;
  prevEmployerTax: number;
  separationDate?: string;
  separationType?: BIRSeparationType;
}


// ─── Performance Management ──────────────────────────────────

import type { SalaryAdjustmentStatus as _SalaryAdjustmentStatus } from "./performance";

export type { PerformanceCriterion, PerformanceRating, PerformanceReview, PerformanceCycle, PerformanceSalaryBand, PerformanceCycleStatus, ReviewStatus, SalaryAdjustmentStatus, PerformanceAuditLog, CreateCycleInput, UpdateCycleInput, CreateCriterionInput, CreateReviewInput, SubmitReviewInput, AcknowledgeReviewInput, CreateSalaryBandInput, ApproveAdjustmentInput } from "./performance";

export interface PerformanceSalaryAdjustment {
  id: string;
  employee_id: string;
  review_id?: string;
  band_id?: string;
  recommended_amount: number;
  finance_approved_amount?: number;
  override_reason?: string;
  status: _SalaryAdjustmentStatus;
  created_at: string;
  approved_at?: string;
  approved_by?: string;
  employee?: {
    name: string;
    current_salary: number;
  };
  review?: {
    overall_rating: number;
  };
  band?: {
    band_name: string;
    adjustment_percentage: number;
    description?: string;
  };
}

