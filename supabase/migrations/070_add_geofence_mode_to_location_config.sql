-- Add geofence_mode to location_config table
ALTER TABLE public.location_config
    ADD COLUMN IF NOT EXISTS geofence_mode text DEFAULT 'flexible'
    CHECK (geofence_mode IN ('strict', 'flexible'));
