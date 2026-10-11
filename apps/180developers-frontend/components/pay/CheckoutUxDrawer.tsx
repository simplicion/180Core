'use client';

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  CreditCard,
  Monitor,
  Smartphone,
  Play,
  Save,
  Loader2,
  CheckCircle2,
  Sparkles,
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
  const { project, saveSettings, saving } = useProject();

  const [payUxModes, setPayUxModes] = useState<string[]>(['bottom_sheet', 'popup']);
  const [payDesktopDefault, setPayDesktopDefault] = useState<string>('bottom_sheet');
  const [payMobileDefault, setPayMobileDefault] = useState<string>('bottom_sheet');

  useEffect(() => {
    if (project) {
      if (project.payUxModes && Array.isArray(project.payUxModes) && project.payUxModes.length > 0) {
        setPayUxModes(project.payUxModes);
      }
      if (project.payDesktopDefault) {
        setPayDesktopDefault(project.payDesktopDefault);
      }
      if (project.payMobileDefault) {
        setPayMobileDefault(project.payMobileDefault);
      }
    }
  }, [project?.payUxModes, project?.payDesktopDefault, project?.payMobileDefault, isOpen]);

  const handleSaveUxModes = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    try {
      await saveSettings({
        payUxModes,
        payDesktopDefault,
        payMobileDefault,
      });
      toast.success('Checkout UX modes saved successfully');
      onClose();
    } catch {
      toast.error('Failed to save checkout UX configuration');
    }
  };

  const onTestPopup = () => {
    try {
      OneEightyPay.openPopup({
        amount: 499,
        currency: 'INR',
        title: `${project?.name || 'Developer Project'} Premium Checkout`,
        description: 'Sandbox verification session (Popup)',
        onSuccess: (res: any) =>
          toast.success(
            `Payment test passed! TxID: ${res?.transactionId || res?.sessionId || 'SUCCESS'}`
          ),
        onCancel: () => toast('Pay checkout closed', { icon: 'ℹ️' }),
      });
    } catch (e: any) {
      toast.error(e.message || 'Popup test failed');
    }
  };

  const onTestBottomSheet = () => {
    try {
      OneEightyPay.openBottomSheet({
        amount: 499,
        currency: 'INR',
        title: `${project?.name || 'Developer Project'} Premium Checkout`,
        description: 'Sandbox verification session (Bottom Sheet)',
        onSuccess: (res: any) =>
          toast.success(
            `Payment test passed! TxID: ${res?.transactionId || res?.sessionId || 'SUCCESS'}`
          ),
        onCancel: () => toast('Pay checkout closed', { icon: 'ℹ️' }),
      });
    } catch (e: any) {
      toast.error(e.message || 'Bottom sheet test failed');
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
            Customize checkout display behaviors for desktop vs mobile devices.
          </p>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-semibold shrink-0">
            180 Pay UX
          </span>
        </div>
      }
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer min-h-[40px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveUxModes}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-600/20 flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50 min-h-[40px]"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Configuration</span>
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Supported Display Modes */}
        <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-zinc-200 dark:border-white/5">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-bold text-zinc-900 dark:text-white">
                Supported Display Modes
              </span>
            </div>
            <span className="text-[11px] text-zinc-400">Select all allowed formats</span>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'bottom_sheet', label: 'Bottom Sheet (Drawer)' },
                { id: 'popup', label: 'Popup Window' },
                { id: 'full_page', label: 'Full Page Redirect' },
              ].map((mode) => {
                const isSelected = payUxModes.includes(mode.id);
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        if (payUxModes.length > 1) {
                          setPayUxModes(payUxModes.filter((m) => m !== mode.id));
                        } else {
                          toast('At least one presentation mode must remain active', { icon: '⚠️' });
                        }
                      } else {
                        setPayUxModes([...payUxModes, mode.id]);
                      }
                    }}
                    className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 ${
                      isSelected
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm shadow-purple-600/25 ring-2 ring-purple-600/20'
                        : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
                    }`}
                  >
                    <span>{mode.label}</span>
                    {isSelected && (
                      <span className="text-[10px] font-bold text-purple-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Enabled
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Device Defaults */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-200 dark:border-white/5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-purple-500" />
                <span>Desktop Default</span>
              </label>
              <select
                value={payDesktopDefault}
                onChange={(e) => setPayDesktopDefault(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-xs font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              >
                <option value="bottom_sheet">Bottom Sheet (Recommended)</option>
                <option value="popup">Popup Window</option>
                <option value="full_page">Full Page Redirect</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-purple-500" />
                <span>Mobile Default</span>
              </label>
              <select
                value={payMobileDefault}
                onChange={(e) => setPayMobileDefault(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-xs font-medium text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
              >
                <option value="bottom_sheet">Bottom Sheet (Recommended)</option>
                <option value="popup">Popup Window</option>
                <option value="full_page">Full Page Redirect</option>
              </select>
            </div>
          </div>
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

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onTestPopup}
              className="w-full sm:w-auto flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 hover:border-purple-500 text-xs font-semibold text-zinc-800 dark:text-zinc-200 shadow-2xs flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-95"
            >
              <Monitor className="w-3.5 h-3.5 text-purple-500" />
              <span>Launch Popup Flow</span>
            </button>

            <button
              type="button"
              onClick={onTestBottomSheet}
              className="w-full sm:w-auto flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 hover:border-purple-500 text-xs font-semibold text-zinc-800 dark:text-zinc-200 shadow-2xs flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-95"
            >
              <Smartphone className="w-3.5 h-3.5 text-purple-500" />
              <span>Launch Bottom Sheet Flow</span>
            </button>
          </div>
        </div>
      </div>
    </PlatformDrawer>
  );
}

export default CheckoutUxDrawer;
