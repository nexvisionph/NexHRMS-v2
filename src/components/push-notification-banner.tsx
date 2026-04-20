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
  const [showBanner, setShowBanner] = useState(false);
  const { permission, isSupported, isSubscribed } = usePushNotifications();
  
  // Initialize app badge sync (works on Android PWA and iOS 16.4+ PWA)
  useAppBadge();

  useEffect(() => {
    // Check if banner was dismissed
    const dismissed = localStorage.getItem("push-prompt-dismissed") === "true";
    
    // Show banner immediately if:
    // - Push is supported
    // - Permission not denied
    // - Not already subscribed
    // - Not previously dismissed
    if (isSupported && permission === "default" && !isSubscribed && !dismissed) {
      setShowBanner(true);
    }
  }, [isSupported, permission, isSubscribed]);

  const handleDismiss = () => {
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <PushNotificationPrompt
      variant="banner"
      onDismiss={handleDismiss}
    />
  );
}
