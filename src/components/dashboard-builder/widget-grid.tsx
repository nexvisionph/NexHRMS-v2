"use client";
/**
 * WidgetGrid — renders an array of WidgetConfig items in a CSS grid.
 * colSpan determines how many of the 4 columns each widget occupies.
 */
import React from "react";
import type { WidgetConfig } from "@/types";
import { RenderWidget } from "./widget-registry";

interface WidgetGridProps {
    widgets: WidgetConfig[];
}

export function WidgetGrid({ widgets }: WidgetGridProps) {
    const sorted = [...widgets].sort((a, b) => a.order - b.order);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
            {sorted.map((w) => {
                const colClass =
                    w.colSpan === 4 ? "sm:col-span-2 lg:col-span-4" :
                    w.colSpan === 3 ? "sm:col-span-2 lg:col-span-3" :
                    w.colSpan === 2 ? "sm:col-span-2 lg:col-span-2" :
                    "col-span-1";
                return (
                    <div key={w.id} className={colClass}>
                        <RenderWidget config={w} />
                    </div>
                );
            })}
        </div>
    );
}
