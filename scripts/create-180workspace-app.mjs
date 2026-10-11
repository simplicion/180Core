import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
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
  console.error('❌ CORE_DATABASE_URL or DATABASE_URL must be set in your environment or .env file.');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: devDbUrl } },
});

function generateToken(prefix, length = 32) {
  return `${prefix}_${crypto.randomBytes(length).toString('hex')}`;
}

async function main() {
  console.log('🚀 Creating "180workspace" OAuth App for user "simplicion"...');

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: 'simplicion.com@gmail.com' },
        { username: 'simplicion' },
      ],
    },
    select: {
      id: true,
      email: true,
      username: true,
    },
  });

  if (!user) {
    console.error('❌ User simplicion not found in 180core DB!');
    process.exit(1);
  }

  // Check if an app called '180workspace' already exists for this user
  let existing = await prisma.oAuthApp.findFirst({
    where: {
      userId: user.id,
      name: '180workspace',
    },
  });

  const clientId = existing?.clientId || generateToken('180_client', 16);
  const rawClientSecret = generateToken('180_secret', 24);
  const clientSecretHash = await bcrypt.hash(rawClientSecret, 10);
  const clientSecretHint = `...${rawClientSecret.slice(-4)}`;
  const webhookSecret = existing?.webhookSecret || generateToken('whsec', 20);

  const redirectUris = [
    'http://localhost:3000/callback',
    'http://localhost:3000/oauth/callback',
    'http://localhost:3008/callback',
    'http://localhost:3009/callback',
    'https://180workspace.com/callback',
    'https://180workspace.com/oauth/callback',
    'https://*.180workspace.com/callback',
  ];

  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3008',
    'http://127.0.0.1:3008',
    'http://localhost:3009',
    'http://127.0.0.1:3009',
    'https://180workspace.com',
    'https://*.180workspace.com',
  ];

  const allowedScopes = [
    'openid',
    'identity:read',
    'identity:email',
    'identity:phone',
    'pay:read',
    'pay:checkout',
  ];

  const webhookUrl = 'https://api.180workspace.com/api/v1/wallet/webhooks/180-pay';

  let app;
  if (existing) {
    app = await prisma.oAuthApp.update({
      where: { id: existing.id },
      data: {
        name: '180workspace',
        description: '180 Workspace Sovereign Business Operating System & Collaboration Suite',
        clientSecretHash,
        clientSecretHint,
        redirectUris,
        allowedOrigins,
        allowedScopes,
        webhookUrl,
        webhookSecret,
        enableAuth: true,
        enablePay: true,
        isVerified: true,
        isActive: true,
      },
    });
    console.log('✅ Updated existing 180workspace app!');
  } else {
    app = await prisma.oAuthApp.create({
      data: {
        userId: user.id,
        name: '180workspace',
        description: '180 Workspace Sovereign Business Operating System & Collaboration Suite',
        clientId,
        clientSecretHash,
        clientSecretHint,
        redirectUris,
        allowedOrigins,
        allowedScopes,
        webhookUrl,
        webhookSecret,
        enableAuth: true,
        enablePay: true,
        isVerified: true,
        isActive: true,
      },
    });
    console.log('✅ Created new 180workspace app!');
  }

  console.log('\n=============================================================');
  console.log('  180WORKSPACE OAUTH & 180 PAY CREDENTIALS');
  console.log('=============================================================');
  console.log(`App Name:        ${app.name}`);
  console.log(`App ID:          ${app.id}`);
  console.log(`Owner User:      ${user.username} (${user.email})`);
  console.log(`Client ID:       ${app.clientId}`);
  console.log(`Client Secret:   ${rawClientSecret}`);
  console.log(`Webhook Secret:  ${app.webhookSecret}`);
  console.log(`Webhook URL:     ${app.webhookUrl}`);
  console.log(`Scopes:          ${app.allowedScopes.join(', ')}`);
  console.log(`Auth Enabled:    ${app.enableAuth}`);
  console.log(`Pay Enabled:     ${app.enablePay}`);
  console.log('=============================================================\n');
}

main().finally(() => prisma.$disconnect());
