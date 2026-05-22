"use client";

import { useState, useEffect } from "react";
import { documents201Storage } from "@/services/db.service";

/**
 * Hook that resolves a storage path to a signed URL for the employee-documents bucket.
 * Returns { url, loading, error } state.
 */
export function useSignedUrl(storagePath: string | undefined | null): {
    url: string | null;
    loading: boolean;
    error: boolean;
} {
    const [url, setUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!storagePath) {
            setUrl(null);
            setLoading(false);
            setError(false);
            return;
        }

        // If it's already a full URL (http/https), use it directly
        if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
            setUrl(storagePath);
            setLoading(false);
            setError(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(false);

        // For comma-separated paths (multiple files), use the first one
        const firstPath = storagePath.split(",")[0].trim();

        documents201Storage.getSignedUrl(firstPath, 3600).then((signedUrl) => {
            if (!cancelled) {
                setUrl(signedUrl);
                setLoading(false);
                setError(!signedUrl);
            }
        });

        return () => { cancelled = true; };
    }, [storagePath]);

    return { url, loading, error };
}
