"use client";

import { useState } from "react";
import { Bill } from "@/components/homepage";
import { CreateBill } from "@/components/create-bill";
import { VoiceSplitAgent } from "@/components/VoiceSplitAgent";
import { useRouter } from "next/navigation";

// Shape returned by the voice agent
interface ParsedBill {
  title: string;
  totalAmountDisplay: string;
  totalAmount: number;
  participants: {
    address: string;
    shareDisplay: string;
    share: number;
  }[];
  confirmation: string;
}

export default function CreateEvent() {
  const router = useRouter();

  // Key trick: increment this to force-remount CreateBill with new default values
  const [formKey, setFormKey] = useState(0);
  const [voiceDefaults, setVoiceDefaults] = useState<ParsedBill | null>(null);

  function handleBack(): void {
    router.push("/");
  }

  function handleCreateBill(bill: Omit<Bill, "id" | "createdAt">): void {
    // After successful creation, go home
    router.push("/");
  }

  // When voice agent confirms a bill, pre-fill the form
  function handleBillParsed(parsed: ParsedBill) {
    setVoiceDefaults(parsed);
    setFormKey((k) => k + 1); // remount CreateBill so it picks up new defaults
  }

  return (
    <>
      {/* Voice agent sits above the manual form */}
      <VoiceSplitAgent onBillParsed={handleBillParsed} />

      {/* 
        Pass voiceDefaults as props to CreateBill.
        You'll need to add defaultTitle, defaultAmount, defaultParticipants
        props to your CreateBill component (see note below).
      */}
      <CreateBill
        key={formKey}
        onBack={handleBack}
        onCreate={handleCreateBill}
        defaultTitle={voiceDefaults?.title}
        defaultAmount={voiceDefaults?.totalAmount?.toString()}
        defaultParticipants={voiceDefaults?.participants.map((p) => ({
          id: Date.now().toString() + Math.random(),
          name: p.address.slice(0, 6),
          phoneNumber: "",
          wallet: p.address === "0xPENDING" ? "" : p.address,
          share: p.share,
        }))}
      />
    </>
  );
}
