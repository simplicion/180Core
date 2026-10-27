'use client';

import React from 'react';
import {
  Sliders,
  CreditCard,
  Smartphone,
  Play,
} from 'lucide-react';
import { PlatformDrawer } from '@workspace/ui';
import { OneEightyPay } from '@workspace/identity-sdk';
import { toast } from 'react-hot-toast';
import { useProject } from '@/context/ProjectContext';

export interface CheckoutUxDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CheckoutUxDrawer({ isOpen, onClose }: CheckoutUxDrawerProps) {
  const { project } = useProject();

  const onTestCheckout = () => {
    try {
      const cur = ((project as any)?.currency || 'USD').toUpperCase();
      const amt = (project as any)?.defaultAmount !== undefined ? (project as any).defaultAmount : 49.0;
      OneEightyPay.checkout({
        sessionId: `sess_sandbox_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`,
        amount: amt,
        currency: cur,
        appId: project?.id,
        title: `${project?.name || 'Developer Project'} Checkout`,
        description: 'Sandbox verification session (Adaptive Sheet)',
        environment: 'sandbox',
        onSuccess: (res: any) =>
          toast.success(
            `Payment test passed! TxID: ${res?.transactionId || res?.sessionId || 'SUCCESS'}`
          ),
        onCancel: () => toast('Pay checkout closed', { icon: 'ℹ️' }),
      });
    } catch (e: any) {
      toast.error(e.message || 'Checkout test failed');
    }
  };

  return (
    <PlatformDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Checkout Presentation & UX Modes"
      icon={Sliders}
      iconColorClass="text-purple-600 dark:text-purple-400"
      iconBgClass="bg-purple-500/10"
      maxWidthClass="max-w-xl"
      subHeader={
        <div className="px-6 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-white/5 flex items-center justify-between">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            180 Pay uses an adaptive in-DOM presentation model across mobile and desktop.
          </p>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-semibold shrink-0">
            Zero-Config UX
          </span>
        </div>
      }
      footer={
        <div className="w-full flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-600/20 cursor-pointer transition-all active:scale-95 min-h-[40px]"
          >
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Adaptive Display Model Card */}
        <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200 dark:border-white/5">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-bold text-zinc-900 dark:text-white">
                Adaptive Display Model
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
              Active Standard
            </span>
          </div>

          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            180 Pay automatically renders as an in-DOM <span className="font-semibold text-zinc-900 dark:text-white">Bottom Sheet</span> on mobile devices and a sleek centered <span className="font-semibold text-zinc-900 dark:text-white">Modal Card</span> on desktop. Zero popup-blockers, no callback redirect URLs needed, and 100% reliable PhonePe / UPI gateway returns.
          </p>
        </div>

        {/* Interactive SDK Experience Tester */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/5 via-indigo-500/5 to-transparent border border-purple-500/20 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5 text-purple-500" />
              <span>Interactive SDK Experience Tester</span>
            </span>
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono font-semibold">
              Simulate User Flow
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Test the live client-side checkout experience without deploying code. Launches in sandboxed mode.
          </p>

          <div className="pt-1">
            <button
              type="button"
              onClick={onTestCheckout}
              className="w-full px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-95"
            >
              <Smartphone className="w-3.5 h-3.5 text-white" />
              <span>Launch Sovereign Checkout Sheet</span>
            </button>
          </div>
        </div>
      </div>
    </PlatformDrawer>
  );
}

export default CheckoutUxDrawer;
