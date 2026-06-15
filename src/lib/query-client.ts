"use client";

import { QueryClient } from "@tanstack/react-query";

let queryClient: QueryClient | undefined;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always create a new query client
    return makeQueryClient();
  }
  // Browser: reuse the same client across renders
  if (!queryClient) {
    queryClient = makeQueryClient();
  }
  return queryClient;
}
