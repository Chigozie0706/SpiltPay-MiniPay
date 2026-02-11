"use client";
import { Bill } from "@/components/homepage";
import { CreateBill } from "@/components/create-bill";
import { useRouter } from "next/navigation";

export default function CreateEvent() {
  const router = useRouter();

  function handleBack(): void {
    router.push("/");
  }

  function handleCreateBill(bill: Omit<Bill, "id" | "createdAt">): void {
    throw new Error("Function not implemented.");
  }

  return (
    <>
      {/* Page wrapper with top padding to prevent content from being hidden behind fixed headers */}
      {/* <div className="pt-16"> */}
      <CreateBill onBack={handleBack} onCreate={handleCreateBill} />
      {/* </div> */}
    </>
  );
}
