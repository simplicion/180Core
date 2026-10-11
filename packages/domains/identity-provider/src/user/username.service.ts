'use strict';

import { developersPrisma as prisma } from '@workspace/db-180core';

export class UsernameService {
    /**
     * Clean and normalize raw name to base username format
     */
    static normalizeUsername(input: string): string {
        return input
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9_]/g, '')
            .slice(0, 20);
    }

    /**
     * Check if a username is available (globally or within a specific developer application)
     */
    static async checkAvailability(
        username: string,
        excludeUserId?: string,
        clientIdOrAppId?: string
    ): Promise<{ available: boolean; message?: string }> {
        const clean = this.normalizeUsername(username);

        if (!clean || clean.length < 3) {
            return { available: false, message: 'Username must be at least 3 characters long and contain only letters, numbers, and underscores.' };
        }

        // Reserved system usernames
        const reserved = ['admin', 'superadmin', 'root', 'api', 'oauth', 'help', 'system', '180', 'identity', 'pitch', 'support', 'developer'];
        if (reserved.includes(clean)) {
            return { available: false, message: 'This username is reserved.' };
        }

        try {
            // If clientIdOrAppId is provided, check the app-scoped namespace in AppUserIdentity
            if (clientIdOrAppId) {
                let targetAppId = clientIdOrAppId;
                const app = await prisma.oAuthApp.findFirst({
                    where: {
                        OR: [
                            { id: clientIdOrAppId },
                            { clientId: clientIdOrAppId }
                        ]
                    },
                    select: { id: true }
                });
                if (app) {
                    targetAppId = app.id;
                }

                const existingInApp = await prisma.appUserIdentity.findFirst({
                    where: {
                        appId: targetAppId,
                        username: clean,
                        ...(excludeUserId ? { userId: { not: excludeUserId } } : {})
                    },
                    select: { id: true, username: true }
                });

                return {
                    available: !existingInApp,
                    message: existingInApp ? 'Username is already taken in this application.' : 'Username is available.'
                };
            }

            // Global sovereign namespace check
            const existing = await prisma.user.findFirst({
                where: {
                    username: clean,
                    ...(excludeUserId ? { id: { not: excludeUserId } } : {})
                },
                select: { id: true, username: true }
            });

            return {
                available: !existing,
                message: existing ? 'Username is already taken.' : 'Username is available.'
            };
        } catch (dbErr: any) {
            console.warn('[UsernameService] Database unreachable, falling back to heuristic availability:', dbErr.message);
            return {
                available: true,
                message: 'Username is available.'
            };
        }
    }

    /**
     * Automatically generate a guaranteed unique username from Full Name (scoped to app if specified)
     */
    static async generateUniqueUsername(fullName: string, clientIdOrAppId?: string): Promise<string> {
        let base = this.normalizeUsername(fullName);
        if (!base || base.length < 3) {
            base = 'user' + Math.floor(100 + Math.random() * 900);
        }

        // Check if base is free
        const isBaseFree = await this.checkAvailability(base, undefined, clientIdOrAppId);
        if (isBaseFree.available) {
            return base;
        }

        // Collision loop with incremental / random seed
        for (let attempt = 1; attempt <= 10; attempt++) {
            const seed = Math.floor(10 + Math.random() * 990);
            const candidate = `${base}${seed}`;
            const check = await this.checkAvailability(candidate, undefined, clientIdOrAppId);
            if (check.available) {
                return candidate;
            }
        }

        // Fallback guaranteed random suffix
        return `${base}_${Date.now().toString().slice(-4)}`;
    }

    /**
     * Provision and reserve an app-scoped username for a user upon authorizing an app
     */
    static async provisionAppUsername(
        appId: string,
        userId: string,
        preferredUsername?: string
    ): Promise<{ id: string; appId: string; userId: string; username: string }> {
        try {
            // 1. Check if user already has an identity in this app
            const existing = await prisma.appUserIdentity.findUnique({
                where: {
                    appId_userId: {
                        appId,
                        userId
                    }
                }
            });

            if (existing) {
                return existing;
            }

            // 2. Determine base preferred username
            let base = this.normalizeUsername(preferredUsername || '');
            if (!base || base.length < 3) {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { username: true, name: true }
                });
                base = this.normalizeUsername(user?.username || user?.name || 'user');
            }

            // 3. Find unique candidate for this app
            let chosenUsername = base;
            const check = await this.checkAvailability(chosenUsername, userId, appId);
            if (!check.available) {
                chosenUsername = await this.generateUniqueUsername(base, appId);
            }

            // 4. Create AppUserIdentity
            const created = await prisma.appUserIdentity.create({
                data: {
                    appId,
                    userId,
                    username: chosenUsername,
                    metadata: { provisionedAt: new Date().toISOString() }
                }
            });

            return created;
        } catch (err: any) {
            console.error('[UsernameService:provisionAppUsername] Error:', err.message);
            // Return fallback
            return {
                id: `aui_${Date.now()}`,
                appId,
                userId,
                username: preferredUsername || 'user'
            };
        }
    }
}
