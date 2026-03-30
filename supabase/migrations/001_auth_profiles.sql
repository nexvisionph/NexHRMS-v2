-- ============================================================
-- 001_auth_profiles.sql
-- Profiles table linked to Supabase Auth (auth.users)
-- ============================================================

-- Profiles: extends auth.users with app-specific fields
CREATE TABLE IF NOT EXISTS public.profiles (
    id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name        text NOT NULL,
    email       text NOT NULL UNIQUE,
    role        text NOT NULL DEFAULT 'employee'
                CHECK (role IN ('admin','hr','finance','employee','supervisor','payroll_admin','auditor')),
    avatar_url  text,
    phone       text,
    department  text,
    birthday    date,
    address     text,
    emergency_contact text,
    must_change_password boolean NOT NULL DEFAULT true,
    profile_complete    boolean NOT NULL DEFAULT false,
    created_by  uuid REFERENCES auth.users(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast role lookups (used by RLS helper)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Helper: get current user's role (used by RLS policies)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: check if current user is admin/hr/supervisor
CREATE OR REPLACE FUNCTION public.is_admin_or_hr()
RETURNS boolean AS $$
    SELECT public.get_user_role() IN ('admin', 'hr')
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS Policies for profiles
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins and HR can read all profiles" ON public.profiles;
CREATE POLICY "Admins and HR can read all profiles"
    ON public.profiles FOR SELECT
    USING (public.get_user_role() IN ('admin', 'hr', 'auditor'));

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
    ON public.profiles FOR ALL
    USING (public.get_user_role() = 'admin');
