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
CREATE INDEX IF NOT EXISTS idx_push_subs_employee ON public.push_subscriptions(employee_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Employees manage own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Admin can view all push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Employees manage own push subscriptions" ON public.push_subscriptions FOR ALL USING (employee_id IN (SELECT e.id FROM public.employees e WHERE e.profile_id = auth.uid())) WITH CHECK (employee_id IN (SELECT e.id FROM public.employees e WHERE e.profile_id = auth.uid()));
CREATE POLICY "Admin can view all push subscriptions" ON public.push_subscriptions FOR SELECT USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.profile_id = auth.uid() AND e.role IN ('admin','hr')));
ALTER TABLE public.push_subscriptions REPLICA IDENTITY FULL;
