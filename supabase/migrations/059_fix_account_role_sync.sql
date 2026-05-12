-- ============================================================
-- 059_fix_account_role_sync.sql
-- Ensure newly created auth users keep intended system role
-- and repair existing profile/employee role mismatches.
-- ============================================================

-- 1) Harden auth->profile trigger role mapping.
-- Prefer explicit role from user/app metadata, normalize to lowercase,
-- and fall back to employee only for unknown/empty values.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  requested_role text;
BEGIN
  requested_role := lower(
    coalesce(
      nullif(NEW.raw_user_meta_data->>'role', ''),
      nullif(NEW.raw_app_meta_data->>'role', ''),
      'employee'
    )
  );

  IF requested_role NOT IN ('admin','hr','finance','employee','supervisor','payroll_admin','auditor') THEN
    requested_role := 'employee';
  END IF;

  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    requested_role
  )
  ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        email = EXCLUDED.email,
        role = EXCLUDED.role;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger points to latest function definition.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2) One-time repair: profile role should match linked employee role.
UPDATE public.profiles p
SET role = e.role
FROM public.employees e
WHERE e.profile_id = p.id
  AND e.role IN ('admin','hr','finance','employee','supervisor','payroll_admin','auditor')
  AND p.role IS DISTINCT FROM e.role;
