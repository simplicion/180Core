'use strict';

import nodemailer from 'nodemailer';

export interface SendEmailOtpOptions {
  email: string;
  otp: string;
  purpose?: 'signup' | 'reset_password' | 'login' | 'verification';
  userName?: string;
}

export class EmailOtpService {
  private static transporter: nodemailer.Transporter | null = null;

  /**
   * Initializes or returns the cached SMTP Nodemailer transporter
   */
  private static getTransporter(): nodemailer.Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

    if (!user || !pass) {
      console.warn('[EmailOtpService] SMTP_USER or SMTP_PASS not set in environment. Outbound emails may fail.');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    return this.transporter;
  }

  /**
   * Generates a beautifully styled, high-converting HTML email template
   */
  private static generateEmailHtml(otp: string, title: string, subtitle: string, note?: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f8fafc;
      padding: 40px 16px;
    }
    .main-table {
      max-width: 520px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
    }
    .header {
      padding: 32px 32px 24px 32px;
      text-align: center;
      border-bottom: 1px solid #f1f5f9;
    }
    .logo-badge {
      display: inline-block;
      width: 44px;
      height: 44px;
      background-color: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 12px;
      line-height: 44px;
      text-align: center;
      font-size: 22px;
      margin-bottom: 12px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.02em;
      margin: 0;
    }
    .brand-title span {
      color: #2563eb;
    }
    .content {
      padding: 32px 32px 24px 32px;
      text-align: center;
    }
    .headline {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 8px;
    }
    .description {
      font-size: 13.5px;
      color: #64748b;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .otp-box {
      display: inline-block;
      background: #eff6ff;
      border: 1.5px solid #bfdbfe;
      border-radius: 12px;
      padding: 16px 36px;
      margin: 0 auto 24px auto;
      letter-spacing: 8px;
      font-size: 32px;
      font-weight: 800;
      color: #1d4ed8;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .expiry-tag {
      display: inline-block;
      font-size: 11.5px;
      font-weight: 600;
      color: #b45309;
      background-color: #fef3c7;
      border: 1px solid #fde68a;
      border-radius: 20px;
      padding: 4px 12px;
      margin-bottom: 24px;
    }
    .security-notice {
      text-align: left;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 16px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.4;
      margin-bottom: 8px;
    }
    .footer {
      padding: 20px 32px 28px 32px;
      text-align: center;
      border-top: 1px solid #f1f5f9;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main-table" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td class="header">
          <div class="logo-badge">🛡️</div>
          <div class="brand-title"><span>180</span> Profile</div>
        </td>
      </tr>
      <tr>
        <td class="content">
          <h1 class="headline">${title}</h1>
          <p class="description">${subtitle}</p>
          
          <div class="otp-box">${otp}</div>
          <br>
          <div class="expiry-tag">⏱️ Valid for 10 minutes</div>
          
          <div class="security-notice">
            <strong>Security Notice:</strong> Never share this verification code with anyone. 180 Workspace personnel will never ask for your code. If you did not initiate this request, you can safely ignore this email.
          </div>
        </td>
      </tr>
      <tr>
        <td class="footer">
          &copy; ${new Date().getFullYear()} 180 Workspace &amp; 180 Profile Sovereign Identity System.<br>
          Protected by End-to-End Cryptographic Ledger Protocol.
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
    `;
  }

  /**
   * Dispatches an OTP via SMTP
   */
  static async sendEmailOtp(options: SendEmailOtpOptions): Promise<{ success: boolean; message: string; messageId?: string }> {
    const { email, otp, purpose = 'verification' } = options;
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Invalid recipient email address' };
    }

    let title = 'Your Verification Code';
    let subtitle = 'Use the 6-digit code below to verify your email address.';

    if (purpose === 'signup') {
      title = 'Verify Your 180 Profile';
      subtitle = 'Welcome to 180 Sovereign Identity. Use the code below to complete your registration.';
    } else if (purpose === 'reset_password') {
      title = 'Reset Your Password';
      subtitle = 'We received a request to reset your 180 Profile password. Use the code below to proceed.';
    } else if (purpose === 'login') {
      title = '180 Identity Sign-In Code';
      subtitle = 'Use this one-time security code to authenticate your session.';
    }

    const html = this.generateEmailHtml(otp, title, subtitle);
    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@180workspace.com';

    try {
      const transporter = this.getTransporter();
      const mailOptions = {
        from: `"180 Profile" <${fromAddress}>`,
        to: cleanEmail,
        subject: `[${otp}] ${title} — 180 Profile`,
        text: `${title}\n\nYour 6-digit verification code is: ${otp}\n\nThis code expires in 10 minutes.\nIf you did not request this, please ignore this email.`,
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
      return {
        success: false,
        message: `SMTP send failed: ${err.message}`,
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
}
