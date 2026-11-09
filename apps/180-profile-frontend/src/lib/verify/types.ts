/**
 * 180 Verify — shared client types for the hosted KYC page.
 * These mirror the public session API under /api/v1/identity/verify/session/*.
 */

export type VerifyEnvironment = 'sandbox' | 'live';

/** Canonical client-side doc kinds. The raw value from the session is echoed back to the server. */
export type DocKind = 'PAN' | 'DL' | 'VOTER_ID' | 'AADHAAR';

export type DocStatus = 'VERIFIED' | 'REJECTED' | 'PENDING';
export type BankStatus = 'VERIFIED' | 'REJECTED' | 'PENDING';
export type FinalStatus = 'APPROVED' | 'MANUAL_REVIEW' | 'REJECTED';
export type ChallengeStep = 'NEUTRAL' | 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT' | 'SMILE';

export interface ApiErrorItem {
  code: string;
  message: string;
}

export interface PublicSession {
  sessionId: string;
  status?: string;
  environment?: VerifyEnvironment | string;
  /** Requested checks, e.g. ['PAN', 'DRIVING_LICENSE', 'BANK_ACCOUNT', 'FACE_MATCH'] */
  documents: string[];
  parentOrigin?: string | null;
  expiresAt?: string | number | null;
  appName?: string | null;
  steps?: {
    documents?: Record<string, { status?: DocStatus | string } | undefined>;
    bank?: { status?: BankStatus | string; registeredNameMasked?: string | null } | null;
    liveness?: { status?: string } | null;
  } | null;
  result?: CompleteResponse | null;
}

export interface DocumentSubmitBody {
  docType: string;
  number?: string;
  name: string;
  dob?: string;
  fatherName?: string;
  gender?: string;
  image?: string;
}

export interface DocumentSubmitResponse {
  docType: string;
  status: 'VERIFIED' | 'REJECTED';
  faceDetected?: boolean;
  registry?: {
    nameMasked?: string;
    dobMatch?: boolean;
    nameMatch?: { score: number; passed: boolean };
    fatherMatch?: boolean | { score?: number; passed: boolean };
    validTill?: string;
    docStatus?: string;
  };
  errors?: ApiErrorItem[];
}

export type BankSubmitBody =
  | { mode: 'UPI'; vpa: string }
  | { mode: 'ACCOUNT'; accountNumber: string; ifsc: string };

export interface BankSubmitResponse {
  status: BankStatus;
  registeredNameMasked?: string | null;
  nameMatch?: { score: number; passed: boolean } | null;
  errors?: ApiErrorItem[];
}

export interface LivenessChallenge {
  challengeId: string;
  steps: ChallengeStep[];
  expiresAt: string | number;
}

export interface CapturedFrame {
  step: ChallengeStep;
  image: string;
  capturedAt: string;
}

export interface CompleteBody {
  challengeId: string;
  selfie: string;
  frames: CapturedFrame[];
}

export interface SummaryCheck {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface CompleteResponse {
  status: FinalStatus;
  error_code?: string;
  error_message?: string;
  summary?: {
    fullNameMasked?: string | null;
    checks?: SummaryCheck[];
    faceMatchConfidence?: number | null;
    livenessScore?: number | null;
  };
}
