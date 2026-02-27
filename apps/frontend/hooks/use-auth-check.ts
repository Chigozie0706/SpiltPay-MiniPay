// hooks/use-auth-check.ts
import { useApiQuery } from "./use-api-query";
import { AuthCheckResponse } from "@/types/auth";

export const useAuthCheck = () => {
  return useApiQuery<AuthCheckResponse>({
    url: "/api/auth/check",
    method: "GET",
    isProtected: true,
    queryKey: ["auth-check"],
  });
};