import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../apps/180-core-backend/.env') });

import { PrismaClient } from '../packages/db-180core/generated/client/index.js';

const devDbUrl =
  process.env.CORE_DATABASE_URL ||
  process.env.DEVELOPERS_DATABASE_URL ||
  process.env.IDENTITY_DATABASE_URL ||
  process.env.DATABASE_URL;

if (!devDbUrl) {
  console.error('❌ CORE_DATABASE_URL or DATABASE_URL must be set in your environment.');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: devDbUrl } },
});

async function main() {
  console.log('🚀 Seeding Simplicion Root User & System OAuth Apps in 180 Identity...');

  const rootEmail = process.env.ROOT_ADMIN_EMAIL || 'simplicion.com@gmail.com';
  const rootPhone = process.env.ROOT_ADMIN_PHONE || '+919381420546';
  const rootUsername = process.env.ROOT_ADMIN_USERNAME || 'simplicion';
  const rootName = 'Simplicion';
  const rootPassword = process.env.ROOT_ADMIN_PASSWORD || 'Simplicion180Secure!';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(rootPassword, salt);

  // 1. Upsert Root User
  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: rootEmail },
        { phone: rootPhone },
        { username: rootUsername },
      ],
    },
  });

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        email: rootEmail,
        phone: rootPhone,
        username: rootUsername,
        name: rootName,
        passwordHash,
        role: 'SUPERADMIN',
        isVerified: true,
        emailVerified: true,
        isActive: true,
        isOnboardingComplete: true,
      },
    });
    console.log(`[Identity DB] Updated root user: ${user.id} (${user.email})`);
  } else {
    user = await prisma.user.create({
      data: {
        email: rootEmail,
        phone: rootPhone,
        username: rootUsername,
        name: rootName,
        passwordHash,
        role: 'SUPERADMIN',
        isVerified: true,
        emailVerified: true,
        isActive: true,
        isOnboardingComplete: true,
      },
    });
    console.log(`[Identity DB] Created root user: ${user.id} (${user.email})`);
  }

  // 2. Ensure Wallet exists
  const wallet = await prisma.wallet.findUnique({
    where: { userId: user.id },
  });
  if (!wallet) {
    await prisma.wallet.create({
      data: {
        userId: user.id,
        balance: 0.0,
        currency: 'INR',
        isLocked: false,
      },
    });
    console.log('[Identity DB] Created wallet with ₹0.00 balance');
  } else {
    console.log(`[Identity DB] Wallet exists for user (Balance: ₹${wallet.balance})`);
  }

  // 3. First-party OAuth Client: 180-workspace-platform
  const platformClientSecret = process.env.PLATFORM_CLIENT_SECRET || '180sec_platform_default_key_seed';
  const platformSecretHash = await bcrypt.hash(platformClientSecret, 10);
  const platformSecretHint = platformClientSecret.slice(-4);

  const existingApp = await prisma.oAuthApp.findUnique({
    where: { clientId: '180-workspace-platform' },
  });

  const appData = {
    name: '180 Workspace Platform',
    description: 'Unified Business Operating System & Sovereign Collaboration Suite',
    redirectUris: [
      'http://localhost:3000/callback',
      'http://localhost:3000/oauth/callback',
      'http://localhost:3008/callback',
      'http://localhost:3009/callback',
      'https://180workspace.com/callback',
      'https://180workspace.com/oauth/callback',
      'https://developers.180workspace.com/callback',
      'https://profile.180workspace.com/callback',
    ],
    allowedOrigins: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3008',
      'http://127.0.0.1:3008',
      'http://localhost:3009',
      'http://127.0.0.1:3009',
      'https://180workspace.com',
      'https://developers.180workspace.com',
      'https://profile.180workspace.com',
    ],
    allowedScopes: ['openid', 'identity:read', 'identity:email', 'identity:phone', 'pay:read', 'pay:checkout'],
    isVerified: true,
    isActive: true,
    enableAuth: true,
    enablePay: true,
    webhookSecret: process.env.ONE_EIGHTY_WEBHOOK_SECRET || `whsec_${crypto.randomBytes(20).toString('hex')}`,
  };

  if (existingApp) {
    await prisma.oAuthApp.update({
      where: { id: existingApp.id },
      data: appData,
    });
    console.log('[Identity DB] Updated 180-workspace-platform OAuth App');
  } else {
    await prisma.oAuthApp.create({
      data: {
        ...appData,
        clientId: '180-workspace-platform',
        clientSecretHash: platformSecretHash,
        clientSecretHint: platformSecretHint,
        userId: user.id,
      },
    });
    console.log('[Identity DB] Created 180-workspace-platform OAuth App');
  }

  console.log('🎉 Seeding successfully completed!');
}

main()
  .catch((err) => {
    console.error('❌ Error during seeding:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
