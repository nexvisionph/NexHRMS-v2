"use server";

/**
 * Face Recognition Service — Tiered Verification
 *
 * Architecture:
 * - Tier 1 (Pre-filter): Embedding euclidean distance rejects obvious non-matches (> 0.75)
 * - Tier 2 (Fast path): Strong embedding matches (< 0.40) auto-verify — no AI needed
 * - Tier 3 (AI enhancement): Borderline matches (0.40–0.55) use Qwen VL vision AI if configured
 * - Tier 4 (Fallback): If AI unavailable, embedding-only with strict threshold (0.55)
 *
 * This tiered approach is optimized for Vercel serverless deployment:
 * - 90%+ of verifications complete instantly via embedding-only (Tier 1+2)
 * - AI is only called for borderline cases, saving latency and API costs
 * - AI errors never block verification — graceful fallback to embedding-only
 *
 * During ENROLLMENT, we store BOTH:
 *   1. The 128-d embedding (for quick matching)
 *   2. A reference face image as base64 JPEG (for AI comparison when needed)
 */

import { createAdminSupabaseClient } from "./supabase-server";
import type { FaceEnrollment } from "@/types";
import { nanoid } from "nanoid";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Embedding pre-filter threshold (Layer 1).
 * Rejects obvious non-matches before any detailed comparison.
 * face-api.js L2-normalized: different-person distances are typically >0.55.
 * Tightened from 0.60 to reduce false positives with similar-looking faces.
 */
const EMBEDDING_PREFILTER_THRESHOLD = 0.50;

/**
 * High-confidence threshold — distances below this skip AI entirely.
 * face-api.js same-person, good conditions, L2-normalized: 0.10–0.25.
 * Only auto-verify truly definitive matches to prevent false positives.
 */
const EMBEDDING_HIGH_CONFIDENCE_THRESHOLD = 0.25;

/**
 * Embedding-only threshold (fallback when AI is unavailable).
 * face-api.js same-person distances across sessions (L2-normalized): 0.15–0.40.
 * Different-person distances: typically >0.45.
 * Calibrated to 0.42 to balance security with natural variation across sessions.
 */
const EMBEDDING_STRICT_THRESHOLD = 0.42;

/**
 * Extra-strict threshold used when there is only 1 enrolled face in the system.
 * With a single enrollment, any probe within the threshold matches — so we
 * require a stronger match to compensate for the lack of relative comparison.
 */
const SINGLE_ENROLLMENT_THRESHOLD = 0.40;

/**
 * Minimum margin between best and second-best match distances.
 * If the gap is too small, the match is ambiguous and should be rejected.
 */
const MIN_MATCH_MARGIN = 0.08;

/** Qwen VL AI confidence threshold for face match confirmation. */
const AI_MATCH_CONFIDENCE_THRESHOLD = 75;

/** L2-normalize a descriptor to unit length for consistent distance computation. */
function normalizeL2(vec: number[]): number[] {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Face Comparison (Layer 2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compare two face images using Qwen VL vision model.
 * Returns a confidence score (0-100) and whether they match.
 */
async function compareFacesWithAI(
  referenceImageBase64: string,
  probeImageBase64: string,
): Promise<{ match: boolean; confidence: number; reason: string; isError?: boolean }> {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    return { match: false, confidence: 0, reason: "AI service not configured", isError: true };
  }

  const baseUrl = process.env.DASHSCOPE_BASE_URL ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
  const model = process.env.QWEN_MODEL ||
    (process.env.NODE_ENV === "production" ? "qwen-vl-max" : "qwen-vl-plus");

  // Strip data URI prefix if present
  const refImg = referenceImageBase64.replace(/^data:image\/\w+;base64,/, "");
  const probeImg = probeImageBase64.replace(/^data:image\/\w+;base64,/, "");

  const systemPrompt = `You are a precise face verification system for employee attendance.

TASK: Compare the two face images and determine if they belong to the SAME person.

ANALYSIS CRITERIA (weight each equally):
1. Facial structure: jawline, cheekbones, face shape, forehead proportions
2. Eye features: eye shape, distance between eyes, brow ridge, eyelid shape
3. Nose features: nose bridge width, tip shape, nostril shape
4. Mouth features: lip shape, philtrum, chin dimple
5. Ear features: ear shape and position (if visible)

IMPORTANT RULES:
- Ignore differences in lighting, angle, expression, and image quality
- Focus ONLY on permanent facial bone structure and features
- Different people of the same ethnicity/gender CAN look similar — be discriminating
- A 70%+ confidence means you are fairly sure it is the same person
- Below 50% means likely different people

Respond with ONLY a JSON object (no markdown, no code fences):
{"same_person": true/false, "confidence": number_0_to_100, "reason": "brief explanation"}`;

  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: "Image 1 (enrolled reference):" },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${refImg}` } },
          { type: "text", text: "Image 2 (live probe — is this the same person?):" },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${probeImg}` } },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 200,
  };

  const controller = new AbortController();
  // 8s timeout — fits within Vercel serverless limits (10s free, 60s pro)
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[compareFacesWithAI] API error ${res.status}: ${errText}`);
      return { match: false, confidence: 0, reason: `AI API error: ${res.status}`, isError: true };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle potential markdown wrapping)
    const jsonStr = content.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    const confidence = Number(parsed.confidence) || 0;
    const samePerson = parsed.same_person === true && confidence >= AI_MATCH_CONFIDENCE_THRESHOLD;

    console.log(`[compareFacesWithAI] same_person=${parsed.same_person} confidence=${confidence} → match=${samePerson} reason="${parsed.reason}"`);

    return {
      match: samePerson,
      confidence,
      reason: parsed.reason || (samePerson ? "AI confirmed match" : "AI rejected match"),
    };
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[compareFacesWithAI] Request timed out");
      return { match: false, confidence: 0, reason: "AI comparison timed out", isError: true };
    }
    console.error("[compareFacesWithAI] Error:", error);
    return { match: false, confidence: 0, reason: "AI comparison failed", isError: true };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Enrollment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enroll a face embedding + reference image for an employee.
 */
export async function enrollFace(
  employeeId: string,
  embedding: number[],
  enrolledBy: string,
  referenceImage?: string,
): Promise<{ ok: boolean; error?: string; enrollment?: FaceEnrollment }> {
  try {
    if (!embedding || embedding.length !== 128) {
      return { ok: false, error: "Invalid face embedding (expected 128 dimensions)" };
    }

    const rawNorm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
    const normalizedEmbedding = normalizeL2(embedding);
    const normalizedNorm = Math.sqrt(normalizedEmbedding.reduce((s, v) => s + v * v, 0));
    console.log(`[enrollFace] employeeId=${employeeId} enrolledBy=${enrolledBy} rawNorm=${rawNorm.toFixed(4)} normalizedNorm=${normalizedNorm.toFixed(4)} hasRefImage=${!!referenceImage} refImageSize=${referenceImage ? Math.round(referenceImage.length / 1024) + "KB" : "none"}`);

    const supabase = await createAdminSupabaseClient();
    const now = new Date().toISOString();

    const baseData: Record<string, unknown> = {
      embedding: normalizedEmbedding,
      face_template_hash: `emb-${nanoid(16)}`,
      enrollment_date: now,
      is_active: true,
      enrolled_by: enrolledBy,
      updated_at: now,
    };

    if (referenceImage) {
      baseData.reference_image = referenceImage;
    }

    const { data: existing } = await supabase
      .from("face_enrollments")
      .select("*")
      .eq("employee_id", employeeId)
      .single();

    if (existing) {
      console.log(`[enrollFace] Updating existing enrollment for ${employeeId} (id=${existing.id})`);
      let { error } = await supabase
        .from("face_enrollments")
        .update(baseData)
        .eq("employee_id", employeeId);

      // If reference_image column doesn't exist yet, retry without it
      if (error?.message?.includes("reference_image")) {
        delete baseData.reference_image;
        const retry = await supabase
          .from("face_enrollments")
          .update(baseData)
          .eq("employee_id", employeeId);
        error = retry.error;
      }
      if (error) return { ok: false, error: error.message };

      return {
        ok: true,
        enrollment: mapEnrollment({ ...existing, ...baseData }),
      };
    }

    // Create new enrollment
    const enrollmentId = `FE-${nanoid(8)}`;
    console.log(`[enrollFace] Creating new enrollment for ${employeeId} (id=${enrollmentId})`);
    const insertData: Record<string, unknown> = { id: enrollmentId, employee_id: employeeId, ...baseData };

    let { error } = await supabase.from("face_enrollments").insert(insertData);
    if (error?.message?.includes("reference_image")) {
      delete insertData.reference_image;
      const retry = await supabase.from("face_enrollments").insert(insertData);
      error = retry.error;
    }
    if (error) return { ok: false, error: error.message };

    return {
      ok: true,
      enrollment: {
        id: enrollmentId,
        employeeId,
        faceTemplateHash: baseData.face_template_hash as string,
        embedding,
        enrollmentDate: now,
        isActive: true,
        enrolledBy,
        createdAt: now,
        updatedAt: now,
        verificationCount: 0,
      },
    };
  } catch (error) {
    console.error("[enrollFace] Error:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Verification (Dual-Layer)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verify a face against a specific employee's enrollment.
 *
 * Layer 1: Embedding euclidean distance (fast pre-filter)
 * Layer 2: Qwen VL AI image comparison (accurate confirmation)
 */
export async function verifyFace(
  employeeId: string,
  embedding: number[],
  probeImage?: string,
): Promise<{ ok: boolean; verified?: boolean; distance?: number; aiConfidence?: number; error?: string }> {
  try {
    if (!embedding || embedding.length !== 128) {
      return { ok: false, error: "Invalid face embedding" };
    }

    // Validate probe embedding quality
    const probeNorm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
    console.log(`[verifyFace] employeeId=${employeeId} probe norm=${probeNorm.toFixed(4)}`);
    if (probeNorm < 0.01) {
      console.error(`[verifyFace] REJECTED: probe embedding near-zero for ${employeeId}`);
      return { ok: true, verified: false, distance: 999 };
    }

    const supabase = await createAdminSupabaseClient();

    let data: Record<string, unknown> | null = null;
    let fetchError: { message: string } | null = null;

    const res1 = await supabase
      .from("face_enrollments")
      .select("embedding, verification_count, reference_image")
      .eq("employee_id", employeeId)
      .eq("is_active", true)
      .not("embedding", "is", null)
      .single();

    data = res1.data;
    fetchError = res1.error;

    // Fallback if reference_image column doesn't exist
    if (fetchError?.message?.includes("reference_image")) {
      const res2 = await supabase
        .from("face_enrollments")
        .select("embedding, verification_count")
        .eq("employee_id", employeeId)
        .eq("is_active", true)
        .not("embedding", "is", null)
        .single();
      data = res2.data;
      fetchError = res2.error;
    }

    if (fetchError || !data?.embedding) {
      console.log(`[verifyFace] No active enrollment for ${employeeId}`);
      return { ok: true, verified: false, distance: 999 };
    }

    // ── Layer 1: Embedding distance pre-filter ──
    const rawStored: number[] = typeof data.embedding === "string"
      ? JSON.parse(data.embedding as string)
      : data.embedding as number[];

    if (!Array.isArray(rawStored) || rawStored.length !== 128) {
      console.error(`[verifyFace] Invalid stored embedding for ${employeeId}`);
      return { ok: true, verified: false, distance: 999 };
    }

    const stored = normalizeL2(rawStored);
    const probe = normalizeL2(embedding);
    let sum = 0;
    for (let i = 0; i < 128; i++) sum += (probe[i] - stored[i]) ** 2;
    const distance = Math.sqrt(sum);

    const hasAI = !!process.env.QWEN_API_KEY;
    const hasReferenceImage = !!data.reference_image && !!probeImage;

    console.log(`[verifyFace] employeeId=${employeeId} distance=${distance.toFixed(4)} hasAI=${hasAI} hasRefImage=${hasReferenceImage} prefilter=${EMBEDDING_PREFILTER_THRESHOLD} highConf=${EMBEDDING_HIGH_CONFIDENCE_THRESHOLD} strict=${EMBEDDING_STRICT_THRESHOLD}`);

    // If distance is very large, reject immediately
    if (distance > EMBEDDING_PREFILTER_THRESHOLD) {
      console.log(`[verifyFace] ❌ REJECTED by pre-filter (distance ${distance.toFixed(4)} > ${EMBEDDING_PREFILTER_THRESHOLD})`);
      return { ok: true, verified: false, distance };
    }

    // ── Fast path: high-confidence embedding match → skip AI entirely ──
    if (distance < EMBEDDING_HIGH_CONFIDENCE_THRESHOLD) {
      console.log(`[verifyFace] ✅ VERIFIED (high-confidence fast path, distance=${distance.toFixed(4)} < ${EMBEDDING_HIGH_CONFIDENCE_THRESHOLD})`);
      await updateVerificationStats(supabase, employeeId, data.verification_count as number);
      return { ok: true, verified: true, distance };
    }

    // ── Uncertain zone: use AI if available for better accuracy ──
    if (hasAI && hasReferenceImage) {
      console.log(`[verifyFace] Borderline distance ${distance.toFixed(4)} — invoking AI comparison...`);
      const aiResult = await compareFacesWithAI(data.reference_image as string, probeImage!);
      console.log(`[verifyFace] AI result: match=${aiResult.match} confidence=${aiResult.confidence} isError=${!!aiResult.isError} reason="${aiResult.reason}"`);

      if (aiResult.isError) {
        console.log(`[verifyFace] AI unavailable, falling back to embedding-only`);
      } else if (!aiResult.match) {
        console.log(`[verifyFace] ❌ REJECTED by AI (confidence=${aiResult.confidence})`);
        return { ok: true, verified: false, distance, aiConfidence: aiResult.confidence };
      } else {
        console.log(`[verifyFace] ✅ VERIFIED by AI (distance=${distance.toFixed(4)}, AI confidence=${aiResult.confidence})`);
        await updateVerificationStats(supabase, employeeId, data.verification_count as number);
        return { ok: true, verified: true, distance, aiConfidence: aiResult.confidence };
      }
    }

    // ── Fallback: embedding-only with calibrated threshold ──
    const verified = distance < EMBEDDING_STRICT_THRESHOLD;
    console.log(`[verifyFace] Embedding-only fallback: distance=${distance.toFixed(4)} threshold=${EMBEDDING_STRICT_THRESHOLD} → ${verified ? "✅ VERIFIED" : "❌ REJECTED"}`);
    if (verified) {
      await updateVerificationStats(supabase, employeeId, data.verification_count as number);
    }
    return { ok: true, verified, distance };
  } catch (error) {
    console.error("[verifyFace] Error:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Verification failed" };
  }
}

async function updateVerificationStats(
  supabase: Awaited<ReturnType<typeof createAdminSupabaseClient>>,
  employeeId: string,
  currentCount: number,
) {
  await supabase
    .from("face_enrollments")
    .update({
      last_verified: new Date().toISOString(),
      verification_count: (currentCount || 0) + 1,
    })
    .eq("employee_id", employeeId)
    .eq("is_active", true);
}

/**
 * Match a face against ALL enrolled employees (kiosk identification).
 *
 * Layer 1: Find best embedding match with margin-based rejection
 * Layer 2: Confirm with AI if reference image is available
 *
 * Key safety features:
 * - Tighter thresholds for single-enrollment scenarios
 * - Margin check: best match must be meaningfully closer than 2nd best
 * - Comprehensive debug logging for diagnostics
 */
export async function matchFace(
  embedding: number[],
  probeImage?: string,
): Promise<{ ok: boolean; employeeId?: string; distance?: number; aiConfidence?: number; error?: string; debug?: Record<string, unknown> }> {
  try {
    if (!embedding || embedding.length !== 128) {
      return { ok: false, error: "Invalid face embedding" };
    }

    // Validate embedding values
    const probeNorm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
    console.log(`[matchFace] Probe embedding norm (pre-L2): ${probeNorm.toFixed(4)}, non-zero dims: ${embedding.filter(v => Math.abs(v) > 1e-8).length}/128`);

    if (probeNorm < 0.01) {
      console.error("[matchFace] REJECTED: probe embedding is near-zero (bad detection)");
      return { ok: false, error: "Face embedding quality too low" };
    }

    const supabase = await createAdminSupabaseClient();

    // Fetch embeddings only — exclude reference_image to avoid loading ~100KB per row
    const { data, error } = await supabase
      .from("face_enrollments")
      .select("employee_id, embedding")
      .eq("is_active", true)
      .not("embedding", "is", null);

    if (error) {
      console.error("[matchFace] Query error:", error);
      return { ok: false, error: error.message };
    }

    if (!data?.length) {
      console.log("[matchFace] No active face enrollments in database");
      return { ok: true };
    }

    const totalEnrollments = data.length;
    console.log(`[matchFace] Comparing against ${totalEnrollments} enrolled face(s)`);

    const probe = normalizeL2(embedding);

    // Compute distances to ALL enrolled faces for ranking + margin check
    const candidates: { employeeId: string; distance: number }[] = [];

    for (const row of data) {
      const rawStored: number[] = typeof row.embedding === "string"
        ? JSON.parse(row.embedding)
        : row.embedding;

      if (!Array.isArray(rawStored) || rawStored.length !== 128) {
        console.warn(`[matchFace] Skipping ${row.employee_id}: invalid embedding (length=${rawStored?.length})`);
        continue;
      }

      const stored = normalizeL2(rawStored);
      let sum = 0;
      for (let i = 0; i < 128; i++) sum += (probe[i] - stored[i]) ** 2;
      const distance = Math.sqrt(sum);

      candidates.push({
        employeeId: row.employee_id,
        distance,
      });
    }

    // Sort by distance (closest first)
    candidates.sort((a, b) => a.distance - b.distance);

    // Log ALL distances for debugging
    console.log(`[matchFace] Distance ranking:`);
    for (const c of candidates) {
      const status = c.distance < EMBEDDING_HIGH_CONFIDENCE_THRESHOLD ? "HIGH-CONF" :
        c.distance < EMBEDDING_STRICT_THRESHOLD ? "IN-RANGE" :
        c.distance < EMBEDDING_PREFILTER_THRESHOLD ? "BORDERLINE" : "REJECTED";
      console.log(`  → ${c.employeeId}: ${c.distance.toFixed(4)} [${status}]`);
    }

    const best = candidates[0];
    const secondBest = candidates.length > 1 ? candidates[1] : null;

    if (!best || best.distance >= EMBEDDING_PREFILTER_THRESHOLD) {
      console.log(`[matchFace] REJECTED: best distance ${best?.distance.toFixed(4) ?? "N/A"} >= prefilter ${EMBEDDING_PREFILTER_THRESHOLD}`);
      return { ok: true };
    }

    // ── Margin check: if multiple enrollments, best must be significantly closer than 2nd ──
    // Skip margin check for HIGH-CONFIDENCE matches (distance < 0.25) — these are definitive.
    // Margin ambiguity only matters in the uncertain zone where distances could be borderline.
    if (secondBest && secondBest.distance < EMBEDDING_PREFILTER_THRESHOLD && best.distance >= EMBEDDING_HIGH_CONFIDENCE_THRESHOLD) {
      const margin = secondBest.distance - best.distance;
      console.log(`[matchFace] Margin check: best=${best.distance.toFixed(4)} 2nd=${secondBest.distance.toFixed(4)} margin=${margin.toFixed(4)} required=${MIN_MATCH_MARGIN}`);
      if (margin < MIN_MATCH_MARGIN) {
        console.log(`[matchFace] REJECTED: insufficient margin between best (${best.employeeId}) and 2nd (${secondBest.employeeId}) — ambiguous match`);
        return { ok: true };
      }
    } else if (secondBest && best.distance < EMBEDDING_HIGH_CONFIDENCE_THRESHOLD) {
      console.log(`[matchFace] Margin check SKIPPED: best distance ${best.distance.toFixed(4)} is high-confidence (< ${EMBEDDING_HIGH_CONFIDENCE_THRESHOLD})`);
    }

    // ── Select effective threshold based on number of enrollments ──
    const effectiveStrictThreshold = totalEnrollments === 1 ? SINGLE_ENROLLMENT_THRESHOLD : EMBEDDING_STRICT_THRESHOLD;
    console.log(`[matchFace] Using threshold: ${effectiveStrictThreshold} (${totalEnrollments === 1 ? "single-enrollment mode" : "multi-enrollment mode"})`);

    console.log(`[matchFace] Best match: ${best.employeeId} distance=${best.distance.toFixed(4)}`);

    // ── Fast path: high-confidence match → skip AI entirely ──
    if (best.distance < EMBEDDING_HIGH_CONFIDENCE_THRESHOLD) {
      console.log(`[matchFace] ✅ MATCHED (high-confidence fast path, distance=${best.distance.toFixed(4)} < ${EMBEDDING_HIGH_CONFIDENCE_THRESHOLD})`);
      return { ok: true, employeeId: best.employeeId, distance: best.distance };
    }

    // ── Uncertain zone: use AI if available ──
    const hasAI = !!process.env.QWEN_API_KEY;
    if (hasAI && probeImage) {
      // Fetch reference_image ONLY for the best candidate (lazy load)
      const { data: refRow } = await supabase
        .from("face_enrollments")
        .select("reference_image")
        .eq("employee_id", best.employeeId)
        .eq("is_active", true)
        .single();
      const bestRefImage = refRow?.reference_image as string | undefined;

      if (bestRefImage) {
        console.log(`[matchFace] Borderline distance ${best.distance.toFixed(4)} — invoking AI comparison...`);
        const aiResult = await compareFacesWithAI(bestRefImage, probeImage);
        console.log(`[matchFace] AI result: match=${aiResult.match} confidence=${aiResult.confidence} isError=${!!aiResult.isError} reason="${aiResult.reason}"`);

        if (aiResult.isError) {
          console.log("[matchFace] AI unavailable, falling back to embedding-only");
        } else if (!aiResult.match) {
          console.log(`[matchFace] ❌ REJECTED by AI (confidence=${aiResult.confidence}) — embedding was false positive`);
          return { ok: true };
        } else {
          console.log(`[matchFace] ✅ MATCHED by AI (distance=${best.distance.toFixed(4)}, AI confidence=${aiResult.confidence})`);
          return {
            ok: true,
            employeeId: best.employeeId,
            distance: best.distance,
            aiConfidence: aiResult.confidence,
          };
        }
      }
    }

    // Fallback: embedding-only with strict threshold
    if (best.distance < effectiveStrictThreshold) {
      console.log(`[matchFace] ✅ MATCHED by embedding-only (distance=${best.distance.toFixed(4)} < strict=${effectiveStrictThreshold})`);
      return { ok: true, employeeId: best.employeeId, distance: best.distance };
    }

    console.log(`[matchFace] ❌ REJECTED: distance ${best.distance.toFixed(4)} >= strict threshold ${effectiveStrictThreshold} (no AI available)`);
    return { ok: true };
  } catch (error) {
    console.error("[matchFace] Error:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Match failed" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status & Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get face enrollment status for an employee.
 */
export async function getFaceEnrollmentStatus(
  employeeId: string,
): Promise<{ enrolled: boolean; hasReferenceImage?: boolean; enrollment?: FaceEnrollment }> {
  try {
    const supabase = await createAdminSupabaseClient();

    let { data: enrollment, error } = await supabase
      .from("face_enrollments")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("is_active", true)
      .single();

    if (error?.message?.includes("reference_image")) {
      const fallback = await supabase
        .from("face_enrollments")
        .select("id, employee_id, face_template_hash, embedding, enrollment_date, last_verified, verification_count, is_active, enrolled_by, created_at, updated_at")
        .eq("employee_id", employeeId)
        .eq("is_active", true)
        .single();
      enrollment = fallback.data;
    }

    if (!enrollment) return { enrolled: false };

    const hasRef = !!(enrollment as Record<string, unknown>).reference_image;
    return { enrolled: true, hasReferenceImage: hasRef, enrollment: mapEnrollment(enrollment) };
  } catch (error) {
    console.error("[getFaceEnrollmentStatus] Error:", error);
    return { enrolled: false };
  }
}

/**
 * Delete face enrollment (for privacy or re-enrollment).
 */
export async function deleteFaceEnrollment(
  employeeId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createAdminSupabaseClient();

    const updateData: Record<string, unknown> = {
      is_active: false,
      embedding: null,
      reference_image: null,
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase
      .from("face_enrollments")
      .update(updateData)
      .eq("employee_id", employeeId);

    if (error?.message?.includes("reference_image")) {
      delete updateData.reference_image;
      const retry = await supabase
        .from("face_enrollments")
        .update(updateData)
        .eq("employee_id", employeeId);
      error = retry.error;
    }

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    console.error("[deleteFaceEnrollment] Error:", error);
    return { ok: false, error: "Failed to delete enrollment" };
  }
}

/**
 * Get all face enrollments (admin dashboard). Never returns reference images.
 */
export async function getAllFaceEnrollments(): Promise<FaceEnrollment[]> {
  try {
    const supabase = await createAdminSupabaseClient();

    const { data } = await supabase
      .from("face_enrollments")
      .select("id, employee_id, face_template_hash, enrollment_date, last_verified, verification_count, is_active, enrolled_by, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (!data) return [];
    return data.map(mapEnrollment);
  } catch (error) {
    console.error("[getAllFaceEnrollments] Error:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mapEnrollment(row: Record<string, unknown>): FaceEnrollment {
  return {
    id: row.id as string,
    employeeId: (row.employee_id ?? row.employeeId) as string,
    faceTemplateHash: (row.face_template_hash ?? row.faceTemplateHash ?? "") as string,
    embedding: row.embedding as number[] | undefined,
    enrollmentDate: (row.enrollment_date ?? row.enrollmentDate) as string,
    lastVerified: (row.last_verified ?? row.lastVerified) as string | undefined,
    verificationCount: ((row.verification_count ?? row.verificationCount) as number) || 0,
    isActive: ((row.is_active ?? row.isActive) as boolean) || false,
    enrolledBy: (row.enrolled_by ?? row.enrolledBy) as string,
    createdAt: (row.created_at ?? row.createdAt) as string,
    updatedAt: (row.updated_at ?? row.updatedAt) as string,
  };
}
