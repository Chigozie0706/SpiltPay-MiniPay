"use client";

import { useSignIn } from "@/hooks/use-sign-in";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HomeScreen } from "@/components/home-screen";

export default function HomePage() {
  const router = useRouter();
  const { isSignedIn, isLoading } = useSignIn({
    autoSignIn: true,
  });
  const [bills, setBills] = useState([]);

  // Redirect to landing if not signed in
  useEffect(() => {
    if (!isLoading && !isSignedIn) {
      router.push("/");
    }
  }, [isSignedIn, isLoading, router]);

  const handleSelectBill = (billId: string) => {
    console.log("Selected bill:", billId);
    // Navigate to bill details
    router.push(`/bill/${billId}`);
  };

  // Show loading while checking auth
  if (isLoading) {
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
    return null;
  }

  return (
    <HomeScreen
      bills={bills}
      onCreateBill={() => {}} // Not needed anymore
      onSelectBill={handleSelectBill}
    />
  );
}
