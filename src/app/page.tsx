"use client";

import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
    const router = useRouter();
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const role = useAuthStore((s) => s.currentUser.role);

    useEffect(() => {
        if (isAuthenticated) {
            router.replace(`/${role}/dashboard`);
        } else {
            router.replace("/login");
        }
    }, [isAuthenticated, role, router]);

    // The client-layout spinner covers this page during redirect, so no extra UI needed.
    return null;
}
