/**
 * Project QR Code Generation & Validation
 * Each project gets a permanent QR code with HMAC signature for attendance verification.
 */

// ─── QR Payload Structure ────────────────────────────────────

export interface ProjectQRPayload {
  type: "project_qr";
  projectId: string;
  projectName: string;
  /** HMAC signature for tamper detection */
  signature: string;
  /** Version for future-proofing */
  version: number;
}

// ─── HMAC Signing ────────────────────────────────────────────

const QR_SECRET = process.env.NEXT_PUBLIC_QR_SECRET || "nexhrms-project-qr-secret-2026";

/**
 * Generate HMAC-SHA256 signature for a project QR code
 */
async function generateHMAC(data: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const key = await window.crypto.subtle.importKey(
      "raw",
      encoder.encode(QR_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await window.crypto.subtle.sign("HMAC", key, encoder.encode(data));
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16); // Truncate to 16 chars for QR readability
  }
  // Fallback for server-side or environments without SubtleCrypto
  let hash = 0;
  const str = QR_SECRET + data;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, "0").slice(0, 16);
}

/**
 * Generate a permanent QR code payload for a project
 */
export async function generateProjectQR(projectId: string, projectName: string): Promise<string> {
  const dataToSign = `project:${projectId}:${projectName}`;
  const signature = await generateHMAC(dataToSign);

  const payload: ProjectQRPayload = {
    type: "project_qr",
    projectId,
    projectName,
    signature,
    version: 1,
  };

  return JSON.stringify(payload);
}

/**
 * Parse and validate a scanned project QR code
 */
export async function validateProjectQR(qrData: string): Promise<{
  valid: boolean;
  payload?: ProjectQRPayload;
  error?: string;
}> {
  try {
    const payload = JSON.parse(qrData) as ProjectQRPayload;

    if (payload.type !== "project_qr") {
      return { valid: false, error: "Not a project QR code" };
    }

    if (!payload.projectId || !payload.signature) {
      return { valid: false, error: "Invalid QR payload structure" };
    }

    // Verify HMAC signature
    const dataToSign = `project:${payload.projectId}:${payload.projectName}`;
    const expectedSignature = await generateHMAC(dataToSign);

    if (payload.signature !== expectedSignature) {
      return { valid: false, error: "QR signature verification failed" };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: "Failed to parse QR data" };
  }
}

/**
 * Generate a QR code data URL for display/download
 * Uses a simple SVG-based QR representation (actual QR generation should use a library like qrcode)
 */
export function getProjectQRDisplayData(projectId: string, projectName: string): {
  label: string;
  subtitle: string;
} {
  return {
    label: projectName,
    subtitle: `Project ID: ${projectId.slice(0, 8)}...`,
  };
}
