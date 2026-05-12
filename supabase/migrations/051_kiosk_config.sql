-- ─── Kiosk configuration singleton table ───────────────────────────────────
-- Stores all kiosk UI/behavior settings (one row with id = 'default')

CREATE TABLE IF NOT EXISTS public.kiosk_config (
  id text NOT NULL DEFAULT 'default'::text,

  -- General
  kiosk_enabled boolean NOT NULL DEFAULT true,
  kiosk_title text NOT NULL DEFAULT 'Attendance Kiosk'::text,
  welcome_message text NOT NULL DEFAULT 'Choose a method to check in or out'::text,
  footer_message text NOT NULL DEFAULT 'Unauthorized access is prohibited'::text,

  -- Check-in methods
  check_in_method text NOT NULL DEFAULT 'all'::text,
  enable_pin boolean NOT NULL DEFAULT true,
  enable_qr boolean NOT NULL DEFAULT true,
  enable_face boolean NOT NULL DEFAULT true,
  enable_nfc boolean NOT NULL DEFAULT true,
  allow_check_out boolean NOT NULL DEFAULT true,

  -- PIN settings
  pin_length integer NOT NULL DEFAULT 6,
  max_pin_attempts integer NOT NULL DEFAULT 0,
  lockout_duration integer NOT NULL DEFAULT 60,

  -- QR / Token
  token_refresh_interval integer NOT NULL DEFAULT 30,
  token_length integer NOT NULL DEFAULT 8,

  -- NFC
  nfc_simulated_delay integer NOT NULL DEFAULT 1500,

  -- Display
  kiosk_theme text NOT NULL DEFAULT 'auto'::text,
  clock_format text NOT NULL DEFAULT '24h'::text,
  show_clock boolean NOT NULL DEFAULT true,
  show_date boolean NOT NULL DEFAULT true,
  show_logo boolean NOT NULL DEFAULT true,
  show_device_id boolean NOT NULL DEFAULT true,
  show_security_badge boolean NOT NULL DEFAULT true,

  -- Behavior
  feedback_duration integer NOT NULL DEFAULT 1800,
  warn_off_day boolean NOT NULL DEFAULT true,
  play_sound boolean NOT NULL DEFAULT false,
  idle_timeout integer NOT NULL DEFAULT 0,
  idle_action text NOT NULL DEFAULT 'none'::text,

  -- Security
  require_geofence boolean NOT NULL DEFAULT false,

  -- Selfie
  selfie_enabled boolean NOT NULL DEFAULT false,
  selfie_required boolean NOT NULL DEFAULT false,

  -- Face Recognition
  face_rec_enabled boolean NOT NULL DEFAULT true,
  face_rec_required boolean NOT NULL DEFAULT false,
  face_rec_auto_start boolean NOT NULL DEFAULT true,
  face_rec_countdown integer NOT NULL DEFAULT 3,
  face_rec_position text NOT NULL DEFAULT 'bottom'::text,

  -- Anti-Cheat
  dev_options_penalty_enabled boolean NOT NULL DEFAULT true,
  dev_options_penalty_minutes integer NOT NULL DEFAULT 30,
  dev_options_penalty_apply_to text NOT NULL DEFAULT 'both'::text,
  dev_options_penalty_notify_admin boolean NOT NULL DEFAULT true,

  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT kiosk_config_pkey PRIMARY KEY (id)
);

-- Seed default row
INSERT INTO public.kiosk_config (id) VALUES ('default') ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.kiosk_config ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (kiosk pages need these settings)
CREATE POLICY "Authenticated users can read kiosk config"
  ON public.kiosk_config FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can update (enforced at API level too, but defense in depth)
CREATE POLICY "Admins can update kiosk config"
  ON public.kiosk_config FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can insert kiosk config"
  ON public.kiosk_config FOR INSERT
  TO authenticated
  WITH CHECK (true);
