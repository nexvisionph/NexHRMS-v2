-- ─────────────────────────────────────────────────────────────
-- Migration 038: payroll_signature_config
-- Single-row table (id = 'default') storing the authorized
-- signatory details that appear on all printed payslips.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payroll_signature_config (
  id              text NOT NULL DEFAULT 'default',
  mode            text NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto', 'manual')),
  signatory_name  text NOT NULL DEFAULT '',
  signatory_title text NOT NULL DEFAULT '',
  signature_data_url text,
  updated_at      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payroll_signature_config_pkey PRIMARY KEY (id)
);

-- Seed the single default row so upsert always works
INSERT INTO public.payroll_signature_config (id, mode, signatory_name, signatory_title)
VALUES ('default', 'auto', '', '')
ON CONFLICT (id) DO NOTHING;

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE public.payroll_signature_config ENABLE ROW LEVEL SECURITY;

-- Payroll admin roles can read and write
CREATE POLICY payroll_sig_admin_all ON public.payroll_signature_config
  FOR ALL
  USING  (public.get_user_role() IN ('admin', 'hr', 'finance', 'payroll_admin'))
  WITH CHECK (public.get_user_role() IN ('admin', 'hr', 'finance', 'payroll_admin'));

-- All authenticated users can read (needed for printing payslips)
CREATE POLICY payroll_sig_read ON public.payroll_signature_config
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
