/**
 * Tests for src/lib/rate-limit.ts
 *
 * Covers:
 * - Sliding window counting
 * - Burst blocking + remaining calculation
 * - Window expiry and reset
 * - Multi-key isolation
 * - reset() clears state
 */

import { createRateLimiter, getClientIp, type RateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  let limiter: RateLimiter;

  afterEach(() => {
    limiter?.reset();
  });

  it("allows requests under the limit", () => {
    limiter = createRateLimiter({ windowMs: 60_000, max: 5 });
    const result = limiter.check("192.168.1.1");
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("counts requests correctly", () => {
    limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    expect(limiter.check("ip1").remaining).toBe(2);
    expect(limiter.check("ip1").remaining).toBe(1);
    expect(limiter.check("ip1").remaining).toBe(0);
  });

  it("blocks when limit is reached", () => {
    limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    limiter.check("ip1"); // 1
    limiter.check("ip1"); // 2
    const blocked = limiter.check("ip1"); // 3 → blocked
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetMs).toBeGreaterThan(0);
  });

  it("isolates different keys", () => {
    limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    limiter.check("ip-a");
    // ip-a is now exhausted
    expect(limiter.check("ip-a").ok).toBe(false);
    // ip-b should be fine
    expect(limiter.check("ip-b").ok).toBe(true);
  });

  it("expires old timestamps from window", () => {
    jest.useFakeTimers();
    try {
      limiter = createRateLimiter({ windowMs: 1000, max: 2 });
      limiter.check("ip1"); // t=0
      limiter.check("ip1"); // t=0 → full

      expect(limiter.check("ip1").ok).toBe(false);

      // Advance past window
      jest.advanceTimersByTime(1001);

      // Window expired, should allow again
      const result = limiter.check("ip1");
      expect(result.ok).toBe(true);
      expect(result.remaining).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("reset() clears all state", () => {
    limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    limiter.check("ip1");
    expect(limiter.check("ip1").ok).toBe(false);

    limiter.reset();
    expect(limiter.check("ip1").ok).toBe(true);
  });

  it("uses default options (60 req/min)", () => {
    limiter = createRateLimiter();
    // Should allow 60 requests
    for (let i = 0; i < 60; i++) {
      expect(limiter.check("ip1").ok).toBe(true);
    }
    expect(limiter.check("ip1").ok).toBe(false);
  });

  it("returns positive resetMs when blocked", () => {
    jest.useFakeTimers();
    try {
      limiter = createRateLimiter({ windowMs: 5000, max: 1 });
      limiter.check("ip1"); // fills the window
      const blocked = limiter.check("ip1");
      expect(blocked.ok).toBe(false);
      expect(blocked.resetMs).toBeGreaterThan(0);
      expect(blocked.resetMs).toBeLessThanOrEqual(5000);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("getClientIp", () => {
  function makeRequest(headers: Record<string, string>): Request {
    return {
      headers: new Headers(headers),
    } as unknown as Request;
  }

  it("extracts IP from x-forwarded-for (first entry)", () => {
    const req = makeRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("extracts single x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "10.0.0.1" });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("falls back to x-real-ip", () => {
    const req = makeRequest({ "x-real-ip": "172.16.0.1" });
    expect(getClientIp(req)).toBe("172.16.0.1");
  });

  it("returns unknown when no IP headers", () => {
    const req = makeRequest({});
    expect(getClientIp(req)).toBe("unknown");
  });

  it("prefers x-forwarded-for over x-real-ip", () => {
    const req = makeRequest({
      "x-forwarded-for": "1.1.1.1",
      "x-real-ip": "2.2.2.2",
    });
    expect(getClientIp(req)).toBe("1.1.1.1");
  });
});
