-- 031: Harden employee document and salary RLS policies
-- Replaces permissive MVP policies with role/self-aware access.

CREATE OR REPLACE FUNCTION public.can_manage_employee_sensitive_records(target_company_id text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = ANY(ARRAY['admin','hr','finance','payroll_admin'])
      AND (
        target_company_id IS NULL
        OR COALESCE(company_id, 'default') = COALESCE(target_company_id, 'default')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_employee_documents(target_company_id text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = ANY(ARRAY['admin','hr'])
      AND (
        target_company_id IS NULL
        OR COALESCE(company_id, 'default') = COALESCE(target_company_id, 'default')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_employee_documents(target_company_id text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = ANY(ARRAY['admin','hr','finance','payroll_admin','auditor'])
      AND (
        target_company_id IS NULL
        OR COALESCE(company_id, 'default') = COALESCE(target_company_id, 'default')
      )
  );
$$;

DROP POLICY IF EXISTS "salary_history_select" ON public.salary_history;
DROP POLICY IF EXISTS "salary_history_manage" ON public.salary_history;
DROP POLICY IF EXISTS "salary_history_select_scoped" ON public.salary_history;
DROP POLICY IF EXISTS "salary_history_manage_admin_hr" ON public.salary_history;
DROP POLICY IF EXISTS "salary_change_requests_select" ON public.salary_change_requests;
DROP POLICY IF EXISTS "salary_change_requests_manage" ON public.salary_change_requests;
DROP POLICY IF EXISTS "salary_change_requests_select_scoped" ON public.salary_change_requests;
DROP POLICY IF EXISTS "salary_change_requests_manage_admin_hr" ON public.salary_change_requests;
DROP POLICY IF EXISTS "employee_docs_select" ON public.employee_documents;
DROP POLICY IF EXISTS "employee_docs_manage" ON public.employee_documents;
DROP POLICY IF EXISTS "employee_docs_select_scoped" ON public.employee_documents;
DROP POLICY IF EXISTS "employee_docs_insert_scoped" ON public.employee_documents;
DROP POLICY IF EXISTS "employee_docs_update_admin_hr" ON public.employee_documents;
DROP POLICY IF EXISTS "employee_docs_delete_scoped" ON public.employee_documents;

DROP FUNCTION IF EXISTS public.can_manage_employee_sensitive_records();
DROP FUNCTION IF EXISTS public.can_manage_employee_documents();

CREATE POLICY "salary_history_select_scoped" ON public.salary_history
  FOR SELECT TO authenticated
  USING (
    public.can_manage_employee_sensitive_records(public.salary_history.company_id)
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = public.salary_history.employee_id
        AND e.profile_id = auth.uid()
        AND COALESCE(e.company_id, 'default') = COALESCE(public.salary_history.company_id, 'default')
    )
  );

CREATE POLICY "salary_history_manage_admin_hr" ON public.salary_history
  FOR ALL TO authenticated
  USING (public.can_manage_employee_sensitive_records(public.salary_history.company_id))
  WITH CHECK (public.can_manage_employee_sensitive_records(public.salary_history.company_id));

CREATE POLICY "salary_change_requests_select_scoped" ON public.salary_change_requests
  FOR SELECT TO authenticated
  USING (
    public.can_manage_employee_sensitive_records(public.salary_change_requests.company_id)
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = public.salary_change_requests.employee_id
        AND e.profile_id = auth.uid()
        AND COALESCE(e.company_id, 'default') = COALESCE(public.salary_change_requests.company_id, 'default')
    )
  );

CREATE POLICY "salary_change_requests_manage_admin_hr" ON public.salary_change_requests
  FOR ALL TO authenticated
  USING (public.can_manage_employee_sensitive_records(public.salary_change_requests.company_id))
  WITH CHECK (public.can_manage_employee_sensitive_records(public.salary_change_requests.company_id));

CREATE POLICY "employee_docs_select_scoped" ON public.employee_documents
  FOR SELECT TO authenticated
  USING (
    public.can_view_employee_documents(public.employee_documents.company_id)
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = public.employee_documents.employee_id
        AND e.profile_id = auth.uid()
        AND COALESCE(e.company_id, 'default') = COALESCE(public.employee_documents.company_id, 'default')
    )
  );

CREATE POLICY "employee_docs_insert_scoped" ON public.employee_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_manage_employee_documents(public.employee_documents.company_id)
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = public.employee_documents.employee_id
        AND e.profile_id = auth.uid()
        AND COALESCE(e.company_id, 'default') = COALESCE(public.employee_documents.company_id, 'default')
    )
  );

CREATE POLICY "employee_docs_update_admin_hr" ON public.employee_documents
  FOR UPDATE TO authenticated
  USING (public.can_manage_employee_documents(public.employee_documents.company_id))
  WITH CHECK (public.can_manage_employee_documents(public.employee_documents.company_id));

CREATE POLICY "employee_docs_delete_scoped" ON public.employee_documents
  FOR DELETE TO authenticated
  USING (
    public.can_manage_employee_documents(public.employee_documents.company_id)
    OR EXISTS (
      SELECT 1
      FROM public.employees e
      WHERE e.id = public.employee_documents.employee_id
        AND e.profile_id = auth.uid()
        AND COALESCE(e.company_id, 'default') = COALESCE(public.employee_documents.company_id, 'default')
    )
  );
