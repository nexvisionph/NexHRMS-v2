"use client";

import { useEffect, useCallback, useRef } from "react";
import { useNotificationsStore } from "@/store/notifications.store";
import { useAuthStore } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";

/**
 * Hook that automatically syncs the PWA app badge with the unread notification count.
 * 
 * Works on:
 * - Android: PWA added to home screen
 * - iOS 16.4+: PWA added to home screen in Safari
 * - Desktop: Chrome, Edge (limited support)
 * 
 * Usage:
 * ```tsx
 * // In your app layout or root component
 * useAppBadge();
 * ```
 */
export function useAppBadge() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const employees = useEmployeesStore((s) => s.employees);
  const getUnreadCountForEmployee = useNotificationsStore((s) => s.getUnreadCountForEmployee);
  const logs = useNotificationsStore((s) => s.logs);
  
  const swRef = useRef<ServiceWorkerRegistration | null>(null);
  const lastCountRef = useRef<number>(0);

  // Check if badge API is supported
  const isBadgeSupported = typeof window !== "undefined" && "setAppBadge" in navigator;

  // Find current user's employee ID
  const currentEmployeeId = employees.find(
    (e) => e.profileId === currentUser?.id || e.email?.toLowerCase() === currentUser?.email?.toLowerCase()
  )?.id;

  // Set the badge count
  const setBadge = useCallback(async (count: number) => {
    // Avoid unnecessary updates
    if (count === lastCountRef.current) return;
    lastCountRef.current = count;

    // Try navigator API first
    if (isBadgeSupported) {
      try {
        if (count > 0) {
          await (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(count);
        } else {
          await (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge();
        }
        return;
      } catch (err) {
        // Badge API not available in this context, try service worker
        console.debug("[badge] Navigator badge API failed, trying service worker:", err);
      }
    }

    // Fallback to service worker
    if (swRef.current?.active) {
      swRef.current.active.postMessage({
        type: count > 0 ? "SET_BADGE" : "CLEAR_BADGE",
        payload: { count },
      });
    }
  }, [isBadgeSupported]);

  // Register service worker on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((registration) => {
      swRef.current = registration;
    }).catch((err) => {
      console.debug("[badge] Service worker not ready:", err);
    });
  }, []);

  // Sync badge with unread count whenever logs change
  useEffect(() => {
    if (!currentEmployeeId) {
      // Clear badge when logged out
      setBadge(0);
      return;
    }

    const unreadCount = getUnreadCountForEmployee(currentEmployeeId);
    setBadge(unreadCount);
  }, [currentEmployeeId, logs, getUnreadCountForEmployee, setBadge]);

  // Clear badge on unmount (app close)
  useEffect(() => {
    return () => {
      if (isBadgeSupported) {
        (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge().catch(() => {});
      }
    };
  }, [isBadgeSupported]);

  return { setBadge, isBadgeSupported };
}
