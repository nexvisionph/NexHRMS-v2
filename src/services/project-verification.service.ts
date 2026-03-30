"use server";

/**
 * Project Verification Service
 * 
 * Manages verification method settings per project.
 * Admins can select: face_only, qr_only, face_or_qr, or manual_only.
 */

import { createServerSupabaseClient, createAdminSupabaseClient } from "./supabase-server";
import type { ProjectVerificationMethod, VerificationMethod } from "@/types";

/**
 * Set verification method for a project
 */
export async function setProjectVerificationMethod(
  projectId: string,
  method: VerificationMethod,
  options?: {
    requireGeofence?: boolean;
    geofenceRadiusMeters?: number;
    allowManualOverride?: boolean;
  },
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

    // Upsert into project_verification_methods table
    const { error } = await supabase.from("project_verification_methods").upsert({
      project_id: projectId,
      verification_method: method,
      require_geofence: options?.requireGeofence ?? true,
      geofence_radius_meters: options?.geofenceRadiusMeters ?? 100,
      allow_manual_override: options?.allowManualOverride ?? false,
    }, {
      onConflict: "project_id",
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    // Also update denormalized column in projects table
    await supabase
      .from("projects")
      .update({
        verification_method: method,
        require_geofence: options?.requireGeofence ?? true,
        geofence_radius_meters: options?.geofenceRadiusMeters ?? 100,
      })
      .eq("id", projectId);

    return { ok: true };
  } catch (error) {
    console.error("[setProjectVerificationMethod] Error:", error);
    return { ok: false, error: "Failed to set verification method" };
  }
}

/**
 * Get verification method for a project
 */
export async function getProjectVerificationMethod(
  projectId: string,
): Promise<ProjectVerificationMethod | null> {
  try {
    const supabase = await createServerSupabaseClient();

    // First try project_verification_methods table
    const { data } = await supabase
      .from("project_verification_methods")
      .select("*")
      .eq("project_id", projectId)
      .single();

    if (data) {
      return {
        id: data.id,
        projectId: data.project_id,
        verificationMethod: data.verification_method as VerificationMethod,
        requireGeofence: data.require_geofence,
        geofenceRadiusMeters: data.geofence_radius_meters,
        allowManualOverride: data.allow_manual_override,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    }

    // Fallback to denormalized projects table
    const { data: project } = await supabase
      .from("projects")
      .select("verification_method, require_geofence, geofence_radius_meters")
      .eq("id", projectId)
      .single();

    if (project?.verification_method) {
      return {
        id: `PVM-${projectId}`,
        projectId,
        verificationMethod: project.verification_method as VerificationMethod,
        requireGeofence: project.require_geofence ?? true,
        geofenceRadiusMeters: project.geofence_radius_meters ?? 100,
        allowManualOverride: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Default
    return {
      id: `PVM-${projectId}`,
      projectId,
      verificationMethod: "face_or_qr",
      requireGeofence: true,
      geofenceRadiusMeters: 100,
      allowManualOverride: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[getProjectVerificationMethod] Error:", error);
    return null;
  }
}

/**
 * Get verification methods for all projects
 */
export async function getAllProjectVerificationMethods(): Promise<ProjectVerificationMethod[]> {
  try {
    const supabase = await createAdminSupabaseClient();

    const { data } = await supabase
      .from("project_verification_methods")
      .select("*")
      .order("created_at", { ascending: false });

    if (!data) return [];

    return data.map((row: Record<string, unknown>) => ({
      id: row.id as string,
      projectId: row.project_id as string,
      verificationMethod: row.verification_method as VerificationMethod,
      requireGeofence: row.require_geofence as boolean,
      geofenceRadiusMeters: row.geofence_radius_meters as number,
      allowManualOverride: row.allow_manual_override as boolean,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  } catch (error) {
    console.error("[getAllProjectVerificationMethods] Error:", error);
    return [];
  }
}

/**
 * Get projects by verification method
 */
export async function getProjectsByVerificationMethod(
  method: VerificationMethod,
): Promise<string[]> {
  try {
    const supabase = await createAdminSupabaseClient();

    const { data } = await supabase
      .from("project_verification_methods")
      .select("project_id")
      .eq("verification_method", method);

    if (!data) return [];

    return data.map((d: Record<string, unknown>) => d.project_id as string);
  } catch (error) {
    console.error("[getProjectsByVerificationMethod] Error:", error);
    return [];
  }
}

/**
 * Check if employee's project requires specific verification method
 */
export async function getEmployeeVerificationRequirement(
  employeeId: string,
): Promise<{
  requiredMethod: VerificationMethod;
  projectId?: string;
  projectName?: string;
  requireGeofence: boolean;
  geofenceRadiusMeters: number;
} | null> {
  try {
    const supabase = await createServerSupabaseClient();

    // Get employee's project
    const { data: employee } = await supabase
      .from("employees")
      .select("id")
      .eq("id", employeeId)
      .single();

    if (!employee) return null;

    // Get projects assigned to this employee
    const { data: projects } = await supabase
      .from("projects")
      .select(`
        id,
        name,
        verification_method,
        require_geofence,
        geofence_radius_meters,
        assigned_employee_ids
      `)
      .contains("assigned_employee_ids", [employeeId]);

    if (!projects || projects.length === 0) {
      return null;
    }

    // Use first project's verification method (or most restrictive)
    const project = projects[0];
    const method = (project.verification_method as VerificationMethod) || "face_or_qr";

    return {
      requiredMethod: method,
      projectId: project.id,
      projectName: project.name,
      requireGeofence: project.require_geofence ?? true,
      geofenceRadiusMeters: project.geofence_radius_meters ?? 100,
    };
  } catch (error) {
    console.error("[getEmployeeVerificationRequirement] Error:", error);
    return null;
  }
}

/**
 * Update verification method for multiple projects (bulk update)
 */
export async function bulkUpdateVerificationMethods(
  projectIds: string[],
  method: VerificationMethod,
): Promise<{ ok: boolean; updated: number; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    // Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, updated: 0, error: "Not authenticated" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return { ok: false, updated: 0, error: "Unauthorized: Admin access required" };
    }

    let updated = 0;

    for (const projectId of projectIds) {
      const { error } = await supabase
        .from("project_verification_methods")
        .upsert({
          project_id: projectId,
          verification_method: method,
          require_geofence: true,
          geofence_radius_meters: 100,
          allow_manual_override: false,
        }, {
          onConflict: "project_id",
        });

      if (!error) {
        updated++;
      }
    }

    return { ok: true, updated };
  } catch (error) {
    console.error("[bulkUpdateVerificationMethods] Error:", error);
    return { ok: false, updated: 0, error: "Bulk update failed" };
  }
}

/**
 * Delete verification method for a project (reverts to default)
 */
export async function deleteProjectVerificationMethod(
  projectId: string,
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
      .from("project_verification_methods")
      .delete()
      .eq("project_id", projectId);

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    console.error("[deleteProjectVerificationMethod] Error:", error);
    return { ok: false, error: "Failed to delete verification method" };
  }
}
