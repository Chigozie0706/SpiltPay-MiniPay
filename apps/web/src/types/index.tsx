export interface ParticipantData {
  wallet: `0x${string}`;
  share: bigint;
  name: string;
  phoneNumber: string;
}

export interface ParticipantFormData {
  address: string;
  name: string;
  phoneNumber: string;
  share: string;
}

export interface Bill {
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
}
