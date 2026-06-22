-- Ensure employee-submitted NTE explanations update the parent case status
-- and are broadcast to other open sessions, especially admin/HR dashboards.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['disciplinary_cases', 'nte_records', 'nod_records'] LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = t
        AND c.relkind = 'r'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_disc_case_from_nte ( ) 
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$ 
BEGIN 
  IF NEW.status = 'explanation_submitted' THEN 
    UPDATE public.disciplinary_cases 
    SET status = 'explanation_submitted' , 
        updated_at = now ( ) 
    WHERE id = NEW.case_id 
      AND status IN ( 'nte_issued' , 'nte_acknowledged' , 'open' ) ; 
  ELSIF NEW.status = 'acknowledged' THEN 
    UPDATE public.disciplinary_cases 
    SET status = 'nte_acknowledged' , 
        updated_at = now ( ) 
    WHERE id = NEW.case_id 
      AND status IN ( 'nte_issued' , 'open' ) ; 
  END IF ; 
  RETURN NEW ; 
END ; 
$$ ; 

DROP TRIGGER IF EXISTS trg_sync_disc_case_from_nte ON public.nte_records ; 
CREATE TRIGGER trg_sync_disc_case_from_nte 
AFTER INSERT OR UPDATE OF status, employee_explanation, explanation_submitted_at, acknowledged_at 
ON public.nte_records 
FOR EACH ROW 
EXECUTE FUNCTION public.sync_disc_case_from_nte ( ) ;
