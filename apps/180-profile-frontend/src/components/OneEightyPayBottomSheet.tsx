'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CreditCard, ShieldCheck, CheckCircle2, Wallet } from 'lucide-react';
import { Button, LogoLoader } from '@workspace/ui';
import toast from 'react-hot-toast';
import { getCoreApiUrl } from '@/lib/api';

export interface OneEightyPayBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newBalance?: number) => void;
  currentBalance?: number;
  initialAmount?: number;
  user?: any;
}

export function OneEightyPayBottomSheet({
  isOpen,
  onClose,
  onSuccess,
  currentBalance = 0,
  initialAmount = 1000,
}: OneEightyPayBottomSheetProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(initialAmount || 1000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const quickAmounts = [500, 1000, 2500, 5000];

  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);

  // Pre-load Razorpay checkout JS immediately into DOM
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!(window as any).Razorpay && !document.querySelector('script[src*="checkout.razorpay.com"]')) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  // Update selected amount when initialAmount changes
  useEffect(() => {
    if (initialAmount && initialAmount > 0) {
      setSelectedAmount(initialAmount);
      setCustomAmount('');
    }
  }, [initialAmount]);

  // Global drag listeners for fluid drag-to-dismiss gesture
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - dragStartY.current;
      setDragY(delta < 0 ? delta * 0.22 : delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragY((prev) => {
        if (prev > 75) {
          onClose();
          return 0;
        }
        return 0;
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        const delta = e.touches[0].clientY - dragStartY.current;
        setDragY(delta < 0 ? delta * 0.22 : delta);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      setDragY((prev) => {
        if (prev > 75) {
          onClose();
          return 0;
        }
        return 0;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const finalAmount = customAmount ? parseFloat(customAmount) : selectedAmount;

  const handleRecharge = async () => {
    if (!finalAmount || finalAmount <= 0) {
      toast.error('Please specify a valid recharge amount');
      return;
    }

    if (finalAmount < 10) {
      toast.error('Minimum top-up is ₹10');
      return;
    }

    const token =
      localStorage.getItem('platform_auth_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken');

    if (!token) {
      toast.error('Please sign in to recharge your wallet');
      return;
    }

    const authHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    setLoading(true);
    const toastId = toast.loading('Creating secure Razorpay order...');

    try {
      const res = await fetch(getCoreApiUrl('/api/oauth/wallet/topup/order'), {
        method: 'POST',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify({ amount: finalAmount, currency: 'INR' }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to initialize top-up');
      }

      const { orderId, amountPaise, keyId } = data.data || data;

      let storedUser: any = null;
      try {
        storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      } catch (_) {}

      const options = {
        key: keyId,
        amount: amountPaise,
        currency: 'INR',
        name: '180 Workspace Profile',
        description: 'Universal Prepaid Wallet Recharge',
        order_id: orderId,
        theme: { color: '#2563eb' },
        prefill: {
          name: storedUser?.name || undefined,
          email: storedUser?.email || undefined,
        },
        handler: async function (response: any) {
          const verifyToast = toast.loading('Verifying transaction...');
          try {
            const verifyRes = await fetch(getCoreApiUrl('/api/oauth/wallet/topup/verify'), {
              method: 'POST',
              headers: authHeaders,
              credentials: 'include',
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                amount: finalAmount,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyData.success) {
              const creditedBalance = verifyData.data?.newBalance ?? (currentBalance + finalAmount);
              toast.success(`Wallet credited with ₹${finalAmount}!`, { id: verifyToast });
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('180_wallet_updated', {
                    detail: { balance: creditedBalance },
                  })
                );
              }
              if (onSuccess) {
                onSuccess(creditedBalance);
              }
              onClose();
            } else {
              toast.error(verifyData.error || 'Verification failed', { id: verifyToast });
            }
          } catch (e: any) {
            toast.error('Error verifying recharge', { id: verifyToast });
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            toast.dismiss(toastId);
          },
        },
      };

      if (!(window as any).Razorpay) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        await new Promise((resolve) => {
          script.onload = resolve;
        });
      }

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
      toast.dismiss(toastId);
    } catch (err: any) {
      toast.error(err.message || 'Payment initiation failed', { id: toastId });
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-auto">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
      />

      {/* Bottom Sheet Drawer */}
      <div
        className="relative z-10 w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-[32px] border-t border-slate-200/90 dark:border-zinc-800 shadow-2xl overflow-hidden p-6 sm:p-7 pb-8 animate-in slide-in-from-bottom duration-300 ease-out"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bottom-sheet-title"
      >
        {/* Tactile Drag Handle Bar */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            dragStartY.current = e.clientY;
            setIsDragging(true);
          }}
          onTouchStart={(e) => {
            if (e.touches && e.touches[0]) {
              dragStartY.current = e.touches[0].clientY;
              setIsDragging(true);
            }
          }}
          className="flex justify-center -mt-3 pt-2 pb-4 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700 transition-all hover:bg-slate-400" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-2xs">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 id="bottom-sheet-title" className="text-base font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                Top-Up Prepaid Wallet
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Universal 180 Pay Ledger</p>
            </div>
          </div>
        </div>

        {/* Current Balance Banner */}
        <div className="my-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/80 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-zinc-400 font-medium">Current Available Balance:</span>
          <span className="font-bold text-slate-900 dark:text-zinc-100 text-sm">₹{currentBalance.toFixed(2)} INR</span>
        </div>

        {/* Preset Amounts */}
        <div className="space-y-2 mt-4">
          <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">Select Amount (INR)</label>
          <div className="grid grid-cols-4 gap-2">
            {quickAmounts.map((amt) => {
              const isSelected = selectedAmount === amt && !customAmount;
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setSelectedAmount(amt);
                    setCustomAmount('');
                  }}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs scale-[1.02]'
                      : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-750'
                  }`}
                >
                  +₹{amt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Input */}
        <div className="mt-4">
          <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">Or Enter Custom Amount</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
            <input
              type="number"
              min="10"
              placeholder="e.g. 1500"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-8 pr-4 py-2.5 min-h-[42px] text-xs font-medium text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Summary Pill */}
        <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 flex items-center justify-between text-xs mt-5">
          <div className="flex flex-col">
            <span className="text-blue-900 dark:text-blue-200 font-bold">Total to Recharge</span>
            <span className="text-[11px] text-blue-600 dark:text-blue-400">Zero platform processing fees</span>
          </div>
          <span className="text-lg font-extrabold text-blue-950 dark:text-blue-100">
            ₹{(finalAmount || 0).toFixed(2)} INR
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-5 mt-4 border-t border-slate-100 dark:border-zinc-800">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="flex-1 min-h-[44px] rounded-xl border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            variant="default"
            onClick={handleRecharge}
            disabled={loading}
            className="flex-2 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-600/25 active:scale-98 transition-all"
          >
            {loading ? (
              <LogoLoader size={16} className="w-4 h-4 text-white" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            <span>{loading ? 'Initializing Payment...' : `Pay ₹${(finalAmount || 0).toFixed(2)}`}</span>
          </Button>
        </div>

        {/* Trust Badges */}
        <div className="flex items-center justify-center gap-4 pt-4 text-[11px] text-slate-400 dark:text-zinc-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> 256-bit Encrypted
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Razorpay Verified (UPI / Cards / Netbanking)
          </span>
        </div>
      </div>
    </div>
  );
}

export default OneEightyPayBottomSheet;
