"use server";

/**
 * QR Token Service
 * 
 * Two QR modes:
 * 1. Daily QR (primary) — date-bound HMAC, rotates at midnight, multi-use per day
 * 2. Dynamic QR (legacy) — 30-second single-use tokens for high-security sites
 */

import { createServerSupabaseClient, createAdminSupabaseClient } from "./supabase-server";
import type { QRTokenRow } from "@/types";
import { nanoid } from "nanoid";
import { isWithinGeofence } from "@/lib/geofence";
import { parseDailyQRPayload, parseEmployeeQRPayload, detectQRType } from "@/lib/qr-utils";

// Token configuration
const TOKEN_EXPIRY_SECONDS = 30; // 30 seconds
const TOKEN_LENGTH = 32; // 32 character random token

/**
 * Generate a dynamic QR token for an employee
 * Token is single-use and expires after 30 seconds
 */
export async function generateQRToken(
  employeeId: string,
  deviceId: string,
): Promise<{ ok: boolean; token?: string; expiresAt?: string; error?: string }> {
  try {
    const supabase = await createAdminSupabaseClient();

    // Generate unique token
    const token = `NEXHRMS-DYN-${nanoid(TOKEN_LENGTH)}`;
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_SECONDS * 1000).toISOString();

    // Insert token into database
    const tokenId = `QRT-${nanoid(8)}`;
    const { error } = await supabase.from("qr_tokens").insert({
      id: tokenId,
      device_id: deviceId,
      employee_id: employeeId,
      token: token,
      expires_at: expiresAt,
      used: false,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { 
      ok: true, 
      token, 
      expiresAt 
    };
  } catch (error) {
    console.error("[generateQRToken] Error:", error);
    return { ok: false, error: "Failed to generate token" };
  }
}

/**
 * Validate a QR token
 * Checks: exists, not expired, not used, device matches, location valid
 */
export async function validateQRToken(
  token: string,
  kioskId: string,
  location?: { lat: number; lng: number; accuracy?: number },
): Promise<{ 
  ok: boolean; 
  valid?: boolean; 
  employeeId?: string; 
  message?: string;
  error?: string;
}> {
  try {
    const supabase = await createAdminSupabaseClient();

    // Use database function for atomic validation
    const { data, error } = await supabase.rpc("validate_qr_token", {
      token_value: token,
      kiosk_id: kioskId,
    });

    if (error) {
      // If RPC function doesn't exist, fall back to manual validation
      return await validateQRTokenManual(token, kioskId, location);
    }

    if (!data || data.length === 0) {
      return { ok: false, error: "Validation failed" };
    }

    const result = data[0] as { valid: boolean; employee_id: string; message: string };

    if (!result.valid) {
      return { 
        ok: true, 
        valid: false, 
        message: result.message 
      };
    }

    // Additional location validation if provided
    if (location) {
      const locationValid = await validateLocation(kioskId, location);
      if (!locationValid.valid) {
        return { 
          ok: true, 
          valid: false, 
          message: `Location validation failed: ${locationValid.message}` 
        };
      }
    }

    return { 
      ok: true, 
      valid: true, 
      employeeId: result.employee_id,
      message: "Token validated successfully" 
    };
  } catch (error) {
    console.error("[validateQRToken] Error:", error);
    return { ok: false, error: "Validation failed" };
  }
}

/**
 * Manual token validation (fallback if RPC function unavailable)
 */
async function validateQRTokenManual(
  token: string,
  kioskId: string,
  location?: { lat: number; lng: number; accuracy?: number },
): Promise<{ 
  ok: boolean; 
  valid?: boolean; 
  employeeId?: string; 
  message?: string;
  error?: string;
}> {
  try {
    const supabase = await createAdminSupabaseClient();

    // Get token record
    const { data: tokenRecord, error } = await supabase
      .from("qr_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !tokenRecord) {
      return { ok: true, valid: false, message: "Invalid token" };
    }

    // Check if already used
    if (tokenRecord.used) {
      return { ok: true, valid: false, message: "Token already used" };
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(tokenRecord.expires_at);
    if (now > expiresAt) {
      return { ok: true, valid: false, message: "Token expired" };
    }

    // Check device match (if kioskId provided)
    if (kioskId && tokenRecord.device_id !== kioskId) {
      return { ok: true, valid: false, message: "Invalid device" };
    }

    // Mark as used
    await supabase
      .from("qr_tokens")
      .update({
        used: true,
        used_at: new Date().toISOString(),
        used_by_kiosk_id: kioskId,
      })
      .eq("id", tokenRecord.id);

    // Additional location validation if provided
    if (location) {
      const locationValid = await validateLocation(kioskId, location);
      if (!locationValid.valid) {
        return { 
          ok: true, 
          valid: false, 
          message: `Location validation failed: ${locationValid.message}` 
        };
      }
    }

    return { 
      ok: true, 
      valid: true, 
      employeeId: tokenRecord.employee_id || undefined,
      message: "Token validated successfully" 
    };
  } catch (error) {
    console.error("[validateQRTokenManual] Error:", error);
    return { ok: false, error: "Validation failed" };
  }
}

/**
 * Validate location matches kiosk location
 */
async function validateLocation(
  kioskId: string,
  location: { lat: number; lng: number; accuracy?: number },
): Promise<{ valid: boolean; message: string }> {
  try {
    const supabase = await createAdminSupabaseClient();

    // Get kiosk device and its project
    const { data: kiosk } = await supabase
      .from("kiosk_devices")
      .select("project_id")
      .eq("id", kioskId)
      .single();

    if (!kiosk?.project_id) {
      // No project associated with kiosk, allow
      return { valid: true, message: "No location constraint" };
    }

    // Get project location
    const { data: project } = await supabase
      .from("projects")
      .select("location_lat, location_lng, location_radius")
      .eq("id", kiosk.project_id)
      .single();

    if (!project?.location_lat || !project?.location_lng) {
      // No location defined for project, allow
      return { valid: true, message: "No project location defined" };
    }

    // Check geofence
    const radius = project.location_radius || 100; // Default 100m
    const withinGeofence = isWithinGeofence(
      location.lat,
      location.lng,
      project.location_lat,
      project.location_lng,
      radius
    );

    if (!withinGeofence) {
      return { valid: false, message: "Outside geofence" };
    }

    return { valid: true, message: "Location validated" };
  } catch (error) {
    console.error("[validateLocation] Error:", error);
    return { valid: true, message: "Location validation error - allowing" };
  }
}

/**
 * Get unused tokens for an employee (for QR display)
 */
export async function getActiveQRToken(
  employeeId: string,
  deviceId: string,
): Promise<{ token?: string; expiresAt?: string }> {
  try {
    const supabase = await createAdminSupabaseClient();

    // Get any unused, unexpired token for this employee/device
    const { data } = await supabase
      .from("qr_tokens")
      .select("token, expires_at")
      .eq("employee_id", employeeId)
      .eq("device_id", deviceId)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!data) {
      return {};
    }

    return {
      token: data.token,
      expiresAt: data.expires_at,
    };
  } catch (error) {
    console.error("[getActiveQRToken] Error:", error);
    return {};
  }
}

/**
 * Clean up expired tokens (run periodically)
 */
export async function cleanupExpiredTokens(): Promise<{ ok: boolean; count?: number }> {
  try {
    const supabase = await createAdminSupabaseClient();

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    // Delete tokens expired more than 1 hour ago
    const { count, error } = await supabase
      .from("qr_tokens")
      .delete()
      .lt("expires_at", oneHourAgo);

    if (error) {
      return { ok: false };
    }

    return { ok: true, count: count || 0 };
  } catch (error) {
    console.error("[cleanupExpiredTokens] Error:", error);
    return { ok: false };
  }
}

/**
 * Get QR token statistics (for admin dashboard)
 */
export async function getQRTokenStats(): Promise<{
  total: number;
  used: number;
  expired: number;
  active: number;
}> {
  try {
    const supabase = await createAdminSupabaseClient();
    const now = new Date().toISOString();

    // Total tokens
    const { count: total } = await supabase
      .from("qr_tokens")
      .select("*", { count: "exact", head: true });

    // Used tokens
    const { count: used } = await supabase
      .from("qr_tokens")
      .select("*", { count: "exact", head: true })
      .eq("used", true);

    // Expired tokens (not used)
    const { count: expired } = await supabase
      .from("qr_tokens")
      .select("*", { count: "exact", head: true })
      .eq("used", false)
      .lt("expires_at", now);

    // Active tokens (not used, not expired)
    const { count: active } = await supabase
      .from("qr_tokens")
      .select("*", { count: "exact", head: true })
      .eq("used", false)
      .gt("expires_at", now);

    return {
      total: total || 0,
      used: used || 0,
      expired: expired || 0,
      active: active || 0,
    };
  } catch (error) {
    console.error("[getQRTokenStats] Error:", error);
    return { total: 0, used: 0, expired: 0, active: 0 };
  }
}

/**
 * Validate a daily QR payload.
 * Checks HMAC + date, resolves employeeId, optionally validates location.
 */
export async function validateDailyQR(
  payload: string,
  kioskId: string,
  location?: { lat: number; lng: number; accuracy?: number },
): Promise<{
  ok: boolean;
  valid?: boolean;
  employeeId?: string;
  message?: string;
  error?: string;
}> {
  try {
    const parsed = await parseDailyQRPayload(payload);
    if (!parsed) {
      return { ok: true, valid: false, message: "Invalid or expired daily QR code" };
    }

    // Location check
    if (location) {
      const locationResult = await validateLocation(kioskId, location);
      if (!locationResult.valid) {
        return {
          ok: true,
          valid: false,
          message: `Location validation failed: ${locationResult.message}`,
        };
      }
    }

    return {
      ok: true,
      valid: true,
      employeeId: parsed.employeeId,
      message: "Daily QR validated successfully",
    };
  } catch (error) {
    console.error("[validateDailyQR] Error:", error);
    return { ok: false, error: "Daily QR validation failed" };
  }
}

/**
 * Validate a static (legacy) QR payload.
 */
export async function validateStaticQR(
  payload: string,
  kioskId: string,
  location?: { lat: number; lng: number; accuracy?: number },
): Promise<{
  ok: boolean;
  valid?: boolean;
  employeeId?: string;
  message?: string;
  error?: string;
}> {
  try {
    const parsed = await parseEmployeeQRPayload(payload);
    if (!parsed) {
      return { ok: true, valid: false, message: "Invalid static QR code" };
    }

    if (location) {
      const locationResult = await validateLocation(kioskId, location);
      if (!locationResult.valid) {
        return {
          ok: true,
          valid: false,
          message: `Location validation failed: ${locationResult.message}`,
        };
      }
    }

    return {
      ok: true,
      valid: true,
      employeeId: parsed.employeeId,
      message: "Static QR validated successfully",
    };
  } catch (error) {
    console.error("[validateStaticQR] Error:", error);
    return { ok: false, error: "Static QR validation failed" };
  }
}

/**
 * Universal QR validator — detects format and delegates.
 */
export async function validateAnyQR(
  payload: string,
  kioskId: string,
  location?: { lat: number; lng: number; accuracy?: number },
): Promise<{
  ok: boolean;
  valid?: boolean;
  employeeId?: string;
  message?: string;
  qrType?: string;
  error?: string;
}> {
  const qrType = detectQRType(payload);

  switch (qrType) {
    case "daily":
      return { ...(await validateDailyQR(payload, kioskId, location)), qrType: "daily" };
    case "static":
      return { ...(await validateStaticQR(payload, kioskId, location)), qrType: "static" };
    case "dynamic": {
      // Extract just the token part for legacy dynamic validation
      const token = payload;
      return { ...(await validateQRToken(token, kioskId, location)), qrType: "dynamic" };
    }
    default:
      return { ok: true, valid: false, message: "Unrecognized QR format", qrType: "unknown" };
  }
}

/**
 * Revoke a token (for security)
 */
export async function revokeQRToken(
  tokenId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createAdminSupabaseClient();

    const { error } = await supabase
      .from("qr_tokens")
      .update({ 
        used: true, 
        used_at: new Date().toISOString(),
        used_by_kiosk_id: "REVOKED",
      })
      .eq("id", tokenId);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    console.error("[revokeQRToken] Error:", error);
    return { ok: false, error: "Failed to revoke token" };
  }
}
