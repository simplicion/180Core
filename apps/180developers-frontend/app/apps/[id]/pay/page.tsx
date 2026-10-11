'use client';

import React, { useState } from 'react';
import { Settings, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AppShellLayout } from '@/components/common/AppShellLayout';
import { PaySidebar } from '@/components/pay/PaySidebar';
import { PayBottomNav } from '@/components/pay/PayBottomNav';
import { PayOverviewView } from '@/components/pay/PayOverviewView';
import { CheckoutUxDrawer } from '@/components/pay/CheckoutUxDrawer';
import { useProject } from '@/context/ProjectContext';

export default function PayOverviewPage() {
  const { enablePay, setEnablePay, saveSettings, saving } = useProject();
  const [isUxDrawerOpen, setIsUxDrawerOpen] = useState(false);
  const [isTogglingPay, setIsTogglingPay] = useState(false);

  const handleToggleEnablePay = async () => {
    setIsTogglingPay(true);
    try {
      const next = !enablePay;
      setEnablePay(next);
      await saveSettings({ enablePay: next });
    } catch {
      toast.error('Failed to update 180 Pay status');
    } finally {
      setIsTogglingPay(false);
    }
  };

  return (
    <>
      <AppShellLayout
        sidebar={<PaySidebar />}
        bottomNav={<PayBottomNav />}
        title="180 Pay Overview & Analytics"
        badge="Checkout Engine"
        badgeColor="purple"
        action={
          <div className="flex items-center gap-2.5">
            {/* Enable / Disable 180 Pay Toggle Button */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 shadow-2xs">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full transition-colors ${
                    enablePay ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
                  }`}
                />
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 select-none">
                  {enablePay ? 'Pay Active' : 'Pay Disabled'}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enablePay}
                onClick={handleToggleEnablePay}
                disabled={isTogglingPay || saving}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  enablePay ? 'bg-purple-600' : 'bg-zinc-300 dark:bg-zinc-700'
                } disabled:opacity-50`}
                title={enablePay ? 'Click to disable 180 Pay' : 'Click to enable 180 Pay'}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    enablePay ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Setting Icon Button: Opens Checkout Presentation & UX Modes Drawer */}
            <button
              type="button"
              onClick={() => setIsUxDrawerOpen(true)}
              className="px-3 py-2 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:text-purple-600 dark:hover:text-purple-400 shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 group active:scale-95"
              title="Checkout Presentation & UX Modes"
            >
              <Settings className="w-4 h-4 text-zinc-600 dark:text-zinc-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:rotate-45 transition-all duration-300" />
              <span className="text-xs font-semibold">UX Settings</span>
            </button>
          </div>
        }
      >
        <PayOverviewView onOpenUxDrawer={() => setIsUxDrawerOpen(true)} />
      </AppShellLayout>

      {/* Checkout Presentation & UX Modes Drawer Component */}
      <CheckoutUxDrawer
        isOpen={isUxDrawerOpen}
        onClose={() => setIsUxDrawerOpen(false)}
      />
    </>
  );
}
