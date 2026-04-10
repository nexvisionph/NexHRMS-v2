-- ============================================================
-- 008: Tasks, Messaging, Announcements (depends on employees, projects)
-- ============================================================

-- Task groups
CREATE TABLE public.task_groups (
  id text NOT NULL,
  name text NOT NULL,
  description text,
  project_id text,
  created_by text NOT NULL,
  member_employee_ids text[] NOT NULL DEFAULT '{}',
  announcement_permission text NOT NULL DEFAULT 'admin_only'
    CHECK (announcement_permission = ANY (ARRAY['admin_only','group_leads','all_members'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_groups_pkey PRIMARY KEY (id),
  CONSTRAINT fk_tg_project FOREIGN KEY (project_id) REFERENCES public.projects(id)
);

-- Tasks
CREATE TABLE public.tasks (
  id text NOT NULL,
  group_id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority = ANY (ARRAY['low','medium','high','urgent'])),
  status text NOT NULL DEFAULT 'open'
    CHECK (status = ANY (ARRAY['open','in_progress','submitted','verified','rejected','cancelled'])),
  due_date date,
  assigned_to text[] NOT NULL DEFAULT '{}',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completion_required boolean NOT NULL DEFAULT false,
  tags text[] DEFAULT '{}',
  project_id text,
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.task_groups(id),
  CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);

-- Task comments
CREATE TABLE public.task_comments (
  id text NOT NULL,
  task_id text NOT NULL,
  employee_id text NOT NULL,
  message text NOT NULL,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_comments_pkey PRIMARY KEY (id),
  CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id),
  CONSTRAINT fk_tc_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

-- Task completion reports
CREATE TABLE public.task_completion_reports (
  id text NOT NULL,
  task_id text NOT NULL,
  employee_id text NOT NULL,
  photo_data_url text,
  gps_lat double precision,
  gps_lng double precision,
  gps_accuracy_meters double precision,
  reverse_geo_address text,
  notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  verified_by text,
  verified_at timestamptz,
  rejection_reason text,
  CONSTRAINT task_completion_reports_pkey PRIMARY KEY (id),
  CONSTRAINT task_completion_reports_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id),
  CONSTRAINT fk_tcr_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

-- Text channels
CREATE TABLE public.text_channels (
  id text NOT NULL,
  name text NOT NULL,
  group_id text,
  member_employee_ids text[] NOT NULL DEFAULT '{}',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_archived boolean NOT NULL DEFAULT false,
  CONSTRAINT text_channels_pkey PRIMARY KEY (id)
);

-- Channel messages
CREATE TABLE public.channel_messages (
  id text NOT NULL,
  channel_id text NOT NULL,
  employee_id text NOT NULL,
  message text NOT NULL,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  read_by text[] NOT NULL DEFAULT '{}',
  CONSTRAINT channel_messages_pkey PRIMARY KEY (id),
  CONSTRAINT channel_messages_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.text_channels(id),
  CONSTRAINT fk_cm_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id)
);

-- Announcements
CREATE TABLE public.announcements (
  id text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  channel text NOT NULL DEFAULT 'in_app'
    CHECK (channel = ANY (ARRAY['email','whatsapp','sms','in_app'])),
  scope text NOT NULL DEFAULT 'all_employees'
    CHECK (scope = ANY (ARRAY['all_employees','selected_employees','task_group','task_assignees'])),
  target_employee_ids text[],
  target_group_id text,
  target_task_id text,
  sent_by text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent'
    CHECK (status = ANY (ARRAY['sent','delivered','read','failed','simulated'])),
  read_by text[] NOT NULL DEFAULT '{}',
  attachment_url text,
  CONSTRAINT announcements_pkey PRIMARY KEY (id)
);
