"use client";

/**
 * BiometricImportDialog
 *
 * Imports raw time-log XLSX/CSV exports from a T800-style biometric device,
 * groups events per (employee, date), and shows a preview dialog (à la the
 * payroll run dialog) before committing.
 *
 * Source-file shape:
 *   Row 0..3 — meta (TimeLogs / Start Date / End Date / blank)
 *   Row 4    — column headers (Personnel No | Personnel | Date | Time | Log Type)
 *   Row 5+   — data rows; same employee + same date repeats per scan.
 *
 * Output: BiometricImportRecord[] with one record per (employee, date).
 */

import { useCallback, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { format, parse, isValid } from "date-fns";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
    UploadCloud,
    FileSpreadsheet,
    CheckCircle,
    AlertTriangle,
    XCircle,
    Loader2,
    Search,
    RotateCcw,
    Fingerprint,
} from "lucide-react";
import type { Employee, AttendanceLog } from "@/types";

/* ─── Public types ────────────────────────────────────────────── */

export interface BiometricImportRecord {
    employeeId: string;
    employeeName: string;
    date: string;            // YYYY-MM-DD
    checkIn?: string;        // HH:MM
    checkOut?: string;       // HH:MM
    hours?: number;
    status: "present" | "absent";
    importStatus: "ready" | "warning" | "error";
    message?: string;
}

interface BiometricImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (records: BiometricImportRecord[]) => void;
    employees: Employee[];
    existingLogs: AttendanceLog[];
}

/* ─── Internal helpers ───────────────────────────────────────── */

/** Normalise a name for fuzzy comparison. "BULARIO, RODRIGO" → "rodrigo bulario" */
function normaliseName(raw: string): string {
    if (!raw) return "";
    const cleaned = raw.replace(/\s+/g, " ").trim();
    // "LAST, FIRST [MIDDLE]" → "FIRST [MIDDLE] LAST"
    if (cleaned.includes(",")) {
        const [last, rest] = cleaned.split(",").map((s) => s.trim());
        return `${rest ?? ""} ${last ?? ""}`.replace(/\s+/g, " ").trim().toLowerCase();
    }
    return cleaned.toLowerCase();
}

/** Parse "MM-DD-YYYY" or "MM/DD/YYYY" into ISO YYYY-MM-DD. Returns null on failure. */
function parseDeviceDate(raw: string): string | null {
    if (!raw) return null;
    const trimmed = String(raw).trim();
    const candidates = ["MM-dd-yyyy", "MM/dd/yyyy", "M-d-yyyy", "M/d/yyyy", "yyyy-MM-dd"];
    for (const fmt of candidates) {
        const d = parse(trimmed, fmt, new Date());
        if (isValid(d)) return format(d, "yyyy-MM-dd");
    }
    // Fallback: native Date
    const native = new Date(trimmed);
    if (isValid(native)) return format(native, "yyyy-MM-dd");
    return null;
}

/** Parse "07:57 AM" or "19:57" into "HH:MM" 24-hour. Returns null on failure. */
function parseDeviceTime(raw: string): string | null {
    if (!raw) return null;
    const trimmed = String(raw).trim();
    const candidates = ["hh:mm a", "h:mm a", "HH:mm", "H:mm", "hh:mm:ss a", "HH:mm:ss"];
    for (const fmt of candidates) {
        const d = parse(trimmed, fmt, new Date());
        if (isValid(d)) return format(d, "HH:mm");
    }
    return null;
}

/** Difference in hours between two HH:MM strings (handles overnight). */
function diffHours(checkIn: string, checkOut: string): number {
    const toMin = (t: string) => {
        const [h = 0, m = 0] = t.split(":").map(Number);
        return h * 60 + m;
    };
    const inMin = toMin(checkIn);
    const outMin = toMin(checkOut);
    const delta = outMin >= inMin ? outMin - inMin : 24 * 60 - inMin + outMin;
    return Math.round((delta / 60) * 100) / 100;
}

/** Find the index of a column whose header loosely matches one of the candidates. */
function findCol(headers: string[], candidates: string[]): number {
    const norm = headers.map((h) => String(h ?? "").trim().toLowerCase());
    for (const c of candidates) {
        const idx = norm.findIndex((h) => h === c.toLowerCase());
        if (idx >= 0) return idx;
    }
    // Fallback: contains match
    for (const c of candidates) {
        const idx = norm.findIndex((h) => h.includes(c.toLowerCase()));
        if (idx >= 0) return idx;
    }
    return -1;
}

interface RawLog {
    personnelNo: string;
    personnelName: string;
    rawDate: string;
    rawTime: string;
    logType: string; // IN | OUT (uppercase)
}

/* ─── Component ──────────────────────────────────────────────── */

export function BiometricImportDialog({
    open,
    onOpenChange,
    onImport,
    employees,
    existingLogs,
}: BiometricImportDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [parsing, setParsing] = useState(false);
    const [records, setRecords] = useState<BiometricImportRecord[]>([]);
    const [search, setSearch] = useState("");
    const fileRef = useRef<HTMLInputElement>(null);

    /* ─── Reset on close ──────────────────────────────────────── */
    const reset = useCallback(() => {
        setFile(null);
        setRecords([]);
        setSearch("");
        if (fileRef.current) fileRef.current.value = "";
    }, []);

    const handleClose = (next: boolean) => {
        if (!next) reset();
        onOpenChange(next);
    };

    /* ─── Build preview from raw rows ─────────────────────────── */
    const buildRecords = useCallback(
        (rawRows: RawLog[]): BiometricImportRecord[] => {
            // Group by (personnelNo OR personnelName) + date
            const groups = new Map<string, RawLog[]>();
            for (const r of rawRows) {
                const key = `${r.personnelNo || normaliseName(r.personnelName)}__${r.rawDate}`;
                const arr = groups.get(key) ?? [];
                arr.push(r);
                groups.set(key, arr);
            }

            const out: BiometricImportRecord[] = [];

            for (const [, rows] of groups) {
                const first = rows[0];
                const personnelNo = first.personnelNo;
                const personnelName = first.personnelName;

                // ─── Resolve employee ──────────────────────────
                let employee: Employee | undefined;
                if (personnelNo) {
                    employee = employees.find((e) => e.biometricId && e.biometricId === personnelNo);
                }
                if (!employee && personnelName) {
                    const target = normaliseName(personnelName);
                    employee = employees.find((e) => normaliseName(e.name) === target);
                }

                const isoDate = parseDeviceDate(first.rawDate);
                if (!isoDate) {
                    out.push({
                        employeeId: employee?.id ?? "",
                        employeeName: employee?.name ?? personnelName ?? personnelNo,
                        date: first.rawDate,
                        status: "absent",
                        importStatus: "error",
                        message: `Cannot parse date: ${first.rawDate}`,
                    });
                    continue;
                }

                if (!employee) {
                    out.push({
                        employeeId: "",
                        employeeName: personnelName || personnelNo || "—",
                        date: isoDate,
                        status: "absent",
                        importStatus: "error",
                        message: personnelNo
                            ? `No employee matched for Personnel No: ${personnelNo}`
                            : `No employee matched for: ${personnelName}`,
                    });
                    continue;
                }

                // ─── Compute earliest IN / latest OUT ──────────
                const ins: string[] = [];
                const outs: string[] = [];
                let badTime: string | null = null;

                for (const r of rows) {
                    const t = parseDeviceTime(r.rawTime);
                    if (!t) {
                        badTime = r.rawTime;
                        continue;
                    }
                    const lt = (r.logType ?? "").toString().trim().toUpperCase();
                    if (lt === "IN" || lt === "I" || lt === "CHECK IN" || lt === "CHECK-IN") ins.push(t);
                    else if (lt === "OUT" || lt === "O" || lt === "CHECK OUT" || lt === "CHECK-OUT") outs.push(t);
                    // Unknown log types are ignored.
                }

                if (badTime && ins.length === 0 && outs.length === 0) {
                    out.push({
                        employeeId: employee.id,
                        employeeName: employee.name,
                        date: isoDate,
                        status: "absent",
                        importStatus: "error",
                        message: `Cannot parse time: ${badTime}`,
                    });
                    continue;
                }

                ins.sort();
                outs.sort();
                const checkIn = ins[0];
                const checkOut = outs[outs.length - 1];

                let hours: number | undefined;
                if (checkIn && checkOut) hours = diffHours(checkIn, checkOut);

                // ─── Detect warnings ───────────────────────────
                const warnings: string[] = [];

                if (checkIn && !checkOut) {
                    warnings.push("No OUT log found — check-in only");
                }
                if (checkIn && checkOut && checkIn === checkOut) {
                    warnings.push("Check-in and check-out are the same time");
                }
                if (hours !== undefined && hours > 0 && hours < 1) {
                    warnings.push("Shift is less than 1 hour");
                }
                const exists = existingLogs.some(
                    (l) => l.employeeId === employee!.id && l.date === isoDate
                );
                if (exists) {
                    warnings.push("Record already exists for this date — will overwrite");
                }

                const status: "present" | "absent" = checkIn ? "present" : "absent";
                const importStatus: BiometricImportRecord["importStatus"] = warnings.length
                    ? "warning"
                    : "ready";

                out.push({
                    employeeId: employee.id,
                    employeeName: employee.name,
                    date: isoDate,
                    checkIn,
                    checkOut,
                    hours,
                    status,
                    importStatus,
                    message: warnings.join(" · ") || undefined,
                });
            }

            // Sort: errors first, then warnings, then ready; secondary by date+name
            return out.sort((a, b) => {
                const order = { error: 0, warning: 1, ready: 2 } as const;
                const sa = order[a.importStatus];
                const sb = order[b.importStatus];
                if (sa !== sb) return sa - sb;
                if (a.date !== b.date) return a.date.localeCompare(b.date);
                return a.employeeName.localeCompare(b.employeeName);
            });
        },
        [employees, existingLogs]
    );

    /* ─── File selection / parsing ────────────────────────────── */
    const handleFile = useCallback(
        async (f: File) => {
            const ext = f.name.split(".").pop()?.toLowerCase();
            if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
                toast.error("Please upload an XLSX or CSV file");
                return;
            }

            setFile(f);
            setParsing(true);
            try {
                const buf = await f.arrayBuffer();
                const wb = XLSX.read(buf, { type: "array", raw: false });
                const ws = wb.Sheets[wb.SheetNames[0]];
                if (!ws) {
                    toast.error("File has no readable sheet");
                    setParsing(false);
                    return;
                }

                // header: 1 → array-of-arrays; defval to keep blanks aligned.
                const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
                    header: 1,
                    defval: "",
                    raw: false,
                });

                // Find the header row: prefer "Personnel No" / "Log Type" anywhere
                // in the first 10 rows. Falls back to row index 4 (T800 standard).
                let headerIdx = -1;
                for (let i = 0; i < Math.min(rows.length, 10); i++) {
                    const cells = (rows[i] ?? []).map((c) => String(c ?? "").toLowerCase());
                    if (
                        cells.some((c) => c.includes("personnel no")) ||
                        cells.some((c) => c.includes("log type"))
                    ) {
                        headerIdx = i;
                        break;
                    }
                }
                if (headerIdx === -1) headerIdx = 4;

                const headers = (rows[headerIdx] ?? []).map((c) => String(c ?? ""));
                const dataRows = rows.slice(headerIdx + 1);

                const cPersNo = findCol(headers, ["Personnel No", "Personnel ID", "Employee ID", "Emp No"]);
                const cName = findCol(headers, ["Personnel", "Personnel Name", "Name", "Employee"]);
                const cDate = findCol(headers, ["Date"]);
                const cTime = findCol(headers, ["Time"]);
                const cType = findCol(headers, ["Log Type", "Type", "Status"]);

                if (cDate === -1 || cTime === -1 || cType === -1) {
                    toast.error(
                        "Could not detect required columns (Date, Time, Log Type). Make sure this is a T800 export."
                    );
                    setParsing(false);
                    return;
                }

                const raw: RawLog[] = [];
                for (const r of dataRows) {
                    if (!r) continue;
                    const personnelNo = String(r[cPersNo] ?? "").trim();
                    const personnelName = String(r[cName] ?? "").trim();
                    const rawDate = String(r[cDate] ?? "").trim();
                    const rawTime = String(r[cTime] ?? "").trim();
                    const logType = String(r[cType] ?? "").trim();
                    // Skip fully empty rows
                    if (!personnelNo && !personnelName && !rawDate && !rawTime) continue;
                    // Skip rows with no usable date — they're padding
                    if (!rawDate) continue;
                    raw.push({ personnelNo, personnelName, rawDate, rawTime, logType });
                }

                if (raw.length === 0) {
                    toast.error("No data rows found in the file");
                    setParsing(false);
                    return;
                }

                const built = buildRecords(raw);
                setRecords(built);

                const ready = built.filter((r) => r.importStatus === "ready").length;
                const warn = built.filter((r) => r.importStatus === "warning").length;
                const err = built.filter((r) => r.importStatus === "error").length;

                if (err === 0 && warn === 0) {
                    toast.success(`Parsed ${built.length} record(s) — all ready`);
                } else {
                    toast.info(`Parsed ${built.length} — ${ready} ready, ${warn} warning, ${err} error`);
                }
            } catch (e) {
                console.error("[biometric-import] parse failed:", e);
                toast.error(`Failed to parse file: ${e instanceof Error ? e.message : "unknown error"}`);
            } finally {
                setParsing(false);
            }
        },
        [buildRecords]
    );

    /* ─── Counts & filtered preview ───────────────────────────── */
    const counts = useMemo(() => {
        let ready = 0;
        let warning = 0;
        let error = 0;
        for (const r of records) {
            if (r.importStatus === "ready") ready++;
            else if (r.importStatus === "warning") warning++;
            else error++;
        }
        return { ready, warning, error };
    }, [records]);

    const filteredRecords = useMemo(() => {
        if (!search.trim()) return records;
        const q = search.toLowerCase();
        return records.filter(
            (r) =>
                r.employeeName.toLowerCase().includes(q) ||
                r.date.includes(q) ||
                (r.message?.toLowerCase().includes(q) ?? false)
        );
    }, [records, search]);

    /* ─── Import actions ──────────────────────────────────────── */
    const importValid = () => {
        const toImport = records.filter((r) => r.importStatus !== "error");
        if (toImport.length === 0) {
            toast.error("No valid records to import");
            return;
        }
        onImport(toImport);
        handleClose(false);
    };

    const importAll = () => {
        const toImport = records.filter((r) => r.importStatus !== "error");
        if (toImport.length === 0) {
            toast.error("No importable records (all rows have errors)");
            return;
        }
        onImport(toImport);
        handleClose(false);
    };

    /* ─── Render ──────────────────────────────────────────────── */
    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Fingerprint className="h-4 w-4" />
                        Import Biometric Time Logs
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Upload a T800 biometric export (XLSX or CSV). Logs are grouped per
                        employee per day before saving. Review the preview below, then choose
                        which rows to commit.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 overflow-y-auto pr-1">
                    {/* ── Upload zone ───────────────────────────────────────── */}
                    {records.length === 0 && (
                        <>
                            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-[11px] text-blue-700 dark:text-blue-300 space-y-1">
                                <p className="font-semibold">How matching works</p>
                                <ul className="space-y-0.5 list-disc list-inside opacity-90">
                                    <li>Personnel No is matched to <code className="font-mono">employee.biometricId</code> first.</li>
                                    <li>Falls back to a normalised name match (<code className="font-mono">LASTNAME, FIRSTNAME</code> ↔ <code className="font-mono">Firstname Lastname</code>).</li>
                                    <li>Same employee + same date is deduped: earliest IN, latest OUT.</li>
                                </ul>
                            </div>

                            <div
                                className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/60 p-8 cursor-pointer hover:border-primary/40 transition-colors"
                                onClick={() => fileRef.current?.click()}
                            >
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    className="hidden"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) handleFile(f);
                                    }}
                                />
                                {parsing ? (
                                    <>
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                        <p className="text-xs text-muted-foreground mt-2">Parsing biometric file…</p>
                                    </>
                                ) : file ? (
                                    <>
                                        <FileSpreadsheet className="h-8 w-8 text-primary" />
                                        <p className="text-sm font-medium mt-1">{file.name}</p>
                                    </>
                                ) : (
                                    <>
                                        <UploadCloud className="h-8 w-8 text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Click to upload XLSX or CSV from the biometric device
                                        </p>
                                    </>
                                )}
                            </div>
                        </>
                    )}

                    {/* ── Summary + preview ─────────────────────────────────── */}
                    {records.length > 0 && (
                        <>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-center">
                                    <CheckCircle className="h-4 w-4 mx-auto text-emerald-600 dark:text-emerald-400" />
                                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 leading-tight">
                                        {counts.ready}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">Ready</p>
                                </div>
                                <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5 text-center">
                                    <AlertTriangle className="h-4 w-4 mx-auto text-amber-600 dark:text-amber-400" />
                                    <p className="text-lg font-bold text-amber-700 dark:text-amber-400 leading-tight">
                                        {counts.warning}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">Warnings</p>
                                </div>
                                <div className="rounded-md border border-red-500/20 bg-red-500/5 p-2.5 text-center">
                                    <XCircle className="h-4 w-4 mx-auto text-red-600 dark:text-red-400" />
                                    <p className="text-lg font-bold text-red-700 dark:text-red-400 leading-tight">
                                        {counts.error}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">Unmatched / Errors</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Filter by name, date, or message…"
                                        className="pl-7 h-8 text-xs"
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 gap-1.5 text-xs"
                                    onClick={() => {
                                        reset();
                                    }}
                                >
                                    <RotateCcw className="h-3.5 w-3.5" /> Clear
                                </Button>
                            </div>

                            <div className="rounded-lg border border-border overflow-hidden">
                                <div className="max-h-[42vh] overflow-y-auto">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-muted/60 z-10">
                                            <TableRow>
                                                <TableHead className="text-xs">Employee</TableHead>
                                                <TableHead className="text-xs">Date</TableHead>
                                                <TableHead className="text-xs">In</TableHead>
                                                <TableHead className="text-xs">Out</TableHead>
                                                <TableHead className="text-xs">Hours</TableHead>
                                                <TableHead className="text-xs">Status</TableHead>
                                                <TableHead className="text-xs">Notes</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredRecords.map((r, idx) => {
                                                const rowClass =
                                                    r.importStatus === "error"
                                                        ? "bg-red-500/5"
                                                        : r.importStatus === "warning"
                                                            ? "bg-amber-500/5"
                                                            : "bg-emerald-500/5";
                                                return (
                                                    <TableRow key={`${r.employeeId}-${r.date}-${idx}`} className={rowClass}>
                                                        <TableCell className="text-xs font-medium">
                                                            {r.employeeName}
                                                        </TableCell>
                                                        <TableCell className="text-xs">{r.date}</TableCell>
                                                        <TableCell className="text-xs">{r.checkIn ?? "—"}</TableCell>
                                                        <TableCell className="text-xs">{r.checkOut ?? "—"}</TableCell>
                                                        <TableCell className="text-xs">
                                                            {r.hours != null ? r.hours.toFixed(2) : "—"}
                                                        </TableCell>
                                                        <TableCell className="text-xs">
                                                            {r.importStatus === "error" ? (
                                                                <Badge variant="outline" className="bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 text-[10px]">
                                                                    Error
                                                                </Badge>
                                                            ) : r.importStatus === "warning" ? (
                                                                <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px]">
                                                                    Warning
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                                                                    {r.status === "present" ? "Present" : "Absent"}
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-[11px] text-muted-foreground">
                                                            {r.message ?? "—"}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                            {filteredRecords.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">
                                                        No records match the filter.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* ── Actions ─────────────────────────────────────────────── */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
                    <Button variant="outline" size="sm" onClick={() => handleClose(false)}>
                        Cancel
                    </Button>
                    {records.length > 0 && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={counts.ready === 0}
                                onClick={importValid}
                                title="Import only rows marked Ready (skip warnings and errors)"
                            >
                                Import Valid Only ({counts.ready})
                            </Button>
                            <Button
                                size="sm"
                                disabled={counts.ready + counts.warning === 0}
                                onClick={importAll}
                                title="Import ready + warning rows (errors are always skipped)"
                            >
                                Import All ({counts.ready + counts.warning})
                            </Button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default BiometricImportDialog;
