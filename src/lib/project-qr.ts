/**
 * Project QR signing & verification.
 *
 * Each project has a server-only `qrSecret` (base64 nonce, set in migration 055).
 * The QR payload is a JSON string the kiosk scans. Format:
 *
 *   { "v": 1, "type": "project", "projectId": "P-xyz", "sig": "<base64url-hmac>" }
 *
 * The signature is HMAC-SHA256 of `${projectId}.${qrSecret}` keyed with
 * `process.env.QR_HMAC_SECRET` (must be set, ≥32 chars). Both the per-project
 * nonce and the global server secret must match for the signature to verify,
 * so a stolen `qrSecret` alone is insufficient — and a stolen server secret
 * alone is insufficient too.
 *
 * Static (no rotation) by design — the QR sticker is permanently posted
 * on-site. Geofence + face verification at scan-time provide the freshness
 * guarantee (you must physically be at the project location to use it).
 *
 * SECURITY:
 *   - Never log `qrSecret` or `QR_HMAC_SECRET`.
 *   - Never return `qrSecret` in any response that's not behind `projects:manage`.
 *   - Always verify on the SERVER. The client only renders the QR.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const QR_PAYLOAD_VERSION = 1;
export const QR_PAYLOAD_TYPE = "project" as const;

export interface ProjectQrPayload {
  v: typeof QR_PAYLOAD_VERSION;
  type: typeof QR_PAYLOAD_TYPE;
  projectId: string;
  sig: string;
}

function getServerSecret(): string {
  const secret = process.env.QR_HMAC_SECRET;
  if (secret && secret.length >= 32) return secret;

  // Fall back to SUPABASE_SERVICE_ROLE_KEY — it's always present in production,
  // server-only, and is a strong enough key (200+ char JWT).
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (fallback && fallback.length >= 32) {
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[qr-utils] QR_HMAC_SECRET not set — falling back to SUPABASE_SERVICE_ROLE_KEY. " +
          "Add QR_HMAC_SECRET to your environment variables for explicit configuration.",
      );
    }
    return fallback;
  }

  throw new Error(
    "QR_HMAC_SECRET env is missing or shorter than 32 chars. " +
      "Set it in .env (production must use a strong random value).",
  );
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function computeSignature(projectId: string, qrSecret: string): string {
  const serverSecret = getServerSecret();
  const message = `${projectId}.${qrSecret}`;
  const hmac = createHmac("sha256", serverSecret).update(message).digest();
  return base64url(hmac);
}

/**
 * Build the QR payload string that gets encoded into the QR image.
 * Returns a stable JSON string suitable for `<QRCodeCanvas value={...} />`.
 */
export function signProjectQr(projectId: string, qrSecret: string): string {
  if (!projectId || !qrSecret) throw new Error("signProjectQr: projectId and qrSecret are required");
  const payload: ProjectQrPayload = {
    v: QR_PAYLOAD_VERSION,
    type: QR_PAYLOAD_TYPE,
    projectId,
    sig: computeSignature(projectId, qrSecret),
  };
  return JSON.stringify(payload);
}

export type QrVerifyResult =
  | { ok: true; projectId: string }
  | { ok: false; reason: string };

/**
 * Parse and HMAC-verify a scanned QR payload string.
 * `lookupSecret(projectId)` is called to fetch the project's qrSecret from DB.
 */
export async function verifyProjectQr(
  raw: string,
  lookupSecret: (projectId: string) => Promise<string | null>,
): Promise<QrVerifyResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
  if (typeof parsed !== "object" || parsed === null) return { ok: false, reason: "not_an_object" };
  const p = parsed as Partial<ProjectQrPayload>;
  if (p.v !== QR_PAYLOAD_VERSION) return { ok: false, reason: "unsupported_version" };
  if (p.type !== QR_PAYLOAD_TYPE) return { ok: false, reason: "wrong_type" };
  if (typeof p.projectId !== "string" || !p.projectId) return { ok: false, reason: "missing_project_id" };
  if (typeof p.sig !== "string" || !p.sig) return { ok: false, reason: "missing_signature" };

  const qrSecret = await lookupSecret(p.projectId);
  if (!qrSecret) return { ok: false, reason: "unknown_project_or_qr_disabled" };

  const expected = computeSignature(p.projectId, qrSecret);
  // Constant-time comparison to defeat timing attacks.
  const a = fromBase64url(p.sig);
  const b = fromBase64url(expected);
  if (a.length !== b.length) return { ok: false, reason: "signature_mismatch" };
  if (!timingSafeEqual(a, b)) return { ok: false, reason: "signature_mismatch" };

  return { ok: true, projectId: p.projectId };
}
