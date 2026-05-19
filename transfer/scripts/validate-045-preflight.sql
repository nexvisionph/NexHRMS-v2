-- =====================================================
-- Pre-flight Validation for Migration 045
-- Run this in Supabase SQL Editor BEFORE running the migration.
-- It checks whether your actual DB schema matches expectations.
-- =====================================================

-- ─── 1. Check critical PK column types ──────────────────────

SELECT
  'CRITICAL: PK Type Check' AS check_name,
  table_name,
  column_name,
  data_type,
  udt_name,
  CASE
    WHEN table_name = 'employees'     AND data_type = 'text' THEN '✅ OK (text, matches migrations)'
    WHEN table_name = 'employees'     AND udt_name  = 'uuid' THEN '❌ MISMATCH — actual=uuid, migrations expect text'
    WHEN table_name = 'payslips'      AND data_type = 'text' THEN '✅ OK (text, matches migrations)'
    WHEN table_name = 'payslips'      AND udt_name  = 'uuid' THEN '❌ MISMATCH — actual=uuid, migrations expect text'
    WHEN table_name = 'payroll_runs'  AND data_type = 'text' THEN '✅ OK (text, matches migrations)'
    WHEN table_name = 'payroll_runs'  AND udt_name  = 'uuid' THEN '❌ MISMATCH — actual=uuid, migrations expect text'
    WHEN table_name = 'projects'      AND data_type = 'text' THEN '✅ OK'
    WHEN table_name = 'projects'      AND udt_name  = 'uuid' THEN '❌ MISMATCH'
    ELSE '⚠️  UNEXPECTED TYPE: ' || data_type
  END AS verdict
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'id'
  AND table_name IN ('employees', 'payslips', 'payroll_runs', 'projects', 'profiles')
ORDER BY table_name;

-- ─── 2. Check if migration 045 tables already exist ─────────

SELECT
  'Table Existence Check' AS check_name,
  table_name,
  CASE
    WHEN table_name IS NOT NULL THEN '⚠️  TABLE ALREADY EXISTS — migration will use IF NOT EXISTS'
  END AS verdict
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('deduction_templates', 'employee_deduction_assignments', 'payslip_line_items')
ORDER BY table_name;

-- ─── 3. Check if deduction_exempt columns already exist ──────

SELECT
  'Column Existence Check' AS check_name,
  table_name,
  column_name,
  data_type,
  '⚠️  Column already exists — ADD COLUMN IF NOT EXISTS will skip' AS verdict
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'employees'
  AND column_name IN ('deduction_exempt', 'deduction_exempt_reason')
ORDER BY column_name;

-- ─── 4. Check payslip status CHECK constraint ───────────────

SELECT
  'Payslip Status Constraint' AS check_name,
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.payslips'::regclass
  AND conname LIKE '%status%';

-- ─── 5. Check payroll_runs status CHECK constraint ──────────

SELECT
  'Run Status Constraint' AS check_name,
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.payroll_runs'::regclass
  AND conname LIKE '%status%';

-- ─── 6. Check for employee_id FK type consistency ───────────
-- Shows all columns named employee_id and their types.
-- ALL should be the same type as employees.id.

SELECT
  'FK Column Type Audit' AS check_name,
  c.table_name,
  c.column_name,
  c.data_type AS fk_column_type,
  pk.data_type AS employees_id_type,
  CASE
    WHEN c.data_type = pk.data_type THEN '✅ Types match'
    ELSE '❌ TYPE MISMATCH: ' || c.data_type || ' → ' || pk.data_type
  END AS verdict
FROM information_schema.columns c
CROSS JOIN (
  SELECT data_type FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'id'
) pk
WHERE c.table_schema = 'public'
  AND c.column_name = 'employee_id'
ORDER BY c.table_name;

-- ─── 7. Sample data check — are employees using text IDs? ───

SELECT
  'Employee ID Sample' AS check_name,
  id,
  CASE
    WHEN id ~ '^EMP-'         THEN '✅ Text ID (nanoid pattern)'
    WHEN id ~ '^[0-9a-f]{8}-' THEN '⚠️  UUID format'
    ELSE '⚠️  Unknown format: ' || LEFT(id, 20)
  END AS verdict
FROM public.employees
LIMIT 5;

-- ─── 8. Summary ─────────────────────────────────────────────
-- If you see any ❌ results above, the migration types need adjustment.
-- The app generates text IDs (EMP-xxx, PS-xxx). If employees.id is uuid,
-- the entire app cannot insert data. You likely need to either:
--   A) Recreate the DB using migrations 001-044 (recommended)
--   B) ALTER TABLE employees ALTER COLUMN id TYPE text (risky if data exists)
