-- Add reconciliation_priority to location_config table
ALTER TABLE public.location_config
    ADD COLUMN IF NOT EXISTS reconciliation_priority text[] DEFAULT ARRAY['biometric', 'mobile_gps', 'web', 'manual'];
