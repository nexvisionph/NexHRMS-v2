"use client";

import { Badge } from "@/components/ui/badge";
import type { LoanStatus } from "@/types";

export function LoanStatusBadge({ status }: { status: LoanStatus }) {
    const statusColor =
        status === "active"
            ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
            : status === "settled"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : status === "cancelled" || status === "rejected"
                ? "bg-red-500/15 text-red-700 dark:text-red-400"
                : status === "pending"
                  ? "bg-violet-500/15 text-violet-700 dark:text-violet-400"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400";

    return (
        <Badge variant="secondary" className={`text-[10px] ${statusColor}`}>
            {status}
        </Badge>
    );
}
