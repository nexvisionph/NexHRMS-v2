-- Migration 023: Face Embedding Support
-- Adds real 128-dimensional face embeddings for biometric matching
-- Replaces text-based face_template_hash with proper numeric embeddings

-- ─────────────────────────────────────────────────────────────────────────────
-- Add embedding column to face_enrollments
-- Stores the 128-dimensional face descriptor from face-api.js
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'face_enrollments'
    AND column_name = 'embedding'
  ) THEN
    ALTER TABLE public.face_enrollments
    ADD COLUMN embedding JSONB;

    COMMENT ON COLUMN public.face_enrollments.embedding
    IS 'Array of 128 float64 values representing the face descriptor from face-api.js';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Euclidean distance function for face matching
-- Compares a query embedding against all enrolled embeddings
-- Returns the closest match if within threshold
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.match_face_embedding(
  query_embedding JSONB,
  match_threshold FLOAT8 DEFAULT 0.75
)
RETURNS TABLE(
  employee_id TEXT,
  distance FLOAT8,
  enrollment_id TEXT
) AS $$
DECLARE
  q_arr FLOAT8[];
BEGIN
  -- Convert JSONB array to native float8 array
  SELECT array_agg(val::FLOAT8)
  INTO q_arr
  FROM jsonb_array_elements_text(query_embedding) AS val;

  -- Use a CTE to compute distance per row first, then filter with WHERE
  -- (HAVING without GROUP BY cannot filter individual rows in PostgreSQL)
  RETURN QUERY
  WITH computed AS (
    SELECT
      fe.employee_id,
      fe.id AS enrollment_id,
      sqrt(
        (SELECT sum(power(q.val - e.val, 2))
         FROM unnest(q_arr) WITH ORDINALITY AS q(val, idx),
              unnest(
                (SELECT array_agg(v::FLOAT8)
                 FROM jsonb_array_elements_text(fe.embedding) AS v)
              ) WITH ORDINALITY AS e(val, idx)
         WHERE q.idx = e.idx)
      ) AS dist
    FROM face_enrollments fe
    WHERE fe.is_active = true
      AND fe.embedding IS NOT NULL
      AND jsonb_array_length(fe.embedding) = 128
  )
  SELECT c.employee_id, c.dist AS distance, c.enrollment_id
  FROM computed c
  WHERE c.dist < match_threshold
  ORDER BY c.dist
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verify face embedding against a specific employee
-- Returns the distance between query and employee's stored embedding
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.verify_face_embedding(
  p_employee_id TEXT,
  query_embedding JSONB,
  match_threshold FLOAT8 DEFAULT 0.75
)
RETURNS TABLE(
  matched BOOLEAN,
  distance FLOAT8
) AS $$
DECLARE
  stored_embedding JSONB;
  q_arr FLOAT8[];
  s_arr FLOAT8[];
  dist FLOAT8;
BEGIN
  -- Get stored embedding
  SELECT fe.embedding INTO stored_embedding
  FROM face_enrollments fe
  WHERE fe.employee_id = p_employee_id
    AND fe.is_active = true
    AND fe.embedding IS NOT NULL;

  IF stored_embedding IS NULL THEN
    RETURN QUERY SELECT false, 999.0::FLOAT8;
    RETURN;
  END IF;

  -- Convert to arrays
  SELECT array_agg(val::FLOAT8) INTO q_arr
  FROM jsonb_array_elements_text(query_embedding) AS val;

  SELECT array_agg(val::FLOAT8) INTO s_arr
  FROM jsonb_array_elements_text(stored_embedding) AS val;

  -- Compute euclidean distance
  SELECT sqrt(sum(power(q.val - s.val, 2))) INTO dist
  FROM unnest(q_arr) WITH ORDINALITY AS q(val, idx),
       unnest(s_arr) WITH ORDINALITY AS s(val, idx)
  WHERE q.idx = s.idx;

  -- Update verification stats
  IF dist < match_threshold THEN
    UPDATE face_enrollments
    SET last_verified = NOW(),
        verification_count = verification_count + 1
    WHERE employee_id = p_employee_id AND is_active = true;
  END IF;

  RETURN QUERY SELECT (dist < match_threshold), dist;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
