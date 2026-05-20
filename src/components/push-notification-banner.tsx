"use client";

import { useEffect, useState } from "react";
import { PushNotificationPrompt } from "@/components/push-notification-prompt";
import { usePushNotifications } from "@/lib/hooks/use-push-notifications";
import { useAppBadge } from "@/lib/hooks/use-app-badge";

/**
 * Service worker initializer + push notification banner + app badge sync.
 * Shows a banner prompting users to enable push notifications
 * after login, if they haven't enabled them yet.
 * Also keeps the PWA app badge in sync with unread notification count.
 */
export function PushNotificationBanner() {
  const [dismissedSession, setDismissedSession] = useState(false);
  const { permission, isSupported, isSubscribed } = usePushNotifications();
  
  // Initialize app badge sync (works on Android PWA and iOS 16.4+ PWA)
  useAppBadge();

  const dismissedPersisted =
    typeof window !== "undefined" &&
    localStorage.getItem("push-prompt-dismissed") === "true";

  const showBanner =
    !dismissedSession &&
    !dismissedPersisted &&
    isSupported &&
    permission === "default" &&
    !isSubscribed;

  const handleDismiss = () => {
    setDismissedSession(true);
  };

  if (!showBanner) return null;

  return (
    <PushNotificationPrompt
      variant="banner"
      onDismiss={handleDismiss}
    />
  );
}
