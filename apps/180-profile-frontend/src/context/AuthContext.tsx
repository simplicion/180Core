'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile } from '@/types';
import { getCoreApiUrl } from '@/lib/api';
import { getStoredAuthToken, purgeAuthSession } from '@/lib/auth';

interface AuthContextType {
  user: UserProfile | null;
  balance: number;
  loading: boolean;
  refreshUser: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  balance: 0,
  loading: true,
  refreshUser: async () => {},
  refreshWallet: async () => {},
  signOut: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfileAndWallet = useCallback(async () => {
    const token = getStoredAuthToken();

    if (!token) {
      setUser(null);
      setBalance(0);
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    try {
      // 1. Fetch user profile
      const userRes = await fetch(getCoreApiUrl('/api/oauth/userinfo'), {
        headers,
        credentials: 'include',
      });

      if (userRes.ok) {
        const data = await userRes.json().catch(() => null);
        if (data && (data.user || data.id)) {
          const validUser = data.user || data;
          setUser(validUser);
          try {
            localStorage.setItem('user', JSON.stringify(validUser));
          } catch (_) {}
        } else {
          setUser(null);
        }
      } else {
        purgeAuthSession();
        setUser(null);
        setBalance(0);
        setLoading(false);
        return;
      }

      // 2. Fetch wallet balance
      try {
        const walletRes = await fetch(getCoreApiUrl('/api/oauth/wallet'), {
          headers,
          credentials: 'include',
        });
        if (walletRes.ok) {
          const wData = await walletRes.json().catch(() => null);
          if (wData?.data && typeof wData.data.balance === 'number') {
            setBalance(wData.data.balance);
          } else if (wData && typeof wData.balance === 'number') {
            setBalance(wData.balance);
          } else {
            setBalance(0);
          }
        }
      } catch (_) {
        setBalance(0);
      }
    } catch (_) {
      setUser(null);
      setBalance(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshWallet = useCallback(async () => {
    const token = getStoredAuthToken();
    if (!token) return;
    try {
      const res = await fetch(getCoreApiUrl('/api/oauth/wallet'), {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (res.ok) {
        const wData = await res.json().catch(() => null);
        if (wData?.data && typeof wData.data.balance === 'number') {
          setBalance(wData.data.balance);
        }
      }
    } catch (_) {}
  }, []);

  const signOut = useCallback(() => {
    purgeAuthSession();
    setUser(null);
    setBalance(0);
    window.location.href = '/';
  }, []);

  useEffect(() => {
    fetchProfileAndWallet();

    const handleWalletUpdated = (e: any) => {
      if (typeof e.detail?.balance === 'number') {
        setBalance(e.detail.balance);
      } else {
        refreshWallet();
      }
    };

    const handleSignout = () => {
      setUser(null);
      setBalance(0);
    };

    const handleAuthSuccess = () => {
      fetchProfileAndWallet();
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'platform_auth_token' || e.key === 'token') {
        fetchProfileAndWallet();
      }
    };

    window.addEventListener('180_wallet_updated', handleWalletUpdated);
    window.addEventListener('180_SIGNOUT', handleSignout);
    window.addEventListener('180_AUTH_SUCCESS', handleAuthSuccess);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('180_wallet_updated', handleWalletUpdated);
      window.removeEventListener('180_SIGNOUT', handleSignout);
      window.removeEventListener('180_AUTH_SUCCESS', handleAuthSuccess);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [fetchProfileAndWallet, refreshWallet]);

  return (
    <AuthContext.Provider
      value={{
        user,
        balance,
        loading,
        refreshUser: fetchProfileAndWallet,
        refreshWallet,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
