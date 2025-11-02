export type AmdFinalResult = 'human' | 'machine' | 'undecided' | 'timeout';

export interface CallRecord {
  id: string;
  callSid: string;
  userId: string;
  toNumber: string;
  fromNumber: string;
  amdStrategy: string;
  amdResult?: AmdFinalResult | null;
  amdConfidence?: number | null;
  status: string;
  detectedAt?: string | null;
  duration?: number | null;
  cost?: number | null;
  callStartedAt?: string | null;
  callEndedAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}
