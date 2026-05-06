-- 031: Harden employee document and salary RLS policies
-- Replaces permissive MVP policies with role/self-aware access.

DROP POLICY IF EXISTS "salary_history_select" ON public.salary_history;
DROP POLICY IF EXISTS "salary_history_manage" ON public.salary_history;
DROP POLICY IF EXISTS "salary_change_requests_select" ON public.salary_change_requests;
DROP POLICY IF EXISTS "salary_change_requests_manage" ON public.salary_change_requests;
DROP POLICY IF EXISTS "employee_docs_select" ON public.employee_documents;
DROP POLICY IF EXISTS "employee_docs_manage" ON public.employee_documents;

CREATE POLICY "salary_history_select_scoped" ON public.salary_history
  FOR SELECT TO authenticated
  USING (
    current_setting('jwt.claims.role', true) IN ('admin', 'hr', 'finance', 'payroll_admin')
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = public.salary_history.employee_id
        AND e.profile_id = auth.uid()
    )
  );

CREATE POLICY "salary_history_manage_admin_hr" ON public.salary_history
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr())
  WITH CHECK (public.is_admin_or_hr());

CREATE POLICY "salary_change_requests_select_scoped" ON public.salary_change_requests
  FOR SELECT TO authenticated
  USING (
    current_setting('jwt.claims.role', true) IN ('admin', 'hr', 'finance', 'payroll_admin')
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = public.salary_change_requests.employee_id
        AND e.profile_id = auth.uid()
    )
  );

CREATE POLICY "salary_change_requests_manage_admin_hr" ON public.salary_change_requests
  FOR ALL TO authenticated
  USING (public.is_admin_or_hr())
  WITH CHECK (public.is_admin_or_hr());

CREATE POLICY "employee_docs_select_scoped" ON public.employee_documents
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_hr()
    OR current_setting('jwt.claims.role', true) IN ('finance', 'payroll_admin', 'auditor')
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = public.employee_documents.employee_id
        AND e.profile_id = auth.uid()
    )
  );

CREATE POLICY "employee_docs_insert_scoped" ON public.employee_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_hr()
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = public.employee_documents.employee_id
        AND e.profile_id = auth.uid()
    )
  );

CREATE POLICY "employee_docs_update_admin_hr" ON public.employee_documents
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_hr())
  WITH CHECK (public.is_admin_or_hr());

CREATE POLICY "employee_docs_delete_scoped" ON public.employee_documents
  FOR DELETE TO authenticated
  USING (
    public.is_admin_or_hr()
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = public.employee_documents.employee_id
        AND e.profile_id = auth.uid()
    )
  );
