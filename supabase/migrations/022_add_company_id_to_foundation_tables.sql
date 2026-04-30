-- ============================================================
-- 022: Add company_id to foundation/system tables
-- This adds nullable company_id to foundation tables that may benefit
-- from per-company customization (roles, job titles, departments, etc).
-- ============================================================

-- Roles (custom) - can be global or per-company
ALTER TABLE IF EXISTS public.roles_custom
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_roles_custom_company_id ON public.roles_custom(company_id);
UPDATE public.roles_custom SET company_id = 'default' WHERE company_id IS NULL;

-- Job titles (per-company for org-specific roles)
ALTER TABLE IF EXISTS public.job_titles
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_job_titles_company_id ON public.job_titles(company_id);
UPDATE public.job_titles SET company_id = 'default' WHERE company_id IS NULL;

-- Departments (per-company for org structure)
ALTER TABLE IF EXISTS public.departments
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_departments_company_id ON public.departments(company_id);
UPDATE public.departments SET company_id = 'default' WHERE company_id IS NULL;

-- Shift templates (can be global or per-company)
ALTER TABLE IF EXISTS public.shift_templates
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_shift_templates_company_id ON public.shift_templates(company_id);
UPDATE public.shift_templates SET company_id = 'default' WHERE company_id IS NULL;

-- Leave policies (per-company for company-specific leave rules)
ALTER TABLE IF EXISTS public.leave_policies
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_leave_policies_company_id ON public.leave_policies(company_id);
UPDATE public.leave_policies SET company_id = 'default' WHERE company_id IS NULL;

-- Holidays (can be global or per-company for regional holidays)
ALTER TABLE IF EXISTS public.holidays
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_holidays_company_id ON public.holidays(company_id);
UPDATE public.holidays SET company_id = 'default' WHERE company_id IS NULL;

-- Attendance rule sets (per-company for company-specific policies)
ALTER TABLE IF EXISTS public.attendance_rule_sets
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_attendance_rule_sets_company_id ON public.attendance_rule_sets(company_id);
UPDATE public.attendance_rule_sets SET company_id = 'default' WHERE company_id IS NULL;

-- Task tags (per-company for org-specific tags)
ALTER TABLE IF EXISTS public.task_tags
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_task_tags_company_id ON public.task_tags(company_id);
UPDATE public.task_tags SET company_id = 'default' WHERE company_id IS NULL;

-- Manual checkin reasons (per-company for org-specific reasons)
ALTER TABLE IF EXISTS public.manual_checkin_reasons
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_manual_checkin_reasons_company_id ON public.manual_checkin_reasons(company_id);
UPDATE public.manual_checkin_reasons SET company_id = 'default' WHERE company_id IS NULL;

-- Calendar events (per-company for company-specific events)
ALTER TABLE IF EXISTS public.calendar_events
  ADD COLUMN IF NOT EXISTS company_id text;
CREATE INDEX IF NOT EXISTS idx_calendar_events_company_id ON public.calendar_events(company_id);
UPDATE public.calendar_events SET company_id = 'default' WHERE company_id IS NULL;

-- End of migration 022.
