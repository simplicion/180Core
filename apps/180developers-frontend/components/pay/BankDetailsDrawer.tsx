'use client';

import React, { useState, useEffect } from 'react';
import {
  Landmark,
  Save,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Info,
  CreditCard,
  QrCode,
  Building2,
  Zap,
  ChevronDown,
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
            <span>Save {settlementMethod === 'UPI' ? 'UPI Details' : 'Bank Details'}</span>
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
            Payout requests from your Settled Withdrawable Balance will be credited directly to your selected destination below.
          </p>
        </div>

        {/* Settlement Method Selector: Dual-Option Tabs */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              Select Payout Method
            </label>
            <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400">
              {settlementMethod === 'UPI' ? 'Instant 24x7 Routing' : 'Direct Corporate Clearing'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/5">
            <button
              type="button"
              onClick={() => setSettlementMethod('UPI')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                settlementMethod === 'UPI'
                  ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-300 shadow-sm border border-purple-500/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span>UPI Transfer</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                settlementMethod === 'UPI'
                  ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
              }`}>
                Instant
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSettlementMethod('BANK_TRANSFER')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                settlementMethod === 'BANK_TRANSFER'
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-300 shadow-sm border border-blue-500/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Landmark className="w-4 h-4 shrink-0" />
              <span>Bank Account</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                settlementMethod === 'BANK_TRANSFER'
                  ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
              }`}>
                NEFT/IMPS
              </span>
            </button>
          </div>

          {/* Alternative Dropdown Selector (Optional for convenient switching) */}
          <div className="relative pt-1">
            <select
              aria-label="Select Settlement Option"
              value={settlementMethod}
              onChange={(e) => setSettlementMethod(e.target.value as 'UPI' | 'BANK_TRANSFER')}
              className="w-full pl-3.5 pr-8 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-purple-500 transition-colors cursor-pointer appearance-none"
            >
              <option value="UPI">Option 1: Receive Payments in UPI (Instant VPA Payout)</option>
              <option value="BANK_TRANSFER">Option 2: Receive Payments in Bank Account (NEFT / RTGS / IMPS)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-3.5 pointer-events-none" />
          </div>
        </div>

        {/* -------------------- OPTION 1: UPI FORM -------------------- */}
        {settlementMethod === 'UPI' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            {/* UPI Info Box */}
            <div className="p-3.5 rounded-2xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/30 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-purple-950 dark:text-purple-200">
                <Zap className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Instant 24x7 NPCI UPI Settlement</span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Payout withdrawals will be routed instantly 24x7 to your registered Virtual Payment Address (VPA) with immediate confirmation.
              </p>
            </div>

            {/* Field: Receiver Legal Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>Receiver / Beneficiary Legal Name</span>
                <span className="text-[10px] text-zinc-400 font-normal">Matches Bank ID / KYC</span>
              </label>
              <input
                type="text"
                required
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="e.g. Acme Tech Private Limited or Rahul Sharma"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Field: UPI ID (VPA) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>Primary Settlement UPI ID</span>
                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold">Instant 24x7 Settlement</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="e.g. acme@okaxis or rahul@okhdfcbank"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
                />
                <QrCode className="w-4 h-4 text-purple-500 dark:text-purple-400 absolute right-3 top-3 pointer-events-none" />
              </div>
              <p className="text-[10px] text-zinc-400">
                Supported handles: @okaxis, @okhdfcbank, @oksbi, @icici, @paytm, @ybl, etc.
              </p>
            </div>
          </div>
        )}

        {/* -------------------- OPTION 2: BANK ACCOUNT FORM -------------------- */}
        {settlementMethod === 'BANK_TRANSFER' && (
          <div className="space-y-4 animate-in fade-in-50 duration-200">
            {/* Bank Info Box */}
            <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/30 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950 dark:text-blue-200">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Automated NPCI IMPS Clearing</span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Bank payouts are cleared through NEFT, RTGS, and IMPS corporate banking networks with penny-drop verification against registered bank records.
              </p>
            </div>

            {/* Field: Receiver's Legal Name on the Bank */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>Receiver's Legal Name on the Bank</span>
                <span className="text-[10px] text-zinc-400 font-normal">Matches Bank ID</span>
              </label>
              <input
                type="text"
                required
                value={accountHolderName}
                onChange={(e) => setAccountHolderName(e.target.value)}
                placeholder="e.g. Acme Tech Private Limited or Rahul Sharma"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Field: Bank Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>Bank Name</span>
                <span className="text-[10px] text-zinc-400 font-normal">e.g. HDFC, ICICI, SBI</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="popular-banks-list"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank, ICICI Bank, State Bank of India"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
                />
                <Building2 className="w-4 h-4 text-zinc-400 absolute right-3 top-3 pointer-events-none" />
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

            {/* Field: Bank Account Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>Bank Account Number</span>
                <span className="text-[10px] text-zinc-400 font-normal">NEFT / RTGS / IMPS</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\s+/g, ''))}
                  placeholder="e.g. 50100412345678"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
                />
                <CreditCard className="w-4 h-4 text-zinc-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Field: IFSC Code */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                <span>IFSC Code</span>
                <span className="text-[10px] text-zinc-400 font-normal">11-Character Code</span>
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
          </div>
        )}
      </form>
    </PlatformDrawer>
  );
}

export default BankDetailsDrawer;
