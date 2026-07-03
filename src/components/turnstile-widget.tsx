"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          theme?: "auto" | "light" | "dark";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

type TurnstileWidgetProps = {
  siteKey: string;
  theme?: "auto" | "light" | "dark";
  className?: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
};

export function resetTurnstileWidget() {
  window.turnstile?.reset();
}

export function TurnstileWidget({
  siteKey,
  theme = "auto",
  className,
  onVerify,
  onExpire,
  onError,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (!siteKey || !scriptReady || !containerRef.current || widgetIdRef.current) {
      return;
    }

    const renderWidget = () => {
      if (!containerRef.current || widgetIdRef.current || !window.turnstile) return false;

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        callback: onVerify,
        "expired-callback": onExpire,
        "error-callback": onError,
      });
      return true;
    };

    let intervalId: number | undefined;
    if (!renderWidget()) {
      intervalId = window.setInterval(() => {
        if (renderWidget() && intervalId) window.clearInterval(intervalId);
      }, 100);
    }

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onError, onExpire, onVerify, scriptReady, siteKey, theme]);

  if (!siteKey) return null;

  return (
    <div className={cn("flex min-h-[65px] justify-center overflow-hidden", className)}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        async
        defer
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} />
    </div>
  );
}
