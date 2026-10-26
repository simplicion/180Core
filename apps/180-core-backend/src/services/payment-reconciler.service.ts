'use strict';

import { CheckoutService } from '@workspace/payment-provider';

export class PaymentReconcilerService {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning = false;

  /**
   * Starts the background payment reconciliation worker.
   * Runs an immediate scan on boot and recurring sweeps every 60 seconds.
   */
  static start(intervalMs: number = 60 * 1000) {
    if (this.timer) {
      return;
    }

    console.log('[PaymentReconcilerService] Background auto-reconciler service initialized.');

    // Initial pass 5 seconds after startup to heal any in-flight payments
    setTimeout(() => {
      this.sweep().catch((err) =>
        console.warn('[PaymentReconcilerService] Initial sweep error:', err.message)
      );
    }, 5000);

    // Periodic sweep
    this.timer = setInterval(() => {
      this.sweep().catch((err) =>
        console.warn('[PaymentReconcilerService] Periodic sweep error:', err.message)
      );
    }, intervalMs);
  }

  /**
   * Stops the background worker cleanly.
   */
  static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[PaymentReconcilerService] Stopped background reconciler.');
    }
  }

  /**
   * Executes a single reconciliation sweep across recent pending/expired sessions.
   */
  static async sweep(): Promise<{ scanned: number; reconciledCount: number; reconciledIds: string[] }> {
    if (this.isRunning) {
      return { scanned: 0, reconciledCount: 0, reconciledIds: [] };
    }

    this.isRunning = true;
    try {
      const result = await CheckoutService.reconcilePendingSessions(50);
      if (result.reconciledCount > 0) {
        console.log(
          `[PaymentReconcilerService] ✅ Auto-reconciled ${result.reconciledCount} stranded payments:`,
          result.reconciledIds
        );
      }
      return result;
    } catch (err: any) {
      console.warn('[PaymentReconcilerService] Sweep encountered error:', err.message);
      return { scanned: 0, reconciledCount: 0, reconciledIds: [] };
    } finally {
      this.isRunning = false;
    }
  }
}
