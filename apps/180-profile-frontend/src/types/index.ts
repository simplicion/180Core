export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  username?: string;
  dob?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export interface ConnectedApp {
  id: string;
  name: string;
  description?: string;
  clientId: string;
  scopes: string[];
  authorizedAt: string;
  logo?: string;
  lastActive?: string;
  status?: 'active' | 'revoked';
}

export interface LedgerEntry {
  id: string;
  userId: string;
  amount: number;
  type: 'TOPUP' | 'PURCHASE' | 'DEBIT' | 'CHECKOUT_PAY' | 'CHECKOUT_RECEIVE' | 'REFUND';
  description: string;
  referenceId?: string;
  appId?: string;
  appName?: string;
  balanceAfter: number;
  createdAt: string;
}

export interface WalletData {
  balance: number;
  currency: string;
  ledgerVersion: number;
  lastTopupAt?: string;
}
