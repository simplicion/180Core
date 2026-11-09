/**
 * 180 Core SDK TypeScript Definitions
 * Universal Client SDK for 180 Identity (SSO/Auth) and 180 Pay (Checkout)
 */

export type EnvironmentMode = 'development' | 'production' | 'auto';

export interface OneEightyConfig {
  clientId?: string;
  authServerUrl?: string;
  payServerUrl?: string;
  apiServerUrl?: string;
  uxMode?: 'bottom_sheet' | 'modal' | 'popup' | 'full_page' | 'auto';
  environment?: EnvironmentMode;
}

export interface AuthSignInOptions {
  clientId?: string;
  authServerUrl?: string;
  redirectUri?: string;
  scope?: string;
  state?: string;
  uxMode?: 'bottom_sheet' | 'modal' | 'popup' | 'full_page' | 'auto';
  environment?: EnvironmentMode;
  onSuccess?: (response: AuthResult) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

export interface AuthResult {
  code?: string;
  token?: string;
  accessToken?: string;
  idToken?: string;
  state?: string;
  user?: any;
}

export interface PayCheckoutOptions {
  amount?: number;
  currency?: string;
  planCode?: string;
  title?: string;
  description?: string;
  sessionId?: string;
  payServerUrl?: string;
  uxMode?: 'bottom_sheet' | 'modal' | 'full_page' | 'popup' | 'auto';
  environment?: EnvironmentMode;
  metadata?: Record<string, any>;
  onSuccess?: (response: PayResult) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

export interface PayResult {
  sessionId: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  status: 'completed' | 'failed' | 'pending';
  isFree?: boolean;
}

export interface AdaptiveModalOptions {
  url: string;
  title?: string;
  uxMode?: 'bottom_sheet' | 'modal' | 'full_page' | 'popup' | 'auto';
  environment?: EnvironmentMode;
  successTypes?: string[];
  closeTypes?: string[];
  mapSuccess?: (data: any) => any;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
}

export interface OneEightyError extends Error {
  code?: string;
  hint?: string;
}

export interface OneEightyAuthService {
  signIn(options?: AuthSignInOptions): Promise<AuthResult | null>;
  openAuthModal(options?: AuthSignInOptions): Promise<AuthResult | null>;
  openLoginPopup(options?: AuthSignInOptions): Promise<AuthResult | null>;
  openBottomSheet(options?: AuthSignInOptions): Promise<AuthResult | null>;
  openPopup(options?: AuthSignInOptions): Promise<AuthResult | null>;
  signOut(): void;
  getUser(): any | null;
  getAccessToken(): string | null;
  resolveEnvironmentMode(customMode?: EnvironmentMode): 'development' | 'production';
  generateReferenceCode(domainPrefix?: 'AUTH' | 'PAY' | 'CORE'): string;
}

export interface OneEightyPayService {
  checkout(options?: PayCheckoutOptions): Promise<PayResult | null>;
  openCheckoutModal(options?: PayCheckoutOptions): Promise<PayResult | null>;
  openBottomSheet(options?: PayCheckoutOptions): Promise<PayResult | null>;
  openPopup(options?: PayCheckoutOptions): Promise<PayResult | null>;
  openFullPage(options?: PayCheckoutOptions): Promise<PayResult | null>;
  resolveEnvironmentMode(customMode?: EnvironmentMode): 'development' | 'production';
  generateReferenceCode(domainPrefix?: 'AUTH' | 'PAY' | 'CORE'): string;
}

export type VerifyDocumentType = 'PAN' | 'DRIVING_LICENSE' | 'VOTER_ID' | 'AADHAAR' | 'BANK_ACCOUNT' | 'FACE_MATCH';

/**
 * Client-side outcome of 180 Verify. Contains NO personal data.
 * SECURITY: this is NOT proof of verification (it comes from the browser). Send sessionId to
 * your server and call fetchVerificationResult() from @workspace/identity-sdk/verify-server.
 */
export interface VerifyClientResult {
  sessionId: string;
  status: 'APPROVED' | 'MANUAL_REVIEW';
}

export interface VerifyClientError {
  code: string;
  message: string;
  sessionId?: string;
}

export interface VerifyLaunchOptions {
  clientId?: string;
  documents: VerifyDocumentType[];
  strictNameMatching?: boolean;
  /** 180 Core API base URL; defaults to OneEighty.init({ apiServerUrl }) */
  apiBaseUrl?: string;
  title?: string;
  /** APPROVED or MANUAL_REVIEW. NOT proof of verification. */
  onSuccess?: (result: VerifyClientResult) => void;
  /** REJECTED is reported as code VERIFICATION_REJECTED. */
  onError?: (error: VerifyClientError) => void;
  onClose?: () => void;
}

export interface VerifyController {
  promise: Promise<VerifyClientResult | null>;
  close(options?: { silent?: boolean }): void;
  getSessionId(): string | undefined;
}

export interface OneEightyVerifyService {
  start(options: VerifyLaunchOptions): VerifyController;
  launch(options: VerifyLaunchOptions): Promise<VerifyClientResult | null>;
  close(): void;
  documentTypes: VerifyDocumentType[];
}

export interface OneEightyUiService {
  openModal(options: AdaptiveModalOptions): Promise<any>;
  openBottomSheet(options: AdaptiveModalOptions): Promise<any>;
  openFullPage(options: AdaptiveModalOptions): Promise<any>;
}

export interface OneEightyCoreInstance {
  version: string;
  init(config?: OneEightyConfig): OneEightyCoreInstance;
  auth: OneEightyAuthService;
  pay: OneEightyPayService;
  verify: OneEightyVerifyService;
  ui: OneEightyUiService;
  resolveEnvironmentMode(customMode?: EnvironmentMode): 'development' | 'production';
  generateReferenceCode(domainPrefix?: 'AUTH' | 'PAY' | 'CORE'): string;
  signIn(options?: AuthSignInOptions): Promise<AuthResult | null>;
  signOut(): void;
  getUser(): any | null;
  getAccessToken(): string | null;
  checkout(options?: PayCheckoutOptions): Promise<PayResult | null>;
  openModal(options: AdaptiveModalOptions): Promise<any>;
}

declare global {
  interface Window {
    OneEighty: OneEightyCoreInstance;
    OneEightyCore: OneEightyCoreInstance;
    OneEightyIdentity: OneEightyAuthService;
    OneEightyAuth: OneEightyAuthService;
    OneEightyPay: OneEightyPayService;
    OneEightyVerify: OneEightyVerifyService;
  }

  interface HTMLElementTagNameMap {
    'one-eighty-auth-button': HTMLElement;
    'one-eighty-pay-button': HTMLElement;
    'one-eighty-pricing-table': HTMLElement;
  }
}

export const OneEighty: OneEightyCoreInstance;
export const OneEightyCore: OneEightyCoreInstance;
export const OneEightyIdentity: OneEightyAuthService;
export const OneEightyAuth: OneEightyAuthService;
export const OneEightyPay: OneEightyPayService;
export const OneEightyVerify: OneEightyVerifyService;
export function resolveEnvironmentMode(customMode?: EnvironmentMode): 'development' | 'production';
export function generateReferenceCode(domainPrefix?: 'AUTH' | 'PAY' | 'CORE'): string;
export function init180Sdk(options?: { cdnUrl?: string; timeoutMs?: number }): Promise<OneEightyAuthService>;
export function load180CoreSdk(options?: { cdnUrl?: string; timeoutMs?: number }): Promise<OneEightyAuthService>;

export default OneEighty;

