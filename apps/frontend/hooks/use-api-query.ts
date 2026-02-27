// hooks/use-api-query.ts
import { useQuery, UseQueryOptions } from "@tanstack/react-query";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface UseApiQueryOptions<TData, TBody = unknown>
  extends Omit<UseQueryOptions<TData>, "queryFn"> {
  url: string;
  method?: HttpMethod;
  body?: TBody;
  isProtected?: boolean;
  enabled?: boolean;
  headers?: Record<string, string>; // Add this
}

export const useApiQuery = <TData, TBody = unknown>(
  options: UseApiQueryOptions<TData, TBody>
) => {
  const {
    url,
    method = "GET",
    body,
    isProtected = false,
    enabled = true,
    headers = {}, // Add this
    ...queryOptions
  } = options;

  return useQuery<TData>({
    ...queryOptions,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: (failureCount, error: any) => {
      if (error.message?.includes('429') || error.message?.includes('401')) {
        return false;
      }
      return failureCount < 2;
    },
    queryFn: async () => {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers, // Include custom headers
        },
        ...(body && { body: JSON.stringify(body) }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }

      return response.json();
    },
  });
};