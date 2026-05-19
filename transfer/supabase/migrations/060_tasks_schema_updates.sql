-- 060_tasks_schema_updates
-- Migration: Make group_id nullable + add start_date
-- Date: 2026-05-11

-- ======================================================================

-- == Make group_id nullable (tasks can exist without a group) =======
ALTER TABLE public.tasks ALTER COLUMN group_id DROP NOT NULL;

-- == Add start_date column ===========================================
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS start_date date;
