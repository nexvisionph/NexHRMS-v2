"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useEmployeesStore } from "@/store/employees.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmployeeCombobox } from "@/components/ui/employee-combobox";
import { Download } from "lucide-react";
import { toast } from "sonner";

const METHOD_COLORS: Record<string, { bg: string; text: string }> = {
  fingerprint: { bg: "#22C55E", text: "#ffffff" },
  face: { bg: "#3B82F6", text: "#ffffff" },
  rfid: { bg: "#EAB308", text: "#111827" },
  pin: { bg: "#F97316", text: "#ffffff" },
  manual: { bg: "#EF4444", text: "#ffffff" },
};

const METHOD_OPTIONS = ["all", "fingerprint", "face", "palm", "rfid", "pin", "manual"];

type LogRow = {
  id: string;
  employee_id: string;
  recognition_method: string;
  log_type: "time_in" | "time_out";
  logged_at: string;
  confidence_score?: number | null;
  low_confidence: boolean;
  employee?: { id: string; name: string; email: string; department?: string };
  device?: { id: string; name: string; location?: string; device_type?: string };
};

type DeviceRow = { id: string; name: string };

export default function BiometricLogsPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const employees = useEmployeesStore((s) => s.employees);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [employeeId, setEmployeeId] = useState("all");
  const [deviceId, setDeviceId] = useState("all");
  const [method, setMethod] = useState("all");

  const canRead = ["admin", "hr"].includes(currentUser?.role);

  useEffect(() => {
    if (!canRead) return;
    loadDevices();
  }, [canRead]);

  useEffect(() => {
    if (!canRead) return;
    loadLogs();
  }, [canRead, dateFrom, dateTo, employeeId, deviceId, method]);

  const loadDevices = async () => {
    try {
      const res = await fetch("/api/biometric/devices");
      const data = await res.json();
      setDevices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (employeeId !== "all") params.set("employee_id", employeeId);
      if (deviceId !== "all") params.set("device_id", deviceId);
      if (method !== "all") params.set("method", method);

      const res = await fetch(`/api/biometric/logs?${params.toString()}`);
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  const formatManilaDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "2-digit", year: "numeric" });

  const formatManilaTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit" });

  const exportCsv = () => {
    if (logs.length === 0) return;
    const csvRows = [
      ["Employee", "Date", "Time In", "Time Out", "Method", "Device", "Confidence", "Low Confidence", "Needs Review"],
      ...logs.map((log) => [
        log.employee?.name || log.employee_id,
        formatManilaDate(log.logged_at),
        log.log_type === "time_in" ? formatManilaTime(log.logged_at) : "",
        log.log_type === "time_out" ? formatManilaTime(log.logged_at) : "",
        log.recognition_method,
        log.device?.name || "",
        log.confidence_score ?? "",
        log.low_confidence ? "yes" : "no",
        ["pin", "manual"].includes(log.recognition_method) ? "yes" : "no",
      ]),
    ];
    const csv = csvRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `biometric-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const rows = useMemo(() => logs, [logs]);

  if (!canRead) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">You do not have access to biometric logs.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Biometric Logs</h1>
          <p className="text-sm text-muted-foreground">Review attendance scans and verification confidence</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />
          <EmployeeCombobox value={employeeId} onValueChange={setEmployeeId} allLabel="All Employees" className="w-[220px]" />
          <Select value={deviceId} onValueChange={setDeviceId}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Devices" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Devices</SelectItem>
              {devices.map((dev) => (
                <SelectItem key={dev.id} value={dev.id}>{dev.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Methods" /></SelectTrigger>
            <SelectContent>
              {METHOD_OPTIONS.map((m) => (
                <SelectItem key={m} value={m}>{m.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">{rows.length} log(s)</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log Entries</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-2">Employee</th>
                <th className="py-2">Date</th>
                <th className="py-2">Time In</th>
                <th className="py-2">Time Out</th>
                <th className="py-2">Method</th>
                <th className="py-2">Device</th>
                <th className="py-2">Confidence</th>
                <th className="py-2">Flags</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">Loading logs...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No biometric logs found</td></tr>
              ) : (
                rows.map((log) => {
                  const color = METHOD_COLORS[log.recognition_method] || { bg: "#64748B", text: "#ffffff" };
                  const needsReview = ["pin", "manual"].includes(log.recognition_method);
                  return (
                    <tr key={log.id} className="border-t">
                      <td className="py-3 font-medium">{log.employee?.name || log.employee_id}</td>
                      <td className="py-3">{formatManilaDate(log.logged_at)}</td>
                      <td className="py-3">{log.log_type === "time_in" ? formatManilaTime(log.logged_at) : "—"}</td>
                      <td className="py-3">{log.log_type === "time_out" ? formatManilaTime(log.logged_at) : "—"}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: color.bg, color: color.text }}>
                          {log.recognition_method.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground">{log.device?.name || "—"}</td>
                      <td className="py-3">
                        {log.confidence_score !== null && log.confidence_score !== undefined ? `${log.confidence_score}` : "—"}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {log.low_confidence && <Badge variant="outline" className="text-[10px] text-red-600">Low Confidence</Badge>}
                          {needsReview && <Badge variant="outline" className="text-[10px] text-amber-600">Needs Review</Badge>}
                          {!log.low_confidence && !needsReview && <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
