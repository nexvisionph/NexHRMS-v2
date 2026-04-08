"use server";

import { createAdminSupabaseClient, createServerSupabaseClient } from "./supabase-server";
import type { Role } from "@/types";

/**
 * Sign in with email/password via Supabase Auth.
 * Called from client via server action.
 */
export async function signIn(email: string, password: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false as const, error: error.message };

  // Fetch profile + employee data to hydrate client store
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  // Try to find employee by profile_id first
  let { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("profile_id", data.user.id)
    .single();

  // If not found by profile_id, try by email and link the profile_id
  if (!employee && data.user.email) {
    const { data: empByEmail } = await supabase
      .from("employees")
      .select("*")
      .ilike("email", data.user.email)
      .single();

    if (empByEmail && !empByEmail.profile_id) {
      // Link the employee to this profile
      const adminSupabase = await createAdminSupabaseClient();
      await adminSupabase
        .from("employees")
        .update({ profile_id: data.user.id })
        .eq("id", empByEmail.id);
      employee = { ...empByEmail, profile_id: data.user.id };
    } else if (empByEmail) {
      employee = empByEmail;
    }
  }

  return {
    ok: true as const,
    user: {
      id: employee?.id ?? data.user.id,
      name: profile?.name ?? data.user.user_metadata?.name ?? "",
      email: data.user.email ?? "",
      role: (profile?.role ?? data.user.user_metadata?.role ?? "employee") as Role,
      avatarUrl: profile?.avatar_url,
      mustChangePassword: profile?.must_change_password ?? false,
      profileComplete: profile?.profile_complete ?? false,
      phone: profile?.phone,
      department: profile?.department,
      birthday: profile?.birthday,
      address: profile?.address,
      emergencyContact: profile?.emergency_contact,
    },
  };
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
}

/**
 * Admin-only: Create a new user account.
 * Requires SUPABASE_SERVICE_ROLE_KEY env var.
 * Caller must be an authenticated admin.
 * 
 * OPTIMIZED: Parallelizes DB operations where possible.
 */
export async function createUserAccount(input: {
  name: string;
  email: string;
  role: Role;
  password: string;
  department?: string;
  mustChangePassword?: boolean;
  phone?: string;
  birthday?: string;
  address?: string;
  emergencyContact?: string;
}) {
  // Password complexity - check before any network calls
  if (input.password.length < 8) {
    return { ok: false as const, error: "Password must be at least 8 characters" };
  }

  // Verify the caller is an authenticated admin
  const caller = await createServerSupabaseClient();
  const { data: { user: callerUser } } = await caller.auth.getUser();
  if (!callerUser) return { ok: false as const, error: "Not authenticated" };

  const { data: callerProfile } = await caller
    .from("profiles")
    .select("role")
    .eq("id", callerUser.id)
    .single();

  if (callerProfile?.role !== "admin") {
    return { ok: false as const, error: "Only admins can create accounts" };
  }

  const supabase = await createAdminSupabaseClient();

  // Create auth user
  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      name: input.name,
      role: input.role,
    },
  });

  if (error) return { ok: false as const, error: error.message };

  // Run profile update and employee lookup in parallel
  if (data.user) {
    const [, employeeResult] = await Promise.all([
      // Update profile with additional fields
      supabase.from("profiles").update({
        name: input.name,
        role: input.role,
        department: input.department ?? "",
        must_change_password: input.mustChangePassword ?? true,
        phone: input.phone ?? null,
        birthday: input.birthday ?? null,
        address: input.address ?? null,
        emergency_contact: input.emergencyContact ?? null,
      }).eq("id", data.user.id),
      
      // Check if employee with this email already exists (created via addEmployee first)
      supabase.from("employees")
        .select("id")
        .ilike("email", input.email)
        .maybeSingle(),
    ]);

    // Link existing employee to profile (don't create - write-through handles that)
    if (employeeResult.data?.id) {
      await supabase.from("employees").update({
        profile_id: data.user.id,
        phone: input.phone ?? null,
        birthday: input.birthday ?? null,
        address: input.address ?? null,
        emergency_contact: input.emergencyContact ?? null,
      }).eq("id", employeeResult.data.id);
    }
  }

  return { ok: true as const, userId: data.user?.id };
}

/**
 * Admin-only: Reset a user's password.
 */
export async function adminResetPassword(userId: string, newPassword: string) {
  const caller = await createServerSupabaseClient();
  const { data: { user: callerUser } } = await caller.auth.getUser();
  if (!callerUser) return { ok: false as const, error: "Not authenticated" };

  const { data: callerProfile } = await caller
    .from("profiles")
    .select("role")
    .eq("id", callerUser.id)
    .single();

  if (callerProfile?.role !== "admin") {
    return { ok: false as const, error: "Only admins can reset passwords" };
  }

  if (newPassword.length < 6) {
    return { ok: false as const, error: "Password must be at least 6 characters" };
  }

  const supabase = await createAdminSupabaseClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) return { ok: false as const, error: error.message };

  await supabase.from("profiles").update({ must_change_password: true }).eq("id", userId);
  return { ok: true as const };
}

/**
 * Admin-only: Delete a user account and all linked records.
 */
export async function adminDeleteAccount(userId: string) {
  const caller = await createServerSupabaseClient();
  const { data: { user: callerUser } } = await caller.auth.getUser();
  if (!callerUser) return { ok: false as const, error: "Not authenticated" };

  if (callerUser.id === userId) {
    return { ok: false as const, error: "Cannot delete your own account" };
  }

  const { data: callerProfile } = await caller
    .from("profiles")
    .select("role")
    .eq("id", callerUser.id)
    .single();

  if (callerProfile?.role !== "admin") {
    return { ok: false as const, error: "Only admins can delete accounts" };
  }

  const supabase = await createAdminSupabaseClient();

  // Delete employee record first (FK constraint)
  await supabase.from("employees").delete().eq("profile_id", userId);
  // Auth user deletion cascades to profile via FK
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const };
}

/**
 * Change the current user's own password.
 */
export async function changeMyPassword(newPassword: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  if (newPassword.length < 6) {
    return { ok: false as const, error: "Password must be at least 6 characters" };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false as const, error: error.message };

  await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id);
  return { ok: true as const };
}

/**
 * Admin-only: List all user accounts (profiles).
 */
export async function listUserAccounts() {
  const caller = await createServerSupabaseClient();
  const { data: { user: callerUser } } = await caller.auth.getUser();
  if (!callerUser) return { ok: false as const, error: "Not authenticated", accounts: [] as DemoUserLike[] };

  const { data: callerProfile } = await caller
    .from("profiles")
    .select("role")
    .eq("id", callerUser.id)
    .single();

  if (!callerProfile || !["admin", "hr"].includes(callerProfile.role)) {
    return { ok: false as const, error: "Insufficient permissions", accounts: [] as DemoUserLike[] };
  }

  const supabase = await createAdminSupabaseClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  return {
    ok: true as const,
    accounts: (profiles ?? []).map((p): DemoUserLike => ({
      id: p.id,
      name: p.name,
      email: p.email,
      role: p.role as Role,
      avatarUrl: p.avatar_url ?? undefined,
      mustChangePassword: p.must_change_password ?? false,
      profileComplete: p.profile_complete ?? false,
      createdAt: p.created_at,
      phone: p.phone ?? undefined,
      department: p.department ?? undefined,
      birthday: p.birthday ?? undefined,
      address: p.address ?? undefined,
      emergencyContact: p.emergency_contact ?? undefined,
    })),
  };
}

/** Shape returned by listUserAccounts — matches DemoUser for UI compatibility */
export interface DemoUserLike {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  mustChangePassword?: boolean;
  profileComplete?: boolean;
  createdAt?: string;
  phone?: string;
  department?: string;
  birthday?: string;
  address?: string;
  emergencyContact?: string;
}

/**
 * Get the current authenticated user's profile.
 */
export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("profile_id", user.id)
    .single();

  return {
    id: employee?.id ?? user.id,
    name: profile?.name ?? "",
    email: user.email ?? "",
    role: (profile?.role ?? "employee") as Role,
    avatarUrl: profile?.avatar_url,
    mustChangePassword: profile?.must_change_password ?? false,
    profileComplete: profile?.profile_complete ?? false,
    phone: profile?.phone,
    department: profile?.department,
    birthday: profile?.birthday,
    address: profile?.address,
    emergencyContact: profile?.emergency_contact,
  };
}
