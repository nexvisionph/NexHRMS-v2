"use server";

/**
 * Manual Check-in Service
 * 
 * Allows admin/HR to manually check in/out employees when biometric systems fail.
 * All manual check-ins are logged with reason and performer for audit trail.
 */

import { createServerSupabaseClient, createAdminSupabaseClient } from "./supabase-server";
import type { ManualCheckin, ManualCheckinReason } from "@/types";
import { nanoid } from "nanoid";

/**
 * Get all active manual check-in reasons
 */
export async function getManualCheckinReasons(): Promise<ManualCheckinReason[]> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data } = await supabase
      .from("manual_checkin_reasons")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (!data) return [];

    return data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      reason: row.reason as string,
      isActive: row.is_active as boolean,
      createdAt: row.created_at as string,
    }));
  } catch (error) {
    console.error("[getManualCheckinReasons] Error:", error);
    return [];
  }
}

/**
 * Create a manual check-in record
 * Also appends to attendance_events for consistency
 */
export async function createManualCheckin(
  data: {
    employeeId: string;
    eventType: "IN" | "OUT";
    reasonId?: string;
    customReason?: string;
    performedBy: string;
    projectId?: string;
    notes?: string;
  },
): Promise<{ ok: boolean; checkin?: ManualCheckin; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    // Verify caller is admin or HR
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Not authenticated" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!["admin", "hr"].includes(profile?.role)) {
      return { ok: false, error: "Unauthorized: Admin/HR access required" };
    }

    // Validate reason
    let reasonText = data.customReason || "";
    if (data.reasonId && data.reasonId !== "MCR-007") {
      const { data: reason } = await supabase
        .from("manual_checkin_reasons")
        .select("reason")
        .eq("id", data.reasonId)
        .single();
      reasonText = reason?.reason || reasonText;
    }

    // Create manual check-in record
    const checkinId = `MCI-${nanoid(8)}`;
    const timestampUtc = new Date().toISOString();

    const { error: checkinError } = await supabase.from("manual_checkins").insert({
      id: checkinId,
      employee_id: data.employeeId,
      event_type: data.eventType,
      reason_id: data.reasonId || null,
      custom_reason: data.customReason || null,
      performed_by: data.performedBy,
      timestamp_utc: timestampUtc,
      project_id: data.projectId || null,
      notes: data.notes || null,
    });

    if (checkinError) {
      return { ok: false, error: checkinError.message };
    }

    // Also append to attendance_events for consistency with other check-in methods
    const eventId = `EVT-${nanoid(8)}`;
    const { error: eventError } = await supabase.from("attendance_events").insert({
      id: eventId,
      employee_id: data.employeeId,
      event_type: data.eventType,
      timestamp_utc: timestampUtc,
      project_id: data.projectId || null,
      device_id: "MANUAL_CHECKIN",
      created_at: timestampUtc,
    });

    if (eventError) {
      // Rollback manual check-in
      await supabase.from("manual_checkins").delete().eq("id", checkinId);
      return { ok: false, error: eventError.message };
    }

    // Create audit log
    await supabase.from("audit_logs").insert({
      id: `AUD-${nanoid(8)}`,
      entity_type: "attendance",
      entity_id: data.employeeId,
      action: "attendance_correction",
      performed_by: data.performedBy,
      timestamp: timestampUtc,
      reason: `Manual ${data.eventType} check-in: ${reasonText}`,
      before_snapshot: null,
      after_snapshot: {
        eventType: data.eventType,
        timestamp: timestampUtc,
        performedBy: data.performedBy,
        reason: reasonText,
      },
    });

    const checkin: ManualCheckin = {
      id: checkinId,
      employeeId: data.employeeId,
      eventType: data.eventType,
      reasonId: data.reasonId,
      customReason: data.customReason,
      performedBy: data.performedBy,
      timestampUtc: timestampUtc,
      projectId: data.projectId,
      notes: data.notes,
      createdAt: timestampUtc,
    };

    return { ok: true, checkin };
  } catch (error) {
    console.error("[createManualCheckin] Error:", error);
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : "Failed to create manual check-in" 
    };
  }
}

/**
 * Get manual check-ins for an employee
 */
export async function getManualCheckinsByEmployee(
  employeeId: string,
  limit = 50,
): Promise<ManualCheckin[]> {
  try {
    const supabase = await createAdminSupabaseClient();

    const { data } = await supabase
      .from("manual_checkins")
      .select(`
        *,
        reasons:manual_checkin_reasons (
          id,
          reason
        )
      `)
      .eq("employee_id", employeeId)
      .order("timestamp_utc", { ascending: false })
      .limit(limit);

    if (!data) return [];

    return data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      employeeId: row.employee_id as string,
      eventType: row.event_type as "IN" | "OUT",
      reasonId: row.reason_id as string,
      customReason: row.custom_reason as string,
      performedBy: row.performed_by as string,
      timestampUtc: row.timestamp_utc as string,
      projectId: row.project_id as string,
      notes: row.notes as string,
      createdAt: row.created_at as string,
    }));
  } catch (error) {
    console.error("[getManualCheckinsByEmployee] Error:", error);
    return [];
  }
}

/**
 * Get manual check-ins by date range (for admin dashboard)
 */
export async function getManualCheckinsByDateRange(
  startDate: string,
  endDate: string,
): Promise<ManualCheckin[]> {
  try {
    const supabase = await createAdminSupabaseClient();

    const { data } = await supabase
      .from("manual_checkins")
      .select(`
        *,
        employee:employees!manual_checkins_employee_id_fkey (
          id,
          name,
          email
        ),
        performer:employees!manual_checkins_performed_by_fkey (
          id,
          name,
          email
        ),
        reasons:manual_checkin_reasons (
          id,
          reason
        )
      `)
      .gte("timestamp_utc", startDate)
      .lte("timestamp_utc", endDate)
      .order("timestamp_utc", { ascending: false });

    if (!data) return [];

    return data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      employeeId: (row as any).employee?.id as string || row.employee_id as string,
      employeeName: (row as any).employee?.name as string,
      eventType: row.event_type as "IN" | "OUT",
      reasonId: row.reason_id as string,
      customReason: row.custom_reason as string,
      performedBy: row.performed_by as string,
      performerName: (row as any).performer?.name as string,
      timestampUtc: row.timestamp_utc as string,
      projectId: row.project_id as string,
      notes: row.notes as string,
      createdAt: row.created_at as string,
    }));
  } catch (error) {
    console.error("[getManualCheckinsByDateRange] Error:", error);
    return [];
  }
}

/**
 * Get manual check-in statistics
 */
export async function getManualCheckinStats(
  startDate?: string,
  endDate?: string,
): Promise<{
  total: number;
  checkIns: number;
  checkOuts: number;
  byReason: Array<{ reason: string; count: number }>;
  byPerformer: Array<{ performer: string; count: number }>;
}> {
  try {
    const supabase = await createAdminSupabaseClient();

    let query = supabase.from("manual_checkins").select("*");

    if (startDate) {
      query = query.gte("timestamp_utc", startDate);
    }
    if (endDate) {
      query = query.lte("timestamp_utc", endDate);
    }

    const { data } = await query;

    if (!data || data.length === 0) {
      return { total: 0, checkIns: 0, checkOuts: 0, byReason: [], byPerformer: [] };
    }

    const checkIns = data.filter((d: Record<string, unknown>) => d.event_type === "IN").length;
    const checkOuts = data.filter((d: Record<string, unknown>) => d.event_type === "OUT").length;

    // Group by reason
    const reasonMap = new Map<string, number>();
    data.forEach((d: Record<string, unknown>) => {
      const reason = (d.custom_reason as string) || (d.reason_id as string) || "Unknown";
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
    });

    // Group by performer
    const performerMap = new Map<string, number>();
    data.forEach((d: Record<string, unknown>) => {
      const performer = d.performed_by as string;
      performerMap.set(performer, (performerMap.get(performer) || 0) + 1);
    });

    return {
      total: data.length,
      checkIns,
      checkOuts,
      byReason: Array.from(reasonMap.entries()).map(([reason, count]) => ({ reason, count })),
      byPerformer: Array.from(performerMap.entries()).map(([performer, count]) => ({ performer, count })),
    };
  } catch (error) {
    console.error("[getManualCheckinStats] Error:", error);
    return { total: 0, checkIns: 0, checkOuts: 0, byReason: [], byPerformer: [] };
  }
}

/**
 * Add a new manual check-in reason (admin only)
 */
export async function addManualCheckinReason(
  reason: string,
): Promise<{ ok: boolean; reasonId?: string; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    // Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return { ok: false, error: "Unauthorized: Admin access required" };
    }

    const reasonId = `MCR-${nanoid(8)}`;
    const { error } = await supabase.from("manual_checkin_reasons").insert({
      id: reasonId,
      reason: reason,
      is_active: true,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, reasonId };
  } catch (error) {
    console.error("[addManualCheckinReason] Error:", error);
    return { ok: false, error: "Failed to add reason" };
  }
}

/**
 * Deactivate a manual check-in reason (admin only)
 */
export async function deactivateManualCheckinReason(
  reasonId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    // Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Not authenticated" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return { ok: false, error: "Unauthorized: Admin access required" };
    }

    const { error } = await supabase
      .from("manual_checkin_reasons")
      .update({ is_active: false })
      .eq("id", reasonId);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    console.error("[deactivateManualCheckinReason] Error:", error);
    return { ok: false, error: "Failed to deactivate reason" };
  }
}
