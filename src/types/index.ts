// ─── Core Types ──────────────────────────────────────────────

export type Role = "admin" | "hr" | "finance" | "employee" | "supervisor" | "payroll_admin" | "auditor";

export type EmployeeStatus = "active" | "inactive" | "resigned";
export type WorkType = "WFH" | "WFO" | "HYBRID" | "ONSITE";
export type AttendanceStatus = "present" | "absent" | "on_leave";
export type LeaveType = "SL" | "VL" | "EL" | "OTHER" | "ML" | "PL" | "SPL";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type PayslipStatus = "issued" | "confirmed" | "published" | "paid" | "acknowledged";
export type PayrollRunStatus = "draft" | "validated" | "locked" | "published" | "paid";
export type LoanStatus = "active" | "settled" | "frozen" | "cancelled";
export type OvertimeStatus = "pending" | "approved" | "rejected";
export type AdjustmentType = "earnings" | "deduction" | "net_correction" | "statutory_correction";
export type AdjustmentStatus = "pending" | "approved" | "applied" | "rejected";
export type SalaryChangeStatus = "pending" | "approved" | "rejected";
export type AttendanceFlag = "missing_in" | "missing_out" | "out_of_geofence" | "duplicate_scan" | "device_mismatch" | "overtime_without_approval";
export type AttendanceEventType =
  | "IN" | "OUT" | "BREAK_START" | "BREAK_END"
  | "OVERRIDE" | "BULK_OVERRIDE"
  | "MARK_ABSENT" | "MARK_PRESENT"
  | "OT_APPROVED" | "OT_REJECTED" | "OT_SUBMITTED"
  | "EXCEPTION_RESOLVED" | "EXCEPTION_SCANNED"
  | "HOLIDAY_ADDED" | "HOLIDAY_UPDATED" | "HOLIDAY_DELETED"
  | "CSV_IMPORTED" | "CSV_EXPORTED"
  | "PENALTY_APPLIED" | "PENALTY_CLEARED"
  | "SHIFT_ASSIGNED" | "DATA_RESET";
export type TimesheetStatus = "computed" | "submitted" | "approved" | "rejected";
export type AccrualFrequency = "monthly" | "annual";
export type PayFrequency = "monthly" | "semi_monthly" | "bi_weekly" | "weekly";
export type AuditAction =
  | "salary_proposed" | "salary_approved" | "salary_rejected"
  | "leave_approved" | "leave_rejected"
  | "overtime_approved" | "overtime_rejected"
  | "payroll_locked" | "payroll_published" | "payroll_paid"
  | "adjustment_created" | "adjustment_approved" | "adjustment_applied"
  | "loan_created" | "loan_frozen" | "loan_unfrozen" | "loan_settled"
  | "payment_recorded" | "employee_resigned" | "employee_deleted" | "final_pay_created"
  | "timesheet_approved" | "timesheet_rejected"
  | "kiosk_registered" | "attendance_correction"
  | "task_created" | "task_assigned" | "task_completed" | "task_verified" | "task_rejected"
  | "tag_created" | "tag_updated" | "tag_deleted"
  | "announcement_sent" | "channel_created";

// ─── Holiday Type ────────────────────────────────────────────

export type HolidayType = "regular" | "special" | "special_non_working" | "special_working";

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
  role: string;
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
  resignedAt?: string;
  shiftId?: string;
  payFrequency?: PayFrequency; // per-employee override (falls back to company default)
  workDays?: string[]; // e.g. ["Mon","Tue","Wed","Thu","Fri"]
  emergencyContact?: string;
  address?: string;
  whatsappNumber?: string;
  preferredChannel?: MessageChannel;
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
  shiftId?: string;
  flags?: AttendanceFlag[];
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
  paymentMethod?: string;
  bankReferenceId?: string;
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
}

// ─── Notification System ─────────────────────────────────────

export type NotificationType =
    | "assignment" | "reassignment" | "absence"
    | "task_assigned" | "task_submitted" | "task_verified" | "task_rejected"
    | "payslip_published" | "payslip_signed" | "payslip_unsigned_reminder" | "payment_confirmed"
    | "leave_submitted" | "leave_approved" | "leave_rejected"
    | "attendance_missing" | "geofence_violation" | "location_disabled"
    | "loan_reminder" | "overtime_submitted"
    | "birthday" | "contract_expiry" | "daily_summary";

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
  | "page:audit" | "page:settings" | "page:timesheets"
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
  | "settings:page_builder"
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
  | "messages:send_whatsapp" | "messages:send_email";

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
  groupId: string;
  projectId?: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
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

export type VerificationMethod = "face_only" | "qr_only" | "manual_only";

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

// Extend Project interface with verification fields
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
  verificationMethod?: VerificationMethod;
  requireGeofence?: boolean;
  geofenceRadiusMeters?: number;
}
