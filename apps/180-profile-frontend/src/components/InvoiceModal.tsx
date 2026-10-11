'use client';

import React from 'react';
import { PlatformModal, Button } from '@workspace/ui';
import { Download, Printer, ShieldCheck, CheckCircle2, Building, Receipt } from 'lucide-react';
import { LedgerEntry } from '../types';

interface InvoiceModalProps {
  transaction: LedgerEntry | null;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
}

export function InvoiceModal({
  transaction,
  onClose,
  userName = 'Verified User',
  userEmail = '',
  userPhone = '',
}: InvoiceModalProps) {
  if (!transaction) return null;

  const totalAmount = Math.abs(transaction.amount);
  const isCredit = transaction.amount > 0;
  const subtotal = Number((totalAmount / 1.18).toFixed(2));
  const gstAmount = Number((totalAmount - subtotal).toFixed(2));
  const invoiceId = `INV-180-${transaction.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <PlatformModal
      isOpen={Boolean(transaction)}
      onClose={onClose}
      title="Tax Invoice & Digital Receipt"
      maxWidthClass="max-w-xl"
    >
      <div className="space-y-6 text-slate-800 text-xs pt-1 font-sans">
        {/* Invoice Header Badge */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 tracking-tight">{invoiceId}</div>
              <div className="text-[11px] text-slate-500 font-mono">
                Issued: {new Date(transaction.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Paid / Settled
          </span>
        </div>

        {/* Billed From & Billed To Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Billed By</span>
            <div className="font-bold text-slate-900 text-xs">180 Workspace Platform Inc.</div>
            <div className="text-[11px] text-slate-500 leading-relaxed">
              Universal Protocol<br />
              GSTIN: 27AAACW1800P1Z8<br />
              support@180workspace.com
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Billed To (Universal ID)</span>
            <div className="font-bold text-slate-900 text-xs">{userName}</div>
            <div className="text-[11px] text-slate-500 leading-relaxed">
              {userEmail}<br />
              {userPhone}<br />
              Place of Supply: Maharashtra (27)
            </div>
          </div>
        </div>

        {/* Itemized Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] uppercase font-semibold">
              <tr>
                <th className="py-2.5 px-3.5">Description</th>
                <th className="py-2.5 px-3.5">Category</th>
                <th className="py-2.5 px-3.5 text-right">Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              <tr>
                <td className="py-3 px-3.5 font-medium text-slate-900">
                  {transaction.description || (isCredit ? 'Prepaid Wallet Recharge' : 'Platform API Metering / Voice Service')}
                  {transaction.referenceId && (
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">Ref: {transaction.referenceId}</div>
                  )}
                </td>
                <td className="py-3 px-3.5 text-slate-500 font-mono text-[11px]">{transaction.type}</td>
                <td className="py-3 px-3.5 text-right font-bold text-slate-900">₹{subtotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tax Summary Breakdown */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-600">
            <span>Taxable Amount (Subtotal):</span>
            <span className="font-medium text-slate-900">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Integrated GST (IGST @ 18%):</span>
            <span className="font-medium text-slate-900">₹{gstAmount.toFixed(2)}</span>
          </div>
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm font-extrabold text-slate-900">
            <span>Total Amount Paid:</span>
            <span className="text-base text-blue-700">₹{totalAmount.toFixed(2)} INR</span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Cryptographically Verified on 180 Ledger</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePrint} className="min-h-[38px] text-xs flex items-center gap-1.5 cursor-pointer">
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </Button>
            <Button variant="default" onClick={onClose} className="min-h-[38px] text-xs cursor-pointer bg-blue-600 hover:bg-blue-700 text-white">
              Done
            </Button>
          </div>
        </div>
      </div>
    </PlatformModal>
  );
}
