-- ─── Task Tags Table ──────────────────────────────────────────
-- Provides a managed registry of tags that admins can define,
-- each with a display name and a hex colour.  Tasks reference
-- tags by name (string[]), so this table is purely metadata.

CREATE TABLE IF NOT EXISTS public.task_tags (
    id          text        PRIMARY KEY,
    name        text        NOT NULL UNIQUE,
    color       text        NOT NULL DEFAULT '#6366f1',
    created_by  text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Full access for authenticated users (admin manages in UI)
ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read task_tags"
    ON public.task_tags FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert task_tags"
    ON public.task_tags FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update task_tags"
    ON public.task_tags FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can delete task_tags"
    ON public.task_tags FOR DELETE
    TO authenticated
    USING (true);

-- Index for quick name lookups / auto-complete
CREATE INDEX IF NOT EXISTS idx_task_tags_name ON public.task_tags (lower(name));
