"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth.store";
import { cn } from "@/lib/utils";

type ResolvedTheme = "light" | "dark";

function getSystemTheme(): ResolvedTheme {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useResolvedAppTheme(): ResolvedTheme {
    const theme = useAuthStore((s) => s.theme);
    const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

    useEffect(() => {
        if (typeof window === "undefined") return;

        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const updateSystemTheme = () => setSystemTheme(media.matches ? "dark" : "light");

        updateSystemTheme();
        media.addEventListener("change", updateSystemTheme);
        return () => media.removeEventListener("change", updateSystemTheme);
    }, []);

    return theme === "system" ? systemTheme : theme;
}

interface ThemeToggleButtonProps {
    className?: string;
    iconClassName?: string;
}

export function ThemeToggleButton({ className, iconClassName = "h-5 w-5" }: ThemeToggleButtonProps) {
    const setTheme = useAuthStore((s) => s.setTheme);
    const resolvedTheme = useResolvedAppTheme();
    const isDarkMode = resolvedTheme === "dark";

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setTheme(isDarkMode ? "light" : "dark")}
            className={cn("text-muted-foreground hover:text-foreground", className)}
        >
            {isDarkMode ? <Sun className={iconClassName} /> : <Moon className={iconClassName} />}
        </Button>
    );
}
