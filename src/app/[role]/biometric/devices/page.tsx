"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Power } from "lucide-react";

const METHOD_COLORS: Record<string, { bg: string; text: string }> = {
  fingerprint: { bg: "#22C55E", text: "#ffffff" },
  face: { bg: "#3B82F6", text: "#ffffff" },
  rfid: { bg: "#EAB308", text: "#111827" },
  pin: { bg: "#F97316", text: "#ffffff" },
  manual: { bg: "#EF4444", text: "#ffffff" },
};

const METHOD_OPTIONS = ["fingerprint", "face", "rfid", "pin"];

type DeviceRow = {
  id: string;
  name: string;
  location?: string;
  device_type?: string;
  supported_methods: string[];
  is_active: boolean;
  last_synced_at?: string;
  api_key_last4?: string;
  created_at?: string;
};

export default function BiometricDevicesPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeviceRow | null>(null);
  const [deviceKey, setDeviceKey] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    location: "",
    device_type: "",
    supported_methods: [] as string[],
  });

  const canRead = ["admin", "hr"].includes(currentUser?.role);
  const canManage = currentUser?.role === "admin";

  useEffect(() => {
    if (!canRead) return;
    loadDevices();
  }, [canRead]);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/biometric/devices");
      const data = await res.json();
      setDevices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setDeviceKey(null);
    setForm({ name: "", location: "", device_type: "", supported_methods: [] });
    setDialogOpen(true);
  };

  const openEdit = (device: DeviceRow) => {
    setEditing(device);
    setDeviceKey(null);
    setForm({
      name: device.name || "",
      location: device.location || "",
      device_type: device.device_type || "",
      supported_methods: device.supported_methods || [],
    });
    setDialogOpen(true);
  };

  const toggleMethod = (method: string) => {
    setForm((prev) => {
      if (prev.supported_methods.includes(method)) {
        return { ...prev, supported_methods: prev.supported_methods.filter((m) => m !== method) };
      }
      return { ...prev, supported_methods: [...prev.supported_methods, method] };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Device name is required");
      return;
    }

    try {
      if (editing) {
        const res = await fetch(`/api/biometric/devices/${editing.id}` , {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error("Failed to update device");
        toast.success("Device updated");
      } else {
        const res = await fetch("/api/biometric/devices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to create device");
        setDeviceKey(data.device_key || null);
        toast.success("Device created");
      }
      await loadDevices();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save device");
    }
  };

  const handleToggleActive = async (device: DeviceRow) => {
    try {
      const res = await fetch(`/api/biometric/devices/${device.id}` , {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !device.is_active }),
      });
      if (!res.ok) throw new Error("Failed to update device");
      toast.success(device.is_active ? "Device deactivated" : "Device activated");
      await loadDevices();
    } catch (error) {
      console.error(error);
      toast.error("Failed to update device status");
    }
  };

  const formatManila = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const rows = useMemo(() => devices, [devices]);

  if (!canRead) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">You do not have access to biometric devices.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Biometric Devices</h1>
          <p className="text-sm text-muted-foreground">Manage scanners and device access keys</p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Add Device
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered Devices</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-2">Name</th>
                <th className="py-2">Location</th>
                <th className="py-2">Type</th>
                <th className="py-2">Methods</th>
                <th className="py-2">Last Synced</th>
                <th className="py-2">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Loading devices...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No devices registered</td></tr>
              ) : (
                rows.map((device) => (
                  <tr key={device.id} className="border-t">
                    <td className="py-3 font-medium">{device.name}</td>
                    <td className="py-3 text-muted-foreground">{device.location || "—"}</td>
                    <td className="py-3">{device.device_type || "—"}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1">
                        {(device.supported_methods || []).map((method) => {
                          const color = METHOD_COLORS[method];
                          return (
                            <span
                              key={method}
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{ backgroundColor: color?.bg, color: color?.text }}
                            >
                              {method.toUpperCase()}
                            </span>
                          );
                        })}
                        {device.supported_methods?.length === 0 && <Badge variant="outline" className="text-[10px]">None</Badge>}
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">{formatManila(device.last_synced_at)}</td>
                    <td className="py-3">
                      <Badge variant="outline" className={device.is_active ? "text-emerald-600" : "text-red-600"}>
                        {device.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(device)} disabled={!canManage}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleToggleActive(device)} disabled={!canManage}>
                          <Power className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Device" : "Add Device"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <Label>Device Type</Label>
              <Input value={form.device_type} onChange={(e) => setForm({ ...form, device_type: e.target.value })} />
            </div>
            <div>
              <Label>Supported Methods</Label>
              <div className="flex flex-wrap gap-2 pt-2">
                {METHOD_OPTIONS.map((method) => (
                  <label key={method} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.supported_methods.includes(method)}
                      onChange={() => toggleMethod(method)}
                    />
                    {method.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
            {deviceKey && (
              <div className="rounded-lg border border-amber-300/40 bg-amber-50 p-3 text-sm">
                <p className="font-medium">Device API Key (copy now)</p>
                <p className="mt-1 font-mono text-xs break-all">{deviceKey}</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
              {canManage && <Button onClick={handleSave}>{editing ? "Save" : "Create"}</Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
