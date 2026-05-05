import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseUrl, getSupabaseAnonKey, getServiceRoleKey } from "@/lib/env";

/**
 * Check if an error is a refresh token error.
 * These errors occur when the session has expired or been invalidated.
 */
export function isRefreshTokenError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { code?: string; message?: string; __isAuthError?: boolean };
  return (
    err.code === "refresh_token_not_found" ||
    err.message?.includes("Refresh Token") ||
    err.message?.includes("Invalid Refresh Token") ||
    err.__isAuthError === true
  );
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from Server Component — safe to ignore
          }
        },
      },
    }
  );
}

/**
 * Admin client using service_role key — use ONLY in server actions / API routes.
 * Uses createClient (NOT createServerClient) so the service role key is used
 * directly as the auth token.  createServerClient piggybacks on cookie-based
 * sessions, which means the user's JWT takes precedence and RLS still applies.
 */
export async function createAdminSupabaseClient() {
  return createSupabaseClient(
    getSupabaseUrl(),
    getServiceRoleKey(),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

/**
 * Backward-compatible server helper used by older API routes.
 */
export async function createClient() {
  return createAdminSupabaseClient();
}
