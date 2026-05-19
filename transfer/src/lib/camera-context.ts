const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

export function isLoopbackHostname(hostname: string): boolean {
    return LOOPBACK_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost");
}

export function canUseCamera(windowLike: Pick<Window, "isSecureContext" | "location">): boolean {
    // Primary check: the browser only exposes navigator.mediaDevices.getUserMedia
    // in secure contexts (HTTPS) AND on localhost — so this is the most accurate
    // feature-detection. It works for both localhost dev and Vercel (HTTPS).
    if (typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function") {
        return true;
    }
    // Fallback for environments where navigator is not yet available (SSR guard)
    return Boolean(windowLike.isSecureContext || isLoopbackHostname(windowLike.location.hostname));
}

export function cameraHttpsHint(pagePath?: string): string {
    const pageSegment = pagePath ? ` and open ${pagePath}` : "";
    return `Camera access requires a secure context. On Vercel (HTTPS) this works automatically. On localhost, navigate to http://localhost:3000${pageSegment} (not an IP address or 0.0.0.0).`;
}
