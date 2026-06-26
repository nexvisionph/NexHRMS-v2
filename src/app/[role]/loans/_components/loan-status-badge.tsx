"use client";

import { Badge } from "@/components/ui/badge";
import type { LoanStatus } from "@/types";

export function LoanStatusBadge({ status }: { status: LoanStatus }) {
    let statusColor = "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    let statusLabel: string = status;

    if (status === "active") {
        statusColor = "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    } else if (status === "settled") {
        statusColor = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    } else if (status === "cancelled" || status === "rejected") {
        statusColor = "bg-red-500/15 text-red-700 dark:text-red-400";
    } else if (status === "pending" || status === "pending_supervisor") {
        statusColor = "bg-violet-500/15 text-violet-700 dark:text-violet-400";
        statusLabel = "Pending Supervisor";
    } else if (status === "pending_hr") {
        statusColor = "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400";
        statusLabel = "Pending HR";
    } else if (status === "pending_finance") {
        statusColor = "bg-amber-500/15 text-amber-700 dark:text-amber-400";
        statusLabel = "Pending Finance";
    } else if (status === "separated") {
        statusColor = "bg-orange-500/15 text-orange-700 dark:text-orange-400";
        statusLabel = "Separated Payout";
    } else if (status === "draft") {
        statusColor = "bg-zinc-500/15 text-zinc-700 dark:text-zinc-400";
    } else if (status === "inactive") {
        statusColor = "bg-rose-500/15 text-rose-700 dark:text-rose-400";
        statusLabel = "inactive";
    }

    return (
        <Badge variant="secondary" className={`text-[10px] whitespace-nowrap ${statusColor}`}>
            {statusLabel}
        </Badge>
    );
}
