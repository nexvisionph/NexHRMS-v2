-- ============================================================
-- 003_roles_permissions.sql
-- Custom roles with permission arrays
-- ============================================================

CREATE TABLE IF NOT EXISTS public.roles_custom (
    id          text PRIMARY KEY,
    name        text NOT NULL,
    slug        text NOT NULL UNIQUE,
    color       text NOT NULL DEFAULT '#6366f1',
    icon        text NOT NULL DEFAULT 'Shield',
    is_system   boolean NOT NULL DEFAULT false,
    permissions text[] NOT NULL DEFAULT '{}',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roles_custom ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_roles_custom_updated_at ON public.roles_custom;
CREATE TRIGGER set_roles_custom_updated_at
    BEFORE UPDATE ON public.roles_custom
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Seed the 7 system roles with their default permissions
INSERT INTO public.roles_custom (id, name, slug, color, icon, is_system, permissions) VALUES
('role-admin', 'Administrator', 'admin', '#ef4444', 'ShieldCheck', true, ARRAY[
    'page:dashboard','page:employees','page:attendance','page:leave','page:payroll',
    'page:loans','page:projects','page:reports','page:kiosk','page:notifications',
    'page:audit','page:settings','page:timesheets','page:tasks','page:messages',
    'employees:view','employees:create','employees:edit','employees:delete',
    'employees:view_salary','employees:approve_salary',
    'attendance:view_all','attendance:edit','attendance:approve_overtime',
    'leave:view_all','leave:approve','leave:manage_policies',
    'payroll:view_all','payroll:generate','payroll:lock','payroll:issue','payroll:view_own',
    'loans:view_all','loans:approve','loans:view_own',
    'audit:view','settings:roles','settings:organization','settings:shifts','settings:page_builder',
    'projects:manage','reports:view','reports:government','notifications:manage',
    'timesheets:view_all','timesheets:approve',
    'tasks:view','tasks:create','tasks:assign','tasks:verify','tasks:delete','tasks:manage_groups',
    'messages:send_announcement','messages:manage_channels','messages:send_whatsapp','messages:send_email'
]),
('role-hr', 'HR Admin', 'hr', '#3b82f6', 'Users', true, ARRAY[
    'page:dashboard','page:employees','page:attendance','page:leave','page:reports',
    'page:timesheets','page:settings','page:tasks','page:messages',
    'employees:view','employees:create','employees:edit','employees:delete','employees:view_salary',
    'attendance:view_all','attendance:edit','attendance:approve_overtime',
    'leave:view_all','leave:approve','leave:manage_policies',
    'settings:organization','settings:shifts',
    'reports:view','timesheets:view_all','timesheets:approve',
    'tasks:view','tasks:create','tasks:assign','tasks:verify','tasks:delete','tasks:manage_groups',
    'messages:send_announcement','messages:manage_channels'
]),
('role-finance', 'Finance', 'finance', '#f59e0b', 'Banknote', true, ARRAY[
    'page:dashboard','page:payroll','page:loans','page:reports','page:employees',
    'employees:view','employees:view_salary','employees:approve_salary',
    'payroll:view_all','payroll:generate','payroll:lock','payroll:issue',
    'loans:view_all','loans:approve',
    'reports:view','reports:government'
]),
('role-employee', 'Employee', 'employee', '#8b5cf6', 'User', true, ARRAY[
    'page:dashboard','page:attendance','page:leave','page:payroll','page:tasks','page:messages',
    'payroll:view_own','loans:view_own',
    'tasks:view'
]),
('role-supervisor', 'Supervisor', 'supervisor', '#f97316', 'UserCheck', true, ARRAY[
    'page:dashboard','page:employees','page:attendance','page:leave',
    'page:timesheets','page:projects','page:tasks','page:messages',
    'employees:view','employees:view_salary',
    'attendance:view_all','attendance:approve_overtime',
    'leave:view_all','leave:approve',
    'timesheets:view_all','timesheets:approve',
    'projects:manage',
    'tasks:view','tasks:create','tasks:assign','tasks:verify','tasks:manage_groups',
    'messages:send_announcement','messages:manage_channels'
]),
('role-payroll-admin', 'Payroll Admin', 'payroll_admin', '#14b8a6', 'Calculator', true, ARRAY[
    'page:dashboard','page:payroll','page:loans','page:reports','page:timesheets',
    'payroll:view_all','payroll:generate','payroll:lock','payroll:issue',
    'loans:view_all','loans:approve',
    'reports:view','reports:government',
    'timesheets:view_all','timesheets:approve'
]),
('role-auditor', 'Auditor', 'auditor', '#64748b', 'Eye', true, ARRAY[
    'page:dashboard','page:audit','page:reports','page:employees',
    'employees:view','audit:view','reports:view'
])
ON CONFLICT (slug) DO NOTHING;
