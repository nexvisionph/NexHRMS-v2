"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocationStore } from "@/store/location.store";
import * as locationService from "@/services/location-actions.service";
import { useProjectsStore } from "@/store/projects.store";
import { isWithinGeofence } from "@/lib/geofence";
import { notifyGeofenceViolation } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { UtensilsCrossed, Play, Square, AlertTriangle, MapPin, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BreakTimerProps {
    employeeId: string;
    employeeName: string;
    employeeEmail?: string;
    disabled?: boolean;
}

export function BreakTimer({ employeeId, employeeName, employeeEmail, disabled }: BreakTimerProps) {
    const config = useLocationStore((s) => s.config);
    const { getActiveBreak, getBreaksToday } = useLocationStore();
    const getProjectForEmployee = useProjectsStore((s) => s.getProjectForEmployee);

    const activeBreak = getActiveBreak(employeeId);
    const todayBreaks = getBreaksToday(employeeId);
    const [elapsed, setElapsed] = useState(0);
    const [ending, setEnding] = useState(false);

    // Tick timer every second while on break
    useEffect(() => {
        if (!activeBreak) { return; }
        const tick = () => {
            const ms = Date.now() - new Date(activeBreak.startTime).getTime();
            setElapsed(Math.floor(ms / 1000));
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [activeBreak]);

    const formatTime = (totalSeconds: number) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    const elapsedMinutes = Math.floor(elapsed / 60);
    const lunchDuration = config.lunchDuration;
    const isOvertime = elapsedMinutes > lunchDuration + config.lunchOvertimeThreshold;
    const isWarning = elapsedMinutes >= lunchDuration;
    const canStartBreak = todayBreaks.length < config.allowedBreaksPerDay && !activeBreak;

    const handleStart = useCallback(() => {
        if (!canStartBreak) {
            toast.error(`Maximum ${config.allowedBreaksPerDay} break(s) per day.`);
            return;
        }
        // Get current GPS for break start
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    locationService.startBreak({
                        employeeId,
                        breakType: "lunch",
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                    });
                    toast.success("Lunch break started");
                },
                () => {
                    locationService.startBreak({ employeeId, breakType: "lunch" });
                    toast.success("Lunch break started (no GPS)");
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            locationService.startBreak({ employeeId, breakType: "lunch" });
            toast.success("Lunch break started");
        }
    }, [canStartBreak, config.allowedBreaksPerDay, employeeId]);

    const handleEnd = useCallback(() => {
        if (!activeBreak) return;
        setEnding(true);

        const finalize = (lat?: number, lng?: number) => {
            const project = getProjectForEmployee(employeeId);
            let geofencePass: boolean | undefined;
            let distanceFromSite: number | undefined;

            if (project && lat !== undefined && lng !== undefined && config.lunchGeofenceRequired) {
                const result = isWithinGeofence(lat, lng, project.location.lat, project.location.lng, project.location.radius);
                geofencePass = result.within;
                distanceFromSite = result.distanceMeters;

                if (!result.within) {
                    toast.warning(
                        `You are ${result.distanceMeters}m from your work site. This has been logged.`,
                        { duration: 8000 }
                    );
                    if (config.alertAdminOnGeofenceViolation) {
                        notifyGeofenceViolation({
                            employeeId,
                            employeeName,
                            employeeEmail: employeeEmail || "",
                            distance: result.distanceMeters,
                            time: new Date().toLocaleTimeString(),
                        });
                    }
                }
            }

            locationService.endBreak(activeBreak.id, { lat, lng, geofencePass, distanceFromSite });
            setEnding(false);
            toast.success("Lunch break ended");
        };

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => finalize(pos.coords.latitude, pos.coords.longitude),
                () => { finalize(); },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            finalize();
        }
    }, [activeBreak, employeeId, employeeName, employeeEmail, config, getProjectForEmployee]);

    return (
        <Card className="border border-border/50">
            <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <UtensilsCrossed className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium">Lunch Break</span>
                    </div>

                    {activeBreak ? (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className={`font-mono text-sm font-semibold ${isOvertime ? "text-red-500" : isWarning ? "text-amber-500" : ""}`}>
                                    {formatTime(elapsed)}
                                </span>
                                <span className="text-[10px] text-muted-foreground">/ {lunchDuration}min</span>
                            </div>
                            {isOvertime && (
                                <Badge variant="destructive" className="text-[10px] gap-0.5">
                                    <AlertTriangle className="h-3 w-3" /> Overtime
                                </Badge>
                            )}
                            {isWarning && !isOvertime && (
                                <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400">
                                    Break over
                                </Badge>
                            )}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleEnd}
                                disabled={ending}
                                className="gap-1 text-xs h-7"
                            >
                                {ending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
                                End Break
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            {todayBreaks.length > 0 && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    {todayBreaks.length}/{config.allowedBreaksPerDay} used
                                    {todayBreaks[todayBreaks.length - 1]?.endGeofencePass === false && (
                                        <Badge variant="destructive" className="text-[9px] ml-1">
                                            Out of fence
                                        </Badge>
                                    )}
                                </div>
                            )}
                            <Button
                                size="sm"
                                onClick={handleStart}
                                disabled={disabled || !canStartBreak}
                                className="gap-1 text-xs h-7"
                            >
                                <Play className="h-3 w-3" /> Start Lunch
                            </Button>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
