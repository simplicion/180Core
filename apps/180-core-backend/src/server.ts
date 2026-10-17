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
import { AuthApiController } from './controllers/auth.controller';
import { generalApiLimiter } from './middleware/rate-limiter.middleware';
import { RsaKeysService, seedFirstPartyOAuthApps, DeveloperBillingService } from '@workspace/identity-provider';
import { RecurringBillingEngine } from '@workspace/payment-provider';

const app = express();
const server = http.createServer(app);

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

const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server) or matching allowed
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('180workspace.com') || origin.endsWith('180core.cloud')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for 3rd-party checkout and OAuth integrations
    }
  },
  credentials: true,
  optionsSuccessStatus: 204,
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
});

// Mount CORS before any body parsers or rate-limiters so OPTIONS preflights never fail
app.disable('x-powered-by');
app.use(corsMiddleware);
app.options('*', corsMiddleware as any);

// Security & Performance Middlewares (Hardened for Production)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
  })
);
app.use(compression() as any);
app.use(morgan('dev') as any);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(generalApiLimiter);

// Root & Healthcheck (Production-Grade JSON API Gateway - Zero HTML or internal port leakage)
app.get('/', (req, res) => {
  res.status(200).json({
    name: '180 Core REST & OIDC API Gateway',
    status: 'operational',
    version: 'v1',
    documentation: 'https://developers.180workspace.com',
    endpoints: {
      openid_configuration: '/.well-known/openid-configuration',
      jwks: '/certs/jwks.json',
      token: '/api/oauth/token',
      userinfo: '/api/oauth/userinfo',
      checkout_session: '/api/v1/pay/checkout-session',
      health: '/health',
    },
  });
});

// Healthcheck Status
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'operational',
    timestamp: new Date().toISOString(),
  });
});

// ─── Universal Root-Level OIDC & JWKS Discovery Aliases ─────────────────────
// Enables jose, jwks-rsa, Python PyJWKClient, and standard OIDC discovery across all canonical paths
app.get('/.well-known/openid-configuration', AuthApiController.getOpenIdConfiguration);
app.get('/.well-known/jwks.json', AuthApiController.getJwks);
app.get('/certs/jwks.json', AuthApiController.getJwks);
app.get('/certs', AuthApiController.getJwks);
app.get('/jwks.json', AuthApiController.getJwks);

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
app.use('/api/v1/pay/checkout', checkoutRoutes);
app.use('/api/v1/pay', checkoutRoutes);

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

