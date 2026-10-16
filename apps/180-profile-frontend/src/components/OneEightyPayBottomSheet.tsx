'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import CheckoutClient from '@/app/checkout/[sessionId]/CheckoutClient';

export interface OneEightyPayBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newBalance?: number) => void;
  currentBalance?: number;
  initialAmount?: number;
  sessionId?: string;
  user?: any;
}

export function OneEightyPayBottomSheet({
  isOpen,
  onClose,
  onSuccess,
  initialAmount = 1000,
  sessionId: customSessionId,
  user,
}: OneEightyPayBottomSheetProps) {
  const [sessionId] = useState<string>(() => {
    if (customSessionId) return customSessionId;
    const uid = user?.id || (typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('user') || '{}')?.id || 'usr') : 'usr');
    return `sess_topup_${uid}_${Date.now()}`;
  });

  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when drawer is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Listen for wallet top-up and payment success events
  useEffect(() => {
    if (!isOpen) return;

    const handleWalletUpdated = (e: any) => {
      const bal = e.detail?.balance;
      if (typeof bal === 'number') {
        onSuccess?.(bal);
      }
    };

    const handleMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data) return;
      if (
        data.type === '180_PAYMENT_SUCCESS' ||
        data.type === '180_PAY_SUCCESS'
      ) {
        if (typeof data.creditedUserBalance === 'number') {
          onSuccess?.(data.creditedUserBalance);
        } else if (typeof data.newBalance === 'number') {
          onSuccess?.(data.newBalance);
        }
      } else if (data.type === '180_PAYMENT_CLOSE' || data.type === '180_PAY_CLOSE') {
        onClose();
      }
    };

    window.addEventListener('180_wallet_updated', handleWalletUpdated);
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('180_wallet_updated', handleWalletUpdated);
      window.removeEventListener('message', handleMessage);
    };
  }, [isOpen, onSuccess, onClose]);

  // Touch and drag-down gesture to dismiss on mobile
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - dragStartY.current;
      setDragY(delta < 0 ? delta * 0.2 : delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragY((prev) => {
        if (prev > 80) {
          onClose();
          return prev;
        }
        return 0;
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        const delta = e.touches[0].clientY - dragStartY.current;
        setDragY(delta < 0 ? delta * 0.2 : delta);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      setDragY((prev) => {
        if (prev > 80) {
          onClose();
          return prev;
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

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
      />

      {/* Drawer / Modal Container */}
      <div
        style={{
          transform: isDragging ? `translateY(${Math.max(0, dragY)}px)` : 'translateY(0)',
          transition: isDragging ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="relative z-10 w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-[28px] sm:rounded-3xl border-t sm:border border-slate-200/90 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tactile Drag Handle Bar (Mobile) */}
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
          className="flex sm:hidden justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing touch-none select-none"
          title="Drag down to close"
        >
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-700" />
        </div>

        {/* Header with Close Button */}
        <div className="flex items-center justify-end px-4 pt-2.5 sm:pt-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body: Standard 180 Pay Checkout Component */}
        <div className="px-5 sm:px-6 pb-6 overflow-y-auto overscroll-contain flex-1">
          <CheckoutClient
            initialSessionId={sessionId}
            initialAmount={initialAmount}
            onSuccess={(newBal) => {
              onSuccess?.(newBal);
            }}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}

export default OneEightyPayBottomSheet;
