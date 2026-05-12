-- Migration 046: Enable Supabase Realtime for text_channels
--
-- The text_channels table was missing from realtime publication.
-- This enables real-time channel creation, updates, and deletions
-- to sync across all connected clients.

DO $$
BEGIN
  -- Set REPLICA IDENTITY FULL for complete UPDATE payloads
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'text_channels' AND c.relkind = 'r'
  ) THEN
    ALTER TABLE public.text_channels REPLICA IDENTITY FULL;
  END IF;

  -- Add to supabase_realtime publication
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'text_channels' AND c.relkind = 'r'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.text_channels;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END;
$$;
