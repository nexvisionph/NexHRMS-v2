-- Add individual payment hold status for Option B payroll flow.
-- Unsigned employees can be held without blocking signed employees from payment.

ALTER TABLE public.payslips
DROP CONSTRAINT IF EXISTS payslips_status_check;

UPDATE public.payslips
SET status = 'published'
WHERE status NOT IN ('draft', 'published', 'signed', 'paid', 'payment_hold');

ALTER TABLE public.payslips
ADD CONSTRAINT payslips_status_check
CHECK (status IN ('draft', 'published', 'signed', 'paid', 'payment_hold'));
