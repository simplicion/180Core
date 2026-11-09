/**
 * 180 Verify — shared types used by both the browser drop-in (`verify-client`)
 * and the server helpers (`verify-server`).
 *
 * Backend contract base path: `/api/v1/identity/verify`.
 */

/** Document / check types a verification session can request. */
export type VerifyDocumentType =
  | 'PAN'
  | 'DRIVING_LICENSE'
  | 'VOTER_ID'
  | 'AADHAAR'
  | 'BANK_ACCOUNT'
  | 'FACE_MATCH';

export const VERIFY_DOCUMENT_TYPES: readonly VerifyDocumentType[] = [
  'PAN',
  'DRIVING_LICENSE',
  'VOTER_ID',
  'AADHAAR',
  'BANK_ACCOUNT',
  'FACE_MATCH',
];

/** Terminal statuses the backend may report. Other in-flight statuses may exist. */
export type VerifySessionStatus =
  | 'APPROVED'
  | 'MANUAL_REVIEW'
  | 'REJECTED'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'EXPIRED'
  | (string & {});

/** Response of `POST /api/v1/identity/verify/session` (201). */
export interface VerifySessionResponse {
  sessionId: string;
  sessionToken: string;
  /** Hosted verification page; opened inside the SDK iframe. Treated as opaque. */
  verifyUrl: string;
  expiresAt: string;
  documents: VerifyDocumentType[];
  environment: string;
}

/**
 * What the browser callback receives. Deliberately contains NO personal data.
 *
 * SECURITY: this value comes from the browser and can be forged by the end user.
 * It is NOT proof of verification. Send `sessionId` to your backend and call
 * `fetchVerificationResult()` to obtain the signed, authoritative result.
 */
export interface VerifyClientResult {
  sessionId: string;
  status: 'APPROVED' | 'MANUAL_REVIEW';
}

/** Error shape passed to `onError`. */
export interface VerifyClientError {
  code: string;
  message: string;
  sessionId?: string;
}

export interface VerifiedDocumentStatus {
  verified: boolean;
  numberMasked?: string;
}

/** The verified profile — only ever obtained server-side via `fetchVerificationResult()`. */
export interface VerifiedProfile {
  fullName: string;
  dob?: string;
  fatherName?: string;
  gender?: string;
  documents: Partial<Record<VerifyDocumentType, VerifiedDocumentStatus>>;
  bankVerified?: boolean;
  faceMatchConfidence?: number;
  livenessScore?: number;
  verifiedAt?: string;
}

/** Raw response of `GET /api/v1/identity/verify/session/:id/result`. */
export interface VerificationResultResponse {
  sessionId: string;
  status: VerifySessionStatus;
  verifiedProfile?: VerifiedProfile | null;
  environment?: string;
  /** JWS compact serialization signed by 180 Core (verified against the platform JWKS). */
  signature: string;
}
