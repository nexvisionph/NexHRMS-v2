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
    const isFullUrl = storagePath && (storagePath.startsWith("http://") || storagePath.startsWith("https://"));
    const initialUrl = isFullUrl ? storagePath : null;
    const needsFetch = storagePath && !isFullUrl;

    const [url, setUrl] = useState<string | null>(initialUrl);
    const [loading, setLoading] = useState(!!needsFetch);
    const [error, setError] = useState(false);

    const [prevPath, setPrevPath] = useState(storagePath);
    if (storagePath !== prevPath) {
        setPrevPath(storagePath);
        setUrl(initialUrl);
        setLoading(!!needsFetch);
        setError(false);
    }

    useEffect(() => {
        if (!storagePath || isFullUrl) {
            return;
        }

        let cancelled = false;

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
    }, [storagePath, isFullUrl]);

    return { url, loading, error };
}
