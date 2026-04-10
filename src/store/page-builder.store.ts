"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";
import type { CustomPage, WidgetConfig } from "@/types";

interface PageBuilderState {
    pages: CustomPage[];
    // CRUD
    createPage: (data: Omit<CustomPage, "id" | "createdAt">) => string;
    updatePage: (id: string, patch: Partial<Omit<CustomPage, "id" | "createdAt">>) => void;
    deletePage: (id: string) => void;
    duplicatePage: (id: string) => string | null;
    // Widget operations
    setWidgets: (pageId: string, widgets: WidgetConfig[]) => void;
    addWidget: (pageId: string, widget: WidgetConfig) => void;
    removeWidget: (pageId: string, widgetId: string) => void;
    updateWidget: (pageId: string, widgetId: string, patch: Partial<WidgetConfig>) => void;
    // Queries
    getPageBySlug: (slug: string) => CustomPage | undefined;
    getPageById: (id: string) => CustomPage | undefined;
    getVisiblePages: (roleSlug: string) => CustomPage[];
    // Export/import
    exportPages: () => string;
    importPages: (json: string) => { ok: boolean; imported: number; error?: string };
}

export const usePageBuilderStore = create<PageBuilderState>()(
    persist(
        (set, get) => ({
            pages: [],

            createPage: (data) => {
                const id = `page-${nanoid(8)}`;
                const page: CustomPage = {
                    ...data,
                    id,
                    createdAt: new Date().toISOString(),
                };
                set((s) => ({ pages: [...s.pages, page] }));
                return id;
            },

            updatePage: (id, patch) => {
                set((s) => ({
                    pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
                }));
            },

            deletePage: (id) => {
                set((s) => ({ pages: s.pages.filter((p) => p.id !== id) }));
            },

            duplicatePage: (id) => {
                const source = get().pages.find((p) => p.id === id);
                if (!source) return null;
                const newId = `page-${nanoid(8)}`;
                const dup: CustomPage = {
                    ...source,
                    id: newId,
                    title: `${source.title} (Copy)`,
                    slug: `${source.slug}-copy-${nanoid(4)}`,
                    createdAt: new Date().toISOString(),
                };
                set((s) => ({ pages: [...s.pages, dup] }));
                return newId;
            },

            setWidgets: (pageId, widgets) => {
                set((s) => ({
                    pages: s.pages.map((p) => (p.id === pageId ? { ...p, widgets } : p)),
                }));
            },

            addWidget: (pageId, widget) => {
                set((s) => ({
                    pages: s.pages.map((p) =>
                        p.id === pageId ? { ...p, widgets: [...p.widgets, widget] } : p
                    ),
                }));
            },

            removeWidget: (pageId, widgetId) => {
                set((s) => ({
                    pages: s.pages.map((p) =>
                        p.id === pageId
                            ? { ...p, widgets: p.widgets.filter((w) => w.id !== widgetId) }
                            : p
                    ),
                }));
            },

            updateWidget: (pageId, widgetId, patch) => {
                set((s) => ({
                    pages: s.pages.map((p) =>
                        p.id === pageId
                            ? {
                                ...p,
                                widgets: p.widgets.map((w) =>
                                    w.id === widgetId ? { ...w, ...patch } : w
                                ),
                            }
                            : p
                    ),
                }));
            },

            getPageBySlug: (slug) => get().pages.find((p) => p.slug === slug),
            getPageById: (id) => get().pages.find((p) => p.id === id),

            getVisiblePages: (roleSlug) =>
                get().pages.filter(
                    (p) => p.showInSidebar && p.allowedRoles.includes(roleSlug)
                ),

            exportPages: () =>
                JSON.stringify(
                    { version: "1.0", exportedAt: new Date().toISOString(), pages: get().pages },
                    null,
                    2
                ),

            importPages: (json) => {
                try {
                    const data = JSON.parse(json);
                    if (!data.version || !Array.isArray(data.pages))
                        return { ok: false, imported: 0, error: "Invalid format" };
                    const existing = new Set(get().pages.map((p) => p.slug));
                    const toAdd: CustomPage[] = [];
                    for (const p of data.pages) {
                        if (!existing.has(p.slug)) {
                            toAdd.push({ ...p, id: `page-${nanoid(8)}`, createdAt: new Date().toISOString() });
                            existing.add(p.slug);
                        }
                    }
                    if (toAdd.length > 0) set((s) => ({ pages: [...s.pages, ...toAdd] }));
                    return { ok: true, imported: toAdd.length };
                } catch {
                    return { ok: false, imported: 0, error: "Invalid JSON" };
                }
            },
        }),
        {
            name: "nexhrms-pages",
            version: 1,
        }
    )
);
