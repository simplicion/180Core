'use client';

import React from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BottomNav } from '@/components/BottomNav';
import { AuthProvider, useAuth } from '@/context/AuthContext';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, balance } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900 selection:bg-blue-500/20 selection:text-blue-950 font-sans relative">
      {/* Background Soft Dot-Matrix Pattern */}
      <div className="fixed inset-0 marketing-grid-bg pointer-events-none z-0 opacity-80" />

      {/* Top Header Navigation */}
      <Header balance={balance} user={user} />

      {/* Main Content Viewport */}
      <main className={`flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-10 ${user ? 'pb-24 sm:pb-10' : 'pb-10'} relative z-10`}>
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar - strictly hidden if user is unauthenticated */}
      {user && <BottomNav user={user} />}

      {/* Unified Platform Footer */}
      <Footer />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  );
}
