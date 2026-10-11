'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BottomNav } from '@/components/BottomNav';
import { UserProfile } from '@/types';
import { getCoreApiUrl } from '@/lib/api';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [balance, setBalance] = useState<number | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchProfileAndWallet = async () => {
      const token =
        localStorage.getItem('platform_auth_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken');

      if (!token) {
        setUser(null);
        setBalance(null);
        return;
      }

      // 1. Fetch User Profile
      try {
        const res = await fetch(getCoreApiUrl('/api/oauth/userinfo'), {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && (data.user || data.id)) {
            const validUser = data.user || data;
            setUser(validUser);
            localStorage.setItem('user', JSON.stringify(validUser));
          } else {
            setUser(null);
          }
        } else {
          localStorage.removeItem('platform_auth_token');
          localStorage.removeItem('token');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('user');
          setUser(null);
        }
      } catch (_) {
        setUser(null);
      }

      // 2. Fetch Wallet Balance
      try {
        const res = await fetch(getCoreApiUrl('/api/oauth/wallet'), {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && data.data && typeof data.data.balance === 'number') {
            setBalance(data.data.balance);
          } else {
            setBalance(0.0);
          }
        } else {
          setBalance(0.0);
        }
      } catch (_) {
        setBalance(0.0);
      }
    };

    fetchProfileAndWallet();

    const handleWalletUpdated = (e: any) => {
      if (typeof e.detail?.balance === 'number') {
        setBalance(e.detail.balance);
      } else {
        fetchProfileAndWallet();
      }
    };

    window.addEventListener('180_wallet_updated', handleWalletUpdated);
    return () => {
      window.removeEventListener('180_wallet_updated', handleWalletUpdated);
    };
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 selection:bg-blue-500/20 selection:text-blue-950 font-sans relative">
      {/* Background Soft Dot-Matrix Pattern */}
      <div className="fixed inset-0 marketing-grid-bg pointer-events-none z-0 opacity-80" />

      {/* Top Header Navigation */}
      <Header balance={balance} user={user} />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-10 pb-24 sm:pb-10 relative z-10">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav user={user} />

      {/* Unified Platform Footer */}
      <Footer />
    </div>
  );
}
