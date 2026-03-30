import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    // Swallow network errors (ECONNRESET, AbortError) — treat as unauthenticated
    const isNetworkError =
      err instanceof Error &&
      (err.name === "AbortError" || (err as NodeJS.ErrnoException).code === "ECONNRESET");
    if (!isNetworkError) {
      console.error("[proxy] Unexpected auth error:", err);
    }
    user = null;
  }

  // Redirect unauthenticated users to login (except for public routes)
  const publicPaths = ["/login", "/kiosk"];
  const isPublic = publicPaths.some((p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
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
     * - API routes for webhooks/notifications
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$|api/notifications).*)",
  ],
};
