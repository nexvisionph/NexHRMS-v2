-- ════════════════════════════════════════════════════════════════════
-- 017: Align employees.role with profiles.role (lowercase)
-- Run this in Supabase Dashboard > SQL Editor
-- ════════════════════════════════════════════════════════════════════

-- Step 1: Drop old constraint
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_role_check;

-- Step 2: Migrate existing data to lowercase
UPDATE public.employees SET role = 'admin' WHERE role = 'Admin';
UPDATE public.employees SET role = 'hr' WHERE role = 'HR Admin';
UPDATE public.employees SET role = 'finance' WHERE role = 'Finance';
UPDATE public.employees SET role = 'employee' WHERE role = 'Employee';
UPDATE public.employees SET role = 'supervisor' WHERE role = 'Supervisor';
UPDATE public.employees SET role = 'payroll_admin' WHERE role = 'Payroll Admin';
UPDATE public.employees SET role = 'auditor' WHERE role = 'Auditor';

-- Step 3: Add new constraint (lowercase, matching profiles.role + frontend Role type)
ALTER TABLE public.employees ADD CONSTRAINT employees_role_check
  CHECK (role IN ('admin','hr','finance','employee','supervisor','payroll_admin','auditor'));
