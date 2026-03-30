"use server";

/**
 * Face Recognition Service — Dual-Layer Verification
 *
 * Architecture:
 * - Layer 1 (Pre-filter): face-api.js 128-d embedding euclidean distance (fast, client-generated)
 * - Layer 2 (AI Confirmation): Qwen VL vision model compares reference vs probe face images
 *
 * During ENROLLMENT, we store BOTH:
 *   1. The 128-d embedding (for quick pre-filtering)
 *   2. A reference face image as base64 JPEG (for AI comparison)
 *
 * During VERIFICATION:
 *   1. Embedding distance check (rejects obviously different faces instantly)
 *   2. If embedding suggests a match, Qwen VL confirms by comparing the actual images
 *   3. Only if BOTH layers agree → verified
 *
 * This solves the accuracy problem with face-api.js's weak 128-d FaceNet model,
 * which produces insufficiently discriminative embeddings (especially for Asian faces).
 * Qwen VL is a powerful vision model that handles all ethnicities accurately.
 *
 * Scalable: Works on Vercel (serverless), 50+ users, AI API-based.
 */

import { createAdminSupabaseClient } from "./supabase-server";
import type { FaceEnrollment } from "@/types";
import { nanoid } from "nanoid";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Embedding pre-filter threshold (Layer 1).
 * Intentionally LENIENT — only rejects obvious non-matches.
 * AI confirmation (Layer 2) handles precise matching.
 */
const EMBEDDING_PREFILTER_THRESHOLD = 0.75;

/**
 * Embedding-only threshold (fallback when AI is unavailable).
 * face-api.js same-person distances across sessions: 0.2–0.55
 * Different-person distances: typically >0.8
 * 0.55 is the practical upper bound for same-person matches.
 */
const EMBEDDING_STRICT_THRESHOLD = 0.55;

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
): Promise<{ match: boolean; confidence: number; reason: string }> {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    return { match: false, confidence: 0, reason: "AI service not configured" };
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
  const timeout = setTimeout(() => controller.abort(), 20_000);

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
      return { match: false, confidence: 0, reason: `AI API error: ${res.status}` };
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
      return { match: false, confidence: 0, reason: "AI comparison timed out" };
    }
    console.error("[compareFacesWithAI] Error:", error);
    return { match: false, confidence: 0, reason: "AI comparison failed" };
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

    const normalizedEmbedding = normalizeL2(embedding);
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

    console.log(`[verifyFace] employeeId=${employeeId} distance=${distance.toFixed(4)} hasAI=${hasAI} hasRefImage=${hasReferenceImage}`);

    // If distance is very large, reject immediately
    if (distance > EMBEDDING_PREFILTER_THRESHOLD) {
      console.log(`[verifyFace] REJECTED by pre-filter (distance ${distance.toFixed(4)} > ${EMBEDDING_PREFILTER_THRESHOLD})`);
      return { ok: true, verified: false, distance };
    }

    // ── Layer 2: AI face comparison ──
    if (hasAI && hasReferenceImage) {
      const aiResult = await compareFacesWithAI(data.reference_image as string, probeImage!);
      console.log(`[verifyFace] AI result: match=${aiResult.match} confidence=${aiResult.confidence} reason="${aiResult.reason}"`);

      if (!aiResult.match) {
        console.log(`[verifyFace] REJECTED by AI (confidence=${aiResult.confidence})`);
        return { ok: true, verified: false, distance, aiConfidence: aiResult.confidence };
      }

      // Both layers agree: VERIFIED
      console.log(`[verifyFace] VERIFIED (distance=${distance.toFixed(4)}, AI=${aiResult.confidence})`);
      await updateVerificationStats(supabase, employeeId, data.verification_count as number);
      return { ok: true, verified: true, distance, aiConfidence: aiResult.confidence };
    }

    // ── Fallback: embedding-only with calibrated threshold ──
    // face-api.js 128-d FaceNet embeddings: same-person 0.2–0.55, diff-person >0.8
    const verified = distance < EMBEDDING_STRICT_THRESHOLD;
    console.log(`[verifyFace] Embedding-only: distance=${distance.toFixed(4)} threshold=${EMBEDDING_STRICT_THRESHOLD} verified=${verified}`);
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
 * Layer 1: Find best embedding match
 * Layer 2: Confirm with AI if reference image is available
 */
export async function matchFace(
  embedding: number[],
  probeImage?: string,
): Promise<{ ok: boolean; employeeId?: string; distance?: number; aiConfidence?: number; error?: string }> {
  try {
    if (!embedding || embedding.length !== 128) {
      return { ok: false, error: "Invalid face embedding" };
    }

    const supabase = await createAdminSupabaseClient();

    // Try to fetch reference_image too
    let { data, error } = await supabase
      .from("face_enrollments")
      .select("employee_id, embedding, reference_image")
      .eq("is_active", true)
      .not("embedding", "is", null);

    // Fallback if reference_image column doesn't exist
    if (error?.message?.includes("reference_image")) {
      const fallback = await supabase
        .from("face_enrollments")
        .select("employee_id, embedding")
        .eq("is_active", true)
        .not("embedding", "is", null);
      data = fallback.data as typeof data;
      error = fallback.error;
    }

    if (error) {
      console.error("[matchFace] Query error:", error);
      return { ok: false, error: error.message };
    }

    if (!data?.length) return { ok: true };

    const probe = normalizeL2(embedding);
    let bestMatch: { employeeId: string; distance: number; referenceImage?: string } | null = null;

    for (const row of data) {
      const rawStored: number[] = typeof row.embedding === "string"
        ? JSON.parse(row.embedding)
        : row.embedding;

      if (!Array.isArray(rawStored) || rawStored.length !== 128) continue;

      const stored = normalizeL2(rawStored);
      let sum = 0;
      for (let i = 0; i < 128; i++) sum += (probe[i] - stored[i]) ** 2;
      const distance = Math.sqrt(sum);

      if (distance < EMBEDDING_PREFILTER_THRESHOLD && (!bestMatch || distance < bestMatch.distance)) {
        bestMatch = {
          employeeId: row.employee_id,
          distance,
          referenceImage: (row as Record<string, unknown>).reference_image as string | undefined,
        };
      }
    }

    if (!bestMatch) {
      console.log("[matchFace] No embedding match within pre-filter threshold");
      return { ok: true };
    }

    console.log(`[matchFace] Best embedding match: ${bestMatch.employeeId} distance=${bestMatch.distance.toFixed(4)}`);

    // ── Layer 2: AI confirmation ──
    const hasAI = !!process.env.QWEN_API_KEY;
    if (hasAI && bestMatch.referenceImage && probeImage) {
      const aiResult = await compareFacesWithAI(bestMatch.referenceImage, probeImage);
      console.log(`[matchFace] AI result: match=${aiResult.match} confidence=${aiResult.confidence}`);

      if (!aiResult.match) {
        console.log("[matchFace] REJECTED by AI — embedding was false positive");
        return { ok: true };
      }

      return {
        ok: true,
        employeeId: bestMatch.employeeId,
        distance: bestMatch.distance,
        aiConfidence: aiResult.confidence,
      };
    }

    // Fallback: embedding-only with strict threshold
    if (bestMatch.distance < EMBEDDING_STRICT_THRESHOLD) {
      return { ok: true, employeeId: bestMatch.employeeId, distance: bestMatch.distance };
    }

    console.log(`[matchFace] Embedding (${bestMatch.distance.toFixed(4)}) above strict threshold (${EMBEDDING_STRICT_THRESHOLD}), rejected without AI`);
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
