-- ═══════════════════════════════════════════════════════════════
-- Payroll Computation Engine — Database Migration
-- Adds fields required for the attendance-based payroll computation.
-- ═══════════════════════════════════════════════════════════════

-- 1. Add OT Description to attendance_logs
-- HR fills this manually when editing/confirming OT entries.
-- Carried over to payslip daily breakdown column.
ALTER TABLE attendance_logs
ADD COLUMN IF NOT EXISTS ot_description TEXT DEFAULT NULL;

COMMENT ON COLUMN attendance_logs.ot_description IS 'HR-filled OT description (e.g. Extended site visit). Displayed on payslip daily breakdown.';

-- 2. Add computation engine fields to payslips
-- These track the detailed OT breakdown from the computation engine.
ALTER TABLE payslips
ADD COLUMN IF NOT EXISTS reg_ot_hours INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reg_ot_minutes INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sat_ot_hours INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sat_ot_minutes INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS compute_source TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS compute_work_days NUMERIC(4,1) DEFAULT NULL;

COMMENT ON COLUMN payslips.reg_ot_hours IS 'Regular day OT hours (integer part) from computation engine';
COMMENT ON COLUMN payslips.reg_ot_minutes IS 'Regular day OT minutes (fractional part) from computation engine';
COMMENT ON COLUMN payslips.sat_ot_hours IS 'Saturday/Sunday/Holiday OT hours from computation engine';
COMMENT ON COLUMN payslips.sat_ot_minutes IS 'Saturday/Sunday/Holiday OT minutes from computation engine';
COMMENT ON COLUMN payslips.compute_source IS 'How payslip was generated: attendance_engine or manual';
COMMENT ON COLUMN payslips.compute_work_days IS 'Rate divisor used (e.g. 21.5 for computation engine)';

-- 3. Add compute_work_days to pay_schedule_config
-- Configurable divisor for rate_per_day = salary / compute_work_days
ALTER TABLE pay_schedule_config
ADD COLUMN IF NOT EXISTS compute_work_days NUMERIC(4,1) DEFAULT 21.5;

COMMENT ON COLUMN pay_schedule_config.compute_work_days IS 'Divisor for computation engine: rate_per_day = salary / compute_work_days (default 21.5)';
