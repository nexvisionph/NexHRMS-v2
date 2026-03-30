"use client";

import { useState } from "react";
import { useProjectsStore } from "@/store/projects.store";
import { useEmployeesStore } from "@/store/employees.store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import dynamic from "next/dynamic";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { sendNotification } from "@/lib/notifications";
import { FolderKanban, Plus, MapPin, UserPlus, Trash2, ScanFace, QrCode, UserCheck, Settings2, Pencil } from "lucide-react";
import type { Project, VerificationMethod } from "@/types";

const MapSelector = dynamic(
    () => import("@/components/projects/map-selector").then((m) => m.MapSelector),
    { ssr: false, loading: () => <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading map…</div> }
);
import { toast } from "sonner";

export default function AdminProjectsView() {
    const { projects, addProject, deleteProject, assignEmployee, removeEmployee, updateProject } = useProjectsStore();
    const employees = useEmployeesStore((s) => s.employees);

    const [addOpen, setAddOpen] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [lat, setLat] = useState("");
    const [lng, setLng] = useState("");
    const [radius, setRadius] = useState("100");
    const [locationAddress, setLocationAddress] = useState("");
    const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>("face_or_qr");

    const [assignOpen, setAssignOpen] = useState(false);
    const [assignProjectId, setAssignProjectId] = useState<string | null>(null);
    const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);

    // ── Edit project state ──────────────────────────────────────
    const [editOpen, setEditOpen] = useState(false);
    const [editProject, setEditProject] = useState<Project | null>(null);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editLat, setEditLat] = useState("");
    const [editLng, setEditLng] = useState("");
    const [editRadius, setEditRadius] = useState("100");
    const [editLocationAddress, setEditLocationAddress] = useState("");
    const [editVerificationMethod, setEditVerificationMethod] = useState<VerificationMethod>("face_or_qr");

    const openEditDialog = (project: Project) => {
        setEditProject(project);
        setEditName(project.name);
        setEditDescription(project.description || "");
        setEditLat(String(project.location.lat));
        setEditLng(String(project.location.lng));
        setEditRadius(String(project.location.radius));
        setEditLocationAddress(project.location.address || "");
        setEditVerificationMethod(project.verificationMethod || "face_or_qr");
        setEditOpen(true);
    };

    const handleEditSave = () => {
        if (!editProject) return;
        if (!editName || !editLat || !editLng) { toast.error("Please fill all required fields"); return; }
        updateProject(editProject.id, {
            name: editName,
            description: editDescription,
            location: { lat: Number(editLat), lng: Number(editLng), radius: Number(editRadius) || 100, address: editLocationAddress || undefined },
            verificationMethod: editVerificationMethod,
        });
        toast.success(`Project "${editName}" updated!`);
        setEditOpen(false);
        setEditProject(null);
    };

    const handleAddProject = () => {
        if (!name || !lat || !lng) { toast.error("Please fill all required fields"); return; }
        addProject({ name, description, location: { lat: Number(lat), lng: Number(lng), radius: Number(radius) || 100, address: locationAddress || undefined }, assignedEmployeeIds: [], verificationMethod });
        toast.success(`Project "${name}" created!`);
        setName(""); setDescription(""); setLat(""); setLng(""); setRadius("100"); setLocationAddress(""); setVerificationMethod("face_or_qr");
        setAddOpen(false);
    };

    const openAssignDialog = (projectId: string) => {
        const project = projects.find((p) => p.id === projectId);
        setAssignProjectId(projectId);
        setSelectedEmpIds(project?.assignedEmployeeIds || []);
        setAssignOpen(true);
    };

    const handleAssignSave = () => {
        if (!assignProjectId) return;
        const project = projects.find((p) => p.id === assignProjectId);
        if (!project) return;
        const currentIds = project.assignedEmployeeIds;
        const toAdd = selectedEmpIds.filter((id) => !currentIds.includes(id));
        const toRemove = currentIds.filter((id) => !selectedEmpIds.includes(id));
        // Warn about employees being moved from another project
        const moved = toAdd.filter((id) => projects.some((p) => p.id !== assignProjectId && p.assignedEmployeeIds.includes(id)));
        toAdd.forEach((empId) => {
            // assignEmployee in the store already strips from other projects
            assignEmployee(assignProjectId, empId);
            const emp = employees.find((e) => e.id === empId);
            if (emp) {
                sendNotification({ type: "assignment", employeeId: empId, employeeName: emp.name, employeeEmail: emp.email, subject: `New Project Assignment: ${project.name}`, body: `Hi ${emp.name}, you have been assigned to "${project.name}". Please report to the project site. Contact HR for details.` });
            }
        });
        toRemove.forEach((empId) => removeEmployee(assignProjectId, empId));
        if (moved.length) {
            const names = moved.map((id) => employees.find((e) => e.id === id)?.name || id).join(", ");
            toast.success(`Assignments updated! ${names} moved from their previous project.`);
        } else {
            toast.success("Assignments updated!");
        }
        setAssignOpen(false);
    };

    const toggleEmpSelection = (empId: string) => {
        setSelectedEmpIds((prev) => prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]);
    };

    // Returns the project name this employee is currently assigned to (excluding current assign dialog's project)
    const getEmpCurrentProject = (empId: string): string | null => {
        const other = projects.find((p) => p.id !== assignProjectId && p.assignedEmployeeIds.includes(empId));
        return other ? other.name : null;
    };

    const getEmpName = (id: string) => employees.find((e) => e.id === id)?.name || id;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">{projects.length} projects</p>
                </div>
                <Dialog open={addOpen} onOpenChange={setAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-1.5"><Plus className="h-4 w-4" /> New Project</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader><DialogTitle>Create Project</DialogTitle></DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="text-sm font-medium">Project Name *</label>
                                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nexvision" className="mt-1" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Description</label>
                                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." className="mt-1" rows={2} />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">Geofence Location *</label>
                                <MapSelector lat={lat} lng={lng} radius={radius} onLatChange={setLat} onLngChange={setLng} onRadiusChange={setRadius} onAddressChange={setLocationAddress} />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Verification Method</label>
                                <Select value={verificationMethod} onValueChange={(v) => setVerificationMethod(v as VerificationMethod)}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="face_only">Face Recognition Only</SelectItem>
                                        <SelectItem value="qr_only">QR Code Only</SelectItem>
                                        <SelectItem value="face_or_qr">Face OR QR (Employee Choice)</SelectItem>
                                        <SelectItem value="manual_only">Manual Check-in Only</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground mt-1">How employees check in for this project</p>
                            </div>
                            <Button onClick={handleAddProject} className="w-full">Create Project</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="border border-border/50">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-xs">ID</TableHead>
                                    <TableHead className="text-xs">Project Name</TableHead>
                                    <TableHead className="text-xs">Location</TableHead>
                                    <TableHead className="text-xs">Radius</TableHead>
                                    <TableHead className="text-xs">Status</TableHead>
                                    <TableHead className="text-xs">Verification</TableHead>
                                    <TableHead className="text-xs">Team</TableHead>
                                    <TableHead className="text-xs w-32">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {projects.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                                            <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-40" />No projects yet
                                        </TableCell>
                                    </TableRow>
                                ) : projects.map((project) => (
                                    <TableRow key={project.id}>
                                        <TableCell className="text-xs text-muted-foreground font-mono">{project.id}</TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="text-sm font-medium">{project.name}</p>
                                                {project.description && <p className="text-xs text-muted-foreground max-w-[250px] truncate">{project.description}</p>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-start gap-1.5 max-w-[220px]">
                                                <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                {project.location.address ? (
                                                    <span className="text-xs text-foreground leading-snug line-clamp-2" title={`${project.location.lat.toFixed(6)}, ${project.location.lng.toFixed(6)}`}>
                                                        {project.location.address}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground font-mono">
                                                        {project.location.lat.toFixed(4)}, {project.location.lng.toFixed(4)}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm">{project.location.radius}m</TableCell>
                                        <TableCell>
                                            <Select value={project.status || "active"} onValueChange={(v) => updateProject(project.id, { status: v as "active" | "completed" | "on_hold" })}>
                                                <SelectTrigger className="h-7 w-full sm:w-[110px] text-xs border-0 bg-transparent"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">🟢 Active</SelectItem>
                                                    <SelectItem value="completed">🔵 Completed</SelectItem>
                                                    <SelectItem value="on_hold">🟡 On Hold</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <VerificationBadge method={project.verificationMethod || "face_or_qr"} onUpdate={(m) => updateProject(project.id, { verificationMethod: m })} />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <div className="flex -space-x-2">
                                                    {project.assignedEmployeeIds.slice(0, 3).map((empId) => (
                                                        <Avatar key={empId} className="h-6 w-6 border-2 border-card">
                                                            <AvatarFallback className="text-[8px] bg-muted">{getInitials(getEmpName(empId))}</AvatarFallback>
                                                        </Avatar>
                                                    ))}
                                                </div>
                                                {project.assignedEmployeeIds.length > 3 && <span className="text-xs text-muted-foreground ml-1">+{project.assignedEmployeeIds.length - 3}</span>}
                                                {project.assignedEmployeeIds.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openAssignDialog(project.id)}>
                                                    <UserPlus className="h-3.5 w-3.5" /> Assign
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(project)}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-500/10" onClick={() => { deleteProject(project.id); toast.success("Project deleted"); }}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>Assign Employees to Project</DialogTitle></DialogHeader>
                    <p className="text-xs text-muted-foreground -mt-1">Each employee can only be assigned to one project at a time.</p>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 pt-1">
                        {employees.filter((e) => e.status === "active").map((emp) => {
                            const currentProj = getEmpCurrentProject(emp.id);
                            const isSelected = selectedEmpIds.includes(emp.id);
                            return (
                                <div key={emp.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                                    isSelected ? "border-primary/50 bg-primary/5" : currentProj ? "border-amber-500/30 bg-amber-500/5" : "border-border/50 hover:bg-muted/50"
                                }`} onClick={() => toggleEmpSelection(emp.id)}>
                                    <Checkbox checked={isSelected} />
                                    <Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-muted">{getInitials(emp.name)}</AvatarFallback></Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">{emp.name}</p>
                                        <p className="text-xs text-muted-foreground">{emp.role} · {emp.department}</p>
                                        {currentProj && !isSelected && (
                                            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Currently on: {currentProj} — will be moved</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <Button onClick={handleAssignSave} className="w-full mt-2">Save Assignments ({selectedEmpIds.length} selected)</Button>
                </DialogContent>
            </Dialog>

            {/* ── Edit Project Dialog ───────────────────────────────── */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div>
                            <label className="text-sm font-medium">Project Name *</label>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nexvision" className="mt-1" />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Description</label>
                            <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Brief description..." className="mt-1" rows={2} />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Geofence Location *</label>
                            <MapSelector
                                lat={editLat}
                                lng={editLng}
                                radius={editRadius}
                                onLatChange={setEditLat}
                                onLngChange={setEditLng}
                                onRadiusChange={setEditRadius}
                                onAddressChange={setEditLocationAddress}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Verification Method</label>
                            <Select value={editVerificationMethod} onValueChange={(v) => setEditVerificationMethod(v as VerificationMethod)}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="face_only">Face Recognition Only</SelectItem>
                                    <SelectItem value="qr_only">QR Code Only</SelectItem>
                                    <SelectItem value="face_or_qr">Face OR QR (Employee Choice)</SelectItem>
                                    <SelectItem value="manual_only">Manual Check-in Only</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">How employees check in for this project</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setEditOpen(false)} className="flex-1">Cancel</Button>
                            <Button onClick={handleEditSave} className="flex-1">Save Changes</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Inline verification method badge with quick-change dropdown ──────────
const VERIFICATION_META: Record<VerificationMethod, { label: string; icon: React.ElementType; color: string }> = {
    face_only: { label: "Face", icon: ScanFace, color: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
    qr_only: { label: "QR", icon: QrCode, color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
    face_or_qr: { label: "Face / QR", icon: Settings2, color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
    manual_only: { label: "Manual", icon: UserCheck, color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
};

function VerificationBadge({ method, onUpdate }: { method: VerificationMethod; onUpdate: (m: VerificationMethod) => void }) {
    const meta = VERIFICATION_META[method] || VERIFICATION_META.face_or_qr;
    const Icon = meta.icon;
    return (
        <Select value={method} onValueChange={(v) => onUpdate(v as VerificationMethod)}>
            <SelectTrigger className={cn("h-7 w-auto text-xs border-0 gap-1.5 px-2 rounded-full", meta.color)}>
                <Icon className="h-3 w-3" />
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="face_only"><span className="flex items-center gap-1.5"><ScanFace className="h-3 w-3" /> Face Only</span></SelectItem>
                <SelectItem value="qr_only"><span className="flex items-center gap-1.5"><QrCode className="h-3 w-3" /> QR Only</span></SelectItem>
                <SelectItem value="face_or_qr"><span className="flex items-center gap-1.5"><Settings2 className="h-3 w-3" /> Face / QR</span></SelectItem>
                <SelectItem value="manual_only"><span className="flex items-center gap-1.5"><UserCheck className="h-3 w-3" /> Manual</span></SelectItem>
            </SelectContent>
        </Select>
    );
}
