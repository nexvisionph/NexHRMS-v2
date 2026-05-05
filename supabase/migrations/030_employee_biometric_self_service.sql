-- ============================================================
-- 030: Employee biometric self-service access
-- ============================================================

DROP POLICY IF EXISTS biometric_logs_select ON public.biometric_logs;

CREATE POLICY biometric_logs_select ON public.biometric_logs
  FOR SELECT USING (
    company_id = current_setting('jwt.claims.company_id', true)
    AND (
      public.is_admin_or_hr()
      OR employee_id IN (
        SELECT id FROM public.employees WHERE profile_id = auth.uid()
      )
    )
  );

