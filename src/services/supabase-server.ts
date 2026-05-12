import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
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

  const client = createServerClient(
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

  // ─── Self-healing getUser() ──────────────────────────────────────────────────
  // @supabase/ssr creates server clients with autoRefreshToken:false by design.
  // Refreshing is supposed to happen once in middleware (proxy.ts). However, in
  // dev mode, Next.js does NOT hot-reload middleware — it requires a full server
  // restart. This means the first time you run the app after a proxy.ts change,
  // or if a user's access token expires mid-session in an edge case, all API
  // routes will return 401 even though the user is still "logged in".
  //
  // Fix: intercept getUser() to add an automatic refreshSession() fallback.
  // If getUser() returns null (expired token), call refreshSession() to use the
  // refresh token from the cookie store, then return the refreshed user.
  // This makes EVERY API route self-healing without changing each one individually.
  const originalGetUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = async (jwt?: string) => {
    const result = await originalGetUser(jwt);
    // If we have a user, or a JWT was explicitly provided, return as-is.
    if (result.data.user || jwt) return result;

    // getUser() returned null without an explicit JWT — access token is likely
    // expired. Attempt a session refresh using the refresh token from cookies.
    console.debug("[supabase-server] getUser() returned null — attempting refreshSession()");
    const { data: { session }, error: refreshError } = await client.auth.refreshSession();
    if (refreshError) {
      console.debug("[supabase-server] refreshSession() failed:", refreshError.message);
      return result; // Return original null result
    }
    if (session?.user) {
      console.debug("[supabase-server] refreshSession() succeeded — session restored");
      return { data: { user: session.user }, error: null };
    }
    return result;
  };

  return client;
}

/**
 * Admin client using service_role key — use ONLY in server actions / API routes.
 * Uses createClient (NOT createServerClient) so the service role key is used
 * directly as the auth token.  createServerClient piggybacks on cookie-based
 * sessions, which means the user's JWT takes precedence and RLS still applies.
 */
export async function createAdminSupabaseClient() {
  return createClient(
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
