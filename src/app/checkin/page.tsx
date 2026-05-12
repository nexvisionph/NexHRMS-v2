"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useAttendanceStore } from "@/store/attendance.store";
import { useEmployeesStore } from "@/store/employees.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, CheckCircle, LogIn, LogOut } from "lucide-react";

export default function SelfCheckInPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const employees = useEmployeesStore((s) => s.employees);
  const events = useAttendanceStore((s) => s.events);
  const appendEvent = useAttendanceStore((s) => s.appendEvent);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [locationError, setLocationError] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);
  const [message, setMessage] = useState("");

  // Find current employee
  const currentEmployee = employees.find(
    (e) => e.profileId === currentUser.id || e.email?.toLowerCase() === currentUser.email?.toLowerCase()
  );

  // Update clock
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Get GPS location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => setLocationError(err.message),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Today's events for this employee
  const today = new Date().toISOString().split("T")[0];
  const todayEvents = currentEmployee
    ? events.filter((e) => e.employeeId === currentEmployee.id && e.timestampUTC.startsWith(today) && (e.eventType === "IN" || e.eventType === "OUT"))
    : [];

  const lastEvent = todayEvents[todayEvents.length - 1];
  const isCheckedIn = lastEvent?.eventType === "IN";

  const handleCheckIn = async () => {
    if (!currentEmployee) return;
    setCheckingIn(true);

    const eventType = isCheckedIn ? "OUT" : "IN";

    appendEvent({
      employeeId: currentEmployee.id,
      eventType,
      timestampUTC: new Date().toISOString(),
      description: `Self check-${eventType === "IN" ? "in" : "out"} via mobile`,
      metadata: location ? { gpsLat: location.lat, gpsLng: location.lng, gpsAccuracy: location.accuracy } : undefined,
    });

    setMessage(`Successfully checked ${eventType === "IN" ? "in" : "out"} at ${new Date().toLocaleTimeString()}`);
    setCheckingIn(false);

    setTimeout(() => setMessage(""), 5000);
  };

  if (!currentEmployee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Please log in to use self-service check-in.</p>
            <Button className="mt-4" onClick={() => window.location.href = "/login"}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Self-Service Check-In</CardTitle>
          <p className="text-sm text-muted-foreground">{currentEmployee.name}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Clock */}
          <div className="text-center">
            <p className="text-4xl font-mono font-bold tabular-nums">
              {currentTime.toLocaleTimeString()}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {currentTime.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>

          {/* Status */}
          <div className="flex justify-center">
            <Badge variant={isCheckedIn ? "default" : "outline"} className="text-sm px-4 py-1">
              {isCheckedIn ? "Checked In" : "Not Checked In"}
            </Badge>
          </div>

          {/* Location */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {location ? (
              <span>GPS: {location.lat.toFixed(4)}, {location.lng.toFixed(4)} (±{Math.round(location.accuracy)}m)</span>
            ) : locationError ? (
              <span className="text-red-500">{locationError}</span>
            ) : (
              <span>Acquiring location...</span>
            )}
          </div>

          {/* Check-in/out Button */}
          <Button
            onClick={handleCheckIn}
            disabled={checkingIn}
            className="w-full h-14 text-lg"
            variant={isCheckedIn ? "outline" : "default"}
          >
            {isCheckedIn ? (
              <><LogOut className="h-5 w-5 mr-2" />Check Out</>
            ) : (
              <><LogIn className="h-5 w-5 mr-2" />Check In</>
            )}
          </Button>

          {/* Success Message */}
          {message && (
            <div className="flex items-center gap-2 text-green-600 justify-center">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">{message}</span>
            </div>
          )}

          {/* Today's Log */}
          {todayEvents.length > 0 && (
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">Today&apos;s Activity</p>
              <div className="space-y-1">
                {todayEvents.map((ev) => (
                  <div key={ev.id} className="flex justify-between text-sm">
                    <span className={ev.eventType === "IN" ? "text-green-600" : "text-red-600"}>
                      {ev.eventType === "IN" ? "Check In" : "Check Out"}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(ev.timestampUTC).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
