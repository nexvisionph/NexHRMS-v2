-- 031: Harden employee document and salary RLS policies
-- Replaces permissive MVP policies with role/self-aware access.

CREATE OR REPLACE FUNCTION public.can_manage_employee_sensitive_records()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = ANY(ARRAY['admin','hr','finance','payroll_admin'])
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_employee_documents()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = ANY(ARRAY['admin','hr'])
  );
$$;

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
  USING (public.can_manage_employee_sensitive_records())
  WITH CHECK (public.can_manage_employee_sensitive_records());

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
  USING (public.can_manage_employee_sensitive_records())
  WITH CHECK (public.can_manage_employee_sensitive_records());

CREATE POLICY "employee_docs_select_scoped" ON public.employee_documents
  FOR SELECT TO authenticated
  USING (
    public.can_manage_employee_sensitive_records()
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
    public.can_manage_employee_documents()
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = public.employee_documents.employee_id
        AND e.profile_id = auth.uid()
    )
  );

CREATE POLICY "employee_docs_update_admin_hr" ON public.employee_documents
  FOR UPDATE TO authenticated
  USING (public.can_manage_employee_documents())
  WITH CHECK (public.can_manage_employee_documents());

CREATE POLICY "employee_docs_delete_scoped" ON public.employee_documents
  FOR DELETE TO authenticated
  USING (
    public.can_manage_employee_documents()
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = public.employee_documents.employee_id
        AND e.profile_id = auth.uid()
    )
  );
