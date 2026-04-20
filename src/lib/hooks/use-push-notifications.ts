"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useNotificationsStore } from "@/store/notifications.store";

// VAPID public key for push subscription
// In production, generate with: npx web-push generate-vapid-keys
// For now, we use a placeholder that works for service worker registration
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

// Push permission states - explicit union type to include all possible values
export type PushPermissionState = "default" | "granted" | "denied" | "unsupported";

interface UsePushNotificationsReturn {
  permission: PushPermissionState;
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  showNotification: (title: string, options?: NotificationOptions) => void;
  setAppBadge: (count: number) => Promise<void>;
  clearAppBadge: () => Promise<void>;
}

/**
 * Hook for managing push notification subscriptions and displaying notifications.
 * 
 * Usage:
 * ```tsx
 * const { permission, subscribe, isSubscribed } = usePushNotifications();
 * 
 * if (permission === "default") {
 *   return <Button onClick={subscribe}>Enable Notifications</Button>;
 * }
 * ```
 */
export function usePushNotifications(): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<PushPermissionState>("default" as PushPermissionState);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUser = useAuthStore((s) => s.currentUser);
  const currentUserRole = currentUser?.role;
  const employees = useEmployeesStore((s) => s.employees);
  const logs = useNotificationsStore((s) => s.logs);
  const lastLogRef = useRef<string | null>(null);

  // Check if push notifications are supported
  const isSupported = typeof window !== "undefined" && 
    "serviceWorker" in navigator && 
    "PushManager" in window &&
    "Notification" in window;

  // Initialize permission state and service worker
  useEffect(() => {
    if (!isSupported) {
      setPermission("unsupported");
      return;
    }

    // Get current permission - explicitly handle all cases
    const currentPermission = Notification.permission;
    if (currentPermission === "denied") {
      setPermission("denied");
    } else if (currentPermission === "granted") {
      setPermission("granted");
    } else {
      setPermission("default");
    }

    // Register service worker
    navigator.serviceWorker.register("/sw.js")
      .then((registration) => {
        swRegistrationRef.current = registration;
        console.log("[push] Service worker registered:", registration.scope);

        // Check if already subscribed
        return registration.pushManager.getSubscription();
      })
      .then((subscription) => {
        setIsSubscribed(!!subscription);
        if (subscription) {
          console.log("[push] Existing subscription found");
        }
      })
      .catch((err) => {
        console.error("[push] Service worker registration failed:", err);
        setError("Failed to initialize push notifications");
      });
  }, [isSupported]);

  // Watch for new notifications and show browser notification
  useEffect(() => {
    if (!isSupported || permission !== "granted" || !isAuthenticated) return;
    if (logs.length === 0) return;

    // Resolve the current user's EMP-prefixed employee ID
    const currentEmployeeId = employees.find(
      (e) => e.profileId === currentUser?.id || e.email?.toLowerCase() === currentUser?.email?.toLowerCase()
    )?.id;

    const latest = logs[0];
    if (!latest || latest.id === lastLogRef.current) return;
    
    // Only show notification for unread messages addressed to the current user
    if (latest.read) return;
    if (currentEmployeeId && latest.employeeId !== currentEmployeeId) return;
    
    lastLogRef.current = latest.id;

    // Show browser notification for new notification logs
    // Prepend role prefix so the service worker navigates to the correct [role]/ route
    const rawLink = latest.link || "/notifications";
    const rolePrefix = currentUserRole ? `/${currentUserRole}` : "";
    const fullUrl = rawLink.startsWith("/") && !rawLink.startsWith(rolePrefix)
      ? `${rolePrefix}${rawLink}`
      : rawLink;
    showNotification(latest.subject, {
      body: latest.body,
      tag: latest.id,
      data: { url: fullUrl },
    });
  }, [logs, permission, isSupported, isAuthenticated, employees, currentUser, currentUserRole]);

  /**
   * Request notification permission and subscribe to push.
   */
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError("Push notifications not supported");
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Run permission request and SW ready in parallel for faster subscribe
      const [permResult, registration] = await Promise.all([
        Notification.permission === "default"
          ? Notification.requestPermission()
          : Promise.resolve(Notification.permission),
        swRegistrationRef.current
          ? Promise.resolve(swRegistrationRef.current)
          : navigator.serviceWorker.ready,
      ]);

      if (permResult === "denied") {
        setPermission("denied");
        setError("Notification permission denied");
        setIsLoading(false);
        return false;
      }
      if (permResult !== "granted") {
        setPermission("default");
        setError("Permission not granted");
        setIsLoading(false);
        return false;
      }
      setPermission("granted");
      swRegistrationRef.current = registration;

      // Subscribe to push
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription && VAPID_PUBLIC_KEY) {
        // Create new subscription with VAPID key
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      } else if (!subscription) {
        // No VAPID key — just use local notifications
        console.log("[push] No VAPID key configured, using local notifications only");
        setIsSubscribed(true);
        setIsLoading(false);
        return true;
      }

      // Send subscription to server
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save subscription");
      }

      setIsSubscribed(true);
      console.log("[push] Subscribed successfully");
      return true;
    } catch (err) {
      console.error("[push] Subscribe error:", err);
      setError(err instanceof Error ? err.message : "Failed to subscribe");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  /**
   * Unsubscribe from push notifications.
   */
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    setIsLoading(true);
    setError(null);

    try {
      const registration = swRegistrationRef.current || await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove from server
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      setIsSubscribed(false);
      console.log("[push] Unsubscribed successfully");
      return true;
    } catch (err) {
      console.error("[push] Unsubscribe error:", err);
      setError(err instanceof Error ? err.message : "Failed to unsubscribe");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported]);

  /**
   * Show a local notification (doesn't require push subscription).
   */
  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || permission !== "granted") return;

    try {
      // Use service worker notification if available (better for PWA)
      if (swRegistrationRef.current) {
        // ServiceWorkerRegistration.showNotification has extended options
        swRegistrationRef.current.showNotification(title, {
          icon: "/android-chrome-192x192.png",
          badge: "/android-chrome-192x192.png",
          ...options,
        } as NotificationOptions);
      } else {
        // Fallback to regular Notification API
        new Notification(title, {
          icon: "/android-chrome-192x192.png",
          ...options,
        });
      }
    } catch (err) {
      console.error("[push] Show notification error:", err);
    }
  }, [isSupported, permission]);

  /**
   * Set the app badge count (PWA icon badge on Android/iOS).
   * Works on Android and iOS 16.4+ when app is added to home screen.
   */
  const setAppBadge = useCallback(async (count: number): Promise<void> => {
    // Try navigator API first (works in main thread)
    if ("setAppBadge" in navigator) {
      try {
        if (count > 0) {
          await (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(count);
        } else {
          await (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge();
        }
        return;
      } catch (err) {
        console.warn("[push] Failed to set app badge via navigator:", err);
      }
    }

    // Fallback to service worker message
    if (swRegistrationRef.current?.active) {
      const channel = new MessageChannel();
      swRegistrationRef.current.active.postMessage(
        { type: "SET_BADGE", payload: { count } },
        [channel.port2]
      );
    }
  }, []);

  /**
   * Clear the app badge.
   */
  const clearAppBadge = useCallback(async (): Promise<void> => {
    if ("clearAppBadge" in navigator) {
      try {
        await (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge();
        return;
      } catch (err) {
        console.warn("[push] Failed to clear app badge:", err);
      }
    }

    // Fallback to service worker message
    if (swRegistrationRef.current?.active) {
      const channel = new MessageChannel();
      swRegistrationRef.current.active.postMessage(
        { type: "CLEAR_BADGE", payload: {} },
        [channel.port2]
      );
    }
  }, []);

  return {
    permission,
    isSupported,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    showNotification,
    setAppBadge,
    clearAppBadge,
  };
}

/**
 * Convert a base64 string to Uint8Array for applicationServerKey.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
