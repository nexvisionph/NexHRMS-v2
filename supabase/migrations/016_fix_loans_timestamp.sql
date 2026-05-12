-- ============================================================
-- 016_fix_loans_timestamp.sql
-- Fix loans.created_at: date → timestamptz (align with all other tables)
-- ============================================================

DO $$
BEGIN
    -- Only ALTER if the column type is 'date' (not already timestamptz)
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'loans'
          AND column_name  = 'created_at'
          AND data_type    = 'date'
    ) THEN
        ALTER TABLE public.loans
            ALTER COLUMN created_at TYPE timestamptz USING created_at::timestamptz,
            ALTER COLUMN created_at SET DEFAULT now();
    END IF;
END $$;
