// hooks/use-sign-in.ts
import { useMiniApp } from "@/contexts/miniapp-context";
import sdk from "@farcaster/frame-sdk";
import { NeynarUser } from "@/lib/neynar";
import { useCallback, useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useApiQuery } from "./use-api-query";
import { useQueryClient } from "@tanstack/react-query";

// Add this type
interface AuthCheckResponse {
  authenticated: boolean;
  fid?: string;
}

export const useSignIn = () => {
  const { context } = useMiniApp();
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("session-id");
    if (stored) {
      setSessionId(stored);
    }
  }, []);

  // Check auth with session ID - Add type here
  const { data: authData } = useApiQuery<AuthCheckResponse>({
    url: "/api/auth/check",
    method: "GET",
    isProtected: true,
    queryKey: ["auth-check", sessionId],
    enabled: !!sessionId,
    headers: sessionId ? { Authorization: `Bearer ${sessionId}` } : {},
  });

  const isSignedIn = authData?.authenticated ?? false;

  // Only fetch user if authenticated
  const {
    data: user,
    isLoading: isLoadingNeynarUser,
  } = useApiQuery<NeynarUser>({
    url: "/api/users/me",
    method: "GET",
    isProtected: true,
    queryKey: ["user"],
    enabled: isSignedIn && !!sessionId,
    headers: sessionId ? { Authorization: `Bearer ${sessionId}` } : {},
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!address) {
        throw new Error("No wallet connected");
      }

      if (!context) {
        throw new Error("Not in mini app");
      }

      const { token } = await sdk.quickAuth.getToken();
      if (!token) {
        throw new Error("Sign in failed");
      }

      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          fid: context.user.fid,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Sign in failed");
      }

      const data = await res.json();
      console.log("✅ Sign-in response:", data);

      // Store session ID
      if (data.sessionId) {
        localStorage.setItem("session-id", data.sessionId);
        setSessionId(data.sessionId);
        
        // Invalidate queries to refetch with new session
        await queryClient.invalidateQueries();
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Sign in failed";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, context, queryClient]);

  return {
    signIn: handleSignIn,
    isSignedIn,
    isLoading: isLoading || isLoadingNeynarUser,
    error,
    user,
  };
};