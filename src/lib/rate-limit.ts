/**
 * Simple in-memory sliding-window rate limiter for API routes.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 60 });
 *   // In API route:
 *   const rl = limiter.check(ip);
 *   if (!rl.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 *
 * Limitations:
 * - In-memory only — resets on deploy / cold start (acceptable for kiosk abuse prevention).
 * - Per-instance — does not share state across Vercel function instances.
 *   For production at scale, switch to Vercel KV or Upstash Redis.
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimiterOptions {
  /** Time window in milliseconds (default: 60 000 = 1 minute). */
  windowMs?: number;
  /** Maximum requests per window per key (default: 60). */
  max?: number;
}

interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetMs: number;
}

export interface RateLimiter {
  /** Check if a request key (usually IP) is within limits. */
  check(key: string): RateLimitResult;
  /** Reset all tracked entries (useful for tests). */
  reset(): void;
}

export function createRateLimiter(options?: RateLimiterOptions): RateLimiter {
  const windowMs = options?.windowMs ?? 60_000;
  const max = options?.max ?? 60;
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup every 5 minutes to prevent memory leaks
  let cleanupTimer: ReturnType<typeof setInterval> | null = null;
  if (typeof setInterval !== "undefined") {
    cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of store) {
        entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
        if (entry.timestamps.length === 0) store.delete(key);
      }
    }, 5 * 60_000);
    // Unref so it doesn't keep Node process alive
    if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
      cleanupTimer.unref();
    }
  }

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      let entry = store.get(key);
      if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
      }

      // Remove timestamps outside the window
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

      if (entry.timestamps.length >= max) {
        const oldest = entry.timestamps[0];
        return {
          ok: false,
          remaining: 0,
          resetMs: oldest + windowMs - now,
        };
      }

      entry.timestamps.push(now);
      return {
        ok: true,
        remaining: max - entry.timestamps.length,
        resetMs: windowMs,
      };
    },

    reset() {
      store.clear();
    },
  };
}

// ─── Shared kiosk limiter (singleton) ────────────────────────────────────────

/** Rate limiter for unauthenticated kiosk API routes: 60 req/min per IP. */
export const kioskRateLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

// ─── Helper to extract client IP from Next.js request ────────────────────────

export function getClientIp(request: Request): string {
  const headers = request.headers;
  // Vercel sets x-forwarded-for
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  // Fallback to x-real-ip
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  // Last resort
  return "unknown";
}
