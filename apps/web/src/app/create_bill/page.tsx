"use client";
import { Bill } from "@/components/App";
import { CreateBill } from "@/components/create-bill";

export default function CreateEvent() {
  function handleBack(): void {
    throw new Error("Function not implemented.");
  }

  function handleCreateBill(bill: Omit<Bill, "id" | "createdAt">): void {
    throw new Error("Function not implemented.");
  }

  return (
    <>
      {/* Page wrapper with top padding to prevent content from being hidden behind fixed headers */}
      <div className="pt-16">
        <CreateBill onBack={handleBack} onCreate={handleCreateBill} />
      </div>
    </>
  );
}
