-- Migration: create biometric_templates table
-- Adds storage for device biometric templates (face/fingerprint) and metadata

/*
  Usage: run this SQL in your Supabase SQL editor or via psql against your database.
  Notes:
  - Uses `gen_random_uuid()` for UUID primary keys. If your DB doesn't have
    pgcrypto enabled, uncomment the CREATE EXTENSION line below (Supabase
    projects typically already enable pgcrypto).
  - `employee_id` is text to match common `employees.id` types used in this
    project. Adjust if your employees.id is uuid.
*/

-- Enable pgcrypto if missing (safe to run if already enabled)
-- create extension if not exists pgcrypto;

create table if not exists biometric_templates (
  id uuid primary key default gen_random_uuid(),
  biometric_id text not null unique,
  employee_id text references employees(id) on delete set null,
  name text,
  privilege integer default 0,
  password text,
  card_no text,
  finger_template text,
  face_template text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_biometric_templates_biometric_id on biometric_templates(biometric_id);
create index if not exists idx_biometric_templates_employee_id on biometric_templates(employee_id);
create index if not exists idx_biometric_templates_created_at on biometric_templates(created_at);

-- Trigger function to set updated_at
create or replace function trg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists biometric_templates_set_updated_at on biometric_templates;
create trigger biometric_templates_set_updated_at
  before update on biometric_templates
  for each row execute function trg_set_updated_at();

-- Optional audit table for raw scanner events — useful for troubleshooting
create table if not exists biometric_logs (
  id uuid primary key default gen_random_uuid(),
  biometric_id text,
  device_id text,
  action text,
  payload jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_biometric_logs_biometric_id on biometric_logs(biometric_id);
create index if not exists idx_biometric_logs_device_id on biometric_logs(device_id);

-- Helpful helper: ensure employee_id column type matches employees.id
-- If you previously created the table with a mismatched type, run these
-- ALTER statements in the SQL editor (they are safe to run idempotently):
--
-- alter table if exists biometric_templates drop constraint if exists biometric_templates_employee_id_fkey;
-- alter table if exists biometric_templates alter column employee_id type text using employee_id::text;
-- alter table if exists biometric_templates add constraint biometric_templates_employee_id_fkey foreign key (employee_id) references employees(id) on delete set null;

