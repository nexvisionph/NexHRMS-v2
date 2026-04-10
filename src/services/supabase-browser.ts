import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseUrl, getSupabaseAnonKey } from "@/lib/env";
import type { AuthChangeEvent, Session, AuthError, SupabaseClient } from "@supabase/supabase-js";

let _client: ReturnType<typeof createBrowserClient> | null = null;
let _initPromise: Promise<void> | null = null;

/**
 * Check if an error is a refresh token error (safe for any error type).
 */
function isRefreshTokenError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { code?: string; message?: string; name?: string };
  return Boolean(
    err.code === "refresh_token_not_found" ||
    err.name === "AuthApiError" ||
    err.message?.includes("Refresh Token") ||
    err.message?.includes("Invalid Refresh Token") ||
    err.message?.includes("refresh_token_not_found")
  );
}

/**
 * Clear all Supabase auth storage (cookies + localStorage).
 * Call this when encountering an unrecoverable auth error (refresh_token_not_found).
 */
export function clearAuthStorage() {
  // Clear localStorage keys set by Supabase
  if (typeof window !== "undefined") {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes("supabase") || key.includes("sb-"))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));

    // Clear Supabase auth cookies (pattern: sb-<project-ref>-auth-token*)
    document.cookie.split(";").forEach((c) => {
      const name = c.trim().split("=")[0];
      if (name.startsWith("sb-") && name.includes("auth")) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    });
  }
}

/**
 * Safely get the current session, suppressing refresh token errors.
 * Returns null if session is invalid or expired.
 */
export async function safeGetSession(client: SupabaseClient): Promise<Session | null> {
  try {
    const { data, error } = await client.auth.getSession();
    if (error) {
      if (isRefreshTokenError(error)) {
        // Silently handle - this is expected for expired sessions
        return null;
      }
      // Log unexpected errors
      console.warn("[Auth] getSession error:", error.message);
      return null;
    }
    return data.session;
  } catch (err) {
    // Catch thrown errors (some Supabase versions throw instead of returning error)
    if (isRefreshTokenError(err)) {
      return null;
    }
    console.warn("[Auth] getSession exception:", err);
    return null;
  }
}

/**
 * Initialize the Supabase client and validate the session.
 * Handles auth errors silently and clears stale auth data.
 */
async function initializeClient(client: SupabaseClient): Promise<void> {
  const session = await safeGetSession(client);
  
  if (!session) {
    // No valid session - clear any stale auth data
    clearAuthStorage();
    
    // Redirect to login if not already there
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/kiosk")) {
      window.location.href = "/login";
    }
  }
}

/**
 * Singleton Supabase browser client.
 * Re-using a single instance avoids duplicate token-refresh attempts
 * (which cause repeated "Refresh Token Not Found" errors when the
 * session is stale) and reduces connection overhead.
 * 
 * Includes automatic handling of invalid refresh tokens:
 * - Clears stale auth storage
 * - Listeners for TOKEN_REFRESHED failures
 */
export function createClient() {
  if (!_client) {
    _client = createBrowserClient(
      getSupabaseUrl(),
      getSupabaseAnonKey()
    );

    // Set up global auth error handling
    _client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      // If a token refresh happened but returned no session, the refresh token is invalid
      if (event === "TOKEN_REFRESHED" && !session) {
        console.info("[Auth] Token refresh returned no session — clearing stale auth");
        clearAuthStorage();
      }
      // SIGNED_OUT should also clear storage to prevent stale token reuse
      if (event === "SIGNED_OUT") {
        clearAuthStorage();
      }
    });

    // Initialize and validate session (fire and forget, errors handled internally)
    _initPromise = initializeClient(_client);
  }
  return _client;
}

/**
 * Wait for client initialization to complete.
 * Useful when you need to ensure the session check is done.
 */
export async function waitForInit(): Promise<void> {
  if (_initPromise) {
    await _initPromise;
  }
}

/**
 * Reset the singleton client (useful after clearing auth storage).
 * Next call to createClient() will create a fresh instance.
 */
export function resetClient() {
  _client = null;
  _initPromise = null;
}

/**
 * Install global handlers to suppress auth errors from appearing in console.
 * Call this once at app startup.
 */
export function installAuthErrorSuppression() {
  if (typeof window === "undefined") return;

  // Suppress unhandled promise rejections for auth errors
  window.addEventListener("unhandledrejection", (event) => {
    if (isRefreshTokenError(event.reason)) {
      event.preventDefault(); // Prevent console error
      console.info("[Auth] Suppressed auth error:", event.reason?.message || "Refresh token invalid");
      clearAuthStorage();
      if (!window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/kiosk")) {
        window.location.href = "/login";
      }
    }
  });

  // Suppress global errors that are auth-related
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    // Check all arguments for auth error indicators
    for (const arg of args) {
      if (isRefreshTokenError(arg)) {
        // Suppress this error entirely
        return;
      }
      // Check string messages
      if (
        typeof arg === "string" &&
        (arg.includes("Refresh Token") || 
         arg.includes("AuthApiError") || 
         arg.includes("refresh_token_not_found") ||
         arg.includes("Invalid Refresh Token"))
      ) {
        return;
      }
    }
    originalError.apply(console, args);
  };
}

