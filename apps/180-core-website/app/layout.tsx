import React from 'react';
import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SITE_URL } from '@/lib/urls';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '180 Core | Sovereign Identity, KYC Verification & Global Payments',
    template: '%s | 180 Core',
  },
  description:
    'Enterprise-grade sovereign identity (OIDC / WebAuthn / WhatsApp OTP), 180 Verify government & AI biometric KYC, and 180 Pay dual-gateway Razorpay + Stripe checkout.',
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: '180 Core',
    title: '180 Core | Sovereign Identity, KYC Verification & Global Payments',
    description:
      'Zero-custom-screen identity, trustless citizen KYC, and global multi-currency payments for web and mobile applications.',
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: '180 Core' }],
  },
  icons: {
    icon: [
      { url: '/180-core-icon.png', media: '(prefers-color-scheme: light)' },
      { url: '/180-core-icon-dark.png', media: '(prefers-color-scheme: dark)' },
      { url: '/favicon-32x32.png' },
    ],
    apple: '/icon-192.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Optimized Non-Render-Blocking Webfonts */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link
          rel="preload"
          as="style"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,400,300&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,400,300&display=swap"
          media="print"
          // @ts-ignore
          onLoad="this.media='all'"
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,400,300&display=swap"
          />
        </noscript>
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          media="print"
          // @ts-ignore
          onLoad="this.media='all'"
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          />
        </noscript>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var userSet = localStorage.getItem('180_theme_user_set');
                var theme = localStorage.getItem('180_theme');
                if (!userSet) {
                  theme = 'light';
                  localStorage.setItem('180_theme', 'light');
                }
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
        {/* 180workspace Traffic Director - Dynamic Script Tag */}
        <script src="https://www.180trafficdirector.pro/tag/180core.js" async />
      </head>
      <body className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 min-h-screen flex flex-col selection:bg-blue-600 selection:text-white antialiased">
        <Toaster
          position="top-right"
          toastOptions={{
            className:
              'text-sm font-medium border border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 text-zinc-900 dark:text-zinc-100 shadow-xl backdrop-blur-md rounded-2xl',
            duration: 4000,
          }}
        />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
