'use client';

import React, { useState, useEffect } from 'react';
import {
  Landmark,
  Save,
  Loader2,
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

  const [settlementMethod, setSettlementMethod] = useState<'UPI' | 'BANK_TRANSFER'>(
    bankDetails?.settlementMethod || (bankDetails?.upiId && !bankDetails?.accountNumber ? 'UPI' : 'BANK_TRANSFER')
  );
  const [accountHolderName, setAccountHolderName] = useState(bankDetails?.accountHolderName || '');
  const [bankName, setBankName] = useState(bankDetails?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(bankDetails?.accountNumber || '');
  const [ifscCode, setIfscCode] = useState(bankDetails?.ifscCode || '');
  const [upiId, setUpiId] = useState(bankDetails?.upiId || '');
  const [saving, setSaving] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);

  // Sync with context bank details when opened or updated
  useEffect(() => {
    if (bankDetails) {
      if (bankDetails.settlementMethod) {
        setSettlementMethod(bankDetails.settlementMethod);
      } else if (bankDetails.upiId && !bankDetails.accountNumber) {
        setSettlementMethod('UPI');
      } else {
        setSettlementMethod('BANK_TRANSFER');
      }
      setAccountHolderName(bankDetails.accountHolderName || '');
      setBankName(bankDetails.bankName || '');
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
          const apiBase = isLocal ? 'http://localhost:4003' : (process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://api.180core.cloud');

          const res = await fetch(`${apiBase}/api/v1/developer/apps/${projectId}/bank-details`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            const details = data.data || data.bankDetails;
            if (details) {
              if (details.settlementMethod) {
                setSettlementMethod(details.settlementMethod);
              } else if (details.upiId && !details.accountNumber) {
                setSettlementMethod('UPI');
              }
              if (details.accountHolderName) setAccountHolderName(details.accountHolderName);
              if (details.bankName) setBankName(details.bankName);
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

    if (settlementMethod === 'UPI') {
      if (!accountHolderName.trim()) {
        toast.error('Please enter the Receiver / Beneficiary Legal Name');
        return;
      }
      if (!upiId.trim()) {
        toast.error('Please provide a Settlement UPI ID (e.g. acme@okaxis)');
        return;
      }
      if (!upiId.includes('@')) {
        toast.error('Invalid UPI ID format. Must include "@" (e.g. merchant@okaxis)');
        return;
      }
    } else {
      if (!accountHolderName.trim()) {
        toast.error('Please enter the Account Holder Legal Name matching your bank records');
        return;
      }
      if (!accountNumber.trim()) {
        toast.error('Please provide the Bank Account Number');
        return;
      }
      if (!ifscCode.trim() || ifscCode.trim().length !== 11) {
        toast.error('Please enter a valid 11-character IFSC Code (e.g. HDFC0001234)');
        return;
      }
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('platform_auth_token');
      const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const apiBase = isLocal ? 'http://localhost:4003' : (process.env.NEXT_PUBLIC_CORE_BACKEND_URL || 'https://api.180core.cloud');

      const payload = {
        settlementMethod,
        accountHolderName: accountHolderName.trim(),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        upiId: upiId.trim(),
      };

      // 1. Try PUT to /api/v1/developer/apps/:id/bank-details
      let res = await fetch(`${apiBase}/api/v1/developer/apps/${projectId}/bank-details`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      // Fallback: try POST to /api/v1/identity/developer/apps/:id/bank-details if PUT returned 404
      if (!res.ok && res.status === 404) {
        res = await fetch(`${apiBase}/api/v1/identity/developer/apps/${projectId}/bank-details`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Failed to update settlement destination details');
      }

      const updatedDetails = {
        settlementMethod,
        accountHolderName: accountHolderName.trim(),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        upiId: upiId.trim(),
      };
      setBankDetails(updatedDetails);

      toast.success(
        settlementMethod === 'UPI'
          ? 'Settlement UPI destination saved successfully!'
          : 'Settlement Bank Account details saved successfully!'
      );
      await refreshProject?.();
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Error saving settlement details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Settlement Bank & UPI"
      icon={Landmark}
      iconColorClass="text-purple-600 dark:text-purple-400"
      iconBgClass="bg-purple-500/10"
      maxWidthClass="max-w-lg"
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
            <span>Save Details</span>
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {loadingInitial && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-xs text-zinc-500 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
            <span>Loading settlement details...</span>
          </div>
        )}

        {/* Settlement Method Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            Payout Method
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/5">
            <button
              type="button"
              onClick={() => setSettlementMethod('UPI')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                settlementMethod === 'UPI'
                  ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-300 shadow-sm border border-purple-500/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span>UPI</span>
            </button>

            <button
              type="button"
              onClick={() => setSettlementMethod('BANK_TRANSFER')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                settlementMethod === 'BANK_TRANSFER'
                  ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-300 shadow-sm border border-purple-500/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Landmark className="w-4 h-4 shrink-0" />
              <span>Bank Account</span>
            </button>
          </div>
        </div>

        {/* Option 1: UPI Form */}
        {settlementMethod === 'UPI' && (
          <div className="space-y-3.5 animate-in fade-in-50 duration-200">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Account Holder Name
              </label>
              <input
                type="text"
                required
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="Name as registered with bank or UPI"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                UPI ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="e.g. name@okhdfcbank"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
                />
                <QrCode className="w-4 h-4 text-zinc-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>
        )}

        {/* Option 2: Bank Account Form */}
        {settlementMethod === 'BANK_TRANSFER' && (
          <div className="space-y-3.5 animate-in fade-in-50 duration-200">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Account Holder Name
              </label>
              <input
                type="text"
                required
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="Name as per bank account"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Account Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\s+/g, ''))}
                  placeholder="Enter account number"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
                />
                <CreditCard className="w-4 h-4 text-zinc-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  IFSC Code
                </label>
                <input
                  type="text"
                  required
                  value={ifscCode}
                  maxLength={11}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                  placeholder="e.g. HDFC0001234"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono uppercase text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Bank Name <span className="text-[10px] text-zinc-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="popular-banks-list"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank"
                    className="w-full pl-3.5 pr-8 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
                  />
                  <Building2 className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-3.5 pointer-events-none" />
                  <datalist id="popular-banks-list">
                    <option value="HDFC Bank" />
                    <option value="State Bank of India (SBI)" />
                    <option value="ICICI Bank" />
                    <option value="Axis Bank" />
                    <option value="Kotak Mahindra Bank" />
                    <option value="Punjab National Bank (PNB)" />
                    <option value="Bank of Baroda" />
                    <option value="Canara Bank" />
                    <option value="IndusInd Bank" />
                    <option value="IDFC FIRST Bank" />
                    <option value="Federal Bank" />
                    <option value="Yes Bank" />
                  </datalist>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>
    </PlatformDrawer>
  );
}

export default BankDetailsDrawer;
