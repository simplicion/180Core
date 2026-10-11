'use strict';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { developersPrisma as prisma } from '@workspace/db-180core';
import { Msg91OtpService } from '../otp/msg91-otp.service';
import { EmailOtpService } from '../otp/email-otp.service';
import { UsernameService } from '../user/username.service';
import { LocationService } from '../user/location.service';

function getJwtSecret(): string {
    return process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || '180-identity-jwt-secret-key-prod-super-secure';
}

const JWT_SECRET = getJwtSecret();

function signToken(userOrId: any): string {
    const id = typeof userOrId === 'string' ? userOrId : (userOrId.id || userOrId.sub);
    const email = typeof userOrId === 'object' ? userOrId.email : undefined;
    const role = typeof userOrId === 'object' ? (userOrId.role || 'USER') : 'USER';
    return jwt.sign(
        { id, sub: id, userId: id, email, role },
        getJwtSecret(),
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
    );
}

function signTempToken(payload: any): string {
    return jwt.sign(
        payload,
        getJwtSecret(),
        { expiresIn: '15m' } as jwt.SignOptions
    );
}

function sanitizeUser(user: any) {
    return {
        id: user.id,
        name: user.name || '',
        username: user.username || '',
        email: user.email || null,
        phone: user.phone || null,
        avatar: user.avatarUrl || user.avatar || '',
        avatarUrl: user.avatarUrl || user.avatar || '',
        headline: user.headline || user.tagline || '',
        tagline: user.tagline || user.headline || '',
        bio: user.bio || '',
        languages: user.languages || [],
        gender: user.gender || '',
        address: user.address || '',
        age: user.age || null,
        dob: user.dob ? user.dob.toISOString() : null,
        securityPreferences: user.securityPreferences || {},
        latitude: user.latitude ?? null,
        longitude: user.longitude ?? null,
        city: user.city || '',
        country: user.country || '',
        role: user.role || 'USER',
        isVerified: Boolean(user.isVerified),
        isOnboarded: Boolean(user.isOnboarded),
        isEmailVerified: Boolean(user.isEmailVerified),
        isPhoneVerified: Boolean(user.isPhoneVerified)
    };
}

export class IdentityAuthController {
    /**
     * 1. Universal Login (Email, Phone, or @Username + Password)
     */
    static async login(req: any, res: any) {
        try {
            const { emailOrPhone, password } = req.body;
            if (!emailOrPhone || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'invalid_credentials',
                    message: 'Email/Phone and password are required'
                });
            }

            const cleanInput = String(emailOrPhone).trim();
            const isEmail = cleanInput.includes('@');
            const cleanUsername = cleanInput.replace(/^@/, '');
            const digits = cleanInput.replace(/[^\d]/g, '');

            const phoneConditions: any[] = [{ phone: cleanInput }];
            if (digits.length >= 10) {
                const { e164, national, msg91Mobile } = Msg91OtpService.normalizePhone(digits);
                phoneConditions.push(
                    { phone: e164 },
                    { phone: national },
                    { phone: msg91Mobile },
                    { phone: `+${national}` }
                );
            }

            const user = await prisma.user.findFirst({
                where: isEmail
                    ? {
                        OR: [
                            { email: { equals: cleanInput, mode: 'insensitive' } },
                            { username: { equals: cleanUsername, mode: 'insensitive' } }
                        ]
                    }
                    : {
                        OR: [
                            ...phoneConditions,
                            { username: { equals: cleanUsername, mode: 'insensitive' } },
                            { email: { equals: cleanInput, mode: 'insensitive' } }
                        ]
                    }
            });

            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: 'user_not_found',
                    message: 'No account found with this credential'
                });
            }

            const passwordToCompare = user.passwordHash || (user as any).password || '';
            const isMatch = await bcrypt.compare(password, passwordToCompare);

            if (!isMatch) {
                return res.status(401).json({
                    success: false,
                    error: 'invalid_password',
                    message: 'Invalid password. Please try again or reset it.'
                });
            }

            const token = signToken(user.id);

            return res.json({
                success: true,
                token,
                user: sanitizeUser(user),
                isOnboarded: Boolean(user.isOnboarded)
            });
        } catch (err: any) {
            console.error('[IdentityAuthController] login error:', err);
            return res.status(500).json({ success: false, error: 'server_error', message: err.message });
        }
    }

    /**
     * 2. Sign Up - Step 1: Initiate & Send OTP
     */
    static async initiateSignup(req: any, res: any) {
        try {
            const rawName = req.body.name || '180 User';
            const rawContact = req.body.emailOrPhone || req.body.email || req.body.phone || req.body.credential;
            if (!rawContact) {
                return res.status(400).json({
                    success: false,
                    error: 'missing_fields',
                    message: 'Email or Phone number is required'
                });
            }

            const cleanName = String(rawName).trim();
            const cleanInput = String(rawContact).trim();
            const isEmail = cleanInput.includes('@');
            const digits = cleanInput.replace(/[^\d]/g, '');

            // Verify contact not already registered
            if (isEmail) {
                const existing = await prisma.user.findFirst({
                    where: { email: { equals: cleanInput, mode: 'insensitive' } }
                });
                if (existing && existing.passwordHash) {
                    return res.status(409).json({
                        success: false,
                        error: 'email_taken',
                        message: 'An account with this email already exists. Please sign in.'
                    });
                }
            } else {
                if (digits.length < 10) {
                    return res.status(400).json({
                        success: false,
                        error: 'invalid_phone',
                        message: 'Please provide a valid 10-digit mobile number'
                    });
                }
                const { e164 } = Msg91OtpService.normalizePhone(digits);
                const existing = await prisma.user.findFirst({
                    where: { phone: e164 }
                });
                if (existing && existing.passwordHash) {
                    return res.status(409).json({
                        success: false,
                        error: 'phone_taken',
                        message: 'An account with this phone number already exists. Please sign in.'
                    });
                }
            }

            // Generate 6-digit OTP
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            const phoneMeta = !isEmail ? Msg91OtpService.normalizePhone(cleanInput) : null;
            const identifier = isEmail ? cleanInput.toLowerCase() : (phoneMeta?.e164 || digits);

            // Upsert in OtpVerification
            await prisma.otpVerification.create({
                data: {
                    identifier,
                    type: isEmail ? 'EMAIL' : 'WHATSAPP',
                    code: otpCode,
                    expiresAt: otpExpiresAt,
                    verified: false
                }
            });

            // Dispatch via Email SMTP or MSG91 WhatsApp Outbound
            if (isEmail) {
                try {
                    await EmailOtpService.sendSignupOtp(cleanInput, otpCode);
                } catch (emailErr: any) {
                    console.warn('[IdentityAuthController] Email OTP dispatch note:', emailErr.message);
                }
            } else {
                try {
                    await Msg91OtpService.sendWhatsAppOtp(phoneMeta?.e164 || digits, otpCode);
                } catch (smsErr: any) {
                    console.warn('[IdentityAuthController] Msg91 dispatch note:', smsErr.message);
                }
            }

            const tempToken = signTempToken({
                identifier,
                name: cleanName,
                isEmail,
                step: 'otp'
            });

            const displayTarget = isEmail
                ? cleanInput
                : (phoneMeta ? `${phoneMeta.e164.slice(0, 3)} ${phoneMeta.national}` : `+91 ${digits.slice(-10)}`);

            return res.json({
                success: true,
                channel: isEmail ? 'email' : 'whatsapp',
                identifier,
                tempToken,
                message: isEmail
                    ? `Verification code sent to ${cleanInput}`
                    : `WhatsApp verification code dispatched to ${displayTarget}`,
                devOtp: process.env.NODE_ENV !== 'production' ? otpCode : undefined
            });
        } catch (err: any) {
            console.error('[IdentityAuthController] initiateSignup error:', err);
            return res.status(500).json({ success: false, error: 'server_error', message: err.message });
        }
    }

    /**
     * 3. Sign Up - Step 2: Verify OTP
     */
    static async verifySignupOtp(req: any, res: any) {
        try {
            let { emailOrPhone, otp, tempToken } = req.body;
            if (!emailOrPhone && tempToken) {
                try {
                    const decoded: any = jwt.verify(tempToken, JWT_SECRET);
                    if (decoded && decoded.identifier) {
                        emailOrPhone = decoded.identifier;
                    }
                } catch (_) {}
            }
            emailOrPhone = emailOrPhone || req.body.credential || req.body.email;
            if (!emailOrPhone || !otp) {
                return res.status(400).json({
                    success: false,
                    error: 'missing_fields',
                    message: 'Email/Phone and OTP code are required'
                });
            }

            const cleanInput = String(emailOrPhone).trim();
            const isEmail = cleanInput.includes('@');
            const cleanOtp = String(otp).trim();
            const digits = cleanInput.replace(/[^\d]/g, '');
            const phoneMeta = !isEmail ? Msg91OtpService.normalizePhone(cleanInput) : null;
            const identifier = isEmail ? cleanInput.toLowerCase() : digits;

            const phoneVariants = isEmail
                ? [identifier]
                : Array.from(new Set([
                    identifier,
                    cleanInput,
                    phoneMeta?.e164,
                    phoneMeta?.national,
                    phoneMeta?.msg91Mobile,
                    digits.slice(-10),
                    `+91${digits.slice(-10)}`,
                    `+${digits}`
                ].filter(Boolean))) as string[];

            // Check database OTP
            let isValid = false;
            const record = await prisma.otpVerification.findFirst({
                where: {
                    identifier: { in: phoneVariants },
                    code: cleanOtp,
                    verified: false,
                    expiresAt: { gt: new Date() }
                },
                orderBy: { createdAt: 'desc' }
            });

            if (record) {
                isValid = true;
                await prisma.otpVerification.update({
                    where: { id: record.id },
                    data: { verified: true }
                });
            } else if (!isEmail && digits.length >= 10) {
                // Secondary check via Msg91 for WhatsApp
                const verifyRes = await Msg91OtpService.verifyWhatsAppOtp(cleanInput, cleanOtp);
                if (verifyRes.valid) {
                    isValid = true;
                }
            }

            // Fallback for dev environment
            if (!isValid && process.env.NODE_ENV !== 'production' && cleanOtp === '123456') {
                isValid = true;
            }

            if (!isValid) {
                return res.status(400).json({
                    success: false,
                    error: 'invalid_otp',
                    message: 'Invalid or expired verification code'
                });
            }

            const verifiedTempToken = signTempToken({
                identifier,
                isEmail,
                verified: true
            });

            return res.json({
                success: true,
                tempToken: verifiedTempToken,
                identifier,
                isEmail,
                message: 'Contact verified successfully'
            });
        } catch (err: any) {
            console.error('[IdentityAuthController] verifySignupOtp error:', err);
            return res.status(500).json({ success: false, error: 'server_error', message: err.message });
        }
    }

    /**
     * 4. Sign Up - Step 3: Set Password & Create User Account
     */
    static async setPassword(req: any, res: any) {
        try {
            let { name, emailOrPhone, password, tempToken } = req.body;
            if (!password || password.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'weak_password',
                    message: 'Password must be at least 6 characters long'
                });
            }

            let verifiedIdentifier = emailOrPhone || req.body.credential || req.body.email;
            let isEmail = Boolean(verifiedIdentifier && String(verifiedIdentifier).includes('@'));
            let userName = name;

            if (tempToken) {
                try {
                    const decoded: any = jwt.verify(tempToken, JWT_SECRET);
                    if (decoded) {
                        if (!verifiedIdentifier && decoded.identifier) {
                            verifiedIdentifier = decoded.identifier;
                            isEmail = decoded.isEmail ?? String(verifiedIdentifier).includes('@');
                        }
                        if (!userName && decoded.name) {
                            userName = decoded.name;
                        }
                    }
                } catch (_) {}
            }

            if (!verifiedIdentifier) {
                return res.status(400).json({
                    success: false,
                    error: 'missing_identifier',
                    message: 'Email, phone number, or verification token is required'
                });
            }

            const cleanName = String(name || '180 User').trim();
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            // Generate unique username
            const username = await UsernameService.generateUniqueUsername(cleanName);

            let cleanEmail: string | null = null;
            let cleanPhone: string | null = null;

            if (isEmail) {
                cleanEmail = String(verifiedIdentifier).toLowerCase().trim();
            } else {
                const digits = String(verifiedIdentifier).replace(/[^\d]/g, '');
                const { e164 } = Msg91OtpService.normalizePhone(digits);
                cleanPhone = e164;
            }

            // Find or create User
            let user = await prisma.user.findFirst({
                where: isEmail ? { email: cleanEmail } : { phone: cleanPhone }
            });

            if (user) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        name: cleanName,
                        passwordHash,
                        isEmailVerified: isEmail ? true : user.isEmailVerified,
                        isPhoneVerified: !isEmail ? true : user.isPhoneVerified,
                        isVerified: true
                    }
                });
            } else {
                user = await prisma.user.create({
                    data: {
                        name: cleanName,
                        email: cleanEmail,
                        phone: cleanPhone,
                        username,
                        passwordHash,
                        isEmailVerified: isEmail,
                        isPhoneVerified: !isEmail,
                        isVerified: true,
                        isOnboarded: false,
                        role: 'USER',
                        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`
                    }
                });
            }

            const token = signToken(user.id);

            return res.status(201).json({
                success: true,
                token,
                user: sanitizeUser(user),
                isOnboarded: false,
                nextStep: 'onboarding'
            });
        } catch (err: any) {
            console.error('[IdentityAuthController] setPassword error:', err);
            return res.status(500).json({ success: false, error: 'server_error', message: err.message });
        }
    }

    /**
     * 5. Sign Up - Step 4: Complete Onboarding Profile
     */
    static async completeOnboarding(req: any, res: any) {
        try {
            // Support user ID from Authorization header or req.body
            let userId = req.user?.id;
            const authHeader = req.headers?.authorization;
            if (!userId && authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const decoded: any = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
                    userId = decoded?.id;
                } catch (e) {}
            }
            if (!userId && req.body.userId) {
                userId = req.body.userId;
            }

            if (!userId) {
                return res.status(401).json({
                    success: false,
                    error: 'unauthorized',
                    message: 'Authentication token required to complete onboarding'
                });
            }

            const existingUser = await prisma.user.findUnique({
                where: { id: userId }
            });

            if (!existingUser) {
                return res.status(404).json({
                    success: false,
                    error: 'user_not_found',
                    message: 'User account not found'
                });
            }

            const {
                name,
                username,
                avatarUrl,
                age,
                dob,
                bio,
                gender,
                address,
                securityPreferences,
                headline,
                tagline,
                languages,
                latitude,
                longitude,
                city,
                country,
                secondaryPhone,
                secondaryEmail
            } = req.body;

            // Handle username update if provided and different
            let finalUsername = existingUser.username;
            if (username && username.trim() !== existingUser.username) {
                const cleanUser = UsernameService.normalizeUsername(username);
                const check = await UsernameService.checkAvailability(cleanUser, existingUser.id);
                if (check.available) {
                    finalUsername = cleanUser;
                }
            }

            // Resolve location if coordinates given
            let finalCity = city || existingUser.city || '';
            let finalCountry = country || existingUser.country || '';
            const latNum = latitude !== undefined && latitude !== null ? Number(latitude) : existingUser.latitude;
            const lngNum = longitude !== undefined && longitude !== null ? Number(longitude) : existingUser.longitude;

            if (latNum !== null && lngNum !== null && (!finalCity || !finalCountry)) {
                try {
                    const loc = await LocationService.resolveCoordinates(latNum, lngNum);
                    finalCity = finalCity || loc.city;
                    finalCountry = finalCountry || loc.country;
                } catch (e) {}
            }

            // Secondary contact handling
            let finalPhone = existingUser.phone;
            let finalEmail = existingUser.email;

            if (!finalPhone && secondaryPhone) {
                const digits = String(secondaryPhone).replace(/[^\d]/g, '');
                if (digits.length >= 10) {
                    const { e164 } = Msg91OtpService.normalizePhone(digits);
                    const conflictUser = await prisma.user.findFirst({
                        where: {
                            phone: e164,
                            id: { not: userId }
                        }
                    });

                    if (conflictUser) {
                        if (!conflictUser.passwordHash && !conflictUser.isOnboarded) {
                            await prisma.user.update({
                                where: { id: conflictUser.id },
                                data: { phone: null }
                            });
                            finalPhone = e164;
                        } else {
                            return res.status(409).json({
                                success: false,
                                error: 'phone_in_use',
                                message: 'This mobile phone number is already registered with another account.'
                            });
                        }
                    } else {
                        finalPhone = e164;
                    }
                }
            }

            if (!finalEmail && secondaryEmail && String(secondaryEmail).includes('@')) {
                const cleanEmail = String(secondaryEmail).toLowerCase().trim();
                const conflictUser = await prisma.user.findFirst({
                    where: {
                        email: { equals: cleanEmail, mode: 'insensitive' },
                        id: { not: userId }
                    }
                });

                if (conflictUser) {
                    if (!conflictUser.passwordHash && !conflictUser.isOnboarded) {
                        await prisma.user.update({
                            where: { id: conflictUser.id },
                            data: { email: null }
                        });
                        finalEmail = cleanEmail;
                    } else {
                        return res.status(409).json({
                            success: false,
                            error: 'email_in_use',
                            message: 'This email address is already registered with another account.'
                        });
                    }
                } else {
                    finalEmail = cleanEmail;
                }
            }

            const updatedUser: any = await (prisma.user as any).update({
                where: { id: userId },
                data: {
                    name: name && String(name).trim() ? String(name).trim() : (existingUser as any).name,
                    username: finalUsername,
                    avatarUrl: avatarUrl || (existingUser as any).avatarUrl || '',
                    age: age ? Number(age) : (existingUser as any).age,
                    dob: dob ? new Date(dob) : (existingUser as any).dob,
                    bio: bio !== undefined ? String(bio).trim() : ((existingUser as any).bio || ''),
                    gender: gender !== undefined ? String(gender).trim() : ((existingUser as any).gender || ''),
                    address: address !== undefined ? String(address).trim() : ((existingUser as any).address || ''),
                    securityPreferences: securityPreferences !== undefined ? securityPreferences : ((existingUser as any).securityPreferences || {}),
                    headline: headline !== undefined ? String(headline).trim() : ((tagline !== undefined ? String(tagline).trim() : (existingUser as any).headline) || ''),
                    tagline: tagline !== undefined ? String(tagline).trim() : ((headline !== undefined ? String(headline).trim() : (existingUser as any).tagline) || ''),
                    languages: Array.isArray(languages) ? languages : ((existingUser as any).languages || []),
                    latitude: latNum,
                    longitude: lngNum,
                    city: finalCity,
                    country: finalCountry,
                    phone: finalPhone,
                    email: finalEmail,
                    isOnboarded: true
                } as any
            });

            const token = signToken(updatedUser.id);

            return res.json({
                success: true,
                message: 'Onboarding completed successfully',
                token,
                user: sanitizeUser(updatedUser),
                isOnboarded: true
            });
        } catch (err: any) {
            console.error('[IdentityAuthController] completeOnboarding error:', err);
            if (err.code === 'P2002') {
                const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : (err.meta?.target || 'field');
                return res.status(409).json({
                    success: false,
                    error: 'duplicate_credential',
                    message: `An account already exists with this ${target}. Please use a different value.`
                });
            }
            return res.status(500).json({ success: false, error: 'server_error', message: err.message });
        }
    }

    /**
     * 6. Google Continuation / Direct Google SSO
     */
    static async googleContinue(req: any, res: any) {
        try {
            const {
                tokenId,
                accessToken,
                password,
                email: manualEmail,
                name: manualName,
                avatar: manualAvatar,
                googleId: manualGoogleId
            } = req.body;

            let googleEmail = manualEmail;
            let googleName = manualName;
            let googleAvatar = manualAvatar;
            let googleSub = manualGoogleId;

            // Decode Google ID Token if present
            if (tokenId) {
                try {
                    const decoded: any = jwt.decode(tokenId);
                    if (decoded) {
                        googleEmail = decoded.email || googleEmail;
                        googleName = decoded.name || googleName;
                        googleAvatar = decoded.picture || googleAvatar;
                        googleSub = decoded.sub || googleSub;
                    }
                } catch (e) {}
            }

            // Fetch Google Userinfo if accessToken is provided
            if (accessToken && !googleEmail) {
                try {
                    const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                        headers: { Authorization: `Bearer ${accessToken}` }
                    });
                    if (gRes.ok) {
                        const gData: any = await gRes.json();
                        googleEmail = gData.email || googleEmail;
                        googleName = gData.name || googleName;
                        googleAvatar = gData.picture || googleAvatar;
                        googleSub = gData.sub || googleSub;
                    }
                } catch (e) {}
            }

            if (!googleEmail) {
                return res.status(400).json({
                    success: false,
                    error: 'missing_email',
                    message: 'Google account email could not be resolved'
                });
            }

            const cleanEmail = String(googleEmail).toLowerCase().trim();

            // Hash password if submitted
            let hashedPassword: string | null = null;
            if (password && password.length >= 6) {
                const salt = await bcrypt.genSalt(10);
                hashedPassword = await bcrypt.hash(password, salt);
            }

            // Find existing user by email or googleId
            const existingUser = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email: { equals: cleanEmail, mode: 'insensitive' } },
                        ...(googleSub ? [{ googleId: googleSub }] : [])
                    ]
                }
            });

            let user;
            if (existingUser) {
                user = await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        name: existingUser.name || googleName || 'Google User',
                        avatarUrl: existingUser.avatarUrl || googleAvatar || '',
                        googleId: googleSub || existingUser.googleId,
                        isEmailVerified: true,
                        isVerified: true,
                        ...(hashedPassword ? { passwordHash: hashedPassword } : {})
                    }
                });
            } else {
                const uniqueUsername = await UsernameService.generateUniqueUsername(googleName || cleanEmail.split('@')[0]);
                user = await prisma.user.create({
                    data: {
                        name: googleName || 'Google User',
                        email: cleanEmail,
                        username: uniqueUsername,
                        avatarUrl: googleAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${uniqueUsername}`,
                        googleId: googleSub || null,
                        passwordHash: hashedPassword || null,
                        isEmailVerified: true,
                        isVerified: true,
                        isOnboarded: false,
                        role: 'USER'
                    }
                });
            }

            const token = signToken(user.id);

            // User requirement: If new or no password set, prompt to set password -> then onboarding
            const requiresPassword = !user.passwordHash;

            return res.json({
                success: true,
                token,
                user: sanitizeUser(user),
                isOnboarded: Boolean(user.isOnboarded),
                requiresPassword,
                nextStep: requiresPassword ? 'password' : (user.isOnboarded ? 'done' : 'onboarding')
            });
        } catch (err: any) {
            console.error('[IdentityAuthController] googleContinue error:', err);
            return res.status(500).json({ success: false, error: 'server_error', message: err.message });
        }
    }

    /**
     * 7. Legacy / Direct Register Endpoint (Full Single Step)
     */
    static async register(req: any, res: any) {
        try {
            const { name, email, phone, password, username, headline, age } = req.body;

            if (!name || (!email && !phone) || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'missing_fields',
                    message: 'Full name, email/phone, and password are required'
                });
            }

            const cleanName = String(name).trim();
            const cleanEmail = email ? String(email).trim().toLowerCase() : null;
            const cleanPhone = phone ? String(phone).trim() : null;

            if (cleanEmail) {
                const existing = await prisma.user.findFirst({
                    where: { email: { equals: cleanEmail, mode: 'insensitive' } }
                });
                if (existing) {
                    return res.status(409).json({ success: false, error: 'email_taken', message: 'Email already registered' });
                }
            }

            if (cleanPhone) {
                const existing = await prisma.user.findFirst({
                    where: { phone: cleanPhone }
                });
                if (existing) {
                    return res.status(409).json({ success: false, error: 'phone_taken', message: 'Phone already registered' });
                }
            }

            let finalUsername = username ? UsernameService.normalizeUsername(username) : '';
            if (!finalUsername || finalUsername.length < 3) {
                finalUsername = await UsernameService.generateUniqueUsername(cleanName);
            }

            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);

            const user = await prisma.user.create({
                data: {
                    name: cleanName,
                    email: cleanEmail,
                    phone: cleanPhone,
                    username: finalUsername,
                    passwordHash,
                    headline: headline || '',
                    age: age ? Number(age) : null,
                    avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${finalUsername}`,
                    isEmailVerified: Boolean(cleanEmail),
                    isPhoneVerified: Boolean(cleanPhone),
                    isVerified: true,
                    isOnboarded: false,
                    role: 'USER'
                }
            });

            const token = signToken(user.id);

            return res.status(201).json({
                success: true,
                token,
                user: sanitizeUser(user),
                isOnboarded: false
            });
        } catch (err: any) {
            console.error('[IdentityAuthController] register error:', err);
            return res.status(500).json({ success: false, error: 'server_error', message: err.message });
        }
    }

    /**
     * 8. Forgot Password - OTP Dispatch
     */
    static async forgotPassword(req: any, res: any) {
        try {
            const rawInput = req.body.emailOrPhone || req.body.credential || req.body.email || req.body.phone;
            if (!rawInput) {
                return res.status(400).json({ success: false, error: 'missing_field', message: 'Email or phone number is required' });
            }

            const cleanInput = String(rawInput).trim();
            const isEmail = cleanInput.includes('@');
            const digits = cleanInput.replace(/[^\d]/g, '');

            const phoneConditions: any[] = [{ phone: cleanInput }];
            if (digits.length >= 10) {
                const { e164, national, msg91Mobile } = Msg91OtpService.normalizePhone(cleanInput);
                phoneConditions.push(
                    { phone: e164 },
                    { phone: national },
                    { phone: msg91Mobile },
                    { phone: `+${national}` }
                );
            }

            const user = await prisma.user.findFirst({
                where: isEmail
                    ? { email: { equals: cleanInput, mode: 'insensitive' } }
                    : { OR: phoneConditions }
            });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'user_not_found',
                    message: 'No account found with this email or phone number.'
                });
            }

            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

            await prisma.user.update({
                where: { id: user.id },
                data: { otpCode, otpExpiresAt }
            });

            // Dispatch via Email SMTP or MSG91 WhatsApp
            if (isEmail) {
                try {
                    await EmailOtpService.sendPasswordResetOtp(cleanInput, otpCode);
                } catch (emailErr: any) {
                    console.warn('[IdentityAuthController] Email OTP dispatch note:', emailErr.message);
                }
            } else if (user.phone) {
                try {
                    await Msg91OtpService.sendWhatsAppOtp(user.phone, otpCode);
                } catch (smsErr: any) {
                    console.warn('[IdentityAuthController] Msg91 dispatch note:', smsErr.message);
                }
            }

            const tempToken = signTempToken({
                id: user.id,
                emailOrPhone: cleanInput,
                purpose: 'forgot_password'
            });

            return res.json({
                success: true,
                channel: isEmail ? 'email' : 'whatsapp',
                tempToken,
                identifier: cleanInput,
                message: isEmail
                    ? `Verification code sent to ${cleanInput}`
                    : `Verification code sent to your registered phone`,
                devOtp: process.env.NODE_ENV !== 'production' ? otpCode : undefined
            });
        } catch (err: any) {
            console.error('[IdentityAuthController] forgotPassword error:', err);
            return res.status(500).json({ success: false, error: 'server_error', message: err.message });
        }
    }

    /**
     * 8b. Verify Reset Password OTP
     */
    static async verifyResetOtp(req: any, res: any) {
        try {
            let { emailOrPhone, otp, tempToken } = req.body;
            if (!emailOrPhone && tempToken) {
                try {
                    const decoded: any = jwt.verify(tempToken, JWT_SECRET);
                    if (decoded) emailOrPhone = decoded.emailOrPhone;
                } catch (_) {}
            }
            emailOrPhone = emailOrPhone || req.body.credential || req.body.email;
            if (!emailOrPhone || !otp) {
                return res.status(400).json({
                    success: false,
                    error: 'missing_fields',
                    message: 'Email or phone and verification code are required'
                });
            }

            const cleanInput = String(emailOrPhone).trim();
            const isEmail = cleanInput.includes('@');

            const user = await prisma.user.findFirst({
                where: isEmail
                    ? { email: { equals: cleanInput, mode: 'insensitive' } }
                    : { phone: cleanInput }
            });

            if (!user) {
                return res.status(404).json({ success: false, error: 'not_found', message: 'Account not found' });
            }

            let isValidOtp = false;
            if (user.otpCode === String(otp).trim() && user.otpExpiresAt && user.otpExpiresAt > new Date()) {
                isValidOtp = true;
            } else if (!isEmail && user.phone) {
                const whatsappVerify = await Msg91OtpService.verifyWhatsAppOtp(user.phone, String(otp).trim());
                isValidOtp = whatsappVerify.valid;
            }

            if (!isValidOtp) {
                return res.status(400).json({ success: false, error: 'invalid_otp', message: 'Invalid or expired verification code' });
            }

            const resetToken = jwt.sign(
                { id: user.id, emailOrPhone: cleanInput, purpose: 'reset_password' },
                JWT_SECRET,
                { expiresIn: '15m' }
            );

            return res.json({
                success: true,
                message: 'Verification code confirmed',
                resetToken,
                tempToken: resetToken
            });
        } catch (err: any) {
            console.error('[IdentityAuthController] verifyResetOtp error:', err);
            return res.status(500).json({ success: false, error: 'server_error', message: err.message });
        }
    }

    /**
     * 9. Reset Password with OTP or Reset Token
     */
    static async resetPassword(req: any, res: any) {
        try {
            let { emailOrPhone, otp, resetToken, tempToken, newPassword, password } = req.body;
            const finalToken = resetToken || tempToken;
            const finalPassword = newPassword || password;

            if (!emailOrPhone && finalToken) {
                try {
                    const decoded: any = jwt.verify(finalToken, JWT_SECRET);
                    if (decoded) emailOrPhone = decoded.emailOrPhone;
                } catch (_) {}
            }
            emailOrPhone = emailOrPhone || req.body.credential || req.body.email;

            if (!emailOrPhone || (!otp && !finalToken) || !finalPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'missing_fields',
                    message: 'Credentials, verification code or reset token, and new password are required'
                });
            }

            if (finalPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'weak_password',
                    message: 'Password must be at least 6 characters long'
                });
            }

            const cleanInput = String(emailOrPhone).trim();
            const isEmail = cleanInput.includes('@');

            const user = await prisma.user.findFirst({
                where: isEmail
                    ? { email: { equals: cleanInput, mode: 'insensitive' } }
                    : { phone: cleanInput }
            });

            if (!user) {
                return res.status(404).json({ success: false, error: 'not_found', message: 'Account not found' });
            }

            let isValid = false;

            if (finalToken) {
                try {
                    const decoded: any = jwt.verify(finalToken, JWT_SECRET);
                    if (decoded && (decoded.purpose === 'reset_password' || decoded.purpose === 'forgot_password') && decoded.id === user.id) {
                        isValid = true;
                    }
                } catch (e) {}
            }

            if (!isValid && otp) {
                if (user.otpCode === String(otp).trim() && user.otpExpiresAt && user.otpExpiresAt > new Date()) {
                    isValid = true;
                }
            }

            if (!isValid) {
                return res.status(400).json({ success: false, error: 'invalid_verification', message: 'Invalid or expired verification session' });
            }

            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(finalPassword, salt);

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    passwordHash,
                    otpCode: null,
                    otpExpiresAt: null
                }
            });

            return res.json({
                success: true,
                message: 'Password reset successfully. You can now sign in with your new password.'
            });
        } catch (err: any) {
            console.error('[IdentityAuthController] resetPassword error:', err);
            return res.status(500).json({ success: false, error: 'server_error', message: err.message });
        }
    }
}
