"use client";

/**
 * Employee Filters Store — pure UI/filter state.
 *
 * Separated from the employee domain data so filters don't trigger
 * data refetches or pollute the TanStack Query cache.
 */

import { create } from "zustand";
import type { EmployeeStatus, WorkType } from "@/types";

interface EmployeeFiltersState {
    searchQuery: string;
    statusFilter: EmployeeStatus | "all";
    workTypeFilter: WorkType | "all";
    roleFilter: string;
    departmentFilter: string;
    setSearchQuery: (q: string) => void;
    setStatusFilter: (s: EmployeeStatus | "all") => void;
    setWorkTypeFilter: (w: WorkType | "all") => void;
    setRoleFilter: (r: string) => void;
    setDepartmentFilter: (d: string) => void;
    resetFilters: () => void;
}

export const useEmployeeFiltersStore = create<EmployeeFiltersState>()((set) => ({
    searchQuery: "",
    statusFilter: "all",
    workTypeFilter: "all",
    roleFilter: "all",
    departmentFilter: "all",
    setSearchQuery: (q) => set({ searchQuery: q }),
    setStatusFilter: (s) => set({ statusFilter: s }),
    setWorkTypeFilter: (w) => set({ workTypeFilter: w }),
    setRoleFilter: (r) => set({ roleFilter: r }),
    setDepartmentFilter: (d) => set({ departmentFilter: d }),
    resetFilters: () => set({
        searchQuery: "",
        statusFilter: "all",
        workTypeFilter: "all",
        roleFilter: "all",
        departmentFilter: "all",
    }),
}));
