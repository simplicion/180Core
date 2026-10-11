'use strict';

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { developersPrisma as prisma } from '@workspace/db-180core';
import { isFirstPartyApp } from '@workspace/identity-provider';

export function verifyJwtToken(token: string): any {
  const secrets = [
    process.env.JWT_SECRET,
    process.env.JWT_ACCESS_SECRET,
    '195ee7cdf2272463be82f5d065eaf1dc52992c6d5c05241e7cde005eb2cbc71b',
    '180-identity-jwt-secret-key-prod-super-secure'
  ].filter(Boolean) as string[];

  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret);
    } catch (_) {}
  }
  return null;
}

export async function protect(req: Request, res: Response, next: NextFunction) {
  try {
    let token: string | undefined;

    // 1. Check Bearer Authorization Header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 2. Check Cookie (supports parsed req.cookies and raw req.headers.cookie)
    if (!token && (req as any).cookies?.platform_auth_token) {
      token = (req as any).cookies.platform_auth_token;
    }
    if (!token && req.headers.cookie) {
      const match = req.headers.cookie.match(/(?:^|;\s*)(?:platform_auth_token|token|auth_token)=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token required',
      });
    }

    // 3. Verify JWT or OAuth Token
    let userId: string | null = null;
    const decoded = verifyJwtToken(token) as any;
    if (decoded) {
      userId = decoded.id || decoded.sub || decoded.userId || null;
      if (userId && decoded.aud && typeof decoded.aud === 'string' && decoded.aud !== '180-core' && !isFirstPartyApp(decoded.aud)) {
        const app = await prisma.oAuthApp.findFirst({
          where: { OR: [{ clientId: decoded.aud }, { id: decoded.aud }] },
        });
        if (app && !isFirstPartyApp(app.clientId)) {
          const consent = await prisma.oAuthConsent.findUnique({
            where: { appId_userId: { appId: app.id, userId } },
          });
          if (!consent) {
            return res.status(401).json({
              success: false,
              error: 'Application access has been revoked',
            });
          }
        }
      }
    } else {
      // Check if it's an OAuth access token stored in database
      const dbToken = await prisma.oAuthToken.findUnique({
        where: { accessToken: token },
        select: { userId: true, appId: true, expiresAt: true, revokedAt: true },
      });
      if (dbToken && !dbToken.revokedAt && dbToken.expiresAt > new Date()) {
        let isFirstParty = false;
        try {
          const app = await prisma.oAuthApp.findUnique({ where: { id: dbToken.appId } });
          isFirstParty = isFirstPartyApp(app?.clientId);
        } catch (_) {}

        if (isFirstParty) {
          userId = dbToken.userId;
        } else {
          const consent = await prisma.oAuthConsent.findUnique({
            where: { appId_userId: { appId: dbToken.appId, userId: dbToken.userId } },
          });
          if (consent) {
            userId = dbToken.userId;
          } else {
            return res.status(401).json({
              success: false,
              error: 'Application access has been revoked',
            });
          }
        }
      }
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid, expired, or revoked session token',
      });
    }

    // 4. Fetch User
    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        username: true,
        role: true,
        isVerified: true,
        isOnboarded: true,
      },
    });

    if (!user && decoded?.email) {
      user = await prisma.user.findFirst({
        where: { email: { equals: decoded.email, mode: 'insensitive' } },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          username: true,
          role: true,
          isVerified: true,
          isOnboarded: true,
        },
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User account not found',
      });
    }

    (req as any).user = user;
    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session token',
    });
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyJwtToken(token) as any;
    if (decoded) {
      (req as any).user = { id: decoded.id || decoded.sub || decoded.userId };
    }
  } catch (e) {}

  next();
}
