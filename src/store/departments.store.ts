"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistStorage } from "@/lib/storage";
import { nanoid } from "nanoid";
import type { Department } from "@/types";
import { DEPARTMENTS } from "@/lib/constants";
import { useAuditStore } from "@/store/audit.store";

// ─── Seed Data (matches migration seed) ────────────────────────
const SEED_DEPARTMENTS: Department[] = DEPARTMENTS.map((name, idx) => {
    const descMap: Record<string, string> = {
        "Engineering": "Software development and technical teams",
        "Design": "UI/UX and graphic design teams",
        "Marketing": "Marketing and brand management",
        "Human Resources": "HR, recruitment, and employee relations",
        "Finance": "Accounting, payroll, and financial operations",
        "Sales": "Sales and business development",
        "Operations": "Business operations and administration",
    };
    const colors = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#06b6d4"];
    return {
        id: `dept_${nanoid(8)}`,
        name,
        description: descMap[name] || undefined,
        headId: undefined,
        color: colors[idx % colors.length],
        isActive: true,
        createdBy: "system",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
});

interface DepartmentsState {
    departments: Department[];

    // ── CRUD ─────────────────────────────────────────────────
    addDepartment: (data: Omit<Department, "id" | "createdAt" | "updatedAt">) => string;
    updateDepartment: (id: string, patch: Partial<Omit<Department, "id" | "createdAt" | "updatedAt">>) => void;
    deleteDepartment: (id: string) => void;
    toggleActive: (id: string) => void;

    // ── Selectors ─────────────────────────────────────────────
    getById: (id: string) => Department | undefined;
    getByName: (name: string) => Department | undefined;
    getActive: () => Department[];

    // ── Reset ─────────────────────────────────────────────────
    resetToSeed: () => void;
}

export const useDepartmentsStore = create<DepartmentsState>()(
    persist(
        (set, get) => ({
            departments: SEED_DEPARTMENTS,

            // ── Add ───────────────────────────────────────────
            addDepartment: (data) => {
                const id = `dept_${nanoid(8)}`;
                const now = new Date().toISOString();
                set((s) => ({
                    departments: [
                        ...s.departments,
                        { ...data, id, createdAt: now, updatedAt: now },
                    ],
                }));
                useAuditStore.getState().log({
                    entityType: "department",
                    entityId: id,
                    action: "tag_created", // reuse tag audit action
                    performedBy: data.createdBy,
                    afterSnapshot: { name: data.name, description: data.description },
                });
                return id;
            },

            // ── Update ────────────────────────────────────────
            updateDepartment: (id, patch) =>
                set((s) => ({
                    departments: s.departments.map((d) =>
                        d.id === id
                            ? { ...d, ...patch, updatedAt: new Date().toISOString() }
                            : d
                    ),
                })),

            // ── Delete ────────────────────────────────────────
            deleteDepartment: (id) =>
                set((s) => ({
                    departments: s.departments.filter((d) => d.id !== id),
                })),

            // ── Toggle Active ─────────────────────────────────
            toggleActive: (id) =>
                set((s) => ({
                    departments: s.departments.map((d) =>
                        d.id === id
                            ? { ...d, isActive: !d.isActive, updatedAt: new Date().toISOString() }
                            : d
                    ),
                })),

            // ── Selectors ─────────────────────────────────────
            getById: (id) => get().departments.find((d) => d.id === id),
            getByName: (name) => get().departments.find((d) => d.name.toLowerCase() === name.toLowerCase()),
            getActive: () => get().departments.filter((d) => d.isActive),

            // ── Reset ─────────────────────────────────────────
            resetToSeed: () => set({ departments: SEED_DEPARTMENTS }),
        }),
        {
            name: "hrms-departments",
            version: 1,
            storage: safePersistStorage,
        }
    )
);
