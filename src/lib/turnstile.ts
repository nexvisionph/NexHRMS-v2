"use server";

import "server-only";
import { headers } from "next/headers";
import { getTurnstileSecretKey } from "@/lib/env";

type TurnstileSiteVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
};

export async function verifyTurnstileToken(token?: string | null) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.NODE_ENV === "test") {
    return { ok: true as const };
  }

  if (!token) {
    return { ok: false as const, error: "Please complete the security check." };
  }

  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const remoteIp = forwardedFor?.split(",")[0]?.trim();

  const formData = new FormData();
  formData.append("secret", getTurnstileSecretKey());
  formData.append("response", token);
  if (remoteIp) formData.append("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      return { ok: false as const, error: "Security check unavailable. Please try again." };
    }

    const result = (await response.json()) as TurnstileSiteVerifyResponse;
    if (!result.success) {
      console.warn("[turnstile] verification failed", result["error-codes"]);
      return { ok: false as const, error: "Security check failed. Please try again." };
    }

    return { ok: true as const };
  } catch (error) {
    console.error("[turnstile] verification error", error);
    return { ok: false as const, error: "Security check unavailable. Please try again." };
  }
}
