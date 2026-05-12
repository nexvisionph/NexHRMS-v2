-- ============================================================
-- 042_employees_add_job_title.sql
-- Add job_title column to employees table to store the display title
-- ============================================================

-- Add job_title column to employees table
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS job_title text;

-- Create index for job title filtering
CREATE INDEX IF NOT EXISTS idx_employees_job_title ON public.employees(job_title);

-- Comment for documentation
COMMENT ON COLUMN public.employees.job_title IS 'Display job title/position (e.g., "DevOps Engineer", "HR Manager")';
