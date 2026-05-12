"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safePersistStorage } from "@/lib/storage";
import { nanoid } from "nanoid";
import type { CalendarEvent } from "@/types";
import { SEED_EVENTS } from "@/data/seed";

interface EventsState {
    events: CalendarEvent[];
    addEvent: (event: Omit<CalendarEvent, "id">) => void;
    updateEvent: (id: string, data: Partial<Omit<CalendarEvent, "id">>) => void;
    removeEvent: (id: string) => void;
    resetToSeed: () => void;
}

export const useEventsStore = create<EventsState>()(
    persist(
        (set) => ({
            events: SEED_EVENTS,
            addEvent: (event) =>
                set((s) => ({
                    events: [
                        ...s.events,
                        { ...event, id: `EVT-${nanoid(8)}` },
                    ],
                })),
            updateEvent: (id, data) =>
                set((s) => ({
                    events: s.events.map((e) => (e.id === id ? { ...e, ...data } : e)),
                })),
            removeEvent: (id) =>
                set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
            resetToSeed: () => set({ events: SEED_EVENTS }),
        }),
        { 
            name: "soren-events", storage: safePersistStorage,
            version: 2,
            migrate: () => ({ events: SEED_EVENTS }),
        }
    )
);
