"use client";

import { useState, useMemo } from "react";
import { useAuthStore } from "@/store/auth.store";
import { usePageBuilderStore } from "@/store/page-builder.store";
import { useRolesStore } from "@/store/roles.store";
import { WIDGET_CATALOG, getWidgetMeta } from "@/components/dashboard-builder/widget-registry";
import { WidgetGrid } from "@/components/dashboard-builder/widget-grid";
import type { WidgetConfig, WidgetType } from "@/types";
import { nanoid } from "nanoid";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
    FileText, Plus, Save, Trash2, GripVertical, Eye,
    Columns, ChevronUp, ChevronDown, Pencil, Copy, Upload, Download,
} from "lucide-react";

export default function PageBuilderPage() {
    const role = useAuthStore((s) => s.currentUser.role);
    const store = usePageBuilderStore();
    const { roles } = useRolesStore();
    const canManage = role === "admin";

    const [showCreate, setShowCreate] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [importOpen, setImportOpen] = useState(false);
    const [importJson, setImportJson] = useState("");

    // Create form
    const [newTitle, setNewTitle] = useState("");
    const [newSlug, setNewSlug] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [newRoles, setNewRoles] = useState<string[]>([]);
    const [newShow, setNewShow] = useState(true);

    // Edit form
    const [editTitle, setEditTitle] = useState("");
    const [editSlug, setEditSlug] = useState("");
    const [editDesc, setEditDesc] = useState("");
    const [editRoles, setEditRoles] = useState<string[]>([]);
    const [editShow, setEditShow] = useState(true);
    const [editWidgets, setEditWidgets] = useState<WidgetConfig[]>([]);
    const [editPreview, setEditPreview] = useState(false);

    const openEdit = (id: string) => {
        const p = store.getPageById(id);
        if (!p) return;
        setEditId(id);
        setEditTitle(p.title);
        setEditSlug(p.slug);
        setEditDesc(p.description || "");
        setEditRoles(p.allowedRoles);
        setEditShow(p.showInSidebar);
        setEditWidgets(p.widgets);
        setEditPreview(false);
    };

    const handleCreate = () => {
        if (!newTitle.trim()) return toast.error("Title is required");
        const slug = newSlug.trim() || newTitle.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        if (store.getPageBySlug(slug)) return toast.error("Slug already exists");
        store.createPage({
            title: newTitle.trim(),
            slug,
            icon: "FileText",
            description: newDesc.trim() || undefined,
            allowedRoles: newRoles.length > 0 ? newRoles : ["admin"],
            widgets: [],
            showInSidebar: newShow,
            order: store.pages.length,
        });
        setShowCreate(false);
        setNewTitle(""); setNewSlug(""); setNewDesc(""); setNewRoles([]); setNewShow(true);
        toast.success("Page created");
    };

    const handleSaveEdit = () => {
        if (!editId || !editTitle.trim()) return;
        store.updatePage(editId, {
            title: editTitle.trim(),
            slug: editSlug.trim(),
            description: editDesc.trim() || undefined,
            allowedRoles: editRoles,
            showInSidebar: editShow,
        });
        store.setWidgets(editId, editWidgets);
        setEditId(null);
        toast.success("Page saved");
    };

    const addWidgetToEdit = (type: WidgetType) => {
        const meta = getWidgetMeta(type);
        setEditWidgets((prev) => [...prev, {
            id: `w-${nanoid(6)}`,
            type,
            colSpan: meta?.defaultColSpan || 1,
            order: prev.length,
        }]);
    };

    const removeEditWidget = (id: string) => {
        setEditWidgets((prev) => prev.filter((w) => w.id !== id).map((w, i) => ({ ...w, order: i })));
    };

    const moveEditWidget = (id: string, dir: -1 | 1) => {
        setEditWidgets((prev) => {
            const sorted = [...prev].sort((a, b) => a.order - b.order);
            const idx = sorted.findIndex((w) => w.id === id);
            if (idx < 0) return prev;
            const ni = idx + dir;
            if (ni < 0 || ni >= sorted.length) return prev;
            [sorted[idx], sorted[ni]] = [sorted[ni], sorted[idx]];
            return sorted.map((w, i) => ({ ...w, order: i }));
        });
    };

    const changeEditColSpan = (id: string, colSpan: WidgetConfig["colSpan"]) => {
        setEditWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, colSpan } : w)));
    };

    const handleExport = () => {
        const blob = new Blob([store.exportPages()], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "nexhrms-pages.json"; a.click();
        URL.revokeObjectURL(url);
        toast.success("Pages exported");
    };

    const handleImport = () => {
        const res = store.importPages(importJson);
        if (res.ok) { toast.success(`Imported ${res.imported} pages`); setImportOpen(false); setImportJson(""); }
        else toast.error(res.error || "Import failed");
    };

    const categories = useMemo(() => {
        const cats: Record<string, typeof WIDGET_CATALOG> = {};
        for (const w of WIDGET_CATALOG) {
            if (!cats[w.category]) cats[w.category] = [];
            cats[w.category].push(w);
        }
        return cats;
    }, []);

    const catLabels: Record<string, string> = { kpi: "KPIs", chart: "Charts", table: "Tables", personal: "Personal", general: "General" };

    const toggleRole = (roleSlug: string, list: string[], setter: (v: string[]) => void) => {
        setter(list.includes(roleSlug) ? list.filter((r) => r !== roleSlug) : [...list, roleSlug]);
    };

    if (!canManage) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-2">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                    <h2 className="text-lg font-semibold">Access Restricted</h2>
                    <p className="text-sm text-muted-foreground">Only administrators can manage pages.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <FileText className="h-6 w-6" /> Page Builder
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Create custom pages with widgets for any role.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
                        <Plus className="h-3.5 w-3.5" /> New Page
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
                        <Download className="h-3.5 w-3.5" /> Export
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportOpen(true)}>
                        <Upload className="h-3.5 w-3.5" /> Import
                    </Button>
                </div>
            </div>

            {store.pages.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="p-12 text-center">
                        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                        <h3 className="text-lg font-semibold">No Custom Pages Yet</h3>
                        <p className="text-sm text-muted-foreground mt-1 mb-4">
                            Create your first custom page with widgets and assign it to roles.
                        </p>
                        <Button size="sm" onClick={() => setShowCreate(true)}>
                            <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Page
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {store.pages.map((page) => (
                        <Card key={page.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="h-4 w-4 text-primary shrink-0" />
                                        <h3 className="font-semibold truncate">{page.title}</h3>
                                    </div>
                                    <Badge variant="secondary" className="shrink-0">{page.widgets.length} widgets</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">/custom/{page.slug}</p>
                                {page.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">{page.description}</p>
                                )}
                                <div className="flex flex-wrap gap-1">
                                    {page.allowedRoles.map((r) => (
                                        <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>
                                    ))}
                                </div>
                                <div className="flex items-center gap-1 pt-1">
                                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openEdit(page.id)}>
                                        <Pencil className="h-3 w-3" /> Edit
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { store.duplicatePage(page.id); toast.success("Page duplicated"); }}>
                                        <Copy className="h-3 w-3" /> Duplicate
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 gap-1 ml-auto">
                                                <Trash2 className="h-3 w-3" /> Delete
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete &quot;{page.title}&quot;?</AlertDialogTitle>
                                                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => { store.deletePage(page.id); toast.success("Page deleted"); }}>Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create Dialog */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Create Custom Page</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-medium">Title</label>
                            <Input value={newTitle} onChange={(e) => { setNewTitle(e.target.value); if (!newSlug) setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")); }} placeholder="My Custom Page" />
                        </div>
                        <div>
                            <label className="text-xs font-medium">Slug</label>
                            <Input value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="my-custom-page" />
                            <p className="text-[10px] text-muted-foreground mt-0.5">URL: /custom/{newSlug || "..."}</p>
                        </div>
                        <div>
                            <label className="text-xs font-medium">Description</label>
                            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Optional description" />
                        </div>
                        <div>
                            <label className="text-xs font-medium">Allowed Roles</label>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {roles.map((r) => (
                                    <label key={r.slug} className="flex items-center gap-1.5 text-xs">
                                        <Checkbox checked={newRoles.includes(r.slug)} onCheckedChange={() => toggleRole(r.slug, newRoles, setNewRoles)} />
                                        {r.name}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <label className="flex items-center gap-2 text-xs">
                            <Checkbox checked={newShow} onCheckedChange={(v) => setNewShow(!!v)} />
                            Show in sidebar
                        </label>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                        <Button onClick={handleCreate}>Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog — full screen */}
            <Dialog open={!!editId} onOpenChange={(open) => { if (!open) setEditId(null); }}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Edit Page: {editTitle}</DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden">
                        <ScrollArea className="h-[calc(90vh-160px)]">
                            <div className="space-y-4 pr-3">
                                {/* Metadata */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-medium">Title</label>
                                        <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium">Slug</label>
                                        <Input value={editSlug} onChange={(e) => setEditSlug(e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium">Description</label>
                                    <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs font-medium">Allowed Roles</label>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {roles.map((r) => (
                                            <label key={r.slug} className="flex items-center gap-1.5 text-xs">
                                                <Checkbox checked={editRoles.includes(r.slug)} onCheckedChange={() => toggleRole(r.slug, editRoles, setEditRoles)} />
                                                {r.name}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 text-xs">
                                    <Checkbox checked={editShow} onCheckedChange={(v) => setEditShow(!!v)} />
                                    Show in sidebar
                                </label>

                                <Separator />

                                {/* Preview toggle */}
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold">Widgets ({editWidgets.length})</h3>
                                    <Button variant="outline" size="sm" className="gap-1.5 h-7" onClick={() => setEditPreview(!editPreview)}>
                                        <Eye className="h-3 w-3" /> {editPreview ? "Edit" : "Preview"}
                                    </Button>
                                </div>

                                {editPreview ? (
                                    <div className="border border-dashed border-primary/30 rounded-xl p-4 bg-primary/5">
                                        <WidgetGrid widgets={editWidgets} />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
                                        {/* Widget list */}
                                        <div className="space-y-2">
                                            {editWidgets.length === 0 && (
                                                <p className="text-xs text-muted-foreground p-4 text-center border border-dashed rounded-lg">
                                                    No widgets yet. Add from the catalog.
                                                </p>
                                            )}
                                            {[...editWidgets].sort((a, b) => a.order - b.order).map((w, idx) => {
                                                const meta = getWidgetMeta(w.type);
                                                const Icon = meta?.icon || FileText;
                                                return (
                                                    <div key={w.id} className="flex items-center gap-2 p-2 border rounded-lg">
                                                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                        <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                                                        <span className="text-xs font-medium flex-1 truncate">{meta?.label || w.type}</span>
                                                        <Select value={String(w.colSpan)} onValueChange={(v) => changeEditColSpan(w.id, Number(v) as WidgetConfig["colSpan"])}>
                                                            <SelectTrigger className="w-14 h-6 text-[10px]">
                                                                <Columns className="h-2.5 w-2.5 mr-0.5" />
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="1">1</SelectItem>
                                                                <SelectItem value="2">2</SelectItem>
                                                                <SelectItem value="3">3</SelectItem>
                                                                <SelectItem value="4">4</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => moveEditWidget(w.id, -1)}>
                                                            <ChevronUp className="h-3 w-3" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === editWidgets.length - 1} onClick={() => moveEditWidget(w.id, 1)}>
                                                            <ChevronDown className="h-3 w-3" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeEditWidget(w.id)}>
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {/* Mini catalog */}
                                        <ScrollArea className="h-[300px]">
                                            <div className="space-y-3 pr-2">
                                                {Object.entries(categories).map(([cat, items]) => (
                                                    <div key={cat}>
                                                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1">
                                                            {catLabels[cat] || cat}
                                                        </h4>
                                                        {items.map((meta) => {
                                                            const added = editWidgets.some((w) => w.type === meta.type);
                                                            return (
                                                                <button key={meta.type} className="flex items-center gap-2 w-full p-1.5 rounded text-left hover:bg-muted/50 text-xs disabled:opacity-40" disabled={added} onClick={() => addWidgetToEdit(meta.type)}>
                                                                    <meta.icon className="h-3 w-3 text-primary" />
                                                                    <span className="flex-1 truncate">{meta.label}</span>
                                                                    {added ? <Badge variant="secondary" className="text-[8px] h-4">Added</Badge> : <Plus className="h-3 w-3 text-muted-foreground" />}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
                        <Button onClick={handleSaveEdit}>
                            <Save className="h-3.5 w-3.5 mr-1.5" /> Save Page
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Import Dialog */}
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Import Pages</DialogTitle></DialogHeader>
                    <textarea
                        className="w-full h-48 text-xs font-mono p-3 border rounded-lg resize-none bg-muted/30"
                        value={importJson}
                        onChange={(e) => setImportJson(e.target.value)}
                        placeholder="Paste exported JSON here..."
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
                        <Button onClick={handleImport}>Import</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
