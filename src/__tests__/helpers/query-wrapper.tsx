/**
 * Test helper: provides QueryClientProvider for hooks that use TanStack Query.
 */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: Infinity,
            },
        },
    });
}

export function createWrapper() {
    const queryClient = createTestQueryClient();
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        );
    };
}
