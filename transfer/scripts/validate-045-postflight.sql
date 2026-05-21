-- =====================================================
-- Post-flight Validation for Migration 045
-- Run this in Supabase SQL Editor AFTER running the migration.
-- Verifies all tables, columns, constraints, and RLS are correct.
-- =====================================================

-- ════════════════════════════════════════════════════════
-- TEST 1: New tables exist
-- ════════════════════════════════════════════════════════

SELECT
  'TEST 1: Table Existence' AS test,
  CASE WHEN COUNT(*) = 3 THEN '✅ PASS' ELSE '❌ FAIL — missing tables' END AS result,
  string_agg(table_name, ', ' ORDER BY table_name) AS tables_found
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('deduction_templates', 'employee_deduction_assignments', 'payslip_line_items');

-- ════════════════════════════════════════════════════════
-- TEST 2: deduction_templates columns and types
-- ════════════════════════════════════════════════════════

SELECT
  'TEST 2: deduction_templates schema' AS test,
  column_name,
  data_type,
  column_default,
  is_nullable,
  CASE
    WHEN column_name = 'id'               AND data_type = 'text'                       THEN '✅'
    WHEN column_name = 'name'             AND data_type = 'text'                       THEN '✅'
    WHEN column_name = 'type'             AND data_type = 'text'                       THEN '✅'
    WHEN column_name = 'calculation_mode' AND data_type = 'text'                       THEN '✅'
    WHEN column_name = 'value'            AND data_type = 'numeric'                    THEN '✅'
    WHEN column_name = 'conditions'       AND data_type = 'jsonb'                      THEN '✅'
    WHEN column_name = 'applies_to_all'   AND data_type = 'boolean'                    THEN '✅'
    WHEN column_name = 'is_active'        AND data_type = 'boolean'                    THEN '✅'
    WHEN column_name = 'created_by'       AND data_type = 'text'                       THEN '✅'
    WHEN column_name IN ('created_at','updated_at') AND data_type LIKE 'timestamp%'    THEN '✅'
    ELSE '⚠️  CHECK'
  END AS verdict
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'deduction_templates'
ORDER BY ordinal_position;

-- ════════════════════════════════════════════════════════
-- TEST 3: employee_deduction_assignments FK types match target
-- ════════════════════════════════════════════════════════

SELECT
  'TEST 3: EDA FK type alignment' AS test,
  eda.column_name AS eda_column,
  eda.udt_name AS eda_type,
  emp.udt_name AS employees_id_type,
  CASE
    WHEN eda.udt_name = emp.udt_name THEN '✅ PASS — types match (' || eda.udt_name || ')'
    ELSE '❌ FAIL — ' || eda.udt_name || ' vs ' || emp.udt_name
  END AS result
FROM information_schema.columns eda
CROSS JOIN (
  SELECT udt_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'employees' AND column_name = 'id'
) emp
WHERE eda.table_schema = 'public'
  AND eda.table_name = 'employee_deduction_assignments'
  AND eda.column_name = 'employee_id';

-- ════════════════════════════════════════════════════════
-- TEST 4: payslip_line_items FK types match target
-- ════════════════════════════════════════════════════════

SELECT
  'TEST 4: PLI FK type alignment' AS test,
  pli.column_name AS pli_column,
  pli.udt_name AS pli_type,
  ps.udt_name AS payslips_id_type,
  CASE
    WHEN pli.udt_name = ps.udt_name THEN '✅ PASS — types match (' || pli.udt_name || ')'
    ELSE '❌ FAIL — ' || pli.udt_name || ' vs ' || ps.udt_name
  END AS result
FROM information_schema.columns pli
CROSS JOIN (
  SELECT udt_name FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'payslips' AND column_name = 'id'
) ps
WHERE pli.table_schema = 'public'
  AND pli.table_name = 'payslip_line_items'
  AND pli.column_name = 'payslip_id';

-- ════════════════════════════════════════════════════════
-- TEST 5: FK constraints actually exist
-- ════════════════════════════════════════════════════════

SELECT
  'TEST 5: FK Constraints' AS test,
  conname AS constraint_name,
  conrelid::regclass AS on_table,
  confrelid::regclass AS references_table,
  '✅ EXISTS' AS result
FROM pg_constraint
WHERE contype = 'f'
  AND conname IN ('eda_employee_fk', 'eda_template_fk', 'pli_payslip_fk', 'pli_template_fk')
ORDER BY conname;

-- Verify count
SELECT
  'TEST 5b: FK count check' AS test,
  CASE WHEN COUNT(*) = 4 THEN '✅ PASS — all 4 FKs present'
       ELSE '❌ FAIL — only ' || COUNT(*) || ' of 4 FKs found'
  END AS result
FROM pg_constraint
WHERE contype = 'f'
  AND conname IN ('eda_employee_fk', 'eda_template_fk', 'pli_payslip_fk', 'pli_template_fk');

-- ════════════════════════════════════════════════════════
-- TEST 6: CHECK constraints on deduction_templates
-- ════════════════════════════════════════════════════════

SELECT
  'TEST 6: CHECK constraints' AS test,
  conname,
  pg_get_constraintdef(oid) AS definition,
  '✅' AS result
FROM pg_constraint
WHERE conrelid = 'public.deduction_templates'::regclass
  AND contype = 'c'
ORDER BY conname;

-- ════════════════════════════════════════════════════════
-- TEST 7: employees.deduction_exempt column exists
-- ════════════════════════════════════════════════════════

SELECT
  'TEST 7: deduction_exempt column' AS test,
  column_name,
  data_type,
  column_default,
  CASE
    WHEN column_name = 'deduction_exempt' AND data_type = 'boolean' THEN '✅ PASS'
    WHEN column_name = 'deduction_exempt_reason' AND data_type = 'text' THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'employees'
  AND column_name IN ('deduction_exempt', 'deduction_exempt_reason')
ORDER BY column_name;

-- ════════════════════════════════════════════════════════
-- TEST 8: payslips new columns exist
-- ════════════════════════════════════════════════════════

SELECT
  'TEST 8: payslips new columns' AS test,
  column_name,
  data_type,
  column_default,
  CASE
    WHEN column_name = 'custom_deductions' AND data_type = 'numeric' THEN '✅ PASS'
    WHEN column_name = 'line_items_json' AND data_type = 'jsonb' THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payslips'
  AND column_name IN ('custom_deductions', 'line_items_json')
ORDER BY column_name;

-- ════════════════════════════════════════════════════════
-- TEST 9: Payslip status CHECK — new 3-state flow
-- ════════════════════════════════════════════════════════

SELECT
  'TEST 9: Payslip status constraint' AS test,
  conname,
  pg_get_constraintdef(oid) AS definition,
  CASE
    WHEN pg_get_constraintdef(oid) LIKE '%draft%'
     AND pg_get_constraintdef(oid) LIKE '%published%'
     AND pg_get_constraintdef(oid) LIKE '%signed%'
     AND pg_get_constraintdef(oid) NOT LIKE '%issued%'
     AND pg_get_constraintdef(oid) NOT LIKE '%paid%'
    THEN '✅ PASS — 3-state flow (draft/published/signed)'
    ELSE '❌ FAIL — old status values still present'
  END AS result
FROM pg_constraint
WHERE conrelid = 'public.payslips'::regclass
  AND conname LIKE '%status%';

-- ════════════════════════════════════════════════════════
-- TEST 10: Payroll run status CHECK — new 3-state flow
-- ════════════════════════════════════════════════════════

SELECT
  'TEST 10: Run status constraint' AS test,
  conname,
  pg_get_constraintdef(oid) AS definition,
  CASE
    WHEN pg_get_constraintdef(oid) LIKE '%draft%'
     AND pg_get_constraintdef(oid) LIKE '%locked%'
     AND pg_get_constraintdef(oid) LIKE '%completed%'
     AND pg_get_constraintdef(oid) NOT LIKE '%validated%'
     AND pg_get_constraintdef(oid) NOT LIKE '%published%'
     AND pg_get_constraintdef(oid) NOT LIKE '%paid%'
    THEN '✅ PASS — 3-state flow (draft/locked/completed)'
    ELSE '❌ FAIL — old status values still present'
  END AS result
FROM pg_constraint
WHERE conrelid = 'public.payroll_runs'::regclass
  AND conname LIKE '%status%';

-- ════════════════════════════════════════════════════════
-- TEST 11: RLS enabled on new tables
-- ════════════════════════════════════════════════════════

SELECT
  'TEST 11: RLS enabled' AS test,
  relname AS table_name,
  CASE WHEN relrowsecurity THEN '✅ RLS ON' ELSE '❌ RLS OFF' END AS result
FROM pg_class
WHERE relname IN ('deduction_templates', 'employee_deduction_assignments', 'payslip_line_items')
  AND relnamespace = 'public'::regnamespace
ORDER BY relname;

-- ════════════════════════════════════════════════════════
-- TEST 12: RLS policies exist
-- ════════════════════════════════════════════════════════

SELECT
  'TEST 12: RLS policies' AS test,
  schemaname,
  tablename,
  policyname,
  cmd AS applies_to,
  '✅ EXISTS' AS result
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('deduction_templates', 'employee_deduction_assignments', 'payslip_line_items')
ORDER BY tablename, policyname;

-- Expected policies:
-- deduction_templates: read (SELECT), write (ALL)
-- employee_deduction_assignments: admin (ALL), employee_read (SELECT)
-- payslip_line_items: admin (ALL), employee_read (SELECT)

SELECT
  'TEST 12b: Policy count' AS test,
  CASE WHEN COUNT(*) = 6 THEN '✅ PASS — all 6 policies'
       ELSE '⚠️  ' || COUNT(*) || ' of 6 policies found'
  END AS result
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('deduction_templates', 'employee_deduction_assignments', 'payslip_line_items');

-- ════════════════════════════════════════════════════════
-- TEST 13: Indexes exist
-- ════════════════════════════════════════════════════════

SELECT
  'TEST 13: Indexes' AS test,
  indexname,
  tablename,
  '✅ EXISTS' AS result
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_deduction_templates_active',
    'idx_eda_employee',
    'idx_eda_template',
    'idx_pli_payslip',
    'idx_employees_deduction_exempt'
  )
ORDER BY indexname;

SELECT
  'TEST 13b: Index count' AS test,
  CASE WHEN COUNT(*) = 5 THEN '✅ PASS — all 5 indexes'
       ELSE '❌ FAIL — only ' || COUNT(*) || ' of 5'
  END AS result
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_deduction_templates_active',
    'idx_eda_employee',
    'idx_eda_template',
    'idx_pli_payslip',
    'idx_employees_deduction_exempt'
  );

-- ════════════════════════════════════════════════════════
-- TEST 14: payroll_runs.completed_at exists
-- ════════════════════════════════════════════════════════

SELECT
  'TEST 14: completed_at column' AS test,
  CASE WHEN COUNT(*) = 1 THEN '✅ PASS' ELSE '❌ FAIL' END AS result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payroll_runs'
  AND column_name = 'completed_at';

-- ════════════════════════════════════════════════════════
-- TEST 15: No stale payslip statuses
-- ════════════════════════════════════════════════════════

SELECT
  'TEST 15: Stale payslip statuses' AS test,
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS — no old statuses'
       ELSE '❌ FAIL — ' || COUNT(*) || ' payslips still have old status values'
  END AS result
FROM public.payslips
WHERE status NOT IN ('draft', 'published', 'signed');

-- ════════════════════════════════════════════════════════
-- TEST 16: No stale payroll_run statuses
-- ════════════════════════════════════════════════════════

SELECT
  'TEST 16: Stale run statuses' AS test,
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS — no old statuses'
       ELSE '❌ FAIL — ' || COUNT(*) || ' runs still have old status values'
  END AS result
FROM public.payroll_runs
WHERE status NOT IN ('draft', 'locked', 'completed');

-- ════════════════════════════════════════════════════════
-- TEST 17: Smoke test — INSERT + SELECT + DELETE on new tables
-- ════════════════════════════════════════════════════════

DO $$
DECLARE
  v_dt_id text;
BEGIN
  -- Insert a test template
  INSERT INTO public.deduction_templates (name, type, value)
  VALUES ('__test_045__', 'deduction', 100)
  RETURNING id INTO v_dt_id;

  -- Verify it exists
  IF NOT EXISTS (SELECT 1 FROM public.deduction_templates WHERE id = v_dt_id) THEN
    RAISE EXCEPTION 'TEST 17 FAIL: template not found after insert';
  END IF;

  -- Clean up
  DELETE FROM public.deduction_templates WHERE id = v_dt_id;

  RAISE NOTICE 'TEST 17: ✅ PASS — CRUD on deduction_templates works';
END $$;

-- ════════════════════════════════════════════════════════
-- SUMMARY
-- ════════════════════════════════════════════════════════

SELECT '========================================' AS line
UNION ALL SELECT 'Migration 045 Post-Flight Validation Complete'
UNION ALL SELECT 'If ALL tests show ✅, the migration is verified.'
UNION ALL SELECT 'Any ❌ requires investigation before using the app.'
UNION ALL SELECT '========================================';
