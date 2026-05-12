-- ============================================================
-- 027_project_constraints.sql
-- 1. Add missing columns to projects table
-- 2. Enforce 1-project-per-employee at the DB level via trigger
-- ============================================================

-- ─── Add missing columns ─────────────────────────────────────

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS location_address    text,
    ADD COLUMN IF NOT EXISTS verification_method text DEFAULT 'face_or_qr'
        CHECK (verification_method IN ('face_only','qr_only','face_or_qr','manual_only')),
    ADD COLUMN IF NOT EXISTS require_geofence    boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS geofence_radius_meters double precision;

-- ─── Function: enforce 1 project per employee ────────────────
--
-- Before any INSERT or UPDATE on projects, check that none of the
-- NEW row's assigned_employee_ids already appear in any OTHER project.
-- If they do, strip them from the OTHER project(s) atomically.
--
-- This mirrors the Zustand store logic: "move" the employee instead
-- of blocking the operation, so the app's intent is always honoured.

CREATE OR REPLACE FUNCTION public.enforce_one_project_per_employee()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    emp_id text;
BEGIN
    -- For each employee being assigned to the NEW row...
    FOREACH emp_id IN ARRAY NEW.assigned_employee_ids
    LOOP
        -- Remove that employee from every OTHER project row
        UPDATE public.projects
        SET assigned_employee_ids = array_remove(assigned_employee_ids, emp_id)
        WHERE id <> NEW.id
          AND emp_id = ANY(assigned_employee_ids);
    END LOOP;

    RETURN NEW;
END;
$$;

-- Drop old version if exists, then recreate
DROP TRIGGER IF EXISTS trg_one_project_per_employee ON public.projects;

CREATE TRIGGER trg_one_project_per_employee
    BEFORE INSERT OR UPDATE OF assigned_employee_ids
    ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_one_project_per_employee();

-- ─── Grant execute on the function ───────────────────────────

GRANT EXECUTE ON FUNCTION public.enforce_one_project_per_employee() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_one_project_per_employee() TO service_role;
