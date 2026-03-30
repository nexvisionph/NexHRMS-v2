"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function RoleError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Route error:", error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="h-20 w-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                <AlertTriangle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold">Something went wrong</h2>
            <p className="text-muted-foreground text-sm max-w-md text-center">
                This page encountered an error. You can try again or go back to the dashboard.
            </p>
            <div className="flex gap-3 mt-2">
                <Button onClick={reset} variant="outline">Try Again</Button>
                <Link href="/"><Button>Dashboard</Button></Link>
            </div>
        </div>
    );
}
