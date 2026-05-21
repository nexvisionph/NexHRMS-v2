"use client";
import { create } from "zustand";
import { nanoid } from "nanoid";
import type { CalendarEvent } from "@/types";
import { SEED_EVENTS } from "@/data/seed";
import { eventsDb } from "@/services/db.service";

interface EventsState {
    events: CalendarEvent[];
    addEvent: (event: Omit<CalendarEvent, "id">) => void;
    updateEvent: (id: string, data: Partial<Omit<CalendarEvent, "id">>) => void;
    removeEvent: (id: string) => void;
    resetToSeed: () => void;
}

export const useEventsStore = create<EventsState>()(
    (set) => ({
        events: SEED_EVENTS,
        addEvent: (event) => {
            const newEvent: CalendarEvent = { ...event, id: `EVT-${nanoid(8)}` };
            set((s) => ({ events: [...s.events, newEvent] }));
            // Write to DB (fire-and-forget)
            eventsDb.upsert(newEvent).catch((err) => {
                console.warn("[events] DB write failed:", err);
            });
        },
        updateEvent: (id, data) => {
            set((s) => {
                const updated = s.events.map((e) => (e.id === id ? { ...e, ...data } : e));
                const event = updated.find((e) => e.id === id);
                if (event) {
                    eventsDb.upsert(event).catch((err) => {
                        console.warn("[events] DB update failed:", err);
                    });
                }
                return { events: updated };
            });
        },
        removeEvent: (id) => {
            set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
            // Delete from DB (fire-and-forget)
            eventsDb.remove(id).catch((err) => {
                console.warn("[events] DB delete failed:", err);
            });
        },
        resetToSeed: () => set({ events: SEED_EVENTS }),
    })
);
