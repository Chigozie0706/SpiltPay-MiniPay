"use client";

import { useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useRouter } from "next/navigation";
import { sdk } from "@farcaster/miniapp-sdk";
import { HomeScreen } from "@/components/home-screen";
import type { Bill } from "@/components/homepage";

// ── Contract ─────────────────────────────────────────────────────
const SPLITPAY_ADDRESS = "0xYOUR_CONTRACT_ADDRESS" as `0x${string}`; // TODO: replace

const ABI = [
  {
    name: "getUserBills",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_user", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getBill",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_billId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "organizer", type: "address" },
          { name: "title", type: "string" },
          { name: "totalAmount", type: "uint256" },
          { name: "totalCollected", type: "uint256" },
          { name: "stablecoin", type: "address" },
          { name: "participantCount", type: "uint256" },
          { name: "isCompleted", type: "bool" },
          { name: "isWithdrawn", type: "bool" },
          { name: "createdAt", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "getBillStatus",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_billId", type: "uint256" }],
    outputs: [
      { name: "participants", type: "address[]" },
      { name: "amountsOwed", type: "uint256[]" },
      { name: "amountsPaid", type: "uint256[]" },
      { name: "paymentStatus", type: "bool[]" },
      { name: "names", type: "string[]" },
      { name: "phoneNumbers", type: "string[]" },
    ],
  },
] as const;

// ── Stablecoin address → currency label ──────────────────────────
const STABLECOIN: Record<string, Bill["currency"]> = {
  "0x765DE816845861e75A25fCA122bb6898B8B1282a": "cUSD",
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0": "cKES",
  "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787": "cREAL",
};

const fromWei = (raw: bigint) => Number(raw) / 1e18;

// ── Single bill loader ───────────────────────────────────────────
function useBill(billId: bigint | undefined): Bill | null {
  const enabled = !!billId && billId > BigInt(0);

  const { data: billData } = useReadContract({
    address: SPLITPAY_ADDRESS,
    abi: ABI,
    functionName: "getBill",
    args: billId ? [billId] : undefined,
    query: { enabled },
  });

  const { data: statusData } = useReadContract({
    address: SPLITPAY_ADDRESS,
    abi: ABI,
    functionName: "getBillStatus",
    args: billId ? [billId] : undefined,
    query: { enabled },
  });

  if (!billData || !statusData) return null;

  const [addrs, amountsOwed, amountsPaid, , names, phoneNumbers] = statusData;

  const participants = addrs.map((addr, i) => {
    const share = fromWei(amountsOwed[i]);
    const paid = fromWei(amountsPaid[i]);
    return {
      id: addr,
      name: names[i] || addr.slice(0, 6),
      phoneNumber: phoneNumbers[i],
      share,
      amountPaid: paid,
      status:
        paid === 0
          ? ("pending" as const)
          : paid >= share
          ? ("paid" as const)
          : ("underpaid" as const),
    };
  });

  return {
    id: billData.id.toString(),
    title: billData.title,
    totalAmount: fromWei(billData.totalAmount),
    currency: STABLECOIN[billData.stablecoin] ?? "cUSD",
    organizerId: billData.organizer,
    organizerName: billData.organizer.slice(0, 6) + "...",
    participants,
    status: billData.isCompleted ? "completed" : "active",
    createdAt: new Date(Number(billData.createdAt) * 1000),
  };
}

// ── Main ──────────────────────────────────────────────────────────
export default function HomeClient() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  // Tell Farcaster the app is ready — hides the splash screen
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  // Get list of bill IDs for this wallet
  const { data: billIds, isLoading } = useReadContract({
    address: SPLITPAY_ADDRESS,
    abi: ABI,
    functionName: "getUserBills",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Load up to 10 bills (hooks can't be in a loop)
  const b0 = useBill(billIds?.[0]);
  const b1 = useBill(billIds?.[1]);
  const b2 = useBill(billIds?.[2]);
  const b3 = useBill(billIds?.[3]);
  const b4 = useBill(billIds?.[4]);
  const b5 = useBill(billIds?.[5]);
  const b6 = useBill(billIds?.[6]);
  const b7 = useBill(billIds?.[7]);
  const b8 = useBill(billIds?.[8]);
  const b9 = useBill(billIds?.[9]);

  const bills = [b0, b1, b2, b3, b4, b5, b6, b7, b8, b9]
    .slice(0, billIds?.length ?? 0)
    .filter((b): b is Bill => b !== null)
    .reverse(); // newest first

  // Wallet not connected yet
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mx-auto mb-3" />
          <p className="text-sm opacity-80">Connecting wallet...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading your bills...</p>
        </div>
      </div>
    );
  }

  // Pass real contract data into your existing HomeScreen UI
  return (
    <HomeScreen
      bills={bills}
      onCreateBill={() => router.push("/create-bill")}
      onSelectBill={(billId) => router.push(`/bill/${billId}`)}
    />
  );
}
