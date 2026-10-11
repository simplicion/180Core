'use client';

import React, { useState } from 'react';
import { PlatformModal, Button, LogoLoader } from '@workspace/ui';
import { CreditCard, Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCoreApiUrl } from '@/lib/api';

interface TopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TopUpModal({ isOpen, onClose, onSuccess }: TopUpModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const quickAmounts = [500, 1000, 2500, 5000];

  const handleRecharge = async () => {
    const finalAmount = customAmount ? parseFloat(customAmount) : selectedAmount;

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
              toast.success(`Wallet credited with ₹${finalAmount}!`, { id: verifyToast });
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('180_wallet_updated', {
                    detail: { balance: verifyData.data?.newBalance },
                  })
                );
              }
              onSuccess();
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
    <PlatformModal
      isOpen={isOpen}
      onClose={onClose}
      title="Top-Up Prepaid Wallet"
      maxWidthClass="max-w-md"
    >
      <div className="space-y-5 text-xs text-slate-700 pt-1 font-sans">
        <p className="text-slate-500 text-xs">
          Add balance to your 180 Profile wallet. Usable for 1-click checkout across all 180 Workspace apps.
        </p>

        {/* Preset Amount Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                +₹{amt}
              </button>
            );
          })}
        </div>

        {/* Custom Input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">Or Custom Amount (INR)</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
            <input
              type="number"
              min="10"
              placeholder="e.g. 1500"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-2.5 min-h-[40px] text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between text-xs">
          <span className="text-blue-700 font-semibold">Total to Recharge:</span>
          <span className="text-sm font-bold text-blue-950">
            ₹{customAmount ? (parseFloat(customAmount) || 0).toFixed(2) : selectedAmount.toFixed(2)} INR
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="min-h-[40px] cursor-pointer">
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleRecharge}
            disabled={loading}
            className="min-h-[40px] bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 cursor-pointer shadow-md shadow-blue-600/20"
          >
            {loading ? <LogoLoader size={16} className="w-4 h-4 text-white" /> : <CreditCard className="w-3.5 h-3.5" />}
            <span>{loading ? 'Processing...' : 'Pay via UPI / Card'}</span>
          </Button>
        </div>
      </div>
    </PlatformModal>
  );
}
