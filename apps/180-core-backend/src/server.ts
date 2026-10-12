'use strict';

import path from 'path';
import dotenv from 'dotenv';
// Reloaded: Sovereign token issuance (decoupled companyId) & R2 Media Pipeline
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';

import authRoutes from './routes/auth.routes';
import walletRoutes from './routes/wallet.routes';
import checkoutRoutes from './routes/checkout.routes';
import subscriptionRoutes from './routes/subscription.routes';
import developerRoutes from './routes/developer.routes';
import couponRoutes from './routes/coupon.routes';
import paymentLinkRoutes from './routes/payment-link.routes';
import geoPricingRoutes from './routes/geo-pricing.routes';
import customerPortalRoutes from './routes/customer-portal.routes';
import agentCheckoutRoutes from './routes/agent-checkout.routes';
import pricingTableRoutes from './routes/pricing-table.routes';
import adminRoutes from './routes/admin.routes';
import supportRoutes from './routes/support.routes';
import { generalApiLimiter } from './middleware/rate-limiter.middleware';
import { RsaKeysService, seedFirstPartyOAuthApps, DeveloperBillingService } from '@workspace/identity-provider';
import { RecurringBillingEngine } from '@workspace/payment-provider';

const app = express();
const server = http.createServer(app);

// Security & Performance Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
  })
);
app.use(compression() as any);
app.use(morgan('dev') as any);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(generalApiLimiter);

// CORS configuration supporting 180 Profile, Developers, Admin, and external origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3008',
  'http://localhost:3009',
  'http://localhost:3010',
  'https://180workspace.com',
  'https://profile.180workspace.com',
  'https://developers.180workspace.com',
  'https://auth.180workspace.com',
  'https://180core.cloud',
  'https://profile.180core.cloud',
  'https://developer.180core.cloud',
  'https://admin.180core.cloud',
  'https://api.180core.cloud',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server) or matching allowed
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('180workspace.com') || origin.endsWith('180core.cloud')) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all for 3rd-party checkout and OAuth integrations
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-180-Signature',
      'X-180-Timestamp',
      'X-180-Event',
      'x-device-token',
      'x-desktop-device-token',
      'x-company-id',
      'x-workspace-id',
      'idempotency-key',
      'Idempotency-Key',
      'x-client-platform',
      'x-app-version',
    ],
  })
);

// Root & Healthcheck
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>180 Core Backend API</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
          .card { background: #18181b; border: 1px solid #27272a; border-radius: 14px; padding: 32px; max-width: 520px; width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
          .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; }
          .dot { width: 6px; height: 6px; background: #10b981; border-radius: 50%; }
          h1 { margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #fafafa; }
          p { margin: 0 0 20px; color: #a1a1aa; font-size: 14px; line-height: 1.6; }
          .links { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; }
          .btn { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: #27272a; color: #fafafa; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 500; transition: all 0.2s; border: 1px solid #3f3f46; }
          .btn:hover { background: #3f3f46; border-color: #52525b; transform: translateY(-1px); }
          .btn span.sub { color: #a1a1aa; font-size: 12px; font-mono: monospace; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge"><span class="dot"></span> Online &bull; Port 4003</div>
          <h1>180 Core Backend API</h1>
          <p>This port hosts the <strong>180 Core REST &amp; OIDC API</strong>. If you are looking for the web applications, launch them using the links below:</p>
          <div class="links">
            <a class="btn" href="http://localhost:3008" target="_blank">
              <span><strong>180 Developer Portal</strong></span>
              <span class="sub">localhost:3008 &rarr;</span>
            </a>
            <a class="btn" href="http://localhost:3009" target="_blank">
              <span><strong>180 Profile / SSO Portal</strong></span>
              <span class="sub">localhost:3009 &rarr;</span>
            </a>
            <a class="btn" href="/health">
              <span>Healthcheck Status</span>
              <span class="sub">/health &rarr;</span>
            </a>
          </div>
        </div>
      </body>
      </html>
    `);
  } else {
    res.json({
      service: '180-core-backend',
      status: 'ok',
      version: '1.0.0',
      description: '180 Sovereign Core Platform API',
      frontends: {
        developers: 'http://localhost:3008',
        profile: 'http://localhost:3009',
      },
      health: '/health',
    });
  }
});

// Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: '180-core-backend',
    timestamp: new Date().toISOString(),
    domains: ['identity', 'wallet', 'checkout', 'developer', 'payout'],
  });
});

// ─── Domain Routes Registration ──────────────────────────────────────────────
app.use('/oauth', authRoutes);
app.use('/api/oauth', authRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/identity/oauth', authRoutes);
app.use('/api/v1/identity', authRoutes);

app.use('/api/v1/wallet', walletRoutes);
app.use('/api/oauth/wallet', walletRoutes);

app.use('/api/v1/checkout', checkoutRoutes);
app.use('/api/oauth/checkout', checkoutRoutes);
app.use('/api/v1/payment/checkout', checkoutRoutes);

app.use('/api/v1/subscriptions', subscriptionRoutes);
app.use('/api/oauth/subscriptions', subscriptionRoutes);
app.use('/api/v1/payment/subscriptions', subscriptionRoutes);

app.use('/api/v1/developer', developerRoutes);
app.use('/api/oauth/developer', developerRoutes);
app.use('/api/v1/identity/developer', developerRoutes);

app.use('/api/v1/coupons', couponRoutes);
app.use('/api/v1/payment/coupons', couponRoutes);
app.use('/api/oauth/coupons', couponRoutes);

app.use('/api/v1/payment-links', paymentLinkRoutes);
app.use('/api/v1/payment/links', paymentLinkRoutes);
app.use('/api/oauth/payment-links', paymentLinkRoutes);

app.use('/api/v1/geo-pricing', geoPricingRoutes);
app.use('/api/v1/payment/geo-pricing', geoPricingRoutes);
app.use('/api/oauth/geo-pricing', geoPricingRoutes);

app.use('/api/v1/portal', customerPortalRoutes);
app.use('/api/v1/customer-portal', customerPortalRoutes);
app.use('/api/v1/billing/portal', customerPortalRoutes);

app.use('/api/v1/agent-checkouts', agentCheckoutRoutes);
app.use('/api/v1/checkout', agentCheckoutRoutes); // Also supports /api/v1/checkout/agent-purchase
app.use('/api/v1/developer', agentCheckoutRoutes);
app.use('/api/oauth/developer', agentCheckoutRoutes);

app.use('/api/v1/pricing-tables', pricingTableRoutes);
app.use('/api/v1/payment/pricing-tables', pricingTableRoutes);
app.use('/api/oauth/pricing-tables', pricingTableRoutes);

// Admin & Platform Governance Routes
app.use('/api/v1/admin', adminRoutes);

// Universal Support & Bug Reporting Ingestion Routes
app.use('/api/v1/support', supportRoutes);
// Error Handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[180-core-backend] Unhandled Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

const PORT = Number(process.env.PORT || process.env.CORE_BACKEND_PORT || 4003);

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 180 Core Dedicated Backend running on http://localhost:${PORT}`);
  console.log(`💳 Domains active: Identity / OAuth2, Prepaid Wallet (Razorpay), 1-Click Checkout, Developer Payouts`);
  try {
    await RsaKeysService.ensureKeys();
    await seedFirstPartyOAuthApps();
    console.log('[180-core-backend] 180 Identity RSA keys and first-party apps verified.');

    // Autonomous recurring subscription auto-billing worker (runs hourly)
    const BILLING_CYCLE_INTERVAL = 60 * 60 * 1000;
    setInterval(async () => {
      try {
        await RecurringBillingEngine.runRecurringBillingCycle();
        await DeveloperBillingService.executeDunningCycle();
      } catch (e: any) {
        console.error('[180-core-backend] Error during recurring billing cycle:', e.message);
      }
    }, BILLING_CYCLE_INTERVAL);
  } catch (err: any) {
    console.warn('[180-core-backend] Bootstrapping note:', err.message);
  }
});

// Graceful Shutdown on zero-downtime deploy
const gracefulShutdown = (signal: string) => {
  console.log(`[180-core-backend] Received ${signal}. Draining connections and shutting down cleanly...`);
  server.close(() => {
    console.log('[180-core-backend] HTTP server closed cleanly.');
    process.exit(0);
  });
  // Force exit after 10s if hanging
  setTimeout(() => {
    console.error('[180-core-backend] Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;

