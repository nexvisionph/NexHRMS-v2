"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useLocationStore } from "@/store/location.store";
import * as locationService from "@/services/location-actions.service";
import { useProjectsStore } from "@/store/projects.store";
import { isWithinGeofence } from "@/lib/geofence";
import { notifyGeofenceViolation, notifyLocationDisabled } from "@/lib/notifications";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { MapPin, MapPinOff, Loader2 } from "lucide-react";

interface LocationTrackerProps {
    employeeId: string;
    employeeName: string;
    employeeEmail?: string;
    active: boolean; // whether tracking should be running (checked in)
}

export function LocationTracker({ employeeId, employeeName, employeeEmail, active }: LocationTrackerProps) {
    const config = useLocationStore((s) => s.config);
    const purgeOldPings = useLocationStore((s) => s.purgeOldPings);
    const getProjectForEmployee = useProjectsStore((s) => s.getProjectForEmployee);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [trackingActive, setTrackingActive] = useState(false);
    const [lastPing, setLastPing] = useState<string | null>(null);
    const [gpsError, setGpsError] = useState(false);

    const doPing = useCallback(() => {
        if (!("geolocation" in navigator)) {
            setGpsError(true);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGpsError(false);
                const { latitude: lat, longitude: lng, accuracy } = pos.coords;
                const project = getProjectForEmployee(employeeId);
                let within = true;
                let distance: number | undefined;
                let projectId: string | undefined;

                if (project) {
                    projectId = project.id;
                    const result = isWithinGeofence(lat, lng, project.location.lat, project.location.lng, project.location.radius);
                    within = result.within;
                    distance = result.distanceMeters;

                    if (!within && config.warnEmployeeOutOfFence) {
                        toast.warning(`You are ${distance}m from your work site`, { duration: 5000 });
                    }
                    if (!within && config.alertAdminOutOfFence) {
                        notifyGeofenceViolation({
                            employeeId,
                            employeeName,
                            employeeEmail: employeeEmail || "",
                            distance: distance ?? 0,
                            time: new Date().toLocaleTimeString(),
                        });
                    }
                }

                locationService.addPing({
                    employeeId,
                    timestamp: new Date().toISOString(),
                    lat,
                    lng,
                    accuracyMeters: accuracy,
                    withinGeofence: within,
                    projectId,
                    distanceFromSite: distance,
                    source: "auto",
                });
                setLastPing(new Date().toLocaleTimeString());
            },
            () => {
                setGpsError(true);
                if (config.alertAdminLocationDisabled) {
                    notifyLocationDisabled({
                        employeeId,
                        employeeName,
                        time: new Date().toLocaleTimeString(),
                    });
                }
                if (config.requireLocation) {
                    toast.error("Location is required. Please enable GPS.", { duration: 8000 });
                }
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
        );
    }, [employeeId, employeeName, employeeEmail, config, getProjectForEmployee]);

    useEffect(() => {
        if (!config.enabled || !active) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        // Defer initial ping to avoid synchronous setState in effect body
        const initTimer = setTimeout(() => {
            doPing();
            purgeOldPings();
            setTrackingActive(true);
        }, 0);

        // Set interval
        const ms = config.pingIntervalMinutes * 60 * 1000;
        intervalRef.current = setInterval(doPing, ms);

        return () => {
            clearTimeout(initTimer);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [config.enabled, config.pingIntervalMinutes, active, doPing, purgeOldPings]);

    if (!config.enabled || !active) return null;

    return (
        <div className="flex items-center gap-1.5">
            {gpsError ? (
                <Badge variant="destructive" className="gap-1 text-[10px] py-0.5">
                    <MapPinOff className="h-3 w-3" /> GPS Off
                </Badge>
            ) : trackingActive ? (
                <Badge variant="secondary" className="gap-1 text-[10px] py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                    <MapPin className="h-3 w-3" /> Tracking
                    {lastPing && <span className="ml-1 opacity-60">{lastPing}</span>}
                </Badge>
            ) : (
                <Badge variant="secondary" className="gap-1 text-[10px] py-0.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Starting...
                </Badge>
            )}
        </div>
    );
}
