import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccessRoute } from "@/lib/permissions-server";

/**
 * Check if an error is an auth/refresh token error.
 * These are expected when sessions expire and should be handled silently.
 */
function isAuthError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { code?: string; message?: string; __isAuthError?: boolean };
  return Boolean(
    err.__isAuthError === true ||
    err.code === "refresh_token_not_found" ||
    err.message?.includes("Refresh Token") ||
    err.message?.includes("Invalid Refresh Token") ||
    err.message?.includes("AuthApiError")
  );
}

// Suppress auth errors from polluting server logs.
// The actual error handling is done in the proxy function below.
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  // Check if this is an auth-related error we should suppress
  for (const arg of args) {
    if (isAuthError(arg)) return;
    if (typeof arg === "string" && 
        (arg.includes("Refresh Token") || 
         arg.includes("AuthApiError") ||
         arg.includes("refresh_token_not_found") ||
         arg.includes("Invalid Refresh Token"))) {
      return;
    }
  }
  originalConsoleError.apply(console, args);
};

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isDemoMode) {
      // In demo mode, skip Supabase auth — client-side Zustand handles it
      return supabaseResponse;
    }
    // In production, missing env vars means we can't authenticate — block access
    const isPublicPath = ["/login", "/kiosk"].some(
      (p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(p + "/")
    );
    if (!isPublicPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Public routes — skip the expensive Supabase auth round-trip entirely.
  // This eliminates ~200-1000ms of latency for /login, /kiosk, and API routes.
  const publicPaths = ["/login", "/kiosk", "/api/"];
  const isPublic = publicPaths.some(
    (p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(p.endsWith("/") ? p : p + "/")
  );

  // If the user has no Supabase auth cookies at all, they definitely have no
  // session — skip the auth check and redirect to login immediately.
  const hasAuthCookies = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));

  if (isPublic || !hasAuthCookies) {
    if (!isPublic && !hasAuthCookies) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired — wrap in try/catch so ECONNRESET / AbortError
  // during HMR or browser navigation doesn't crash the dev server.
  let user: { id: string } | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    
    // Handle refresh token errors explicitly
    if (error) {
      const isRefreshTokenError = 
        error.code === "refresh_token_not_found" ||
        error.message?.includes("Refresh Token") ||
        error.message?.includes("Invalid Refresh Token");
      
      if (isRefreshTokenError) {
        // Silently clear cookies - this is expected for expired sessions
        for (const cookie of request.cookies.getAll()) {
          if (cookie.name.startsWith("sb-")) {
            supabaseResponse.cookies.delete(cookie.name);
          }
        }
        user = null;
      } else {
        // Log other auth errors but treat as unauthenticated
        console.warn("[proxy] Auth error:", error.message);
        user = null;
      }
    } else {
      user = data.user;
    }
  } catch (err) {
    // Swallow network errors (ECONNRESET, AbortError) — treat as unauthenticated
    const isNetworkError =
      err instanceof Error &&
      (err.name === "AbortError" || (err as NodeJS.ErrnoException).code === "ECONNRESET");
    // Swallow Supabase auth errors (expired/invalid refresh token) — treat as
    // unauthenticated.  Also clear the stale Supabase auth cookies so the
    // failed refresh doesn't repeat on every subsequent request.
    const isAuthError =
      err != null && typeof err === "object" && "__isAuthError" in err;
    
    // Check if thrown error is a refresh token error (by code or message)
    const errObj = err as { code?: string; message?: string };
    const isRefreshTokenError =
      errObj.code === "refresh_token_not_found" ||
      errObj.message?.includes("Refresh Token") || 
      errObj.message?.includes("refresh_token_not_found") ||
      errObj.message?.includes("Invalid Refresh Token");
    
    if (isAuthError || isRefreshTokenError) {
      // Silently clear cookies - this is expected for expired sessions
      for (const cookie of request.cookies.getAll()) {
        if (cookie.name.startsWith("sb-")) {
          supabaseResponse.cookies.delete(cookie.name);
        }
      }
    } else if (!isNetworkError) {
      console.error("[proxy] Unexpected auth error:", err);
    }
    user = null;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // ─── Server-side Permission Enforcement ───────────────────────────────────
  // Fetch user's role from Supabase and check if they can access this route.
  // This prevents malicious users from bypassing client-side permission checks.
  const pathname = request.nextUrl.pathname;
  
  // Skip permission check for API routes (they have their own auth)
  if (!pathname.startsWith("/api/")) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const userRole = profile?.role || "employee";
      const access = canAccessRoute(userRole, pathname);

      if (!access.allowed) {
        // User doesn't have permission - redirect to their dashboard
        const dashboardUrl = request.nextUrl.clone();
        dashboardUrl.pathname = `/${userRole}/dashboard`;
        dashboardUrl.searchParams.set("access_denied", "1");
        return NextResponse.redirect(dashboardUrl);
      }
    } catch (permErr) {
      // Non-fatal: if permission check fails, allow access (fail open for now)
      // In production, you might want to fail closed instead
      console.error("[proxy] Permission check failed:", permErr);
    }
  }

  // NOTE: We intentionally do NOT redirect authenticated users away from /login.
  // The client-side login page handles this, and blocking /login in middleware
  // causes infinite redirect loops when Zustand and Supabase session disagree.

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder assets
     * - models folder (face-api models)
     * - API routes for webhooks/notifications
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest|woff2?)$|models/|api/notifications).*)",
  ],
};
