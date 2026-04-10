"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore, PERMISSION_GROUPS, ALL_PERMISSIONS } from "@/store/roles.store";
import type { CustomRole, Permission } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
    Shield, Plus, Pencil, Trash2, Copy, Users, Download, Upload,
    ChevronDown, ChevronRight, Lock, RotateCcw,
} from "lucide-react";

export default function RolesPage() {
    const role = useAuthStore((s) => s.currentUser.role);
    const {
        roles, createRole, updateRole, deleteRole, duplicateRole,
        setPermissions, exportConfig, importConfig, resetToDefaults,
    } = useRolesStore();

    const canManage = role === "admin";

    // Create dialog
    const [createOpen, setCreateOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [newSlug, setNewSlug] = useState("");
    const [newColor, setNewColor] = useState("#6366f1");

    // Edit dialog
    const [editRole, setEditRole] = useState<CustomRole | null>(null);
    const [editName, setEditName] = useState("");
    const [editColor, setEditColor] = useState("");
    const [editPerms, setEditPerms] = useState<Permission[]>([]);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // Delete
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Reset to defaults
    const [resetOpen, setResetOpen] = useState(false);

    // Import
    const [importOpen, setImportOpen] = useState(false);
    const [importJson, setImportJson] = useState("");

    if (!canManage) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-2">
                    <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
                    <h2 className="text-lg font-semibold">Access Restricted</h2>
                    <p className="text-sm text-muted-foreground">Only administrators can manage roles.</p>
                </div>
            </div>
        );
    }

    const handleCreate = () => {
        if (!newName || !newSlug) { toast.error("Name and slug are required"); return; }
        if (roles.some((r) => r.slug === newSlug)) { toast.error("Slug already exists"); return; }
        createRole({ name: newName, slug: newSlug, color: newColor, icon: "Users", permissions: ["page:dashboard"], dashboardLayout: undefined });
        toast.success(`Role "${newName}" created`);
        setNewName(""); setNewSlug(""); setNewColor("#6366f1");
        setCreateOpen(false);
    };

    const openEdit = (r: CustomRole) => {
        setEditRole(r);
        setEditName(r.name);
        setEditColor(r.color);
        setEditPerms([...r.permissions]);
        setExpandedGroups(new Set());
    };

    const handleSaveEdit = () => {
        if (!editRole) return;
        updateRole(editRole.id, { name: editName, color: editColor });
        setPermissions(editRole.id, editPerms);
        toast.success(`Role "${editName}" updated`);
        setEditRole(null);
    };

    const togglePerm = (perm: Permission) => {
        setEditPerms((prev) =>
            prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
        );
    };

    const toggleGroup = (groupLabel: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupLabel)) { next.delete(groupLabel); } else { next.add(groupLabel); }
            return next;
        });
    };

    const selectAllInGroup = (perms: Permission[]) => {
        setEditPerms((prev) => {
            const set = new Set(prev);
            perms.forEach((p) => set.add(p));
            return Array.from(set);
        });
    };

    const deselectAllInGroup = (perms: Permission[]) => {
        setEditPerms((prev) => prev.filter((p) => !perms.includes(p)));
    };

    const handleExport = () => {
        const blob = new Blob([exportConfig()], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "nexhrms-roles-config.json"; a.click();
        URL.revokeObjectURL(url);
        toast.success("Configuration exported");
    };

    const handleImport = () => {
        const result = importConfig(importJson);
        if (result.ok) { toast.success(`Imported ${result.imported} items`); setImportOpen(false); setImportJson(""); }
        else { toast.error(result.error || "Import failed"); }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Shield className="h-6 w-6" /> Role Management
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Create custom roles, manage permissions, and configure dashboards.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10" onClick={() => setResetOpen(true)}>
                        <RotateCcw className="h-3.5 w-3.5" /> Reset Defaults
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
                        <Download className="h-3.5 w-3.5" /> Export
                    </Button>
                    <Dialog open={importOpen} onOpenChange={setImportOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5">
                                <Upload className="h-3.5 w-3.5" /> Import
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Import Configuration</DialogTitle></DialogHeader>
                            <textarea
                                className="w-full h-40 rounded-md border border-border bg-background p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder='Paste exported JSON here...'
                                value={importJson}
                                onChange={(e) => setImportJson(e.target.value)}
                            />
                            <Button onClick={handleImport} className="w-full">Import</Button>
                        </DialogContent>
                    </Dialog>
                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="gap-1.5">
                                <Plus className="h-3.5 w-3.5" /> New Role
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>Create Custom Role</DialogTitle></DialogHeader>
                            <div className="space-y-3 pt-2">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Name</label>
                                    <Input placeholder="e.g. Team Lead" value={newName} onChange={(e) => { setNewName(e.target.value); setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")); }} />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Slug (unique identifier)</label>
                                    <Input placeholder="e.g. team_lead" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Color</label>
                                    <div className="flex items-center gap-2">
                                        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer" />
                                        <Input value={newColor} onChange={(e) => setNewColor(e.target.value)} className="flex-1" />
                                    </div>
                                </div>
                                <Button onClick={handleCreate} className="w-full">Create Role</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Roles grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map((r) => (
                    <Card key={r.id} className="border border-border/50 hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: r.color + "20" }}>
                                        <Users className="h-4 w-4" style={{ color: r.color }} />
                                    </div>
                                    <div>
                                        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                                            {r.name}
                                            {r.isSystem && <Lock className="h-3 w-3 text-muted-foreground" />}
                                        </CardTitle>
                                        <p className="text-[10px] text-muted-foreground font-mono">{r.slug}</p>
                                    </div>
                                </div>
                                <Badge variant="secondary" className="text-[10px]" style={{ backgroundColor: r.color + "15", color: r.color }}>
                                    {r.permissions.length} perms
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="flex flex-wrap gap-1 mt-2 mb-3">
                                {r.permissions.filter((p) => p.startsWith("page:")).slice(0, 6).map((p) => (
                                    <Badge key={p} variant="outline" className="text-[9px] px-1.5 py-0">
                                        {p.replace("page:", "")}
                                    </Badge>
                                ))}
                                {r.permissions.filter((p) => p.startsWith("page:")).length > 6 && (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                        +{r.permissions.filter((p) => p.startsWith("page:")).length - 6}
                                    </Badge>
                                )}
                            </div>
                            <Separator className="my-2" />
                            <div className="flex items-center gap-1.5">
                                <Button variant="outline" size="sm" className="flex-1 h-7 text-xs gap-1" onClick={() => openEdit(r)}>
                                    <Pencil className="h-3 w-3" /> Edit
                                </Button>
                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => { duplicateRole(r.id); toast.success("Role duplicated"); }}>
                                    <Copy className="h-3 w-3" />
                                </Button>
                                {!r.isSystem && (
                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => setDeleteId(r.id)}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Edit Role Dialog */}
            <Dialog open={!!editRole} onOpenChange={(o) => !o && setEditRole(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded flex items-center justify-center" style={{ backgroundColor: editColor + "20" }}>
                                <Shield className="h-3.5 w-3.5" style={{ color: editColor }} />
                            </div>
                            Edit Role: {editName}
                            {editRole?.isSystem && <Badge variant="secondary" className="text-[10px]">System</Badge>}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Name</label>
                                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Color</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="h-9 w-9 rounded cursor-pointer" />
                                    <Input value={editColor} onChange={(e) => setEditColor(e.target.value)} className="flex-1" />
                                </div>
                            </div>
                        </div>
                        <Separator />
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold">Permissions ({editPerms.length}/{ALL_PERMISSIONS.length})</h3>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditPerms([...ALL_PERMISSIONS])}>Select All</Button>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditPerms([])}>Clear All</Button>
                                </div>
                            </div>
                            <ScrollArea className="h-[340px] pr-4">
                                <div className="space-y-2">
                                    {PERMISSION_GROUPS.map((group) => {
                                        const isExpanded = expandedGroups.has(group.label);
                                        const groupPerms = group.permissions.map((p) => p.key);
                                        const checkedCount = groupPerms.filter((p) => editPerms.includes(p)).length;
                                        return (
                                            <div key={group.label} className="border border-border/50 rounded-lg">
                                                <button
                                                    className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 transition-colors rounded-lg"
                                                    onClick={() => toggleGroup(group.label)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                        <span className="text-sm font-medium">{group.label}</span>
                                                    </div>
                                                    <Badge variant="secondary" className="text-[10px]">
                                                        {checkedCount}/{groupPerms.length}
                                                    </Badge>
                                                </button>
                                                {isExpanded && (
                                                    <div className="px-3 pb-3 space-y-2">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => selectAllInGroup(groupPerms)}>All</Button>
                                                            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => deselectAllInGroup(groupPerms)}>None</Button>
                                                        </div>
                                                        {group.permissions.map((p) => (
                                                            <div key={p.key} className="flex items-center gap-2">
                                                                <Checkbox
                                                                    id={p.key}
                                                                    checked={editPerms.includes(p.key)}
                                                                    onCheckedChange={() => togglePerm(p.key)}
                                                                />
                                                                <label htmlFor={p.key} className="text-xs cursor-pointer flex-1">
                                                                    {p.label}
                                                                    <span className="text-muted-foreground ml-1 font-mono text-[10px]">({p.key})</span>
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                    <div className="flex gap-2 pt-4 border-t border-border">
                        <Button variant="outline" className="flex-1" onClick={() => setEditRole(null)}>Cancel</Button>
                        <Button className="flex-1" onClick={handleSaveEdit}>Save Changes</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Reset to defaults confirmation */}
            <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset All Roles to Defaults?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove all custom roles and restore all system roles to their factory permission sets and dashboard layouts. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => {
                            resetToDefaults();
                            toast.success("All roles reset to defaults");
                            setResetOpen(false);
                        }}>Reset</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete confirmation */}
            <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Role?</AlertDialogTitle>
                        <AlertDialogDescription>This role will be permanently removed. Users assigned to this role should be reassigned first.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => {
                            if (deleteId) {
                                const ok = deleteRole(deleteId);
                                if (ok) toast.success("Role deleted");
                                else toast.error("Cannot delete system role");
                                setDeleteId(null);
                            }
                        }}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
