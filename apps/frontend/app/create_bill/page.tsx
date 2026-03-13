"use client";

import { useState } from "react";
import { Bill } from "@/components/homepage";
import { CreateBill } from "@/components/create-bill";
import { VoiceSplitAgent } from "@/components/VoiceSplitAgent";
import { useRouter } from "next/navigation";

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
  // formKey forces CreateBill to remount with fresh defaults when voice parses a bill
  const [formKey, setFormKey] = useState(0);
  const [voiceDefaults, setVoiceDefaults] = useState<ParsedBill | null>(null);

  function handleBack(): void {
    router.push("/");
  }

  function handleCreateBill(_bill: Omit<Bill, "id" | "createdAt">): void {
    router.push("/");
  }

  function handleBillParsed(parsed: ParsedBill) {
    setVoiceDefaults(parsed);
    // Incrementing key forces CreateBill to fully remount with new defaults
    // instead of trying to reconcile stale state
    setFormKey((k) => k + 1);
  }

  // Map voice participants → CreateBill's ParticipantInput shape
  // FIX: use a stable id that doesn't call Date.now() per-item inside map()
  //      to avoid duplicate ids when the array is mapped rapidly
  const defaultParticipants = voiceDefaults?.participants.map((p, i) => ({
    id: `voice-${formKey}-${i}`, // stable: formKey changes once per parse
    // Show the full address as the name so the user knows who is who.
    // If it's 0xPENDING the user must fill it in, so leave name blank.
    name: p.address === "0xPENDING" ? "" : p.address,
    phoneNumber: "",
    wallet: p.address === "0xPENDING" ? "" : p.address,
    share: p.share,
  }));

  return (
    // min-h-screen + overflow-y-auto lets the whole page scroll inside Farcaster's WebView
    <div className="min-h-screen bg-gray-50 overflow-y-auto">
      {/*
        VoiceSplitAgent sits ABOVE CreateBill's sticky header intentionally:
        once the user confirms the voice bill, the form below auto-fills and
        they can scroll down to review / edit before submitting.
      */}
      <VoiceSplitAgent onBillParsed={handleBillParsed} />

      <CreateBill
        key={formKey}
        onBack={handleBack}
        onCreate={handleCreateBill}
        defaultTitle={voiceDefaults?.title}
        defaultAmount={voiceDefaults?.totalAmount?.toString()}
        defaultParticipants={defaultParticipants}
      />
    </div>
  );
}
