"use client";

import { useState, useMemo } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useRolesStore } from "@/store/roles.store";
import { WIDGET_CATALOG, getWidgetMeta } from "@/components/dashboard-builder/widget-registry";
import { WidgetGrid } from "@/components/dashboard-builder/widget-grid";
import type { WidgetConfig, WidgetType } from "@/types";
import { nanoid } from "nanoid";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
    LayoutDashboard, Plus, Save, RotateCcw, Trash2, GripVertical,
    ChevronUp, ChevronDown, Eye, Columns,
} from "lucide-react";

export default function DashboardBuilderPage() {
    const role = useAuthStore((s) => s.currentUser.role);
    const { roles, getDashboardLayout, saveDashboardLayout } = useRolesStore();

    const canManage = role === "admin";

    const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id || "");
    const selectedRole = roles.find((r) => r.id === selectedRoleId);

    const [widgets, setWidgets] = useState<WidgetConfig[]>(() =>
        selectedRole ? getDashboardLayout(selectedRole.slug) : []
    );
    const [previewMode, setPreviewMode] = useState(false);

    const handleRoleChange = (roleId: string) => {
        setSelectedRoleId(roleId);
        const r = roles.find((ro) => ro.id === roleId);
        if (r) setWidgets(getDashboardLayout(r.slug));
    };

    const addWidget = (type: WidgetType) => {
        const meta = getWidgetMeta(type);
        const newWidget: WidgetConfig = {
            id: `w-${nanoid(6)}`,
            type,
            colSpan: meta?.defaultColSpan || 1,
            order: widgets.length,
        };
        setWidgets((prev) => [...prev, newWidget]);
    };

    const removeWidget = (id: string) => {
        setWidgets((prev) => prev.filter((w) => w.id !== id).map((w, i) => ({ ...w, order: i })));
    };

    const moveWidget = (id: string, dir: -1 | 1) => {
        setWidgets((prev) => {
            const sorted = [...prev].sort((a, b) => a.order - b.order);
            const idx = sorted.findIndex((w) => w.id === id);
            if (idx < 0) return prev;
            const newIdx = idx + dir;
            if (newIdx < 0 || newIdx >= sorted.length) return prev;
            [sorted[idx], sorted[newIdx]] = [sorted[newIdx], sorted[idx]];
            return sorted.map((w, i) => ({ ...w, order: i }));
        });
    };

    const changeColSpan = (id: string, colSpan: WidgetConfig["colSpan"]) => {
        setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, colSpan } : w)));
    };

    const handleSave = () => {
        if (!selectedRole) return;
        saveDashboardLayout(selectedRole.id, widgets);
        toast.success(`Dashboard saved for "${selectedRole.name}"`);
    };

    const handleReset = () => {
        if (!selectedRole) return;
        setWidgets(getDashboardLayout(selectedRole.slug));
        toast.info("Reset to current saved layout");
    };

    const categories = useMemo(() => {
        const cats: Record<string, typeof WIDGET_CATALOG> = {};
        for (const w of WIDGET_CATALOG) {
            if (!cats[w.category]) cats[w.category] = [];
            cats[w.category].push(w);
        }
        return cats;
    }, []);

    const catLabels: Record<string, string> = {
        kpi: "KPIs",
        chart: "Charts",
        table: "Tables",
        personal: "Personal",
        general: "General",
    };

    if (!canManage) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-2">
                    <LayoutDashboard className="h-12 w-12 mx-auto text-muted-foreground" />
                    <h2 className="text-lg font-semibold">Access Restricted</h2>
                    <p className="text-sm text-muted-foreground">Only administrators can manage dashboards.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <LayoutDashboard className="h-6 w-6" /> Dashboard Builder
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Customize the dashboard layout for each role.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Select value={selectedRoleId} onValueChange={handleRoleChange}>
                        <SelectTrigger className="w-[180px] h-9">
                            <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                            {roles.filter((r) => r.id).map((r) => (
                                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPreviewMode(!previewMode)}>
                        <Eye className="h-3.5 w-3.5" /> {previewMode ? "Edit" : "Preview"}
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={handleReset}>
                        <RotateCcw className="h-3.5 w-3.5" /> Reset
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={handleSave}>
                        <Save className="h-3.5 w-3.5" /> Save
                    </Button>
                </div>
            </div>

            {previewMode ? (
                <div className="border border-dashed border-primary/30 rounded-xl p-4 bg-primary/5">
                    <p className="text-xs text-primary font-medium mb-3">Preview — {selectedRole?.name} Dashboard</p>
                    <WidgetGrid widgets={widgets} />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
                    {/* Widget layout editor */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground">Layout ({widgets.length} widgets)</h3>
                        {widgets.length === 0 && (
                            <Card className="border-dashed">
                                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                                    No widgets yet. Add widgets from the catalog on the right.
                                </CardContent>
                            </Card>
                        )}
                        {[...widgets].sort((a, b) => a.order - b.order).map((w, idx) => {
                            const meta = getWidgetMeta(w.type);
                            const Icon = meta?.icon || LayoutDashboard;
                            return (
                                <Card key={w.id} className="border border-border/50">
                                    <CardContent className="p-3">
                                        <div className="flex items-center gap-3">
                                            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                <Icon className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{meta?.label || w.type}</p>
                                                <p className="text-[10px] text-muted-foreground">{meta?.category} · {w.colSpan} col</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Select value={String(w.colSpan)} onValueChange={(v) => changeColSpan(w.id, Number(v) as WidgetConfig["colSpan"])}>
                                                    <SelectTrigger className="w-16 h-7 text-xs">
                                                        <Columns className="h-3 w-3 mr-1" />
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="1">1 col</SelectItem>
                                                        <SelectItem value="2">2 col</SelectItem>
                                                        <SelectItem value="3">3 col</SelectItem>
                                                        <SelectItem value="4">4 col</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveWidget(w.id, -1)}>
                                                    <ChevronUp className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === widgets.length - 1} onClick={() => moveWidget(w.id, 1)}>
                                                    <ChevronDown className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => removeWidget(w.id)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Widget catalog */}
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Widget Catalog</h3>
                        <ScrollArea className="h-[calc(100vh-280px)]">
                            <div className="space-y-4 pr-3">
                                {Object.entries(categories).map(([cat, items]) => (
                                    <div key={cat}>
                                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
                                            {catLabels[cat] || cat}
                                        </h4>
                                        <div className="space-y-1.5">
                                            {items.map((meta) => {
                                                const Icon = meta.icon;
                                                const alreadyAdded = widgets.some((w) => w.type === meta.type);
                                                return (
                                                    <button
                                                        key={meta.type}
                                                        className="flex items-center gap-2.5 w-full p-2 rounded-lg text-left hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                        onClick={() => addWidget(meta.type)}
                                                        disabled={alreadyAdded}
                                                    >
                                                        <div className="h-7 w-7 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                                            <Icon className="h-3.5 w-3.5 text-primary" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium truncate">{meta.label}</p>
                                                            <p className="text-[10px] text-muted-foreground truncate">{meta.description}</p>
                                                        </div>
                                                        {alreadyAdded ? (
                                                            <Badge variant="secondary" className="text-[9px] shrink-0">Added</Badge>
                                                        ) : (
                                                            <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            )}
        </div>
    );
}
