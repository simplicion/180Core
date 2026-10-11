'use client';

import React, { useState, useEffect } from 'react';
import {
  Landmark,
  Save,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Info,
  Settings,
  CreditCard,
  QrCode,
  Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PlatformDrawer } from '@workspace/ui';
import { useProject } from '@/context/ProjectContext';

export interface BankDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function BankDetailsDrawer({
  isOpen,
  onClose,
  onSaved,
}: BankDetailsDrawerProps) {
  const { projectId, bankDetails, setBankDetails, refreshProject } = useProject();

  const [accountHolderName, setAccountHolderName] = useState(bankDetails?.accountHolderName || '');
  const [accountNumber, setAccountNumber] = useState(bankDetails?.accountNumber || '');
  const [ifscCode, setIfscCode] = useState(bankDetails?.ifscCode || '');
  const [upiId, setUpiId] = useState(bankDetails?.upiId || '');
  const [saving, setSaving] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);

  // Sync with context bank details when opened or updated
  useEffect(() => {
    if (bankDetails) {
      setAccountHolderName(bankDetails.accountHolderName || '');
      setAccountNumber(bankDetails.accountNumber || '');
      setIfscCode(bankDetails.ifscCode || '');
      setUpiId(bankDetails.upiId || '');
    }
  }, [bankDetails]);

  // Fetch fresh bank details from server if not populated in context
  useEffect(() => {
    if (isOpen && projectId && projectId !== 'default') {
      const fetchFreshDetails = async () => {
        try {
          setLoadingInitial(true);
          const token = localStorage.getItem('platform_auth_token');
          const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
          const apiBase = isLocal ? 'http://localhost:4003' : 'https://services.180workspace.com';

          const res = await fetch(`${apiBase}/api/v1/developer/apps/${projectId}/bank-details`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            const details = data.data || data.bankDetails;
            if (details) {
              if (details.accountHolderName) setAccountHolderName(details.accountHolderName);
              if (details.accountNumber) setAccountNumber(details.accountNumber);
              if (details.ifscCode) setIfscCode(details.ifscCode);
              if (details.upiId) setUpiId(details.upiId);
            }
          }
        } catch (_) {
          // Non-blocking fetch
        } finally {
          setLoadingInitial(false);
        }
      };

      fetchFreshDetails();
    }
  }, [isOpen, projectId]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!accountHolderName.trim()) {
      toast.error('Please enter the Account Holder Legal Name');
      return;
    }

    if (!accountNumber.trim() && !upiId.trim()) {
      toast.error('Please provide either a Bank Account Number or a Primary Settlement UPI ID');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const apiBase = isLocal ? 'http://localhost:4003' : 'https://services.180workspace.com';

      // 1. Try PUT to /api/v1/developer/apps/:id/bank-details
      let res = await fetch(`${apiBase}/api/v1/developer/apps/${projectId}/bank-details`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accountHolderName: accountHolderName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase(),
          upiId: upiId.trim(),
        }),
      });

      // Fallback: try POST to /api/v1/identity/developer/apps/:id/bank-details if PUT returned 404
      if (!res.ok && res.status === 404) {
        res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/bank-details`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            accountHolderName: accountHolderName.trim(),
            accountNumber: accountNumber.trim(),
            ifscCode: ifscCode.trim().toUpperCase(),
            upiId: upiId.trim(),
          }),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Failed to update settlement bank details');
      }

      const updatedDetails = {
        accountHolderName: accountHolderName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        upiId: upiId.trim(),
      };
      setBankDetails(updatedDetails);

      toast.success('Settlement bank details verified and updated successfully!');
      await refreshProject?.();
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error saving bank details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Settlement Bank & UPI Configuration"
      icon={Landmark}
      iconColorClass="text-purple-600 dark:text-purple-400"
      iconBgClass="bg-purple-500/10"
      maxWidthClass="max-w-xl"
      subHeader={
        <div className="px-6 py-3.5 bg-purple-50/60 dark:bg-purple-950/20 border-b border-purple-200/50 dark:border-purple-800/30 flex items-start gap-2.5 text-xs">
          <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-purple-950 dark:text-purple-200">Penny-Drop Bank Verification</span>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Bank account changes undergo automated NPCI IMPS penny-drop verification to ensure the beneficiary name matches your registered identity.
            </p>
          </div>
        </div>
      }
      footer={
        <div className="w-full flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer min-h-[40px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors min-h-[40px]"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save Bank Details</span>
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {loadingInitial && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-xs text-zinc-500 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
            <span>Retrieving current settlement credentials...</span>
          </div>
        )}

        {/* Informative Destination Note */}
        <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-white/5 space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white">
            <Building2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Target Financial Destination</span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Payout requests from your Settled Withdrawable Balance will be credited directly to these account details.
          </p>
        </div>

        {/* Field 1: Account Holder Legal Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
            <span>Account Holder Legal Name</span>
            <span className="text-[10px] text-zinc-400 font-normal">Matches Bank ID</span>
          </label>
          <input
            type="text"
            required
            value={accountHolderName}
            onChange={(e) => setAccountHolderName(e.target.value)}
            placeholder="e.g. Acme Tech Private Limited"
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {/* Field 2: Bank Account Number */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
            <span>Bank Account Number</span>
            <span className="text-[10px] text-zinc-400 font-normal">NEFT / RTGS / IMPS</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\s+/g, ''))}
              placeholder="e.g. 50100412345678"
              className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
            />
            <CreditCard className="w-4 h-4 text-zinc-400 absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>

        {/* Field 3: IFSC Code */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
            <span>IFSC Code</span>
            <span className="text-[10px] text-zinc-400 font-normal">11-Character Code</span>
          </label>
          <input
            type="text"
            value={ifscCode}
            onChange={(e) => setIfscCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
            placeholder="e.g. HDFC0001234"
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono uppercase text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {/* Field 4: Primary Settlement UPI ID */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
            <span>Primary Settlement UPI ID (Optional)</span>
            <span className="text-[10px] text-zinc-400 font-normal">Instant 24x7 Settlement</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value.toLowerCase().replace(/\s+/g, ''))}
              placeholder="e.g. acme@okaxis"
              className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
            />
            <QrCode className="w-4 h-4 text-zinc-400 absolute right-3 top-3 pointer-events-none" />
          </div>
        </div>
      </form>
    </PlatformDrawer>
  );
}

export default BankDetailsDrawer;
