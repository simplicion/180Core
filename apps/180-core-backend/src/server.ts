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
  'https://auth.180core.cloud',
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

// ─── OAuth & 180 Pay Parameter Normalization Middleware (snake_case & camelCase interoperability) ────
app.use((req, res, next) => {
  // Query parameter normalization
  if (req.query) {
    // OAuth params
    if (req.query.clientId && !req.query.client_id) req.query.client_id = req.query.clientId;
    if (req.query.client_id && !req.query.clientId) req.query.clientId = req.query.client_id;
    if (req.query.redirectUri && !req.query.redirect_uri) req.query.redirect_uri = req.query.redirectUri;
    if (req.query.redirect_uri && !req.query.redirectUri) req.query.redirectUri = req.query.redirect_uri;
    if (req.query.responseType && !req.query.response_type) req.query.response_type = req.query.responseType;
    if (req.query.response_type && !req.query.responseType) req.query.responseType = req.query.response_type;
    if (req.query.codeChallenge && !req.query.code_challenge) req.query.code_challenge = req.query.codeChallenge;
    if (req.query.code_challenge && !req.query.codeChallenge) req.query.codeChallenge = req.query.code_challenge;
    if (req.query.codeChallengeMethod && !req.query.code_challenge_method) req.query.code_challenge_method = req.query.codeChallengeMethod;
    if (req.query.code_challenge_method && !req.query.codeChallengeMethod) req.query.codeChallengeMethod = req.query.code_challenge_method;
    if (req.query.codeVerifier && !req.query.code_verifier) req.query.code_verifier = req.query.codeVerifier;
    if (req.query.code_verifier && !req.query.codeVerifier) req.query.codeVerifier = req.query.code_verifier;
    if (req.query.grantType && !req.query.grant_type) req.query.grant_type = req.query.grantType;
    if (req.query.grant_type && !req.query.grantType) req.query.grantType = req.query.grant_type;

    // 180 Pay params
    if (req.query.returnUrl && !req.query.return_url) req.query.return_url = req.query.returnUrl;
    if (req.query.return_url && !req.query.returnUrl) req.query.returnUrl = req.query.return_url;
    if (req.query.cancelUrl && !req.query.cancel_url) req.query.cancel_url = req.query.cancelUrl;
    if (req.query.cancel_url && !req.query.cancelUrl) req.query.cancelUrl = req.query.cancel_url;
    if (req.query.orderId && !req.query.order_id) req.query.order_id = req.query.orderId;
    if (req.query.order_id && !req.query.orderId) req.query.orderId = req.query.order_id;
    if (req.query.sessionId && !req.query.session_id) req.query.session_id = req.query.sessionId;
    if (req.query.session_id && !req.query.sessionId) req.query.sessionId = req.query.session_id;
    if (req.query.couponCode && !req.query.coupon_code) req.query.coupon_code = req.query.couponCode;
    if (req.query.coupon_code && !req.query.couponCode) req.query.couponCode = req.query.coupon_code;
    if (req.query.coupon && !req.query.couponCode) req.query.couponCode = req.query.coupon;
    if (req.query.coupon && !req.query.coupon_code) req.query.coupon_code = req.query.coupon;
    if (req.query.appId && !req.query.app_id) req.query.app_id = req.query.appId;
    if (req.query.app_id && !req.query.appId) req.query.appId = req.query.app_id;
  }
  // Body parameter normalization
  if (req.body && typeof req.body === 'object') {
    // OAuth params
    if (req.body.clientId && !req.body.client_id) req.body.client_id = req.body.clientId;
    if (req.body.client_id && !req.body.clientId) req.body.clientId = req.body.client_id;
    if (req.body.redirectUri && !req.body.redirect_uri) req.body.redirect_uri = req.body.redirectUri;
    if (req.body.redirect_uri && !req.body.redirectUri) req.body.redirectUri = req.body.redirect_uri;
    if (req.body.responseType && !req.body.response_type) req.body.response_type = req.body.responseType;
    if (req.body.response_type && !req.body.responseType) req.body.responseType = req.body.response_type;
    if (req.body.codeChallenge && !req.body.code_challenge) req.body.code_challenge = req.body.codeChallenge;
    if (req.body.code_challenge && !req.body.codeChallenge) req.body.codeChallenge = req.body.code_challenge;
    if (req.body.codeChallengeMethod && !req.body.code_challenge_method) req.body.code_challenge_method = req.body.codeChallengeMethod;
    if (req.body.code_challenge_method && !req.body.codeChallengeMethod) req.body.codeChallengeMethod = req.body.code_challenge_method;
    if (req.body.codeVerifier && !req.body.code_verifier) req.body.code_verifier = req.body.codeVerifier;
    if (req.body.code_verifier && !req.body.codeVerifier) req.body.codeVerifier = req.body.code_verifier;
    if (req.body.grantType && !req.body.grant_type) req.body.grant_type = req.body.grantType;
    if (req.body.grant_type && !req.body.grantType) req.body.grantType = req.body.grant_type;
    if (req.body.clientSecret && !req.body.client_secret) req.body.client_secret = req.body.clientSecret;
    if (req.body.client_secret && !req.body.clientSecret) req.body.clientSecret = req.body.client_secret;
    if (req.body.refreshToken && !req.body.refresh_token) req.body.refresh_token = req.body.refreshToken;
    if (req.body.refresh_token && !req.body.refreshToken) req.body.refreshToken = req.body.refresh_token;

    // 180 Pay params
    if (req.body.returnUrl && !req.body.return_url) req.body.return_url = req.body.returnUrl;
    if (req.body.return_url && !req.body.returnUrl) req.body.returnUrl = req.body.return_url;
    if (req.body.cancelUrl && !req.body.cancel_url) req.body.cancel_url = req.body.cancelUrl;
    if (req.body.cancel_url && !req.body.cancelUrl) req.body.cancelUrl = req.body.cancel_url;
    if (req.body.orderId && !req.body.order_id) req.body.order_id = req.body.orderId;
    if (req.body.order_id && !req.body.orderId) req.body.orderId = req.body.order_id;
    if (req.body.sessionId && !req.body.session_id) req.body.session_id = req.body.sessionId;
    if (req.body.session_id && !req.body.sessionId) req.body.sessionId = req.body.session_id;
    if (req.body.couponCode && !req.body.coupon_code) req.body.coupon_code = req.body.couponCode;
    if (req.body.coupon_code && !req.body.couponCode) req.body.couponCode = req.body.coupon_code;
    if (req.body.coupon && !req.body.couponCode) req.body.couponCode = req.body.coupon;
    if (req.body.coupon && !req.body.coupon_code) req.body.coupon_code = req.body.coupon;
    if (req.body.appId && !req.body.app_id) req.body.app_id = req.body.appId;
    if (req.body.app_id && !req.body.appId) req.body.appId = req.body.app_id;
    if (req.body.paymentId && !req.body.payment_id) req.body.payment_id = req.body.paymentId;
    if (req.body.payment_id && !req.body.paymentId) req.body.paymentId = req.body.payment_id;

    // Gateway-specific aliases (Razorpay, etc.)
    if (req.body.razorpay_order_id && !req.body.orderId) {
      req.body.orderId = req.body.razorpay_order_id;
      req.body.order_id = req.body.razorpay_order_id;
    }
    if (req.body.razorpay_payment_id && !req.body.paymentId) {
      req.body.paymentId = req.body.razorpay_payment_id;
      req.body.payment_id = req.body.razorpay_payment_id;
    }
    if (req.body.razorpay_signature && !req.body.signature) {
      req.body.signature = req.body.razorpay_signature;
    }
  }
  next();
});

// Root & Healthcheck (Production-Grade JSON API Gateway - Zero HTML or internal port leakage)
app.get('/', (req, res) => {
  res.status(200).json({
    name: '180 Core REST & OIDC API Gateway',
    status: 'operational',
    version: 'v1',
    documentation: 'https://developer.180core.cloud',
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

// ─── OAuth Authorization Endpoint Redirect (RFC 6749) ──────────────────────
// Redirects inbound /oauth/authorize browser requests to the hosted SSO screen on 180 Profile
const handleOAuthAuthorizeRedirect = (req: any, res: any) => {
  const profileUrl = process.env.PROFILE_FRONTEND_URL || 'https://profile.180core.cloud';
  const query = new URLSearchParams(req.query as any).toString();
  return res.redirect(`${profileUrl}/auth/login${query ? `?${query}` : ''}`);
};
app.get('/oauth/authorize', handleOAuthAuthorizeRedirect);
app.get('/api/oauth/authorize', handleOAuthAuthorizeRedirect);
app.get('/api/v1/auth/authorize', handleOAuthAuthorizeRedirect);

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

