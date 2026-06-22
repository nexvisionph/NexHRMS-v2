-- Migration 066: Disciplinary Case Status Sync Triggers
-- Automatically syncs case status and results when employees acknowledge or explain NTE/NOD records.
-- SECURITY DEFINER allows triggering user (employee role) to update the parent case table.

BEGIN;

-- 1. NTE trigger function and trigger
CREATE OR REPLACE FUNCTION public.sync_disc_case_from_nte()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'explanation_submitted' THEN
    UPDATE public.disciplinary_cases
    SET status = 'explanation_submitted',
        updated_at = now()
    WHERE id = NEW.case_id
      AND status IN ('nte_issued', 'nte_acknowledged', 'open');
  ELSIF NEW.status = 'acknowledged' THEN
    UPDATE public.disciplinary_cases
    SET status = 'nte_acknowledged',
        updated_at = now()
    WHERE id = NEW.case_id
      AND status IN ('nte_issued', 'open');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_disc_case_from_nte ON public.nte_records;
CREATE TRIGGER trg_sync_disc_case_from_nte
AFTER INSERT OR UPDATE OF status, employee_explanation, explanation_submitted_at, acknowledged_at
ON public.nte_records
FOR EACH ROW
EXECUTE FUNCTION public.sync_disc_case_from_nte();


-- 2. NOD trigger function and trigger
CREATE OR REPLACE FUNCTION public.sync_disc_case_from_nod()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_result text;
BEGIN
  IF NEW.status = 'acknowledged' THEN
    -- Map nod.decision to CaseResult
    IF NEW.decision = 'verbal_warning' THEN c_result := 'VERBAL_WARNING';
    ELSIF NEW.decision = 'written_warning' THEN c_result := 'WRITTEN_WARNING';
    ELSIF NEW.decision = 'final_warning' THEN c_result := 'FINAL_WARNING';
    ELSIF NEW.decision = 'termination' THEN c_result := 'TERMINATION';
    ELSIF NEW.decision = 'suspension' THEN c_result := 'SUSPENSION';
    ELSIF NEW.decision = 'no_violation' THEN c_result := 'DISMISSED';
    ELSE c_result := upper(NEW.decision);
    END IF;

    UPDATE public.disciplinary_cases
    SET status = 'nod_acknowledged',
        result = coalesce(c_result, result),
        updated_at = now()
    WHERE id = NEW.case_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_disc_case_from_nod ON public.nod_records;
CREATE TRIGGER trg_sync_disc_case_from_nod
AFTER INSERT OR UPDATE OF status, decision, acknowledged_at
ON public.nod_records
FOR EACH ROW
EXECUTE FUNCTION public.sync_disc_case_from_nod();

COMMIT;
