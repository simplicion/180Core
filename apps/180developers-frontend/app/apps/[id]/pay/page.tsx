'use client';

import React, { useState } from 'react';
import { ChevronDown, Smartphone } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { OneEightyPay } from '@workspace/identity-sdk';
import { usePlatformCurrency } from '@workspace/ui';
import { AppShellLayout } from '@/components/common/AppShellLayout';
import { PaySidebar } from '@/components/pay/PaySidebar';
import { PayBottomNav } from '@/components/pay/PayBottomNav';
import { PayOverviewView } from '@/components/pay/PayOverviewView';
import { useProject } from '@/context/ProjectContext';

export default function PayOverviewPage() {
  const { enablePay, setEnablePay, saveSettings, saving, project } = useProject();
  const { activeCurrency, activeMeta, openCurrencyModal } = usePlatformCurrency();
  const [isTogglingPay, setIsTogglingPay] = useState(false);

  const handleTestCheckout = () => {
    try {
      const cur = ((project as any)?.currency || activeCurrency || 'USD').toUpperCase();
      const amt = (project as any)?.defaultAmount !== undefined ? (project as any).defaultAmount : 49.0;
      OneEightyPay.checkout({
        sessionId: `sess_sandbox_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`,
        amount: amt,
        currency: cur,
        appId: project?.id,
        title: `${project?.name || 'Developer Project'} Checkout`,
        description: 'Sandbox verification session (Adaptive Sheet)',
        environment: 'sandbox',
        onSuccess: (res: any) => toast.success(`Payment test passed! TxID: ${res?.transactionId || res?.sessionId || 'SUCCESS'}`),
        onCancel: () => toast('Pay checkout closed', { icon: 'ℹ️' }),
      });
    } catch (e: any) {
      toast.error(e.message || 'Checkout test failed');
    }
  };

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
    <AppShellLayout
      sidebar={<PaySidebar />}
      bottomNav={<PayBottomNav />}
      title="180 Pay Overview & Analytics"
      badge="Checkout Engine"
      badgeColor="purple"
      action={
        <div className="flex items-center gap-2.5">
          {/* View Demo Checkout Button */}
          <button
            type="button"
            onClick={handleTestCheckout}
            className="px-3.5 py-1.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Launch test checkout sheet demo"
          >
            <Smartphone className="w-3.5 h-3.5 text-white" />
            <span>View Demo</span>
          </button>

          {/* Global Currency Selector (from 180 Checkout) */}
          <button
            type="button"
            onClick={openCurrencyModal}
            className="px-3 py-1.5 rounded-2xl bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-200 shadow-2xs transition-all cursor-pointer flex items-center gap-2 group active:scale-95"
            title="Change Display Currency (Auto-detected from your location, defaults to USD)"
          >
            <span className="text-base leading-none">{activeMeta.flag}</span>
            <span className="text-xs font-bold font-mono text-zinc-900 dark:text-white">
              {activeCurrency} ({activeMeta.symbol})
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-transform" />
          </button>

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
        </div>
      }
    >
      <PayOverviewView />
    </AppShellLayout>
  );
}
