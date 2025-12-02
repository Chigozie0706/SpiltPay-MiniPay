import { useState } from "react";
import { ArrowLeft, Plus, X, Users } from "lucide-react";
import { Bill, Currency } from "./App";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, Address } from "viem";
import contractABI from "../contract/abi.json";

interface CreateBillProps {
  onBack: () => void;
  onCreate: (bill: Omit<Bill, "id" | "createdAt">) => void;
}

interface ParticipantInput {
  id: string;
  name: string;
  phoneNumber: string;
  wallet: string;
  share: number;
}

// Mento Stablecoin addresses on Celo Mainnet
const STABLECOIN_ADDRESSES: Record<Currency, Address> = {
  cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  cKES: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0",
  cREAL: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787",
  cEUR: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
};

const CONTRACT_ADDRESS: Address = "0x374523992a926751c642cC81159B45A6BB12053f";

export function CreateBill({ onBack, onCreate }: CreateBillProps) {
  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("cUSD");
  const [participants, setParticipants] = useState<ParticipantInput[]>([
    { id: "1", name: "", phoneNumber: "", wallet: "", share: 0 },
  ]);
  const [splitMethod, setSplitMethod] = useState<"equal" | "manual">("equal");
  const [error, setError] = useState("");

  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const {
    writeContract,
    data: hash,
    isPending,
    error: writeError,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const addParticipant = () => {
    setParticipants([
      ...participants,
      {
        id: Date.now().toString(),
        name: "",
        phoneNumber: "",
        wallet: "",
        share: 0,
      },
    ]);
  };

  const removeParticipant = (id: string) => {
    if (participants.length > 1) {
      setParticipants(participants.filter((p) => p.id !== id));
    }
  };

  const updateParticipant = (
    id: string,
    field: keyof ParticipantInput,
    value: string | number
  ) => {
    setParticipants(
      participants.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const calculateShares = () => {
    const amount = parseFloat(totalAmount) || 0;
    if (splitMethod === "equal" && participants.length > 0) {
      const sharePerPerson = amount / participants.length;
      setParticipants(
        participants.map((p) => ({ ...p, share: sharePerPerson }))
      );
    }
  };

  // const handleCreate = () => {
  //   if (!title || !totalAmount || participants.some((p) => !p.name)) {
  //     alert("Please fill in all required fields");
  //     return;
  //   }

  //   const amount = parseFloat(totalAmount);
  //   if (isNaN(amount) || amount <= 0) {
  //     alert("Please enter a valid amount");
  //     return;
  //   }

  //   // Calculate shares if not done yet
  //   let finalParticipants = participants;
  //   if (splitMethod === "equal") {
  //     const sharePerPerson = amount / participants.length;
  //     finalParticipants = participants.map((p) => ({
  //       ...p,
  //       share: sharePerPerson,
  //     }));
  //   }

  //   const totalShares = finalParticipants.reduce((sum, p) => sum + p.share, 0);
  //   if (Math.abs(totalShares - amount) > 0.01) {
  //     alert("Total shares must equal the total amount");
  //     return;
  //   }

  //   onCreate({
  //     title,
  //     totalAmount: amount,
  //     currency,
  //     organizerId: "user1",
  //     organizerName: "You",
  //     status: "active",
  //     participants: finalParticipants.map((p) => ({
  //       ...p,
  //       amountPaid: 0,
  //       status: "pending" as const,
  //     })),
  //   });
  // };

  const validateForm = () => {
    if (!isConnected) {
      setError("Please connect your wallet first");
      return false;
    }

    if (!title || !totalAmount) {
      setError("Please fill in bill title and amount");
      return false;
    }

    const amount = parseFloat(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount");
      return false;
    }

    if (participants.some((p) => !p.name)) {
      setError("Please enter names for all participants");
      return false;
    }

    // Validate wallet addresses
    for (const p of participants) {
      if (!p.wallet) {
        setError(`Please enter wallet address for ${p.name}`);
        return false;
      }
      if (!p.wallet.startsWith("0x") || p.wallet.length !== 42) {
        setError(`Invalid wallet address for ${p.name}`);
        return false;
      }
    }

    return true;
  };

  const handleCreate = async () => {
    setError("");

    if (!validateForm()) {
      return;
    }

    const amount = parseFloat(totalAmount);

    // Calculate shares if not done yet
    let finalParticipants = participants;
    if (splitMethod === "equal") {
      const sharePerPerson = amount / participants.length;
      finalParticipants = participants.map((p) => ({
        ...p,
        share: sharePerPerson,
      }));
    }

    const totalShares = finalParticipants.reduce((sum, p) => sum + p.share, 0);
    if (Math.abs(totalShares - amount) > 0.01) {
      setError("Total shares must equal the total amount");
      return;
    }

    try {
      // Prepare contract parameters
      const stablecoinAddress = STABLECOIN_ADDRESSES[currency];
      const totalAmountWei = parseUnits(amount.toString(), 18);

      const participantsData = finalParticipants.map((p) => ({
        wallet: p.wallet as Address,
        share: parseUnits(p.share.toString(), 18),
        name: p.name,
        phoneNumber: p.phoneNumber || "",
      }));

      // Call the contract
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: contractABI.abi,
        functionName: "createBill",
        args: [title, totalAmountWei, stablecoinAddress, participantsData],
      });
    } catch (err: any) {
      console.error("Error creating bill:", err);
      setError(err.message || "Failed to create bill. Please try again.");
    }
  };

  // Handle transaction success
  if (isSuccess && hash) {
    // You can parse the transaction receipt to get the bill ID from events
    // For now, showing success message
    setTimeout(() => {
      alert("Bill created successfully!");
      onBack();
    }, 1000);
  }

  // Handle write error
  if (writeError) {
    const errorMessage = writeError.message || "Transaction failed";
    if (error !== errorMessage) {
      setError(errorMessage);
    }
  }

  const isProcessing = isPending || isConfirming;

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors -ml-2"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-gray-900 text-lg">Create New Bill</h1>
              <p className="text-gray-500 text-sm">
                Split expenses with friends
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {/* Bill Details */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-4">
          <h2 className="text-gray-900 mb-4">Bill Details</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm mb-2">
                Bill Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Dinner at KFC"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-700 text-sm mb-2">
                  Total Amount
                </label>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  onBlur={calculateShares}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm mb-2">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                >
                  <option value="cUSD">cUSD</option>
                  <option value="cKES">cKES</option>
                  <option value="cREAL">cREAL</option>
                  <option value="cEUR">cEUR</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Split Method */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-4">
          <h2 className="text-gray-900 mb-4">Split Method</h2>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setSplitMethod("equal");
                calculateShares();
              }}
              className={`p-4 rounded-lg border-2 transition-all ${
                splitMethod === "equal"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Users
                className={`w-5 h-5 mx-auto mb-2 ${
                  splitMethod === "equal" ? "text-emerald-600" : "text-gray-400"
                }`}
              />
              <div
                className={`text-sm ${
                  splitMethod === "equal" ? "text-emerald-900" : "text-gray-700"
                }`}
              >
                Equal Split
              </div>
            </button>
            <button
              onClick={() => setSplitMethod("manual")}
              className={`p-4 rounded-lg border-2 transition-all ${
                splitMethod === "manual"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div
                className={`w-5 h-5 mx-auto mb-2 flex items-center justify-center ${
                  splitMethod === "manual"
                    ? "text-emerald-600"
                    : "text-gray-400"
                }`}
              >
                <span className="text-lg">✏️</span>
              </div>
              <div
                className={`text-sm ${
                  splitMethod === "manual"
                    ? "text-emerald-900"
                    : "text-gray-700"
                }`}
              >
                Custom
              </div>
            </button>
          </div>
        </div>

        {/* Participants */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-gray-900">
              Participants ({participants.length})
            </h2>
            <button
              onClick={addParticipant}
              className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add</span>
            </button>
          </div>

          <div className="space-y-4">
            {participants.map((participant, index) => (
              <div
                key={participant.id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-gray-700 text-sm">
                    Person {index + 1}
                  </div>
                  {participants.length > 1 && (
                    <button
                      onClick={() => removeParticipant(participant.id)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <input
                    type="text"
                    value={participant.name}
                    onChange={(e) =>
                      updateParticipant(participant.id, "name", e.target.value)
                    }
                    placeholder="Name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                  />

                  <input
                    type="text"
                    value={participant.wallet}
                    onChange={(e) =>
                      updateParticipant(
                        participant.id,
                        "wallet",
                        e.target.value
                      )
                    }
                    placeholder="Address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                  />

                  <input
                    type="tel"
                    value={participant.phoneNumber}
                    onChange={(e) =>
                      updateParticipant(
                        participant.id,
                        "phoneNumber",
                        e.target.value
                      )
                    }
                    placeholder="Phone (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                  />
                  {splitMethod === "manual" && (
                    <div>
                      <label className="block text-gray-600 text-sm mb-1">
                        Amount to pay
                      </label>
                      <input
                        type="number"
                        value={participant.share || ""}
                        onChange={(e) =>
                          updateParticipant(
                            participant.id,
                            "share",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        placeholder="0.00"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                      />
                    </div>
                  )}
                  {splitMethod === "equal" && totalAmount && (
                    <div className="text-gray-600 text-sm">
                      Share:{" "}
                      {(parseFloat(totalAmount) / participants.length).toFixed(
                        2
                      )}{" "}
                      {currency}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Create Button */}
        <button
          onClick={handleCreate}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-xl transition-colors shadow-lg"
        >
          Create Bill
        </button>
      </div>
    </div>
  );
}
