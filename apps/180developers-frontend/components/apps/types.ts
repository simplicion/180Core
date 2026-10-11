export interface DeveloperAppDetail {
  id: string;
  name: string;
  description: string;
  logoUrl?: string;
  clientId: string;
  clientSecretHint: string;
  redirectUris: string[];
  allowedOrigins: string[];
  allowedScopes: string[];
  isVerified: boolean;
  isActive: boolean;
  enableAuth: boolean;
  enablePay: boolean;
  webhookUrl: string;
  webhookSecret: string;
  authUxModes?: string[];
  payUxModes?: string[];
  authDesktopDefault?: string;
  authMobileDefault?: string;
  payDesktopDefault?: string;
  payMobileDefault?: string;
  accessTokenTtl?: number;
  refreshTokenDays?: number;
  createdAt: string;
}

export interface AuthLogEntry {
  userId: string;
  email?: string;
  phone?: string;
  name?: string;
  avatarUrl?: string;
  username?: string;
  authMethod: string;
  activeSessions: number;
  lastActive: string;
  sessionId?: string;
}

export interface AuthLogsData {
  logs: AuthLogEntry[];
  totalUsers: number;
  activeSessionsCount: number;
}

export interface TransactionRecord {
  id: string;
  amount: number;
  originalAmount?: number;
  discountAmount?: number;
  couponCode?: string | null;
  currency: string;
  status: 'CAPTURED' | 'GATEWAY_DROPPED' | 'INTENT_ONLY' | 'FAILED' | string;
  statusLabel?: string;
  stage?: string;
  stageLabel?: string;
  stageDescription?: string;
  title?: string;
  description?: string;
  customer?: { name?: string; email?: string; phone?: string } | null;
  customerPhone?: string;
  customerName?: string;
  customerEmail?: string;
  method?: string;
  paymentMethod?: string;
  createdAt: string;
  completedAt?: string | null;
  gatewayInvokedAt?: string | null;
  ip?: string;
  userAgent?: string;
  language?: string;
  location?: string;
  gatewayOrderId?: string | null;
  gatewayPaymentId?: string | null;
  upiId?: string;
  notes?: Record<string, any>;
  gatewayTxId?: string;
}

export interface PaymentAnalyticsData {
  grossVolume: number;
  platformFeePercent?: number;
  totalPlatformFee?: number;
  netMerchantVolume?: number;
  thisMonthVolume: number;
  lastMonthVolume: number;
  pendingSettlements: number;
  withdrawableBalance: number;
  currency: string;
  totalTransactionsCount: number;
  totalIntentsCount?: number;
  totalIntentsVolume?: number;
  gatewayAttemptsCount?: number;
  gatewayAttemptsVolume?: number;
  intentOnlyCount?: number;
  conversionRate?: number;
  transactions: TransactionRecord[];
}

export interface BankDetailsData {
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  upiId?: string;
}

export interface PayoutRecord {
  id: string;
  amount: number;
  currency: string;
  status: 'REQUESTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | string;
  method: 'UPI' | 'BANK_TRANSFER' | string;
  destination: string;
  adminNote?: string;
  transactionRef?: string;
  createdAt: string;
  processedAt?: string;
}

export interface WebhookTestResult {
  success: boolean;
  statusCode: number;
  latencyMs: number;
  signature: string;
  targetUrl: string;
  message: string;
  response: string;
}
