-- Migration: Add reference_image column to face_enrollments
-- Stores a base64 JPEG of the enrollment face crop for AI-powered face comparison.
-- This enables server-side Qwen VL face matching (much more accurate than embedding-only).

ALTER TABLE public.face_enrollments
ADD COLUMN IF NOT EXISTS reference_image TEXT;

COMMENT ON COLUMN public.face_enrollments.reference_image IS
  'Base64 JPEG of the best enrollment face crop for AI face comparison';
