"use client";
/**
 * Events Actions Service — DB-first mutations.
 * 
 * Writes to Supabase first, then updates local Zustand cache on success.
 * Migration target: Store 4 of ZUSTAND_MIGRATION_CHECKLIST.md
 */

import { eventsDb } from "./db.service";
import { useEventsStore } from "@/store/events.store";
import type { CalendarEvent } from "@/types";
import { nanoid } from "nanoid";

/**
 * Add a calendar event — DB-first.
 */
export async function addEvent(data: Omit<CalendarEvent, "id">): Promise<boolean> {
    const event: CalendarEvent = {
        ...data,
        id: `EVT-${nanoid(8)}`,
    };

    // 1. Write to DB first
    const ok = await eventsDb.upsert(event);
    if (!ok) return false;

    // 2. Update local cache
    useEventsStore.setState((s) => ({
        events: [...s.events, event],
    }));
    return true;
}

/**
 * Update a calendar event — DB-first.
 */
export async function updateEvent(id: string, data: Partial<Omit<CalendarEvent, "id">>): Promise<boolean> {
    const store = useEventsStore.getState();
    const existing = store.events.find((e) => e.id === id);
    if (!existing) return false;

    const updated: CalendarEvent = { ...existing, ...data };

    // 1. Write to DB first
    const ok = await eventsDb.upsert(updated);
    if (!ok) return false;

    // 2. Update local cache
    useEventsStore.setState((s) => ({
        events: s.events.map((e) => (e.id === id ? updated : e)),
    }));
    return true;
}

/**
 * Remove a calendar event — DB-first.
 */
export async function removeEvent(id: string): Promise<boolean> {
    // 1. Delete from DB first
    const ok = await eventsDb.remove(id);
    if (!ok) return false;

    // 2. Update local cache
    useEventsStore.setState((s) => ({
        events: s.events.filter((e) => e.id !== id),
    }));
    return true;
}
