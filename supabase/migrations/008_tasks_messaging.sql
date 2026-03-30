-- ============================================================
-- 008_tasks_messaging.sql
-- Task groups, tasks, completions, comments, announcements,
-- text channels, channel messages
-- ============================================================

-- Task Groups
CREATE TABLE IF NOT EXISTS public.task_groups (
    id                      text PRIMARY KEY,
    name                    text NOT NULL,
    description             text,
    project_id              text,
    created_by              text NOT NULL,
    member_employee_ids     text[] NOT NULL DEFAULT '{}',
    announcement_permission text NOT NULL DEFAULT 'admin_only'
                            CHECK (announcement_permission IN ('admin_only','group_leads','all_members')),
    created_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_groups ENABLE ROW LEVEL SECURITY;

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
    id                  text PRIMARY KEY,
    group_id            text NOT NULL REFERENCES public.task_groups(id) ON DELETE CASCADE,
    title               text NOT NULL,
    description         text NOT NULL DEFAULT '',
    priority            text NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('low','medium','high','urgent')),
    status              text NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','in_progress','submitted','verified','rejected','cancelled')),
    due_date            date,
    assigned_to         text[] NOT NULL DEFAULT '{}',
    created_by          text NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    completion_required boolean NOT NULL DEFAULT false,
    tags                text[] DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_tasks_group ON public.tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_tasks_updated_at ON public.tasks;
CREATE TRIGGER set_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Task Completion Reports
CREATE TABLE IF NOT EXISTS public.task_completion_reports (
    id                  text PRIMARY KEY,
    task_id             text NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    employee_id         text NOT NULL,
    photo_data_url      text,
    gps_lat             double precision,
    gps_lng             double precision,
    gps_accuracy_meters double precision,
    reverse_geo_address text,
    notes               text,
    submitted_at        timestamptz NOT NULL DEFAULT now(),
    verified_by         text,
    verified_at         timestamptz,
    rejection_reason    text
);

CREATE INDEX IF NOT EXISTS idx_tcr_task ON public.task_completion_reports(task_id);

ALTER TABLE public.task_completion_reports ENABLE ROW LEVEL SECURITY;

-- Task Comments
CREATE TABLE IF NOT EXISTS public.task_comments (
    id              text PRIMARY KEY,
    task_id         text NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    employee_id     text NOT NULL,
    message         text NOT NULL,
    attachment_url  text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tc_task ON public.task_comments(task_id);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- ─── Messaging ───────────────────────────────────────────────

-- Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
    id                  text PRIMARY KEY,
    subject             text NOT NULL,
    body                text NOT NULL,
    channel             text NOT NULL DEFAULT 'in_app'
                        CHECK (channel IN ('email','whatsapp','sms','in_app')),
    scope               text NOT NULL DEFAULT 'all_employees'
                        CHECK (scope IN ('all_employees','selected_employees','task_group','task_assignees')),
    target_employee_ids text[],
    target_group_id     text,
    target_task_id      text,
    sent_by             text NOT NULL,
    sent_at             timestamptz NOT NULL DEFAULT now(),
    status              text NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('sent','delivered','read','failed','simulated')),
    read_by             text[] NOT NULL DEFAULT '{}',
    attachment_url      text
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Text Channels
CREATE TABLE IF NOT EXISTS public.text_channels (
    id                  text PRIMARY KEY,
    name                text NOT NULL,
    group_id            text,
    member_employee_ids text[] NOT NULL DEFAULT '{}',
    created_by          text NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),
    is_archived         boolean NOT NULL DEFAULT false
);

ALTER TABLE public.text_channels ENABLE ROW LEVEL SECURITY;

-- Channel Messages
CREATE TABLE IF NOT EXISTS public.channel_messages (
    id              text PRIMARY KEY,
    channel_id      text NOT NULL REFERENCES public.text_channels(id) ON DELETE CASCADE,
    employee_id     text NOT NULL,
    message         text NOT NULL,
    attachment_url  text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    edited_at       timestamptz,
    read_by         text[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_cm_channel ON public.channel_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_cm_created ON public.channel_messages(created_at);

ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
