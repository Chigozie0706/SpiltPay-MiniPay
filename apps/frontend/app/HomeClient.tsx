"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useRouter } from "next/navigation";
import { sdk } from "@farcaster/miniapp-sdk";
import { HomeScreen } from "@/components/home-screen";
import type { Bill } from "@/components/homepage";
import contractABI from "../contract/abi.json";

const SPLITPAY_ADDRESS =
  "0xE47aa208f9B59b5857E6c54a5198a9a40F4c90C7" as `0x${string}`;

const STABLECOIN: Record<string, Bill["currency"]> = {
  "0x765DE816845861e75A25fCA122bb6898B8B1282a": "cUSDm",
  "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0": "cKES",
  "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787": "cREAL",
};

const fromWei = (raw: bigint) => Number(raw) / 1e18;

type ContractBill = {
  id: bigint;
  organizer: `0x${string}`;
  title: string;
  totalAmount: bigint;
  totalCollected: bigint;
  stablecoin: `0x${string}`;
  participantCount: bigint;
  isCompleted: boolean;
  isWithdrawn: boolean;
  createdAt: bigint;
};

type ContractBillStatus = [
  participants: readonly `0x${string}`[],
  amountsOwed: readonly bigint[],
  amountsPaid: readonly bigint[],
  paymentStatus: readonly boolean[],
  names: readonly string[],
  phoneNumbers: readonly string[],
];

function useBill(billId: bigint | undefined): Bill | null {
  const enabled = !!billId && billId > BigInt(0);

  const { data: rawBill } = useReadContract({
    address: SPLITPAY_ADDRESS,
    abi: contractABI.abi,
    functionName: "getBill",
    args: billId ? [billId] : undefined,
    query: { enabled },
  });

  const { data: rawStatus } = useReadContract({
    address: SPLITPAY_ADDRESS,
    abi: contractABI.abi,
    functionName: "getBillStatus",
    args: billId ? [billId] : undefined,
    query: { enabled },
  });

  if (!rawBill || !rawStatus) return null;

  const billData = rawBill as unknown as ContractBill;
  const statusData = rawStatus as unknown as ContractBillStatus;

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

export default function HomeClient() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    sdk.actions.ready();
  }, []);

  const { data: rawBillIds, isLoading } = useReadContract({
    address: SPLITPAY_ADDRESS,
    abi: contractABI.abi,
    functionName: "getUserBills",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Cast getUserBills return value — matches: uint256[]
  const billIds = rawBillIds as unknown as bigint[] | undefined;

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
    .reverse();

  if (!mounted) return null;

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

  return (
    <HomeScreen
      bills={bills}
      onCreateBill={() => router.push("/create-bill")}
      onSelectBill={(billId) => router.push(`/bill/${billId}`)}
    />
  );
}
