"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Check, X, Smartphone, AlertCircle } from "lucide-react";
import { usePushNotifications, type PushPermissionState } from "@/lib/hooks/use-push-notifications";
import { cn } from "@/lib/utils";

interface PushNotificationPromptProps {
  variant?: "banner" | "card" | "inline";
  className?: string;
  onDismiss?: () => void;
}

/**
 * Prompt component for enabling push notifications.
 * 
 * Variants:
 * - banner: Full-width banner at the top of the page
 * - card: Card-style prompt for settings pages
 * - inline: Compact inline button
 */
export function PushNotificationPrompt({
  variant = "card",
  className,
  onDismiss,
}: PushNotificationPromptProps) {
  const {
    permission: rawPermission,
    isSupported,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotifications();
  
  // Explicitly type permission to include all possible values
  const permission = rawPermission as PushPermissionState;
  const isDenied = permission === "denied";
  
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
    // Remember dismissal in localStorage
    localStorage.setItem("push-prompt-dismissed", "true");
  };

  // Don't render if not supported or dismissed (but show denied state)
  if (!isSupported || dismissed) {
    return null;
  }

  if (variant === "inline") {
    if (isDenied) {
      return (
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2 cursor-not-allowed opacity-50", className)}
          disabled
        >
          <Bell className="h-4 w-4" />
          Blocked by Browser
        </Button>
      );
    }
    
    if (isSubscribed) {
      return (
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2", className)}
          onClick={unsubscribe}
          disabled={isLoading}
        >
          <BellOff className="h-4 w-4" />
          Disable Notifications
        </Button>
      );
    }

    return (
      <Button
        variant={permission === "default" ? "default" : "outline"}
        size="sm"
        className={cn("gap-2", className)}
        onClick={subscribe}
        disabled={isLoading}
      >
        <Bell className="h-4 w-4" />
        {isLoading ? "Enabling..." : "Enable Notifications"}
      </Button>
    );
  }

  if (variant === "banner") {
    if (isSubscribed) return null;

    return (
      <div className={cn(
        "fixed bottom-5 right-5 z-50 w-[300px] animate-in slide-in-from-bottom-4 fade-in duration-300",
        "rounded-xl border border-border/60 bg-background/80 backdrop-blur-md shadow-lg shadow-black/10",
        className
      )}>
        <div className="flex items-start gap-3 p-3.5">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Bell className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-tight">Stay in the loop</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Enable push notifications for instant alerts.
            </p>
            <div className="flex items-center gap-2 mt-2.5">
              <Button
                size="sm"
                onClick={subscribe}
                disabled={isLoading}
                className="h-7 px-3 text-xs gap-1.5"
              >
                <Bell className="h-3 w-3" />
                {isLoading ? "Enabling…" : "Enable"}
              </Button>
              <button
                onClick={handleDismiss}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground/60 hover:text-muted-foreground transition-colors shrink-0 mt-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // Card variant (default)
  return (
    <Card className={cn("border-primary/20 bg-primary/5", className)}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            {isSubscribed ? (
              <Check className="h-6 w-6 text-primary" />
            ) : isDenied ? (
              <AlertCircle className="h-6 w-6 text-destructive" />
            ) : (
              <Smartphone className="h-6 w-6 text-primary" />
            )}
          </div>
          
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Push Notifications</h3>
              {isSubscribed && (
                <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-700 dark:text-green-400">
                  Enabled
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {isSubscribed
                ? "You'll receive notifications even when the app is closed."
                : isDenied
                ? "Notifications are blocked. Enable them in your browser settings."
                : "Get instant updates about approvals, payslips, tasks, and more — even when you're not in the app."}
            </p>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            {isSubscribed ? (
              <Button
                variant="outline"
                size="sm"
                onClick={unsubscribe}
                disabled={isLoading}
                className="gap-1.5"
              >
                <BellOff className="h-4 w-4" />
                Disable
              </Button>
            ) : !isDenied ? (
              <>
                <Button
                  size="sm"
                  onClick={subscribe}
                  disabled={isLoading}
                  className="gap-1.5"
                >
                  <Bell className="h-4 w-4" />
                  {isLoading ? "Enabling..." : "Enable"}
                </Button>
                {onDismiss && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDismiss}
                    className="text-muted-foreground"
                  >
                    Later
                  </Button>
                )}
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Open browser notification settings
                  if ('permissions' in navigator) {
                    // Try to open settings (not all browsers support this)
                    alert("Please enable notifications in your browser settings for this site.");
                  }
                }}
              >
                Open Settings
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Small notification bell button with status indicator.
 * Use in topbar or header for quick access.
 */
export function PushNotificationButton({ className }: { className?: string }) {
  const { permission: rawPerm, isSubscribed, isLoading, subscribe, unsubscribe } = usePushNotifications();
  
  // Capture denied state before any early returns
  const isDenied = rawPerm === "denied";

  if (rawPerm === "unsupported") return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative", className)}
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={isLoading || isDenied}
      title={
        isDenied
          ? "Notifications blocked"
          : isSubscribed
          ? "Disable notifications"
          : "Enable notifications"
      }
    >
      {isSubscribed ? (
        <Bell className="h-5 w-5 text-primary" />
      ) : (
        <BellOff className="h-5 w-5 text-muted-foreground" />
      )}
      {/* Status indicator */}
      <span
        className={cn(
          "absolute right-1 top-1 h-2 w-2 rounded-full",
          isSubscribed
            ? "bg-green-500"
            : isDenied
            ? "bg-red-500"
            : "bg-amber-500"
        )}
      />
    </Button>
  );
}
