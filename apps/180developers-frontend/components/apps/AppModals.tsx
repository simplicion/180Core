'use client';

import React from 'react';
import {
  RotateCw,
  Copy,
  Check,
  AlertCircle,
  CreditCard,
  Landmark,
  Receipt,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Globe,
  MapPin,
  Languages,
  Laptop,
  User,
} from 'lucide-react';
import { Button, PlatformModal, LogoLoader } from '@workspace/ui';
import { DeveloperAppDetail } from './types';

export interface AppModalsProps {
  app: DeveloperAppDetail;
  // Rotate modal
  showRotateModal: boolean;
  setShowRotateModal: (val: boolean) => void;
  isRotating: boolean;
  handleRotateSecret: () => void;
  newSecretRevealed: string | null;
  setNewSecretRevealed: (val: string | null) => void;
  secretCopied: boolean;
  setSecretCopied: (val: boolean) => void;
  hasAcknowledgedSecret: boolean;
  setHasAcknowledgedSecret: (val: boolean) => void;
  copyToClipboard: (text: string, key: string) => void;

  // Delete modal
  showDeleteModal: boolean;
  setShowDeleteModal: (val: boolean) => void;
  deleteConfirmText: string;
  setDeleteConfirmText: (val: string) => void;
  handleDeleteApp: () => void;
  isDeleting: boolean;

  // Payout request modal
  showPayoutModal: boolean;
  setShowPayoutModal: (val: boolean) => void;
  payoutBalance: number;
  payoutAmount: string;
  setPayoutAmount: (val: string) => void;
  payoutMethod: 'UPI' | 'BANK_TRANSFER';
  setPayoutMethod: (val: 'UPI' | 'BANK_TRANSFER') => void;
  upiId: string;
  setUpiId: (val: string) => void;
  bankAccNumber: string;
  setBankAccNumber: (val: string) => void;
  bankIfsc: string;
  setBankIfsc: (val: string) => void;
  bankHolder: string;
  setBankHolder: (val: string) => void;
  handleRequestPayout: (e: React.FormEvent) => void;
  isRequestingPayout: boolean;

  // Bank setup modal
  showBankModal: boolean;
  setShowBankModal: (val: boolean) => void;
  handleSaveBankDetails: (e: React.FormEvent) => void;
  savingBank: boolean;

  // Transaction receipt modal
  selectedTx: any;
  setSelectedTx: (tx: any) => void;
  copiedKey: string | null;

  // Admin payout review modal
  showAdminPayoutModal: boolean;
  setShowAdminPayoutModal: (val: boolean) => void;
  adminPayouts: any[];
  loadingAdminPayouts: boolean;
  updatingPayoutId: string | null;
  payoutTxRef: string;
  setPayoutTxRef: (val: string) => void;
  payoutAdminNote: string;
  setPayoutAdminNote: (val: string) => void;
  handleUpdateAdminPayoutStatus: (id: string, status: 'PAID' | 'REJECTED') => void;
}

export function AppModals({
  app,
  showRotateModal,
  setShowRotateModal,
  isRotating,
  handleRotateSecret,
  newSecretRevealed,
  setNewSecretRevealed,
  secretCopied,
  setSecretCopied,
  hasAcknowledgedSecret,
  setHasAcknowledgedSecret,
  copyToClipboard,

  showDeleteModal,
  setShowDeleteModal,
  deleteConfirmText,
  setDeleteConfirmText,
  handleDeleteApp,
  isDeleting,

  showPayoutModal,
  setShowPayoutModal,
  payoutBalance,
  payoutAmount,
  setPayoutAmount,
  payoutMethod,
  setPayoutMethod,
  upiId,
  setUpiId,
  bankAccNumber,
  setBankAccNumber,
  bankIfsc,
  setBankIfsc,
  bankHolder,
  setBankHolder,
  handleRequestPayout,
  isRequestingPayout,

  showBankModal,
  setShowBankModal,
  handleSaveBankDetails,
  savingBank,

  selectedTx,
  setSelectedTx,
  copiedKey,

  showAdminPayoutModal,
  setShowAdminPayoutModal,
  adminPayouts,
  loadingAdminPayouts,
  updatingPayoutId,
  payoutTxRef,
  setPayoutTxRef,
  payoutAdminNote,
  setPayoutAdminNote,
  handleUpdateAdminPayoutStatus,
}: AppModalsProps) {
  return (
    <>
      {/* ─────────────────────────────────────────────────────────────────────────────
          CENTRALIZED MODAL: SECRET ROTATION
          ───────────────────────────────────────────────────────────────────────────── */}
      <PlatformModal
        isOpen={showRotateModal}
        onClose={() => setShowRotateModal(false)}
        title="Rotate Client Secret"
        icon={RotateCw}
        iconBgClass="bg-amber-500/10"
        iconColorClass="text-amber-600 dark:text-amber-400"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4 text-zinc-900 dark:text-white">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Rotating your Client Secret will immediately issue a new secret. To prevent downtime, previous secrets have a 24-hour grace window.
          </p>

          {newSecretRevealed ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-mono text-emerald-600 dark:text-emerald-400 break-all select-all">
                {newSecretRevealed}
              </div>
              <Button
                onClick={() => {
                  copyToClipboard(newSecretRevealed, 'newSecret');
                  setSecretCopied(true);
                }}
                className="w-full py-2.5 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer flex items-center justify-center gap-2"
              >
                {secretCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{secretCopied ? 'Copied to Clipboard!' : 'Copy New Secret'}</span>
              </Button>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ack-rot"
                  checked={hasAcknowledgedSecret}
                  onChange={(e) => setHasAcknowledgedSecret(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                />
                <label htmlFor="ack-rot" className="text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer">
                  I have copied and safely stored this new secret.
                </label>
              </div>
              <Button
                disabled={!hasAcknowledgedSecret}
                onClick={() => {
                  setShowRotateModal(false);
                  setNewSecretRevealed(null);
                }}
                className="w-full py-2.5 min-h-[44px] rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-xs cursor-pointer"
              >
                Close
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowRotateModal(false)}
                className="px-4 py-2 min-h-[44px] text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRotateSecret}
                disabled={isRotating}
                className="px-4 py-2 min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-lg cursor-pointer flex items-center gap-2"
              >
                {isRotating ? <LogoLoader className="w-4 h-4 animate-spin text-white" /> : <RotateCw className="w-4 h-4" />}
                <span>Confirm Rotation</span>
              </Button>
            </div>
          )}
        </div>
      </PlatformModal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          CENTRALIZED MODAL: DELETE APPLICATION
          ───────────────────────────────────────────────────────────────────────────── */}
      <PlatformModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Deletion"
        icon={AlertCircle}
        iconBgClass="bg-red-500/10"
        iconColorClass="text-red-600 dark:text-red-400"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4 text-zinc-900 dark:text-white">
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            To delete this application permanently, type its exact name <strong className="text-zinc-950 dark:text-white">{app.name}</strong> below:
          </p>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-red-500 transition-colors"
            placeholder="Type app name to confirm"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 min-h-[44px] text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white"
            >
              Cancel
            </Button>
            <button
              onClick={handleDeleteApp}
              disabled={deleteConfirmText !== app.name || isDeleting}
              className="px-4 py-2 min-h-[44px] rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-xs cursor-pointer transition-colors flex items-center gap-2"
            >
              {isDeleting ? <LogoLoader className="w-4 h-4 animate-spin text-white" /> : null}
              <span>Delete Forever</span>
            </button>
          </div>
        </div>
      </PlatformModal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          CENTRALIZED MODAL: PAYOUT REQUEST
          ───────────────────────────────────────────────────────────────────────────── */}
      <PlatformModal
        isOpen={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
        title="Request Revenue Payout"
        icon={CreditCard}
        iconBgClass="bg-purple-500/10"
        iconColorClass="text-purple-600 dark:text-purple-400"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleRequestPayout} className="space-y-4 text-zinc-900 dark:text-white">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Available to withdraw: <strong className="text-emerald-500">₹{payoutBalance.toFixed(2)}</strong>
          </p>

          <div>
            <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
              Withdrawal Amount (INR)
            </label>
            <input
              type="number"
              min="100"
              max={payoutBalance}
              placeholder="Enter amount (min ₹100)"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
              Payout Method
            </label>
            <select
              value={payoutMethod}
              onChange={(e) => setPayoutMethod(e.target.value as any)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
            >
              <option value="UPI">UPI ID (Instant Transfer)</option>
              <option value="BANK_TRANSFER">Bank Account (NEFT/IMPS)</option>
            </select>
          </div>

          {payoutMethod === 'UPI' ? (
            <div>
              <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                UPI ID
              </label>
              <input
                type="text"
                placeholder="username@okhdfcbank"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
                required
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                  Account Holder Name
                </label>
                <input
                  type="text"
                  placeholder="Full Name as per Bank"
                  value={bankHolder}
                  onChange={(e) => setBankHolder(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                  Account Number
                </label>
                <input
                  type="text"
                  placeholder="Bank Account Number"
                  value={bankAccNumber}
                  onChange={(e) => setBankAccNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                  IFSC Code
                </label>
                <input
                  type="text"
                  placeholder="HDFC0001234"
                  value={bankIfsc}
                  onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white"
                  required
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setShowPayoutModal(false)}
              className="px-4 py-2 min-h-[44px] text-xs text-zinc-600 dark:text-zinc-300"
            >
              Cancel
            </Button>
            <button
              type="submit"
              disabled={isRequestingPayout}
              className="px-5 py-2 min-h-[44px] rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs cursor-pointer transition-colors shadow-md flex items-center gap-2"
            >
              {isRequestingPayout ? <LogoLoader className="w-4 h-4 animate-spin text-white" /> : null}
              <span>Submit Request</span>
            </button>
          </div>
        </form>
      </PlatformModal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          CENTRALIZED MODAL: BANK SETTLEMENT SETUP
          ───────────────────────────────────────────────────────────────────────────── */}
      <PlatformModal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        title="Settlement Bank Information"
        icon={Landmark}
        iconBgClass="bg-purple-500/10"
        iconColorClass="text-purple-600 dark:text-purple-400"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSaveBankDetails} className="space-y-4 text-zinc-900 dark:text-white">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Configure your registered bank account or UPI ID to receive automatic & manual revenue withdrawals.
          </p>

          <div>
            <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
              Account Holder Full Name *
            </label>
            <input
              type="text"
              placeholder="Full Name as per Bank"
              value={bankHolder}
              onChange={(e) => setBankHolder(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                Bank Account Number
              </label>
              <input
                type="text"
                placeholder="000123456789"
                value={bankAccNumber}
                onChange={(e) => setBankAccNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
                IFSC Code
              </label>
              <input
                type="text"
                placeholder="HDFC0001234"
                value={bankIfsc}
                onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white uppercase focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 text-zinc-700 dark:text-zinc-300">
              UPI ID (Optional for Instant Payouts)
            </label>
            <input
              type="text"
              placeholder="developer@okhdfcbank"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setShowBankModal(false)}
              className="px-4 py-2 min-h-[44px] text-xs text-zinc-600 dark:text-zinc-300"
            >
              Cancel
            </Button>
            <button
              type="submit"
              disabled={savingBank}
              className="px-5 py-2 min-h-[44px] rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs cursor-pointer transition-colors shadow-md flex items-center gap-2"
            >
              {savingBank ? <LogoLoader className="w-4 h-4 animate-spin text-white" /> : null}
              <span>Save Settlement Account</span>
            </button>
          </div>
        </form>
      </PlatformModal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          CENTRALIZED MODAL: TRANSACTION RECEIPT & AUDIT
          ───────────────────────────────────────────────────────────────────────────── */}
      <PlatformModal
        isOpen={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
        title="Transaction Receipt & Customer Journey"
        icon={Receipt}
        iconBgClass="bg-purple-500/10"
        iconColorClass="text-purple-600 dark:text-purple-400"
        maxWidthClass="max-w-2xl"
      >
        {selectedTx && (
          <div className="space-y-4 text-zinc-900 dark:text-white text-xs max-h-[80vh] overflow-y-auto pr-1">
            {/* Session ID Header */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
              <span className="truncate flex-1">Tx: {selectedTx.id}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(selectedTx.id, 'receipt_id')}
                className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer ml-2 flex items-center gap-1 text-[10px]"
              >
                {copiedKey === 'receipt_id' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'receipt_id' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Financial Status Banner */}
            {(() => {
              const isCaptured = selectedTx.status === 'CAPTURED' || selectedTx.status === 'SUCCESS';
              const isGatewayDropped = selectedTx.status === 'GATEWAY_DROPPED';
              const isIntentOnly = selectedTx.status === 'INTENT_ONLY';

              if (isCaptured) {
                return (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Payment Captured &amp; Verified</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                        SETTLED TO CLEARING
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 leading-relaxed">
                      Payment was authorized and captured. Funds are credited to your 180 Pay clearing pool for standard T+1 bank withdrawal.
                    </p>
                  </div>
                );
              }

              if (isGatewayDropped) {
                return (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Payment Gateway Opened • Dropped Before Capture</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300">
                        UNCAPTURED
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                      Customer launched the 180 Pay sheet and clicked <strong>&quot;Pay&quot;</strong>, opening the UPI/Card payment gateway. The customer closed the gateway popup without paying.
                    </p>
                  </div>
                );
              }

              if (isIntentOnly) {
                return (
                  <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs">
                        <Compass className="w-4 h-4 shrink-0" />
                        <span>Intent to Pay • 180 Pay Drawer Launched</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-800 dark:text-blue-300">
                        ZERO LIABILITY
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                      Customer loaded the 180 Pay bottom sheet showing purchase intent, but closed the drawer before opening the payment gateway.
                    </p>
                  </div>
                );
              }

              return (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Payment Authorization Declined</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-800 dark:text-rose-300">
                      FAILED
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80 leading-relaxed">
                    Customer attempted to pay, but the issuing bank or payment gateway declined authorization. No funds were debited.
                  </p>
                </div>
              );
            })()}

            {/* Financial Ledger Section */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-white/5">
                <div>
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">Session Title</span>
                  <div className="font-bold text-sm text-zinc-950 dark:text-white">{selectedTx.title || '180 Pay Checkout'}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider block font-medium">Total Amount</span>
                  <div className="text-lg font-black text-zinc-950 dark:text-white font-mono">
                    {selectedTx.currency || 'INR'} {(selectedTx.amount || 0).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-white/5">
                  <span className="text-[10px] text-zinc-400 block">Original Price</span>
                  <span className="font-bold text-zinc-900 dark:text-white font-mono">
                    ₹{(selectedTx.originalAmount || selectedTx.amount || 0).toLocaleString()}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-white/5">
                  <span className="text-[10px] text-zinc-400 block">Discount Applied</span>
                  <span className="font-bold text-zinc-900 dark:text-white font-mono">
                    {selectedTx.discountAmount ? `-₹${selectedTx.discountAmount}` : '₹0.00'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-white/5">
                  <span className="text-[10px] text-zinc-400 block">Payment Method</span>
                  <span className="font-bold text-zinc-900 dark:text-white truncate block">
                    {selectedTx.method || selectedTx.paymentMethod || '180 Wallet'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-white/5">
                  <span className="text-[10px] text-zinc-400 block">Settlement Cycle</span>
                  <span className="font-bold text-zinc-900 dark:text-white truncate block">
                    {selectedTx.status === 'CAPTURED' ? 'T+1 Clearing' : 'Zero Required'}
                  </span>
                </div>
              </div>
            </div>

            {/* Behavioral Checkout Journey Stepper */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-3">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-purple-500" />
                <span>Customer Checkout Journey &amp; Audit Trail</span>
              </h4>

              <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
                {/* Step 1: 180 Pay Drawer Opened */}
                <div className="relative text-xs">
                  <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                    ✓
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-900 dark:text-white">180 Pay Drawer Launched</span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {new Date(selectedTx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Encrypted checkout sheet initiated on client device. Session registered in developer ledger.
                    </p>
                  </div>
                </div>

                {/* Step 2: Gateway Invoked */}
                {(() => {
                  const hasGateway =
                    selectedTx.status === 'GATEWAY_DROPPED' ||
                    selectedTx.status === 'CAPTURED' ||
                    Boolean(selectedTx.gatewayOrderId);

                  return (
                    <div className="relative text-xs">
                      <div
                        className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          hasGateway
                            ? 'bg-purple-600 text-white'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {hasGateway ? '2' : '—'}
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className={`font-bold ${hasGateway ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>
                            {hasGateway ? 'Payment Gateway Launched' : 'Payment Gateway (Not Invoked)'}
                          </span>
                          {selectedTx.gatewayInvokedAt && (
                            <span className="text-[10px] font-mono text-zinc-500">
                              {new Date(selectedTx.gatewayInvokedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {hasGateway
                            ? `User tapped Pay by UPI / Card. Gateway window opened${
                                selectedTx.gatewayOrderId ? ` (Order: ${selectedTx.gatewayOrderId})` : ''
                              }.`
                            : 'Customer closed the 180 bottom sheet before tapping the Pay button.'}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Step 3: Final Resolution */}
                <div className="relative text-xs">
                  {(() => {
                    const isCaptured = selectedTx.status === 'CAPTURED' || selectedTx.status === 'SUCCESS';
                    const isGatewayDropped = selectedTx.status === 'GATEWAY_DROPPED';
                    const isIntentOnly = selectedTx.status === 'INTENT_ONLY';

                    return (
                      <>
                        <div
                          className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isCaptured
                              ? 'bg-emerald-500 text-white'
                              : isGatewayDropped
                              ? 'bg-amber-500 text-white'
                              : isIntentOnly
                              ? 'bg-blue-500 text-white'
                              : 'bg-rose-500 text-white'
                          }`}
                        >
                          {isCaptured ? '✓' : '!'}
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-zinc-900 dark:text-white">
                              {isCaptured
                                ? 'Payment Captured & Verified'
                                : isGatewayDropped
                                ? 'Gateway Dismissed by Customer'
                                : isIntentOnly
                                ? 'Drawer Dismissed Prior to Gateway'
                                : 'Authorization Declined'}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500">
                              {new Date(selectedTx.completedAt || selectedTx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {isCaptured
                              ? `Confirmed with Payment ID: ${selectedTx.gatewayPaymentId || 'Verified'}.`
                              : isGatewayDropped
                              ? 'Gateway modal closed without authorization. Logged as gateway drop-off.'
                              : isIntentOnly
                              ? 'Customer browsed checkout sheet and exited. Logged as initial intent.'
                              : 'Payment authorization rejected by card issuer or UPI bank network.'}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Client Context, Telemetry & User Details */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 space-y-3">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-purple-500" />
                <span>Client Telemetry &amp; Device Context</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold">
                    <MapPin className="w-3 h-3 text-purple-500" />
                    <span>Customer Location</span>
                  </div>
                  <div className="font-bold text-zinc-900 dark:text-white">
                    {selectedTx.location || 'India (IN)'}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold">
                      <Globe className="w-3 h-3 text-purple-500" />
                      <span>Client IP Address</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedTx.ip || '127.0.0.1', 'receipt_ip')}
                      className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-[10px] flex items-center gap-1"
                    >
                      {copiedKey === 'receipt_ip' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="font-mono text-zinc-900 dark:text-white font-semibold text-[11px]">
                    {selectedTx.ip || '2400:1a00:2b41:892'}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold">
                    <Languages className="w-3 h-3 text-purple-500" />
                    <span>Language &amp; Dialog Locale</span>
                  </div>
                  <div className="font-semibold text-zinc-900 dark:text-white">
                    {selectedTx.language || 'en-US (English - United States)'}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold">
                    <Laptop className="w-3 h-3 text-purple-500" />
                    <span>Platform &amp; Browser</span>
                  </div>
                  <div className="font-semibold text-zinc-900 dark:text-white truncate">
                    {selectedTx.userAgent || 'Chrome 128 • Windows 11'}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-white/5 space-y-1 sm:col-span-2">
                  <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase font-semibold">
                    <User className="w-3 h-3 text-purple-500" />
                    <span>Customer Profile &amp; Contact</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="font-bold text-zinc-900 dark:text-white">
                      {selectedTx.customerName || selectedTx.customer?.name || '180 User'}
                    </span>
                    <span className="font-mono text-zinc-500 text-[11px]">
                      {selectedTx.customerEmail || selectedTx.customerPhone || selectedTx.customer?.email || 'Direct App Checkout'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-white/10">
              <Button
                variant="ghost"
                onClick={() => setSelectedTx(null)}
                className="px-5 py-2 min-h-[40px] text-xs text-zinc-600 dark:text-zinc-300 font-semibold"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </PlatformModal>

      {/* ─────────────────────────────────────────────────────────────────────────────
          CENTRALIZED MODAL: ADMIN SETTLEMENT REVIEW CONSOLE
          ───────────────────────────────────────────────────────────────────────────── */}
      <PlatformModal
        isOpen={showAdminPayoutModal}
        onClose={() => setShowAdminPayoutModal(false)}
        title="Admin Settlement & Payout Management"
        icon={Shield}
        iconBgClass="bg-purple-500/10"
        iconColorClass="text-purple-600 dark:text-purple-400"
        maxWidthClass="max-w-2xl"
      >
        <div className="space-y-4 text-zinc-900 dark:text-white">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Review incoming developer payout requests, verify bank/UPI details, and update settlement status.
          </p>

          {/* Admin Note & Tx Ref Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                Settlement Reference / UTR
              </label>
              <input
                type="text"
                placeholder="e.g. UTR1234567890"
                value={payoutTxRef}
                onChange={(e) => setPayoutTxRef(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                Admin Audit Note
              </label>
              <input
                type="text"
                placeholder="Optional audit notes"
                value={payoutAdminNote}
                onChange={(e) => setPayoutAdminNote(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {loadingAdminPayouts ? (
            <div className="py-8 text-center text-xs text-zinc-400">Loading settlement requests...</div>
          ) : adminPayouts.length > 0 ? (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs text-zinc-600 dark:text-zinc-300">
                <thead className="border-b border-zinc-200 dark:border-white/10 text-zinc-400 text-[11px] uppercase sticky top-0 bg-white dark:bg-zinc-950">
                  <tr>
                    <th className="pb-2">Developer / App</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Method</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                  {adminPayouts.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5">
                        <div className="font-semibold text-zinc-950 dark:text-white">{p.app?.name || 'App'}</div>
                        <div className="text-[10px] text-zinc-400">{p.developer?.email || 'Developer'}</div>
                      </td>
                      <td className="py-2.5 font-bold font-mono text-zinc-950 dark:text-white">
                        ₹{p.amount.toFixed(2)}
                      </td>
                      <td className="py-2.5 font-mono text-[11px]">
                        {p.payoutMethod === 'UPI' ? `UPI: ${p.upiId}` : `A/C: ${p.bankAccNumber}`}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.status === 'PAID'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : p.status === 'REJECTED'
                              ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-right space-x-1">
                        {p.status === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              disabled={updatingPayoutId === p.id}
                              onClick={() => handleUpdateAdminPayoutStatus(p.id, 'PAID')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={updatingPayoutId === p.id}
                              onClick={() => handleUpdateAdminPayoutStatus(p.id, 'REJECTED')}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-zinc-400 italic py-4 text-center">No pending settlement requests found.</p>
          )}

          <div className="flex justify-end pt-2">
            <Button
              variant="ghost"
              onClick={() => setShowAdminPayoutModal(false)}
              className="px-4 py-2 min-h-[44px] text-xs text-zinc-600 dark:text-zinc-300"
            >
              Close
            </Button>
          </div>
        </div>
      </PlatformModal>
    </>
  );
}

export default AppModals;
