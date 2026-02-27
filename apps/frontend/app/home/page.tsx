"use client";

import { useSignIn } from "@/hooks/use-sign-in";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HomeScreen } from "@/components/home-screen";

export default function HomePage() {
  const router = useRouter();
  const { isSignedIn, isLoading } = useSignIn();
  const [bills, setBills] = useState([]);
  const [isMounted, setIsMounted] = useState(false);

  // Ensure component is mounted (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Redirect to landing if not signed in
  useEffect(() => {
    if (isMounted && !isLoading && !isSignedIn) {
      router.push("/");
    }
  }, [isSignedIn, isLoading, router, isMounted]);

  const handleSelectBill = (billId: string) => {
    console.log("Selected bill:", billId);
    router.push(`/bill/${billId}`);
  };

  // Show nothing during initial mount to avoid hydration mismatch
  if (!isMounted || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not signed in (will redirect)
  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <HomeScreen
      bills={bills}
      onCreateBill={() => {}}
      onSelectBill={handleSelectBill}
    />
  );
}
