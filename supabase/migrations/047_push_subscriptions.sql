-- Migration 047: Push Notification Subscriptions
--
-- Stores Web Push API subscriptions for PWA push notifications.
-- Each employee can have multiple subscriptions (different devices/browsers).

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint),
  CONSTRAINT fk_push_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE
);

-- Index for fast lookups by employee
CREATE INDEX IF NOT EXISTS idx_push_subs_employee ON public.push_subscriptions(employee_id) WHERE is_active = true;

-- Index for endpoint lookups (for subscription management)
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Employees can manage their own subscriptions
CREATE POLICY "Employees manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (
    employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.profile_id = auth.uid()
    )
  );

-- Admin/HR can view all subscriptions (for debugging/support)
CREATE POLICY "Admin can view all push subscriptions"
  ON public.push_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.profile_id = auth.uid()
      AND e.role IN ('admin', 'hr')
    )
  );

-- Enable Realtime for push_subscriptions
ALTER TABLE public.push_subscriptions REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$$;

COMMENT ON TABLE public.push_subscriptions IS 'Web Push API subscriptions for PWA push notifications';
COMMENT ON COLUMN public.push_subscriptions.endpoint IS 'Push service endpoint URL (unique per browser/device)';
COMMENT ON COLUMN public.push_subscriptions.p256dh IS 'Public key for encryption (base64url encoded)';
COMMENT ON COLUMN public.push_subscriptions.auth IS 'Authentication secret (base64url encoded)';
