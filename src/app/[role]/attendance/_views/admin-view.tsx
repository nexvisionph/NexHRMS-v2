"use client";

import { useState, useMemo, useEffect, useCallback, useRef, type ChangeEvent } from "react";
import { useAttendanceStore } from "@/store/attendance.store";
import { useEmployeesStore } from "@/store/employees.store";
import { useAuthStore } from "@/store/auth.store";
import { useProjectsStore } from "@/store/projects.store";
import { useRolesStore } from "@/store/roles.store";
import { useLocationStore } from "@/store/location.store";
import { useKioskStore } from "@/store/kiosk.store";
import { sendNotification } from "@/lib/notifications";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Clock, LogIn, LogOut, Download, MapPin, CheckCircle, XCircle, Navigation,
    BellRing, UserX, ShieldCheck, Timer, ThumbsUp, ThumbsDown, RotateCcw,
    AlertTriangle, Zap, CalendarDays, Plus, Pencil, Trash2, UploadCloud,
    ShieldAlert, Gauge, Camera, ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import { isWithinGeofence } from "@/lib/geofence";
import { FaceRecognitionSimulator } from "@/components/attendance/face-recognition";
import { SelfieCapture } from "@/components/attendance/selfie-capture";
import { LocationTracker } from "@/components/attendance/location-tracker";
import { BreakTimer } from "@/components/attendance/break-timer";
import { SiteSurveyGallery } from "@/components/attendance/site-survey-gallery";
import { LocationTrail } from "@/components/attendance/location-trail";
import { AttendanceHeatmap } from "@/components/attendance/attendance-heatmap";
import type { Holiday } from "@/types";

type CheckInStep = "idle" | "locating" | "location_result" | "done" | "error" | "selfie";

/* ─── Spoofing / DevTools helpers ──────────────────────────── */
const isDesktopDevToolsOpen = (): boolean => {
    const threshold = 160;
    return window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold;
};
const detectLocationSpoofing = (coords: GeolocationCoordinates): string | null => {
    const ua = navigator.userAgent; const isAndroid = /Android/i.test(ua); const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const nav = navigator as unknown as { webdriver?: boolean };
    if (nav.webdriver === true) return "Automation or USB debugging session detected.";
    if (coords.accuracy > 0 && coords.accuracy < 1) return "Suspiciously precise GPS accuracy (possible mock provider).";
    if (coords.accuracy > 500) return "GPS accuracy is too poor to verify location reliably.";
    if (coords.speed !== null && coords.speed < 0) return "Invalid speed value in location data.";
    if (isIOS && coords.altitude === null) return "Mock location suspected — iOS altitude data missing.";
    if (isAndroid && coords.altitude !== null && coords.altitudeAccuracy === null) return "Mock location suspected — Android altitude accuracy missing.";
    return null;
};
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const statusColors: Record<string, string> = { present: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", absent: "bg-red-500/15 text-red-700 dark:text-red-400", on_leave: "bg-amber-500/15 text-amber-700 dark:text-amber-400" };
const otStatusColor: Record<string, string> = { pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400", approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", rejected: "bg-red-500/15 text-red-700 dark:text-red-400" };

/* ═══════════════════════════════════════════════════════════════
   ADMIN MANAGEMENT VIEW
   mode=admin  → full features (override, holidays CRUD, surveys, location trail)
   mode=hr     → can edit records + approve OT, no holiday CRUD/surveys/location
   mode=supervisor → can approve OT, team-scoped, no override/CRUD
   ═══════════════════════════════════════════════════════════════ */
interface AdminViewProps {
    mode?: "admin" | "hr" | "supervisor";
}

export default function AdminView({ mode = "admin" }: AdminViewProps) {
    const { logs, checkIn, checkOut, getTodayLog, markAbsent, updateLog, bulkUpsertLogs, appendEvent, overtimeRequests, submitOvertimeRequest, approveOvertime, rejectOvertime, events, exceptions, autoGenerateExceptions, autoMarkAbsentAfterShift, resolveException, resetToSeed, holidays, addHoliday, updateHoliday, deleteHoliday, resetHolidaysToDefault, applyPenalty, getActivePenalty, cleanExpiredPenalties, shiftTemplates, employeeShifts } = useAttendanceStore();
    const employees = useEmployeesStore((s) => s.employees);
    const currentUser = useAuthStore((s) => s.currentUser);
    const getProjectForEmployee = useProjectsStore((s) => s.getProjectForEmployee);
    const projects = useProjectsStore((s) => s.projects);
    const { hasPermission } = useRolesStore();
    const locationConfig = useLocationStore((s) => s.config);
    const addPhoto = useLocationStore((s) => s.addPhoto);
    const penaltySettings = useKioskStore((s) => s.settings);

    // ─── Permission flags ─────────────────────────────────────────
    const canEdit = hasPermission(currentUser.role, "attendance:edit");
    const canApproveOT = hasPermission(currentUser.role, "attendance:approve_overtime");
    const canManageHolidays = mode === "admin";
    const canViewSurveys = mode === "admin";
    const canViewLocationTrail = mode === "admin";
    const canOverride = canEdit;
    const canMarkAbsent = canEdit;
    const canImportCSV = mode === "admin" || mode === "hr";

    // ─── Identity ─────────────────────────────────────────────────
    const myEmployeeId = employees.find((e) => e.profileId === currentUser.id || e.email === currentUser.email || e.name === currentUser.name)?.id;
    const todayLog = myEmployeeId ? getTodayLog(myEmployeeId) : undefined;
    const myProject = myEmployeeId ? getProjectForEmployee(myEmployeeId) : undefined;

    // ─── Supervisor: limit to team members ────────────────────────
    const teamEmployeeIds = useMemo(() => {
        if (mode !== "supervisor" || !myEmployeeId) return null;
        const myProj = projects.filter((p) => p.assignedEmployeeIds?.includes(myEmployeeId));
        const ids = new Set<string>();
        myProj.forEach((p) => p.assignedEmployeeIds?.forEach((m: string) => ids.add(m)));
        ids.add(myEmployeeId);
        return ids;
    }, [mode, myEmployeeId, projects]);

    const visibleEmployees = useMemo(() => {
        if (!teamEmployeeIds) return employees.filter((e) => e.status === "active");
        return employees.filter((e) => e.status === "active" && teamEmployeeIds.has(e.id));
    }, [employees, teamEmployeeIds]);

    // ─── Filters ──────────────────────────────────────────────────
    const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().split("T")[0]);
    const [empFilter, setEmpFilter] = useState("all");

    // Event ledger filters
    const [eventTypeFilter, setEventTypeFilter] = useState("all");
    const [eventEmpFilter, setEventEmpFilter] = useState("all");

    const filteredLogs = useMemo(() => {
        return logs
            .filter((l) => {
                const matchDate = !dateFilter || l.date === dateFilter;
                const matchEmp = empFilter === "all" || l.employeeId === empFilter;
                const matchTeam = !teamEmployeeIds || teamEmployeeIds.has(l.employeeId);
                return matchDate && matchEmp && matchTeam;
            })
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 50);
    }, [logs, dateFilter, empFilter, teamEmployeeIds]);

    const filteredEvents = useMemo(() => {
        return events
            .filter((e) => {
                const matchType = eventTypeFilter === "all" || e.eventType === eventTypeFilter;
                const matchEmp = eventEmpFilter === "all" || e.employeeId === eventEmpFilter;
                const matchTeam = !teamEmployeeIds || teamEmployeeIds.has(e.employeeId);
                return matchType && matchEmp && matchTeam;
            })
            .sort((a, b) => (b.timestampUTC ?? "").localeCompare(a.timestampUTC ?? ""))
            .slice(0, 200);
    }, [events, eventTypeFilter, eventEmpFilter, teamEmployeeIds]);

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;
    const getEmpDept = (id: string) => employees.find((e) => e.id === id)?.department || "—";
    const getProjectName = (id?: string) => id ? projects.find((p) => p.id === id)?.name || id : "—";
    const getEmpShift = (empId: string) => {
        const shiftId = employeeShifts[empId];
        return shiftId ? shiftTemplates.find((s) => s.id === shiftId) : undefined;
    };

    const pendingOT = overtimeRequests.filter((r) => r.status === "pending").length;
    const visibleOTRequests = useMemo(() => {
        if (!teamEmployeeIds) return overtimeRequests;
        return overtimeRequests.filter((r) => teamEmployeeIds.has(r.employeeId));
    }, [overtimeRequests, teamEmployeeIds]);

    // ─── Check-in state ───────────────────────────────────────────
    const [checkInOpen, setCheckInOpen] = useState(false);
    const [step, setStep] = useState<CheckInStep>("idle");
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [geoResult, setGeoResult] = useState<{ within: boolean; distanceMeters: number; accuracy?: number } | null>(null);
    const [spoofReason, setSpoofReason] = useState<string | null>(null);
    const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);
    const [notifyingId, setNotifyingId] = useState<string | null>(null);

    // OT state
    const [otOpen, setOtOpen] = useState(false);
    const [otDate, setOtDate] = useState("");
    const [otHours, setOtHours] = useState("1");
    const [otReason, setOtReason] = useState("");
    const [otRejectId, setOtRejectId] = useState<string | null>(null);
    const [otRejectReason, setOtRejectReason] = useState("");

    // Holiday state
    const [holDialogOpen, setHolDialogOpen] = useState(false);
    const [holEditing, setHolEditing] = useState<Holiday | null>(null);
    const [holDate, setHolDate] = useState("");
    const [holName, setHolName] = useState("");
    const [holType, setHolType] = useState<"regular" | "special" | "special_non_working" | "special_working">("regular");
    const [holDeleteId, setHolDeleteId] = useState<string | null>(null);

    // CSV import ref
    const csvInputRef = useRef<HTMLInputElement>(null);

    // Override state
    const [overrideOpen, setOverrideOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<typeof logs[0] | null>(null);
    const [ovCheckIn, setOvCheckIn] = useState("");
    const [ovCheckOut, setOvCheckOut] = useState("");
    const [ovStatus, setOvStatus] = useState<"present" | "absent" | "on_leave">("present");
    const [ovLate, setOvLate] = useState("");

    // Bulk selection state
    const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
    const [bulkStatus, setBulkStatus] = useState<"present" | "absent" | "on_leave">("present");

    // Live clock
    const [now, setNow] = useState(new Date());
    useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

    // Penalty + continuous devtools monitor
    const [penaltyRemainMs, setPenaltyRemainMs] = useState(0);
    const [devToolsOpen, setDevToolsOpen] = useState(false);
    useEffect(() => {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        const t = setInterval(() => {
            cleanExpiredPenalties();
            if (myEmployeeId) {
                const p = getActivePenalty(myEmployeeId);
                setPenaltyRemainMs(p ? Math.max(0, new Date(p.penaltyUntil).getTime() - Date.now()) : 0);
            }
            if (!isMobile) {
                const open = isDesktopDevToolsOpen();
                setDevToolsOpen(open);
                if (open && penaltySettings.devOptionsPenaltyEnabled && myEmployeeId &&
                    (penaltySettings.devOptionsPenaltyApplyTo === "devtools" || penaltySettings.devOptionsPenaltyApplyTo === "both")) {
                    const existing = getActivePenalty(myEmployeeId);
                    if (!existing) {
                        const until = new Date(Date.now() + penaltySettings.devOptionsPenaltyMinutes * 60000).toISOString();
                        applyPenalty({
                            employeeId: myEmployeeId,
                            reason: "Developer tools were opened. Check-in is locked for the penalty duration.",
                            triggeredAt: new Date().toISOString(),
                            penaltyUntil: until,
                        });
                        toast.error(`Developer tools detected. Locked out for ${penaltySettings.devOptionsPenaltyMinutes} minutes.`, { duration: 6000, id: "devtools-penalty" });
                    }
                }
            }
        }, 1000);
        return () => clearInterval(t);
    }, [cleanExpiredPenalties, myEmployeeId, getActivePenalty, applyPenalty, penaltySettings]);
    const activePenalty = myEmployeeId ? getActivePenalty(myEmployeeId) : undefined;

    // ─── Handlers ─────────────────────────────────────────────────
    const openOverride = (log: typeof logs[0]) => {
        setEditingLog(log); setOvCheckIn(log.checkIn || ""); setOvCheckOut(log.checkOut || "");
        setOvStatus(log.status as "present" | "absent" | "on_leave"); setOvLate(log.lateMinutes != null ? String(log.lateMinutes) : ""); setOverrideOpen(true);
    };
    const handleSaveOverride = () => {
        if (!editingLog) return;
        const prevStatus = editingLog.status;
        const prevCheckIn = editingLog.checkIn;
        const prevCheckOut = editingLog.checkOut;
        updateLog(editingLog.id, { checkIn: ovCheckIn || undefined, checkOut: ovCheckOut || undefined, status: ovStatus, lateMinutes: ovLate !== "" ? Number(ovLate) : undefined });
        appendEvent({ employeeId: editingLog.employeeId, eventType: "OVERRIDE", timestampUTC: new Date().toISOString(), projectId: editingLog.projectId, performedBy: currentUser.id, description: `Override for ${getEmpName(editingLog.employeeId)} on ${editingLog.date}: status ${prevStatus}→${ovStatus}, in ${prevCheckIn || "—"}→${ovCheckIn || "—"}, out ${prevCheckOut || "—"}→${ovCheckOut || "—"}`, metadata: { logId: editingLog.id, prevStatus, newStatus: ovStatus, prevCheckIn, newCheckIn: ovCheckIn, prevCheckOut, newCheckOut: ovCheckOut } });
        toast.success("Attendance record updated"); setOverrideOpen(false);
    };

    const allLogsSelected = filteredLogs.length > 0 && filteredLogs.every((l) => selectedLogIds.has(l.id));
    const toggleLogSelect = (id: string) => setSelectedLogIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    const toggleAllLogs = () => { if (allLogsSelected) setSelectedLogIds(new Set()); else setSelectedLogIds(new Set(filteredLogs.map((l) => l.id))); };
    const applyBulkStatus = () => {
        if (selectedLogIds.size === 0) return;
        const affectedNames: string[] = [];
        Array.from(selectedLogIds).forEach((id) => {
            const log = logs.find((l) => l.id === id);
            updateLog(id, { status: bulkStatus });
            if (log) {
                affectedNames.push(getEmpName(log.employeeId));
                appendEvent({ employeeId: log.employeeId, eventType: "BULK_OVERRIDE", timestampUTC: new Date().toISOString(), projectId: log.projectId, performedBy: currentUser.id, description: `Bulk status change to "${bulkStatus.replace("_", " ")}" for ${getEmpName(log.employeeId)} on ${log.date}`, metadata: { logId: id, newStatus: bulkStatus, bulkCount: selectedLogIds.size } });
            }
        });
        toast.success(`${selectedLogIds.size} record(s) set to "${bulkStatus.replace("_", " ")}"`);
        setSelectedLogIds(new Set());
    };

    const handleExportCSV = () => {
        const rows = [
            ["Date", "Employee", "Department", "Shift", "Project", "Check In", "Check Out", "Hours", "Late (min)", "Status", "Last Updated"],
            ...filteredLogs.map((l) => { const sh = getEmpShift(l.employeeId); return [l.date, getEmpName(l.employeeId), getEmpDept(l.employeeId), sh ? `${sh.name} (${sh.startTime}–${sh.endTime})` : "", getProjectName(l.projectId), l.checkIn || "", l.checkOut || "", l.hours ?? "", l.lateMinutes ?? "", l.status, l.updatedAt || ""]; }),
        ];
        const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `attendance-${dateFilter || "all"}.csv`; a.click(); URL.revokeObjectURL(a.href);
        appendEvent({ employeeId: currentUser.id || "SYSTEM", eventType: "CSV_EXPORTED", timestampUTC: new Date().toISOString(), performedBy: currentUser.id, description: `Exported ${filteredLogs.length} attendance records for ${dateFilter || "all dates"}`, metadata: { count: filteredLogs.length, dateFilter } });
        toast.success(`Exported ${filteredLogs.length} records`);
    };

    const handleImportCSV = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const text = ev.target?.result as string;
                const lines = text.trim().split(/\r?\n/);
                const firstCells = lines[0].split(",").map((c) => c.replace(/^"|"$/g, "").trim().toLowerCase());
                const hasHeader = firstCells.includes("date") || firstCells.includes("employee");
                const dataLines = hasHeader ? lines.slice(1) : lines;
                const parseCell = (c: string) => c.replace(/^"|"$/g, "").trim();
                const rows: Parameters<typeof bulkUpsertLogs>[0] = [];
                let skipped = 0;
                for (const line of dataLines) {
                    if (!line.trim()) continue;
                    const cells = line.split(",").map(parseCell);
                    const [dateVal, empRaw, checkInVal, checkOutVal, statusRaw] = cells;
                    if (!dateVal || !empRaw) { skipped++; continue; }
                    const emp = employees.find((e) => e.id === empRaw || e.name.toLowerCase() === empRaw.toLowerCase());
                    if (!emp) { skipped++; continue; }
                    const status: "present" | "absent" | "on_leave" = (["present", "absent", "on_leave"] as const).includes(statusRaw as never) ? (statusRaw as "present" | "absent" | "on_leave") : checkInVal ? "present" : "absent";
                    rows.push({ employeeId: emp.id, date: dateVal, checkIn: checkInVal || undefined, checkOut: checkOutVal || undefined, status });
                }
                bulkUpsertLogs(rows);
                appendEvent({ employeeId: currentUser.id || "SYSTEM", eventType: "CSV_IMPORTED", timestampUTC: new Date().toISOString(), performedBy: currentUser.id, description: `Imported ${rows.length} attendance record(s) from CSV${skipped ? `, skipped ${skipped}` : ""}`, metadata: { imported: rows.length, skipped } });
                toast.success(`Imported ${rows.length} record(s)${skipped ? `, skipped ${skipped}` : ""}`);
            } catch { toast.error("Failed to parse CSV."); }
        };
        reader.readAsText(file); e.target.value = "";
    };

    const handleSubmitOT = () => {
        if (!myEmployeeId) { toast.error("Unable to identify employee"); return; }
        if (!otDate) { toast.error("Please select a date"); return; }
        if (!otHours || Number(otHours) < 1) { toast.error("Please enter valid hours"); return; }
        if (!otReason || otReason.length < 3) { toast.error("Please provide a reason"); return; }
        submitOvertimeRequest({ employeeId: myEmployeeId, date: otDate, hoursRequested: Number(otHours), reason: otReason });
        appendEvent({ employeeId: myEmployeeId, eventType: "OT_SUBMITTED", timestampUTC: new Date().toISOString(), description: `Submitted ${otHours}h OT request for ${otDate}: ${otReason}`, metadata: { date: otDate, hours: Number(otHours), reason: otReason } });
        toast.success("Overtime request submitted"); setOtOpen(false); setOtDate(""); setOtHours("1"); setOtReason("");
    };

    const handleAbsenceNotify = async (employeeId: string, date: string) => {
        setNotifyingId(employeeId);
        const emp = employees.find((e) => e.id === employeeId);
        await sendNotification({ type: "absence", employeeId, subject: `Absence Alert: ${emp?.name || employeeId} was absent on ${date}`, body: `${emp?.name || employeeId} did not check in on ${date}.` });
        setNotifyingId(null);
    };

    // ─── Check-in flow ────────────────────────────────────────────
    const startCheckIn = () => {
        if (myEmployeeId && activePenalty) {
            const remaining = Math.max(0, Math.ceil((new Date(activePenalty.penaltyUntil).getTime() - Date.now()) / 60000));
            toast.error(`Check-in locked for ${remaining} more minute${remaining !== 1 ? "s" : ""}.`); return;
        }
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (!isMobile && isDesktopDevToolsOpen()) {
            if (penaltySettings.devOptionsPenaltyEnabled && myEmployeeId && (penaltySettings.devOptionsPenaltyApplyTo === "devtools" || penaltySettings.devOptionsPenaltyApplyTo === "both")) {
                applyPenalty({ employeeId: myEmployeeId, reason: "Developer tools detected during check-in.", triggeredAt: new Date().toISOString(), penaltyUntil: new Date(Date.now() + penaltySettings.devOptionsPenaltyMinutes * 60000).toISOString() });
                toast.error(`Check-in blocked. Locked out for ${penaltySettings.devOptionsPenaltyMinutes} minutes.`, { duration: 6000 });
            } else { toast.error("Check-in blocked: Developer tools detected."); }
            return;
        }
        const myEmp = employees.find((e) => e.id === myEmployeeId);
        if (myEmp?.workDays?.length) { const todayName = DAY_NAMES[new Date().getDay()]; if (!myEmp.workDays.includes(todayName)) toast.warning(`${todayName} is not in your scheduled work days.`, { duration: 5000 }); }
        setSpoofReason(null); setStep("idle"); setUserLocation(null); setGeoResult(null); setSelfieDataUrl(null); setCheckInOpen(true);
    };

    const requestLocation = () => {
        setSpoofReason(null); setStep("locating");
        if (!navigator.geolocation) { toast.error("Geolocation not supported"); setStep("error"); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const spoof = detectLocationSpoofing(pos.coords);
                if (spoof) {
                    if (penaltySettings.devOptionsPenaltyEnabled && myEmployeeId && (penaltySettings.devOptionsPenaltyApplyTo === "spoofing" || penaltySettings.devOptionsPenaltyApplyTo === "both")) {
                        applyPenalty({ employeeId: myEmployeeId, reason: spoof, triggeredAt: new Date().toISOString(), penaltyUntil: new Date(Date.now() + penaltySettings.devOptionsPenaltyMinutes * 60000).toISOString() });
                        toast.error(`Location spoofing detected. Locked out for ${penaltySettings.devOptionsPenaltyMinutes} minutes.`, { duration: 6000 });
                    }
                    setSpoofReason(spoof); setStep("error"); return;
                }
                const gpsAccuracy = Math.round(pos.coords.accuracy);
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setUserLocation(loc);
                if (myProject) {
                    const result = isWithinGeofence(loc.lat, loc.lng, myProject.location.lat, myProject.location.lng, myProject.location.radius);
                    if (!result.within && gpsAccuracy > myProject.location.radius) { setSpoofReason(`GPS accuracy (±${gpsAccuracy}m) > geofence radius (${myProject.location.radius}m).`); setStep("error"); return; }
                    setGeoResult({ ...result, accuracy: gpsAccuracy }); setStep(result.within ? "location_result" : "error");
                } else { setGeoResult({ within: true, distanceMeters: 0, accuracy: gpsAccuracy }); setStep("location_result"); }
            },
            (err) => { toast.error(err.code === err.PERMISSION_DENIED ? "Location access denied." : "Unable to retrieve location."); setStep("error"); },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    const handleFaceVerified = useCallback(() => {
        if (!myEmployeeId) return;
        checkIn(myEmployeeId, myProject?.id);
        const todayStr = new Date().toISOString().split("T")[0];
        const updatedLogs = useAttendanceStore.getState().logs.map((l) => {
            if (l.employeeId === myEmployeeId && l.date === todayStr && l.checkIn) return { ...l, locationSnapshot: userLocation || undefined, faceVerified: true };
            return l;
        });
        useAttendanceStore.setState({ logs: updatedLogs });
        if (selfieDataUrl && userLocation) {
            addPhoto({ eventId: `checkin-${Date.now()}`, employeeId: myEmployeeId, photoDataUrl: selfieDataUrl, gpsLat: userLocation.lat, gpsLng: userLocation.lng, gpsAccuracyMeters: geoResult?.accuracy || 0, capturedAt: new Date().toISOString(), geofencePass: geoResult?.within ?? true, projectId: myProject?.id });
        }
        setStep("done"); toast.success("Check-in successful! 🎉");
    }, [myEmployeeId, myProject, userLocation, checkIn, selfieDataUrl, geoResult, addPhoto]);

    const viewTitle = mode === "admin" ? "Attendance Management" : mode === "hr" ? "Attendance Overview" : "Team Attendance";

    return (
        <div className="space-y-4">
            {/* ─── Header ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{viewTitle}</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        {mode === "supervisor" ? "Team check-in/out logs" : "Daily check-in/out logs"}
                    </p>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    {/* Live clock pill */}
                    <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-3 py-1.5 text-xs font-medium tabular-nums">
                        <CalendarDays className="h-3 w-3 text-muted-foreground" />
                        <span>{now.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</span>
                        <span className="text-muted-foreground/50">|</span>
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono">{now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                    </div>
                    {/* Check In/Out is employee-only — not shown for admin managing the full system */}
                    {myEmployeeId && mode !== "admin" && (<>
                        {!todayLog?.checkIn ? (
                            <Button onClick={startCheckIn} disabled={!!activePenalty || devToolsOpen} size="sm" className="gap-1.5">
                                <LogIn className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{activePenalty ? "Locked" : devToolsOpen ? "DevTools Open" : "Check In"}</span>
                            </Button>
                        ) : !todayLog?.checkOut ? (
                            <Button onClick={() => { checkOut(myEmployeeId, myProject?.id); toast.success("Checked out!"); }} variant="outline" size="sm" className="gap-1.5">
                                <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Check Out</span>
                            </Button>
                        ) : (
                            <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 text-xs">
                                <Clock className="h-3 w-3 mr-1" />{todayLog.hours}h logged
                            </Badge>
                        )}
                    </>)}

                    {/* Request OT is only for HR/Supervisor on behalf of employees — not admin console */}
                    {myEmployeeId && mode !== "admin" && (
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => { setOtDate(new Date().toISOString().split("T")[0]); setOtOpen(true); }}>
                            <Timer className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Request OT</span>
                        </Button>
                    )}

                    {/* Action buttons group */}
                    <div className="flex items-center rounded-lg border border-border/40 bg-muted/20 p-0.5 gap-0.5">
                        <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7 px-2.5 rounded-md" onClick={handleExportCSV}>
                            <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Export</span>
                        </Button>
                        {canImportCSV && (<>
                            <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCSV} />
                            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7 px-2.5 rounded-md" onClick={() => csvInputRef.current?.click()}>
                                <UploadCloud className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Import</span>
                            </Button>
                        </>)}
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7 px-2.5 rounded-md text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Reset</span></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Reset Attendance Data?</AlertDialogTitle>
                                    <AlertDialogDescription>This will restore seed data. You can then do a fresh check-in for today.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => { resetToSeed(); const y = new Date(); y.setDate(y.getDate() - 1); setDateFilter(y.toISOString().split("T")[0]); appendEvent({ employeeId: currentUser.id || "SYSTEM", eventType: "DATA_RESET", timestampUTC: new Date().toISOString(), performedBy: currentUser.id, description: "Attendance data reset to seed" }); toast.success("Attendance data reset"); }}>Reset</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </div>

            {/* DevTools / Penalty / Project / Break — employee self-service only, not shown for admin console */}
            {mode !== "admin" && (<>
                {/* DevTools Open Warning */}
                {devToolsOpen && (
                    <div className="rounded-lg border-2 border-orange-500/40 bg-orange-500/5 p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <ShieldAlert className="h-5 w-5 text-orange-500 animate-pulse shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">Developer Tools Detected</p>
                            <p className="text-xs text-muted-foreground">Close Developer Tools to remove this warning. Cooldown penalty is still active.</p>
                        </div>
                    </div>
                )}

                {/* Penalty Cooldown Banner */}
                {activePenalty && (() => {
                    const rMin = Math.floor(penaltyRemainMs / 60000);
                    const rSec = Math.floor((penaltyRemainMs % 60000) / 1000);
                    return (
                        <div className="rounded-lg border-2 border-red-500/40 bg-red-500/5 p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
                            <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-red-700 dark:text-red-400">Check-In Locked — Cooldown Active</p>
                                <p className="text-xs text-muted-foreground">{activePenalty.reason}</p>
                                <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                                    {devToolsOpen ? "Close Developer Tools. Penalty is still running." : <>Unlocks in <span className="font-mono font-bold">{rMin}m {String(rSec).padStart(2, "0")}s</span></>}
                                </p>
                            </div>
                        </div>
                    );
                })()}

                {/* Project Banner */}
                {myProject && myEmployeeId && (
                    <Card className="border border-blue-500/20 bg-blue-500/5">
                        <CardContent className="p-4 flex items-center gap-3">
                            <MapPin className="h-5 w-5 text-blue-500" />
                            <div className="flex-1">
                                <p className="text-sm font-medium">Assigned to: <span className="text-blue-600 dark:text-blue-400">{myProject.name}</span></p>
                                <p className="text-xs text-muted-foreground">{myProject.location.lat.toFixed(4)}, {myProject.location.lng.toFixed(4)} · {myProject.location.radius}m</p>
                            </div>
                            {todayLog?.checkIn && !todayLog?.checkOut && locationConfig.enabled && (
                                <LocationTracker employeeId={myEmployeeId} employeeName={currentUser.name} active={!!todayLog?.checkIn && !todayLog?.checkOut} />
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Break Timer */}
                {myEmployeeId && todayLog?.checkIn && !todayLog?.checkOut && (
                    <BreakTimer employeeId={myEmployeeId} employeeName={currentUser.name} />
                )}
            </>)}

            {/* ─── Tabs ───────────────────────────────────────────── */}
            <Tabs defaultValue="heatmap" className="space-y-4">
                <div className="relative">
                    <TabsList className="w-full h-auto p-1 bg-muted/30 border border-border/40 rounded-xl overflow-x-auto flex justify-start gap-0.5 no-scrollbar">
                        <TabsTrigger value="heatmap" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs px-3 py-2"><CalendarDays className="h-3.5 w-3.5" /> Heatmap</TabsTrigger>
                        <TabsTrigger value="logs" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs px-3 py-2">Attendance Logs</TabsTrigger>
                        <TabsTrigger value="events" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs px-3 py-2">
                            <Zap className="h-3.5 w-3.5" /> Event Ledger
                            {events.length > 0 && <span className="ml-1 bg-blue-500/15 text-blue-700 dark:text-blue-400 text-[10px] px-1.5 py-0.5 rounded-full font-medium">{events.length}</span>}
                        </TabsTrigger>
                        <TabsTrigger value="exceptions" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs px-3 py-2">
                            <AlertTriangle className="h-3.5 w-3.5" /> Exceptions
                            {exceptions.filter(e => !e.resolvedAt).length > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">{exceptions.filter(e => !e.resolvedAt).length}</span>}
                        </TabsTrigger>
                        <TabsTrigger value="overtime" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs px-3 py-2">
                            <Timer className="h-3.5 w-3.5" /> Overtime
                            {pendingOT > 0 && <span className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">{pendingOT}</span>}
                        </TabsTrigger>
                        <TabsTrigger value="holidays" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs px-3 py-2"><CalendarDays className="h-3.5 w-3.5" /> Holidays</TabsTrigger>
                        {canViewSurveys && <TabsTrigger value="surveys" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs px-3 py-2"><Camera className="h-3.5 w-3.5" /> Site Surveys</TabsTrigger>}
                        {canViewLocationTrail && <TabsTrigger value="location" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs px-3 py-2"><Navigation className="h-3.5 w-3.5" /> Location Trail</TabsTrigger>}
                    </TabsList>
                </div>

                {/* ─── Heatmap Tab ──────────────────────────────────── */}
                <TabsContent value="heatmap">
                    <AttendanceHeatmap
                        logs={logs}
                        employees={visibleEmployees}
                        projects={projects}
                        holidays={holidays.map((h) => ({ date: h.date, name: h.name }))}
                        mode={mode}
                        canEdit={canEdit}
                        shiftTemplates={shiftTemplates}
                        employeeShifts={employeeShifts}
                        onStatusChange={(empId, date, newStatus, checkIn, checkOut, lateMinutes) => {
                            const existingLog = logs.find((l) => l.employeeId === empId && l.date === date);
                            if (existingLog) {
                                updateLog(existingLog.id, {
                                    status: newStatus as "present" | "absent" | "on_leave",
                                    checkIn: checkIn,
                                    checkOut: checkOut,
                                    lateMinutes: lateMinutes,
                                });
                            } else {
                                bulkUpsertLogs([{
                                    employeeId: empId,
                                    date,
                                    status: newStatus as "present" | "absent" | "on_leave",
                                    checkIn,
                                    checkOut,
                                    lateMinutes,
                                }]);
                            }
                            appendEvent({ employeeId: empId, eventType: "OVERRIDE", timestampUTC: new Date().toISOString(), projectId: existingLog?.projectId, performedBy: currentUser.id, description: `Heatmap override for ${getEmpName(empId)} on ${date}: set to ${newStatus}${checkIn ? `, in=${checkIn}` : ""}${checkOut ? `, out=${checkOut}` : ""}`, metadata: { source: "heatmap", newStatus, checkIn, checkOut, lateMinutes } });
                            toast.success(`Attendance updated for ${getEmpName(empId)}`);
                        }}
                    />
                </TabsContent>

                {/* ─── Logs Tab ─────────────────────────────────────── */}
                <TabsContent value="logs" className="space-y-3">
                    <Card className="border border-border/40 shadow-sm">
                        <CardContent className="p-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-full sm:w-[170px] h-8 text-xs" />
                                <Select value={empFilter} onValueChange={setEmpFilter}>
                                    <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs"><SelectValue placeholder="All Employees" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All {mode === "supervisor" ? "Team Members" : "Employees"}</SelectItem>
                                        {visibleEmployees.filter((e) => e.id).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                    {canOverride && selectedLogIds.size > 0 && (
                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                            <ListChecks className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="text-xs font-medium">{selectedLogIds.size} selected</span>
                            <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as "present" | "absent" | "on_leave")}>
                                <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="present">Present</SelectItem>
                                    <SelectItem value="absent">Absent</SelectItem>
                                    <SelectItem value="on_leave">On Leave</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button size="sm" className="h-7 text-xs" onClick={applyBulkStatus}>Apply</Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedLogIds(new Set())}>Clear</Button>
                        </div>
                    )}
                    <Card className="border border-border/40 shadow-sm">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {canOverride && <TableHead className="w-8 text-xs"><Checkbox checked={allLogsSelected} onCheckedChange={toggleAllLogs} aria-label="Select all" /></TableHead>}
                                            <TableHead className="text-xs">Date</TableHead>
                                            <TableHead className="text-xs">Employee</TableHead>
                                            <TableHead className="text-xs">Department</TableHead>
                                            <TableHead className="text-xs">Shift</TableHead>
                                            <TableHead className="text-xs">Project</TableHead>
                                            <TableHead className="text-xs">Check In</TableHead>
                                            <TableHead className="text-xs">Check Out</TableHead>
                                            <TableHead className="text-xs">Hours</TableHead>
                                            <TableHead className="text-xs">Late</TableHead>
                                            <TableHead className="text-xs">Status</TableHead>
                                            <TableHead className="text-xs">Last Updated</TableHead>
                                            {canOverride && <TableHead className="text-xs w-[120px]">Actions</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredLogs.length === 0 ? (
                                            <TableRow><TableCell colSpan={canOverride ? 14 : 12} className="text-center text-sm text-muted-foreground py-8">No attendance logs</TableCell></TableRow>
                                        ) : filteredLogs.map((log) => (
                                            <TableRow key={log.id} className={selectedLogIds.has(log.id) ? "bg-primary/5" : undefined}>
                                                {canOverride && <TableCell className="w-8"><Checkbox checked={selectedLogIds.has(log.id)} onCheckedChange={() => toggleLogSelect(log.id)} aria-label="Select row" /></TableCell>}
                                                <TableCell className="text-sm">{log.date}</TableCell>
                                                <TableCell className="text-sm font-medium">{getEmpName(log.employeeId)}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{getEmpDept(log.employeeId)}</TableCell>
                                                <TableCell className="text-xs">{(() => { const sh = getEmpShift(log.employeeId); return sh ? <Badge variant="secondary" className="text-[9px] bg-purple-500/10 text-purple-700 dark:text-purple-400 whitespace-nowrap">{sh.name} ({sh.startTime}–{sh.endTime})</Badge> : <span className="text-muted-foreground">—</span>; })()}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{getProjectName(log.projectId)}</TableCell>
                                                <TableCell className="text-sm">{log.checkIn || "—"}{log.faceVerified && <ShieldCheck className="inline h-3.5 w-3.5 ml-1 text-emerald-500" />}</TableCell>
                                                <TableCell className="text-sm">{log.checkOut || "—"}</TableCell>
                                                <TableCell className="text-sm">{log.hours ? `${log.hours}h` : "—"}</TableCell>
                                                <TableCell className="text-sm">
                                                    {log.lateMinutes && log.lateMinutes > 0 ? <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400">+{log.lateMinutes}m</Badge> : <span className="text-muted-foreground">—</span>}
                                                </TableCell>
                                                <TableCell><Badge variant="secondary" className={`text-[10px] ${statusColors[log.status]}`}>{log.status.replace("_", " ")}</Badge></TableCell>
                                                <TableCell className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">{log.updatedAt ? new Date(log.updatedAt).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}</TableCell>
                                                {canOverride && (
                                                    <TableCell>
                                                        <div className="flex items-center gap-1">
                                                            <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openOverride(log)}><Pencil className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent side="left"><p className="text-xs">Override</p></TooltipContent></Tooltip>
                                                            {canMarkAbsent && log.status === "present" && (
                                                                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-500/10" onClick={() => { markAbsent(log.employeeId, log.date); appendEvent({ employeeId: log.employeeId, eventType: "MARK_ABSENT", timestampUTC: new Date().toISOString(), projectId: log.projectId, performedBy: currentUser.id, description: `Marked ${getEmpName(log.employeeId)} as absent for ${log.date}` }); toast.success(`${getEmpName(log.employeeId)} marked absent`); }}><UserX className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent side="left"><p className="text-xs">Mark absent</p></TooltipContent></Tooltip>
                                                            )}
                                                            {log.status === "absent" && (
                                                                <Tooltip><TooltipTrigger asChild><Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-amber-600" disabled={notifyingId === log.employeeId} onClick={() => handleAbsenceNotify(log.employeeId, log.date)}><BellRing className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent side="left"><p className="text-xs">Notify</p></TooltipContent></Tooltip>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ─── Events Tab (Full Admin Audit Ledger) ──────── */}
                <TabsContent value="events" className="space-y-3">
                    {/* Event Ledger Filters */}
                    <Card className="border border-border/40 shadow-sm">
                        <CardContent className="p-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                                    <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs"><SelectValue placeholder="All Event Types" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Event Types</SelectItem>
                                        <SelectItem value="IN">Check In</SelectItem>
                                        <SelectItem value="OUT">Check Out</SelectItem>
                                        <SelectItem value="BREAK_START">Break Start</SelectItem>
                                        <SelectItem value="BREAK_END">Break End</SelectItem>
                                        <SelectItem value="OVERRIDE">Override</SelectItem>
                                        <SelectItem value="BULK_OVERRIDE">Bulk Override</SelectItem>
                                        <SelectItem value="MARK_ABSENT">Mark Absent</SelectItem>
                                        <SelectItem value="OT_APPROVED">OT Approved</SelectItem>
                                        <SelectItem value="OT_REJECTED">OT Rejected</SelectItem>
                                        <SelectItem value="OT_SUBMITTED">OT Submitted</SelectItem>
                                        <SelectItem value="EXCEPTION_RESOLVED">Exception Resolved</SelectItem>
                                        <SelectItem value="EXCEPTION_SCANNED">Exception Scanned</SelectItem>
                                        <SelectItem value="HOLIDAY_ADDED">Holiday Added</SelectItem>
                                        <SelectItem value="HOLIDAY_UPDATED">Holiday Updated</SelectItem>
                                        <SelectItem value="HOLIDAY_DELETED">Holiday Deleted</SelectItem>
                                        <SelectItem value="CSV_IMPORTED">CSV Imported</SelectItem>
                                        <SelectItem value="CSV_EXPORTED">CSV Exported</SelectItem>
                                        <SelectItem value="PENALTY_APPLIED">Penalty Applied</SelectItem>
                                        <SelectItem value="SHIFT_ASSIGNED">Shift Assigned</SelectItem>
                                        <SelectItem value="DATA_RESET">Data Reset</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={eventEmpFilter} onValueChange={setEventEmpFilter}>
                                    <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs"><SelectValue placeholder="All Employees" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Employees</SelectItem>
                                        {visibleEmployees.filter((e) => e.id).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <span className="text-xs text-muted-foreground ml-auto">{filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border border-border/40 shadow-sm">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="text-xs w-[180px]">Timestamp</TableHead>
                                        <TableHead className="text-xs">Employee</TableHead>
                                        <TableHead className="text-xs">Event Type</TableHead>
                                        <TableHead className="text-xs">Description</TableHead>
                                        <TableHead className="text-xs">Performed By</TableHead>
                                        <TableHead className="text-xs">Project</TableHead>
                                        <TableHead className="text-xs">Device / Source</TableHead>
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {filteredEvents.length === 0 ? (
                                            <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No events recorded.</TableCell></TableRow>
                                        ) : filteredEvents.map((evt) => {
                                            const eventColor = evt.eventType === "IN" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                                : evt.eventType === "OUT" ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                                                : evt.eventType === "OVERRIDE" || evt.eventType === "BULK_OVERRIDE" ? "bg-violet-500/15 text-violet-700 dark:text-violet-400"
                                                : evt.eventType === "MARK_ABSENT" ? "bg-red-500/15 text-red-700 dark:text-red-400"
                                                : evt.eventType.startsWith("OT_") ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                                : evt.eventType.startsWith("HOLIDAY_") ? "bg-pink-500/15 text-pink-700 dark:text-pink-400"
                                                : evt.eventType.startsWith("EXCEPTION_") ? "bg-orange-500/15 text-orange-700 dark:text-orange-400"
                                                : evt.eventType === "CSV_IMPORTED" || evt.eventType === "CSV_EXPORTED" ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400"
                                                : evt.eventType === "PENALTY_APPLIED" || evt.eventType === "PENALTY_CLEARED" ? "bg-red-500/15 text-red-700 dark:text-red-400"
                                                : evt.eventType === "DATA_RESET" ? "bg-slate-500/15 text-slate-700 dark:text-slate-400"
                                                : "bg-slate-500/15 text-slate-700 dark:text-slate-400";
                                            const performedByName = evt.performedBy ? getEmpName(evt.performedBy) : evt.deviceId?.startsWith("admin:") ? evt.deviceId.replace("admin:", "") : "System";
                                            const isAdminAction = evt.eventType === "OVERRIDE" || evt.eventType === "BULK_OVERRIDE" || evt.eventType === "MARK_ABSENT" || evt.eventType.startsWith("OT_") || evt.eventType.startsWith("HOLIDAY_") || evt.eventType.startsWith("EXCEPTION_") || evt.eventType === "DATA_RESET" || evt.eventType === "CSV_IMPORTED" || evt.eventType === "SHIFT_ASSIGNED";
                                            return (
                                                <TableRow key={evt.id} className={isAdminAction ? "bg-violet-500/[0.03]" : undefined}>
                                                    <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">{new Date(evt.timestampUTC).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}</TableCell>
                                                    <TableCell className="text-sm font-medium">{getEmpName(evt.employeeId)}</TableCell>
                                                    <TableCell><Badge variant="secondary" className={`text-[10px] ${eventColor}`}>{evt.eventType.replace(/_/g, " ")}</Badge></TableCell>
                                                    <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">{evt.description || "—"}</TableCell>
                                                    <TableCell className="text-xs">
                                                        {isAdminAction ? (
                                                            <span className="inline-flex items-center gap-1">
                                                                <ShieldCheck className="h-3 w-3 text-violet-500" />
                                                                <span className="font-medium text-violet-700 dark:text-violet-400">{performedByName}</span>
                                                            </span>
                                                        ) : <span className="text-muted-foreground">{performedByName}</span>}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{evt.projectId ? getProjectName(evt.projectId) : "—"}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground font-mono">{evt.deviceId && !evt.deviceId.startsWith("admin:") ? evt.deviceId : "—"}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                    <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground">Event ledger is append-only. All administrative actions are recorded for audit compliance.</p>
                        {filteredEvents.length > 0 && (
                            <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-7" onClick={() => {
                                const csvRows = [
                                    ["Timestamp", "Employee ID", "Employee Name", "Event Type", "Description", "Performed By", "Project", "Device"],
                                    ...filteredEvents.map((evt) => [
                                        new Date(evt.timestampUTC).toISOString(),
                                        evt.employeeId,
                                        getEmpName(evt.employeeId),
                                        evt.eventType,
                                        evt.description || "",
                                        evt.performedBy || (evt.deviceId?.startsWith("admin:") ? evt.deviceId.replace("admin:", "") : "System"),
                                        evt.projectId ? getProjectName(evt.projectId) : "",
                                        evt.deviceId && !evt.deviceId.startsWith("admin:") ? evt.deviceId : "",
                                    ]),
                                ];
                                const csv = csvRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                                const blob = new Blob([csv], { type: "text/csv" });
                                const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `event-ledger-${new Date().toISOString().split("T")[0]}.csv`; a.click(); URL.revokeObjectURL(a.href);
                                toast.success(`Exported ${filteredEvents.length} event(s)`);
                            }}>
                                <Download className="h-3 w-3" /> Export Ledger
                            </Button>
                        )}
                    </div>
                </TabsContent>

                {/* ─── Exceptions Tab ───────────────────────────────── */}
                <TabsContent value="exceptions" className="space-y-3">
                    {canEdit && (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm text-muted-foreground">Auto-detect anomalies & mark absent</p>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
                                    const targetDate = dateFilter || new Date().toISOString().slice(0, 10);
                                    const count = autoMarkAbsentAfterShift(
                                        targetDate,
                                        visibleEmployees.map(e => ({ id: e.id, workDays: e.workDays, shiftId: e.shiftId }))
                                    );
                                    if (count > 0) {
                                        appendEvent({ employeeId: currentUser.id || "SYSTEM", eventType: "BULK_OVERRIDE", timestampUTC: new Date().toISOString(), performedBy: currentUser.id, description: `Auto-marked ${count} employee(s) absent for ${targetDate}`, metadata: { date: targetDate, count } });
                                        toast.success(`Marked ${count} employee(s) as absent`);
                                    } else {
                                        toast.info("No employees to mark absent (all have logs or it's a non-work day/holiday)");
                                    }
                                }}><UserX className="h-3.5 w-3.5" /> Mark Absent</Button>
                                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => {
                                    autoGenerateExceptions(dateFilter || new Date().toISOString().slice(0, 10), visibleEmployees.map(e => e.id));
                                    appendEvent({ employeeId: currentUser.id || "SYSTEM", eventType: "EXCEPTION_SCANNED", timestampUTC: new Date().toISOString(), performedBy: currentUser.id, description: `Scanned for exceptions on ${dateFilter || "today"} for ${visibleEmployees.length} employee(s)`, metadata: { date: dateFilter, employeeCount: visibleEmployees.length } });
                                    toast.success("Exceptions auto-generated");
                                }}><AlertTriangle className="h-3.5 w-3.5" /> Scan</Button>
                            </div>
                        </div>
                    )}
                    <Card className="border border-border/40 shadow-sm">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="text-xs">Date</TableHead><TableHead className="text-xs">Employee</TableHead>
                                        <TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Description</TableHead>
                                        <TableHead className="text-xs">Status</TableHead>
                                        {canEdit && <TableHead className="text-xs w-20">Actions</TableHead>}
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {exceptions.length === 0 ? (
                                            <TableRow><TableCell colSpan={canEdit ? 6 : 5} className="text-center text-sm text-muted-foreground py-8">No exceptions</TableCell></TableRow>
                                        ) : exceptions.map((exc) => {
                                            const typeColor = exc.flag === "missing_in" || exc.flag === "missing_out" ? "bg-red-500/15 text-red-700 dark:text-red-400"
                                                : exc.flag === "out_of_geofence" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                                : exc.flag === "duplicate_scan" ? "bg-violet-500/15 text-violet-700 dark:text-violet-400" : "bg-slate-500/15 text-slate-700 dark:text-slate-400";
                                            return (
                                                <TableRow key={exc.id}>
                                                    <TableCell className="text-sm">{exc.date}</TableCell>
                                                    <TableCell className="text-sm font-medium">{getEmpName(exc.employeeId)}</TableCell>
                                                    <TableCell><Badge variant="secondary" className={`text-[10px] ${typeColor}`}>{exc.flag.replace(/_/g, " ")}</Badge></TableCell>
                                                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{exc.notes || "—"}</TableCell>
                                                    <TableCell><Badge variant="secondary" className={`text-[10px] ${exc.resolvedAt ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-red-500/15 text-red-700 dark:text-red-400"}`}>{exc.resolvedAt ? "resolved" : "open"}</Badge></TableCell>
                                                    {canEdit && (
                                                        <TableCell>{!exc.resolvedAt && <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => { resolveException(exc.id, currentUser.id, "Manually resolved"); appendEvent({ employeeId: exc.employeeId, eventType: "EXCEPTION_RESOLVED", timestampUTC: new Date().toISOString(), performedBy: currentUser.id, description: `Resolved "${exc.flag.replace(/_/g, " ")}" exception for ${getEmpName(exc.employeeId)} on ${exc.date}`, metadata: { exceptionId: exc.id, flag: exc.flag, date: exc.date } }); toast.success("Resolved"); }}><CheckCircle className="h-3.5 w-3.5" /></Button>}</TableCell>
                                                    )}
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ─── Overtime Tab ─────────────────────────────────── */}
                <TabsContent value="overtime">
                    <Card className="border border-border/40 shadow-sm">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="text-xs">Date</TableHead><TableHead className="text-xs">Employee</TableHead>
                                        <TableHead className="text-xs">Hours</TableHead><TableHead className="text-xs">Reason</TableHead>
                                        <TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Requested</TableHead>
                                        {canApproveOT && <TableHead className="text-xs w-24">Actions</TableHead>}
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {visibleOTRequests.length === 0 ? (
                                            <TableRow><TableCell colSpan={canApproveOT ? 7 : 6} className="text-center text-sm text-muted-foreground py-8">No overtime requests</TableCell></TableRow>
                                        ) : visibleOTRequests.map((ot) => (
                                            <TableRow key={ot.id}>
                                                <TableCell className="text-sm">{ot.date}</TableCell>
                                                <TableCell className="text-sm font-medium">{getEmpName(ot.employeeId)}</TableCell>
                                                <TableCell className="text-sm">{ot.hoursRequested}h</TableCell>
                                                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{ot.reason}</TableCell>
                                                <TableCell><Badge variant="secondary" className={`text-[10px] ${otStatusColor[ot.status]}`}>{ot.status}</Badge></TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{new Date(ot.requestedAt).toLocaleDateString()}</TableCell>
                                                {canApproveOT && (
                                                    <TableCell>
                                                        {ot.status === "pending" && (
                                                            <div className="flex items-center gap-1">
                                                                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => { approveOvertime(ot.id, currentUser.id); appendEvent({ employeeId: ot.employeeId, eventType: "OT_APPROVED", timestampUTC: new Date().toISOString(), performedBy: currentUser.id, description: `Approved ${ot.hoursRequested}h OT for ${getEmpName(ot.employeeId)} on ${ot.date}`, metadata: { otId: ot.id, hours: ot.hoursRequested, date: ot.date } }); toast.success("OT approved"); }}><ThumbsUp className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent side="left"><p className="text-xs">Approve</p></TooltipContent></Tooltip>
                                                                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => { setOtRejectId(ot.id); setOtRejectReason(""); }}><ThumbsDown className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent side="left"><p className="text-xs">Reject</p></TooltipContent></Tooltip>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ─── Holidays Tab ─────────────────────────────────── */}
                <TabsContent value="holidays" className="space-y-3">
                    {(() => {
                        const todayStr = new Date().toISOString().split("T")[0];
                        const upcoming = [...holidays].sort((a, b) => a.date.localeCompare(b.date)).find((h) => h.date >= todayStr);
                        const isHolidayToday = upcoming?.date === todayStr;
                        return upcoming ? (
                            <div className={`rounded-lg border p-4 flex items-center gap-3 ${isHolidayToday ? "bg-emerald-500/10 border-emerald-500/40" : "bg-blue-500/5 border-blue-500/20"}`}>
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isHolidayToday ? "bg-emerald-500/20" : "bg-blue-500/10"}`}>
                                    <CalendarDays className={`h-5 w-5 ${isHolidayToday ? "text-emerald-600 dark:text-emerald-400" : "text-blue-600 dark:text-blue-400"}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-semibold ${isHolidayToday ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}>
                                        {isHolidayToday ? `Today is a Holiday — ${upcoming.name} 🎉` : `Next Holiday: ${upcoming.name}`}
                                    </p>
                                    <p className={`text-xs mt-0.5 ${isHolidayToday ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                                        {new Date(upcoming.date + "T00:00:00").toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                                        {" • "}
                                        <span className={`font-medium ${upcoming.type === "regular" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                                            {upcoming.type === "regular" ? "Regular Holiday" : "Special Non-Working"}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground text-center">No more holidays scheduled.</div>
                        );
                    })()}
                    {canManageHolidays && (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">{holidays.length} holiday{holidays.length !== 1 ? "s" : ""}</p>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => { resetHolidaysToDefault(); appendEvent({ employeeId: currentUser.id || "SYSTEM", eventType: "DATA_RESET", timestampUTC: new Date().toISOString(), performedBy: currentUser.id, description: "Holidays reset to PH defaults" }); toast.success("Holidays reset"); }}><RotateCcw className="h-3.5 w-3.5" /> Reset</Button>
                                <Button size="sm" className="gap-1.5 text-xs" onClick={() => { setHolEditing(null); setHolDate(""); setHolName(""); setHolType("regular"); setHolDialogOpen(true); }}><Plus className="h-3.5 w-3.5" /> Add</Button>
                            </div>
                        </div>
                    )}
                    <Card className="border border-border/40 shadow-sm">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow>
                                        <TableHead className="text-xs w-36">Date</TableHead><TableHead className="text-xs">Holiday</TableHead>
                                        <TableHead className="text-xs w-44">Type</TableHead><TableHead className="text-xs w-32">Pay if Worked</TableHead>
                                        {canManageHolidays && <TableHead className="text-xs w-20">Actions</TableHead>}
                                    </TableRow></TableHeader>
                                    <TableBody>
                                        {holidays.length === 0 ? (
                                            <TableRow><TableCell colSpan={canManageHolidays ? 5 : 4} className="text-center text-sm text-muted-foreground py-10">No holidays configured.</TableCell></TableRow>
                                        ) : [...holidays].sort((a, b) => a.date.localeCompare(b.date)).map((h) => {
                                            const todayStr = new Date().toISOString().split("T")[0];
                                            const isToday = h.date === todayStr; const isPast = h.date < todayStr;
                                            return (
                                                <TableRow key={h.id} className={`${isToday ? "bg-emerald-500/10" : isPast ? "opacity-45" : ""}`}>
                                                    <TableCell className="text-sm font-mono">
                                                        <div className="flex items-center gap-2">
                                                            {isToday && <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />}
                                                            {new Date(h.date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric", weekday: "short" })}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-sm font-medium">{h.name}{isToday && <Badge variant="secondary" className="ml-2 text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">Today</Badge>}</TableCell>
                                                    <TableCell><Badge variant="secondary" className={`text-[10px] ${h.type === "regular" ? "bg-red-500/10 text-red-700 dark:text-red-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>{h.type === "regular" ? "Regular" : "Special Non-Working"}</Badge></TableCell>
                                                    <TableCell className="text-xs font-mono">{h.type === "regular" ? <span className="text-red-600 dark:text-red-400 font-semibold">200%</span> : <span className="text-amber-600 dark:text-amber-400 font-semibold">130%</span>}</TableCell>
                                                    {canManageHolidays && (
                                                        <TableCell>
                                                            <div className="flex items-center gap-1">
                                                                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setHolEditing(h); setHolDate(h.date); setHolName(h.name); setHolType(h.type); setHolDialogOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent side="left"><p className="text-xs">Edit</p></TooltipContent></Tooltip>
                                                                <Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => setHolDeleteId(h.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent side="left"><p className="text-xs">Delete</p></TooltipContent></Tooltip>
                                                            </div>
                                                        </TableCell>
                                                    )}
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                    <p className="text-[11px] text-muted-foreground text-center pb-2">PH National Holidays 2026 · Regular = 200% · Special Non-Working = 130%</p>
                </TabsContent>

                {/* ─── Site Surveys (Admin) ─────────────────────────── */}
                {canViewSurveys && <TabsContent value="surveys"><SiteSurveyGallery /></TabsContent>}

                {/* ─── Location Trail (Admin) ──────────────────────── */}
                {canViewLocationTrail && <TabsContent value="location"><LocationTrail /></TabsContent>}
            </Tabs>

            {/* ═══════════════ DIALOGS ═══════════════ */}

            {/* Override Dialog */}
            {canOverride && (
                <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
                    <DialogContent className="max-w-sm">
                        <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Override Record</DialogTitle></DialogHeader>
                        {editingLog && (
                            <div className="space-y-4 pt-2">
                                <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">{getEmpName(editingLog.employeeId)}</span> — {editingLog.date}</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-sm font-medium">Check In</label><Input type="time" value={ovCheckIn} onChange={(e) => setOvCheckIn(e.target.value)} className="mt-1" /></div>
                                    <div><label className="text-sm font-medium">Check Out</label><Input type="time" value={ovCheckOut} onChange={(e) => setOvCheckOut(e.target.value)} className="mt-1" /></div>
                                </div>
                                <div><label className="text-sm font-medium">Status</label>
                                    <Select value={ovStatus} onValueChange={(v) => setOvStatus(v as typeof ovStatus)}>
                                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="present">Present</SelectItem><SelectItem value="absent">Absent</SelectItem><SelectItem value="on_leave">On Leave</SelectItem></SelectContent>
                                    </Select>
                                </div>
                                <div><label className="text-sm font-medium">Late Minutes</label><Input type="number" min="0" max="480" value={ovLate} onChange={(e) => setOvLate(e.target.value)} placeholder="0" className="mt-1" /></div>
                                <p className="text-[11px] text-amber-600 dark:text-amber-400">⚠️ Admin override — logged for audit.</p>
                                <div className="flex gap-2 pt-1"><Button variant="outline" className="flex-1" onClick={() => setOverrideOpen(false)}>Cancel</Button><Button className="flex-1" onClick={handleSaveOverride}>Save</Button></div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            )}

            {/* Holiday Dialog */}
            {canManageHolidays && (
                <Dialog open={holDialogOpen} onOpenChange={setHolDialogOpen}>
                    <DialogContent className="max-w-sm">
                        <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> {holEditing ? "Edit Holiday" : "Add Holiday"}</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div><label className="text-sm font-medium">Date</label><Input type="date" value={holDate} onChange={(e) => setHolDate(e.target.value)} className="mt-1" /></div>
                            <div><label className="text-sm font-medium">Holiday Name</label><Input value={holName} onChange={(e) => setHolName(e.target.value)} placeholder="e.g. National Election Day" className="mt-1" /></div>
                            <div><label className="text-sm font-medium">Type</label>
                                <Select value={holType} onValueChange={(v) => setHolType(v as "regular" | "special" | "special_non_working" | "special_working")}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="regular">Regular Holiday (200%)</SelectItem><SelectItem value="special">Special Non-Working (130%)</SelectItem><SelectItem value="special_non_working">Special Non-Working (130%)</SelectItem><SelectItem value="special_working">Special Working (130%)</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div className="flex gap-2 pt-1"><Button variant="outline" className="flex-1" onClick={() => setHolDialogOpen(false)}>Cancel</Button>
                                <Button className="flex-1" onClick={() => {
                                    if (!holDate) { toast.error("Select a date"); return; }
                                    if (!holName.trim()) { toast.error("Enter a name"); return; }
                                    if (holEditing) {
                                        updateHoliday(holEditing.id, { date: holDate, name: holName.trim(), type: holType });
                                        appendEvent({ employeeId: currentUser.id || "SYSTEM", eventType: "HOLIDAY_UPDATED", timestampUTC: new Date().toISOString(), performedBy: currentUser.id, description: `Updated holiday "${holName.trim()}" (${holDate}, ${holType})`, metadata: { holidayId: holEditing.id, name: holName.trim(), date: holDate, type: holType } });
                                        toast.success(`"${holName}" updated`);
                                    } else {
                                        addHoliday({ date: holDate, name: holName.trim(), type: holType });
                                        appendEvent({ employeeId: currentUser.id || "SYSTEM", eventType: "HOLIDAY_ADDED", timestampUTC: new Date().toISOString(), performedBy: currentUser.id, description: `Added holiday "${holName.trim()}" on ${holDate} (${holType})`, metadata: { name: holName.trim(), date: holDate, type: holType } });
                                        toast.success(`"${holName}" added`);
                                    }
                                    setHolDialogOpen(false);
                                }}>{holEditing ? "Save" : "Add"}</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Delete Holiday */}
            {canManageHolidays && (
                <AlertDialog open={!!holDeleteId} onOpenChange={(o) => { if (!o) setHolDeleteId(null); }}>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete Holiday?</AlertDialogTitle>
                            <AlertDialogDescription>{holDeleteId && (() => { const h = holidays.find((x) => x.id === holDeleteId); return h ? `"${h.name}" (${h.date}) will be permanently removed.` : ""; })()}</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setHolDeleteId(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (holDeleteId) { const h = holidays.find((x) => x.id === holDeleteId); deleteHoliday(holDeleteId); appendEvent({ employeeId: currentUser.id || "SYSTEM", eventType: "HOLIDAY_DELETED", timestampUTC: new Date().toISOString(), performedBy: currentUser.id, description: `Deleted holiday "${h?.name || holDeleteId}" (${h?.date || "?"})`, metadata: { holidayId: holDeleteId, name: h?.name, date: h?.date } }); toast.success("Holiday deleted"); setHolDeleteId(null); } }}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}

            {/* OT Request Dialog */}
            <Dialog open={otOpen} onOpenChange={setOtOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Timer className="h-5 w-5" /> Request Overtime</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div><label className="text-sm font-medium">Date</label><Input type="date" value={otDate} onChange={(e) => setOtDate(e.target.value)} className="mt-1" /></div>
                        <div><label className="text-sm font-medium">Hours (1–8)</label><Input type="number" min="1" max="8" value={otHours} onChange={(e) => setOtHours(e.target.value)} className="mt-1" /></div>
                        <div><label className="text-sm font-medium">Reason</label><Input value={otReason} onChange={(e) => setOtReason(e.target.value)} placeholder="e.g. Project deadline" className="mt-1" /></div>
                        <Button onClick={handleSubmitOT} className="w-full">Submit Request</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* OT Rejection Dialog */}
            {canApproveOT && (
                <Dialog open={!!otRejectId} onOpenChange={(open) => { if (!open) { setOtRejectId(null); setOtRejectReason(""); } }}>
                    <DialogContent className="max-w-sm">
                        <DialogHeader><DialogTitle className="flex items-center gap-2"><ThumbsDown className="h-4 w-4 text-red-500" /> Reject Overtime</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div><label className="text-sm font-medium">Reason for Rejection</label><Input value={otRejectReason} onChange={(e) => setOtRejectReason(e.target.value)} placeholder="e.g. overtime budget exceeded" className="mt-1" /></div>
                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={() => { setOtRejectId(null); setOtRejectReason(""); }}>Cancel</Button>
                                <Button variant="destructive" className="flex-1" onClick={() => {
                                    if (!otRejectId) return; if (!otRejectReason.trim()) { toast.error("Enter a reason"); return; }
                                    const ot = overtimeRequests.find((r) => r.id === otRejectId);
                                    rejectOvertime(otRejectId, currentUser.id, otRejectReason.trim());
                                    if (ot) appendEvent({ employeeId: ot.employeeId, eventType: "OT_REJECTED", timestampUTC: new Date().toISOString(), performedBy: currentUser.id, description: `Rejected OT for ${getEmpName(ot.employeeId)} on ${ot.date}: ${otRejectReason.trim()}`, metadata: { otId: otRejectId, hours: ot.hoursRequested, reason: otRejectReason.trim() } });
                                    toast.success("OT rejected"); setOtRejectId(null); setOtRejectReason("");
                                }}>Reject</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Check-In Dialog */}
            <Dialog open={checkInOpen} onOpenChange={setCheckInOpen}>
                <DialogContent className="max-w-sm w-[calc(100vw-2rem)] max-h-[90dvh] flex flex-col p-0">
                    <DialogHeader className="px-4 pt-4 pb-2 shrink-0"><DialogTitle className="flex items-center gap-2"><LogIn className="h-5 w-5" /> Check In</DialogTitle></DialogHeader>
                    <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
                        {step === "idle" && (
                            <Card className="border border-border/40 shadow-sm">
                                <CardContent className="p-6 flex flex-col items-center gap-3">
                                    <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center"><Navigation className="h-8 w-8 text-blue-500" /></div>
                                    <p className="text-sm font-medium">Step 1: Share Location</p>
                                    <p className="text-xs text-muted-foreground text-center">{myProject ? `Verify within ${myProject.location.radius}m of ${myProject.name}` : "Share your location"}</p>
                                    <Button onClick={requestLocation} className="gap-1.5 mt-1"><MapPin className="h-4 w-4" /> Share My Location</Button>
                                </CardContent>
                            </Card>
                        )}
                        {step === "locating" && (
                            <Card className="border border-border/40 shadow-sm">
                                <CardContent className="p-6 flex flex-col items-center gap-3">
                                    <div className="h-12 w-12 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
                                    <p className="text-sm font-medium">Getting your location...</p>
                                </CardContent>
                            </Card>
                        )}
                        {step === "location_result" && geoResult && (<>
                            <Card className="border border-emerald-500/30 bg-emerald-500/5">
                                <CardContent className="p-4 flex items-center gap-3">
                                    <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Location Verified</p>
                                        <p className="text-xs text-muted-foreground">{myProject ? `${geoResult.distanceMeters}m from ${myProject.name}` : "Location recorded"}</p>
                                        {geoResult.accuracy !== undefined && <p className="text-[10px] text-muted-foreground mt-0.5"><Gauge className="inline w-3 h-3 mr-0.5 -mt-px" />GPS ±{geoResult.accuracy}m</p>}
                                    </div>
                                </CardContent>
                            </Card>
                            {locationConfig.requireSelfie && !selfieDataUrl && (
                                <div className="pt-1">
                                    <p className="text-xs text-muted-foreground text-center mb-3">Step 2: Take a Selfie</p>
                                    <SelfieCapture compressionQuality={locationConfig.selfieCompressionQuality} onCapture={(d) => { setSelfieDataUrl(d.photoDataUrl); toast.success("Selfie captured!"); }} onCancel={() => {}} />
                                </div>
                            )}
                            {selfieDataUrl && (
                                <Card className="border border-blue-500/20 bg-blue-500/5">
                                    <CardContent className="p-3 flex items-center gap-3">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={selfieDataUrl} alt="Selfie" className="h-12 w-12 rounded-lg object-cover" />
                                        <div className="flex-1"><p className="text-xs font-medium text-blue-700 dark:text-blue-400">Selfie Captured</p><button className="text-[10px] text-muted-foreground underline" onClick={() => setSelfieDataUrl(null)}>Retake</button></div>
                                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                                    </CardContent>
                                </Card>
                            )}
                            {(!locationConfig.requireSelfie || selfieDataUrl) && (
                                <div className="pt-1">
                                    <p className="text-xs text-muted-foreground text-center mb-3">{locationConfig.requireSelfie ? "Step 3" : "Step 2"}: Verify identity</p>
                                    <FaceRecognitionSimulator onVerified={handleFaceVerified} autoStart employeeName={currentUser.name} />
                                </div>
                            )}
                        </>)}
                        {step === "error" && spoofReason && (
                            <Card className="border border-orange-500/30 bg-orange-500/5">
                                <CardContent className="p-6 flex flex-col items-center gap-3">
                                    <div className="h-16 w-16 rounded-full bg-orange-500/15 flex items-center justify-center"><ShieldAlert className="h-8 w-8 text-orange-500" /></div>
                                    <p className="text-sm font-medium text-orange-700 dark:text-orange-400">Check-In Blocked</p>
                                    <p className="text-xs text-muted-foreground text-center">{spoofReason}</p>
                                    <Button variant="outline" size="sm" onClick={() => { setSpoofReason(null); setStep("idle"); }} className="mt-1">Try Again</Button>
                                </CardContent>
                            </Card>
                        )}
                        {step === "error" && !spoofReason && geoResult && !geoResult.within && (
                            <Card className="border border-red-500/30 bg-red-500/5">
                                <CardContent className="p-6 flex flex-col items-center gap-3">
                                    <div className="h-16 w-16 rounded-full bg-red-500/15 flex items-center justify-center"><XCircle className="h-8 w-8 text-red-500" /></div>
                                    <p className="text-sm font-medium text-red-700 dark:text-red-400">Outside Project Area</p>
                                    <p className="text-xs text-muted-foreground text-center">You are <strong>{geoResult.distanceMeters}m</strong> away. Must be within <strong>{myProject?.location.radius ?? 100}m</strong>.</p>
                                    <Button variant="outline" size="sm" onClick={() => setStep("idle")} className="mt-1">Try Again</Button>
                                </CardContent>
                            </Card>
                        )}
                        {step === "error" && !spoofReason && !geoResult && (
                            <Card className="border border-red-500/30 bg-red-500/5">
                                <CardContent className="p-6 flex flex-col items-center gap-3">
                                    <XCircle className="h-8 w-8 text-red-500" />
                                    <p className="text-sm font-medium text-red-700 dark:text-red-400">Location Error</p>
                                    <Button variant="outline" size="sm" onClick={() => setStep("idle")} className="mt-1">Try Again</Button>
                                </CardContent>
                            </Card>
                        )}
                        {step === "done" && (
                            <Card className="border border-emerald-500/30 bg-emerald-500/5">
                                <CardContent className="p-6 flex flex-col items-center gap-3">
                                    <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center"><CheckCircle className="h-8 w-8 text-emerald-500" /></div>
                                    <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">Check-In Confirmed!</p>
                                    <p className="text-xs text-muted-foreground text-center">{myProject ? `Checked in at ${myProject.name}` : "Attendance recorded"}</p>
                                    <Button variant="outline" size="sm" onClick={() => setCheckInOpen(false)} className="mt-1">Close</Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
