'use strict';

import nodemailer from 'nodemailer';

export interface SendEmailOtpOptions {
  email: string;
  otp: string;
  purpose?: 'signup' | 'reset_password' | 'login' | 'verification';
  userName?: string;
}

export interface SmtpVerificationStatus {
  success: boolean;
  error?: string;
  config: {
    host: string;
    port: number;
    secure: boolean;
    userConfigured: boolean;
    passConfigured: boolean;
    from: string;
  };
}

export class EmailOtpService {
  private static transporter: nodemailer.Transporter | null = null;

  /**
   * Sanitizes environment strings (removes wrapping quotes and extraneous whitespace)
   */
  private static sanitizeEnv(val: string | undefined): string | undefined {
    if (!val) return undefined;
    const trimmed = String(val).trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1).trim();
    }
    return trimmed;
  }

  /**
   * Initializes or returns the cached SMTP Nodemailer transporter
   */
  private static getTransporter(): nodemailer.Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.sanitizeEnv(process.env.SMTP_HOST) || 'smtp.gmail.com';
    const port = parseInt(this.sanitizeEnv(process.env.SMTP_PORT) || '587', 10);
    const secure = this.sanitizeEnv(process.env.SMTP_SECURE) === 'true' || port === 465;
    const user = this.sanitizeEnv(process.env.SMTP_USER || process.env.EMAIL_USER);
    const pass = this.sanitizeEnv(process.env.SMTP_PASS || process.env.EMAIL_PASS);

    if (!user || !pass) {
      console.warn('[EmailOtpService] SMTP_USER or SMTP_PASS not set in environment. Outbound emails will fail.');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: false,
      },
    });

    return this.transporter;
  }

  /**
   * Verifies the SMTP connection and authentication status
   */
  static async verifyConnection(): Promise<SmtpVerificationStatus> {
    const host = this.sanitizeEnv(process.env.SMTP_HOST) || 'smtp.gmail.com';
    const port = parseInt(this.sanitizeEnv(process.env.SMTP_PORT) || '587', 10);
    const secure = this.sanitizeEnv(process.env.SMTP_SECURE) === 'true' || port === 465;
    const user = this.sanitizeEnv(process.env.SMTP_USER || process.env.EMAIL_USER);
    const pass = this.sanitizeEnv(process.env.SMTP_PASS || process.env.EMAIL_PASS);
    const from = this.sanitizeEnv(process.env.EMAIL_FROM || user) || 'notifications@180core.cloud';

    const config = {
      host,
      port,
      secure,
      userConfigured: Boolean(user),
      passConfigured: Boolean(pass),
      from,
    };

    if (!user || !pass) {
      return {
        success: false,
        error: 'SMTP credentials missing: SMTP_USER or SMTP_PASS environment variable is not configured.',
        config,
      };
    }

    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      return {
        success: true,
        config,
      };
    } catch (err: any) {
      // Invalidate broken cached transporter so future calls re-attempt fresh config
      this.transporter = null;
      return {
        success: false,
        error: `SMTP connection verification failed: ${err.message}`,
        config,
      };
    }
  }

  /**
   * Generates a corporate-grade, executive HTML email template
   * adhering strictly to the 180 Core Sovereign Design System
   */
  private static generateEmailHtml(otp: string, title: string, subtitle: string, cleanEmail: string, refCode: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title} — 180 Core</title>
  <style>
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #f4f4f5;
      font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #09090b;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      line-height: 1.5;
    }
    table {
      border-spacing: 0;
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    .email-container {
      max-width: 560px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      border: 1px solid #e4e4e7;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03);
    }
    .accent-bar {
      height: 4px;
      width: 100%;
      background: linear-gradient(90deg, #10b981 0%, #3b82f6 50%, #6366f1 100%);
    }
    .header-cell {
      padding: 32px 36px 20px 36px;
      border-bottom: 1px solid #f4f4f5;
    }
    .brand-table {
      width: 100%;
    }
    .brand-logo {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #09090b;
      display: inline-block;
      text-align: center;
      vertical-align: middle;
    }
    .brand-name {
      font-size: 17px;
      font-weight: 800;
      color: #09090b;
      letter-spacing: -0.02em;
      margin-left: 10px;
      display: inline-block;
      vertical-align: middle;
    }
    .badge-pill {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #059669;
      background-color: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-radius: 9999px;
      padding: 4px 10px;
    }
    .content-cell {
      padding: 36px 36px 28px 36px;
      text-align: left;
    }
    .headline {
      font-size: 22px;
      font-weight: 800;
      color: #09090b;
      letter-spacing: -0.025em;
      margin: 0 0 10px 0;
    }
    .subtitle {
      font-size: 14.5px;
      color: #52525b;
      line-height: 1.6;
      margin: 0 0 28px 0;
    }
    .otp-card {
      background-color: #fafafa;
      border: 1.5px solid #e4e4e7;
      border-radius: 14px;
      padding: 24px 20px;
      text-align: center;
      margin-bottom: 24px;
    }
    .otp-code {
      font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', Menlo, Monaco, Consolas, monospace;
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 12px;
      color: #09090b;
      margin: 0 0 10px 0;
      padding-left: 12px; /* balance letter-spacing on last char */
    }
    .otp-meta {
      font-size: 12px;
      font-weight: 600;
      color: #71717a;
      letter-spacing: 0.01em;
    }
    .security-card {
      background-color: #fafafa;
      border: 1px solid #e4e4e7;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 12px;
    }
    .security-title {
      font-size: 12.5px;
      font-weight: 700;
      color: #09090b;
      margin: 0 0 4px 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .security-text {
      font-size: 12px;
      color: #71717a;
      line-height: 1.5;
      margin: 0;
    }
    .footer-cell {
      padding: 24px 36px 36px 36px;
      background-color: #fafafa;
      border-top: 1px solid #f4f4f5;
      text-align: center;
    }
    .footer-links {
      font-size: 12px;
      color: #71717a;
      margin-bottom: 12px;
    }
    .footer-links a {
      color: #52525b;
      text-decoration: underline;
      margin: 0 6px;
    }
    .footer-legal {
      font-size: 11px;
      color: #a1a1aa;
      line-height: 1.6;
      margin: 0;
    }
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        border-radius: 0 !important;
        border: none !important;
      }
      .header-cell, .content-cell, .footer-cell {
        padding-left: 20px !important;
        padding-right: 20px !important;
      }
      .otp-code {
        font-size: 32px !important;
        letter-spacing: 8px !important;
      }
    }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table role="presentation" class="email-container" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td class="accent-bar"></td>
          </tr>
          <!-- Header -->
          <tr>
            <td class="header-cell">
              <table role="presentation" class="brand-table" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" valign="middle">
                    <div style="display: inline-block; vertical-align: middle;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width: 32px; height: 32px; background: #09090b; border-radius: 8px; text-align: center; vertical-align: middle; border: 1px solid #27272a;">
                            <span style="font-size: 15px; font-weight: 900; color: #ffffff; font-family: sans-serif;">180</span>
                          </td>
                          <td style="padding-left: 10px; vertical-align: middle;">
                            <span style="font-size: 16px; font-weight: 800; color: #09090b; letter-spacing: -0.02em;">180 Core</span>
                            <span style="font-size: 12px; color: #71717a; font-weight: 500; margin-left: 4px;">Sovereign Identity</span>
                          </td>
                        </tr>
                      </table>
                    </div>
                  </td>
                  <td align="right" valign="middle">
                    <span class="badge-pill">Verified Dispatch</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td class="content-cell">
              <h1 class="headline">${title}</h1>
              <p class="subtitle">${subtitle}</p>

              <!-- Central OTP Code Block -->
              <div class="otp-card">
                <div class="otp-code">${otp}</div>
                <div class="otp-meta">⏱️ Single-use code • Valid for 10 minutes</div>
              </div>

              <!-- Security Callout -->
              <div class="security-card">
                <div class="security-title">
                  🔒 Security Notice
                </div>
                <p class="security-text">
                  Never share this verification code with anyone. 180 Core personnel will never ask for your code. If you did not initiate this request, you can safely disregard this email — your account remains protected.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="footer-cell">
              <div class="footer-links">
                <a href="https://180core.cloud" target="_blank">180 Core</a>
                &bull;
                <a href="https://developer.180core.cloud" target="_blank">Developer Console</a>
                &bull;
                <a href="https://profile.180core.cloud" target="_blank">Profile Dashboard</a>
              </div>
              <p class="footer-legal">
                &copy; ${new Date().getFullYear()} 180 Core Global Sovereign Identity Protocol.<br>
                Recipient: <strong style="color: #71717a;">${cleanEmail}</strong> &bull; Incident Ref: <span style="font-family: monospace;">180-OTP-${refCode}</span><br>
                Protected by End-to-End Cryptographic Authentication Standards.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Dispatches an OTP via SMTP with corporate-grade styling & robust error propagation
   */
  static async sendEmailOtp(options: SendEmailOtpOptions): Promise<{ success: boolean; message: string; messageId?: string }> {
    const { email, otp, purpose = 'verification' } = options;
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Invalid recipient email address' };
    }

    let title = 'Your Verification Code';
    let subtitle = 'Use the 6-digit security code below to complete your authentication.';

    if (purpose === 'signup') {
      title = 'Verify Your 180 Profile';
      subtitle = 'Welcome to 180 Core Sovereign Identity. Enter the 6-digit verification code below to complete your registration.';
    } else if (purpose === 'reset_password') {
      title = 'Reset Your Password';
      subtitle = 'We received an authorized request to reset your 180 Profile password. Enter the code below to proceed.';
    } else if (purpose === 'login') {
      title = '180 Identity Sign-In Code';
      subtitle = 'Use this single-use security code to authenticate your active session.';
    }

    const refCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const html = this.generateEmailHtml(otp, title, subtitle, cleanEmail, refCode);

    const rawFrom = this.sanitizeEnv(process.env.EMAIL_FROM || process.env.SMTP_USER);
    const fromAddress = rawFrom || 'notifications@180core.cloud';

    try {
      const transporter = this.getTransporter();
      const mailOptions = {
        from: `"180 Core Sovereign Identity" <${fromAddress}>`,
        to: cleanEmail,
        subject: `[${otp}] ${title} — 180 Core`,
        text: `${title}\n\nYour 6-digit verification code is: ${otp}\n\nThis security code is single-use and valid for 10 minutes.\nIf you did not initiate this request, you can safely ignore this email.\n\n180 Core Global Platform Security & Compliance\nhttps://180core.cloud`,
        html,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[EmailOtpService] Successfully dispatched OTP email to ${cleanEmail} (Message ID: ${info.messageId})`);

      return {
        success: true,
        message: `Verification code sent to ${cleanEmail}`,
        messageId: info.messageId,
      };
    } catch (err: any) {
      console.error(`[EmailOtpService] Failed to send email to ${cleanEmail}:`, err.message);
      // Invalidate transporter cache in case credentials were bad
      this.transporter = null;
      return {
        success: false,
        message: `SMTP dispatch failed: ${err.message}`,
      };
    }
  }

  /**
   * Helper: Send Signup Verification OTP
   */
  static async sendSignupOtp(email: string, otp: string) {
    return this.sendEmailOtp({ email, otp, purpose: 'signup' });
  }

  /**
   * Helper: Send Password Reset OTP
   */
  static async sendPasswordResetOtp(email: string, otp: string) {
    return this.sendEmailOtp({ email, otp, purpose: 'reset_password' });
  }

  /**
   * Helper: Send Login OTP
   */
  static async sendLoginOtp(email: string, otp: string) {
    return this.sendEmailOtp({ email, otp, purpose: 'login' });
  }

  /**
   * Helper: Send Automated Suspicious Activity Termination Notice
   */
  static async sendSuspiciousActivityTerminationNotice(email: string, userName?: string, reason?: string) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Invalid recipient email' };
    }

    const title = 'Account Termination Notice — Security Policy Enforcement';
    const detail = reason || 'Our automated security monitoring systems detected activity violating 180 Core Platform Terms of Service and security integrity policies.';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #09090b; color: #f4f4f5; margin: 0; padding: 32px 16px; -webkit-font-smoothing: antialiased; }
    .card { max-width: 540px; margin: 0 auto; background: #121215; border: 1px solid rgba(244,63,94,0.3); border-radius: 20px; padding: 36px 28px; box-shadow: 0 16px 40px rgba(0,0,0,0.6); }
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: rgba(244,63,94,0.15); color: #f43f5e; border: 1px solid rgba(244,63,94,0.3); border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 20px; }
    h1 { font-size: 20px; font-weight: 800; color: #ffffff; margin: 0 0 12px; }
    p { color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 0 0 16px; }
    .alert-box { background: rgba(244,63,94,0.08); border: 1px solid rgba(244,63,94,0.25); border-radius: 14px; padding: 18px; margin: 20px 0; color: #fecdd3; font-size: 13px; line-height: 1.6; }
    .footer { text-align: center; color: #71717a; font-size: 11px; margin-top: 28px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 18px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Security Alert</div>
    <h1>Account Terminated & Deleted</h1>
    <p>Dear ${userName || 'User'},</p>
    <p>We are writing to notify you that your 180 Core and Sovereign Developer account associated with <strong>${cleanEmail}</strong> has been terminated and permanently deleted from our platform systems.</p>
    <div class="alert-box">
      <strong>Reason for Termination:</strong><br />
      We detected suspicious activity associated with this account that violates 180 Core platform security, anti-abuse, and operational policies.<br /><br />
      <strong>Incident Summary:</strong> ${detail}
    </div>
    <p>All registered OAuth applications, sovereign developer wallets, and active API credentials have been permanently deleted from platform databases.</p>
    <div class="footer">
      180 Core Global Platform Security & Compliance Team<br />
      https://180core.cloud
    </div>
  </div>
</body>
</html>`;

    const rawFrom = this.sanitizeEnv(process.env.EMAIL_FROM || process.env.SMTP_USER);
    const fromAddress = rawFrom || 'notifications@180core.cloud';

    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: `"180 Core Security" <${fromAddress}>`,
        to: cleanEmail,
        subject: `[URGENT] ${title} — 180 Core`,
        text: `Your 180 Core account has been terminated due to policy violations: ${detail}`,
        html,
      });
      console.log(`[EmailOtpService] Termination notice dispatched to ${cleanEmail}`);
      return { success: true, message: 'Notice sent' };
    } catch (err: any) {
      console.warn(`[EmailOtpService] Failed to dispatch termination email to ${cleanEmail}:`, err.message);
      return { success: false, message: err.message };
    }
  }
}
