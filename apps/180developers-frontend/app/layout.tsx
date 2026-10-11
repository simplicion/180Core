import React from 'react';
import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import PortalShell from '../components/layout/PortalShell';
import './globals.css';

export const metadata: Metadata = {
  title: '180 Developers | Universal Identity & OAuth 2.0 API',
  description:
    'Integrate 180 Identity into your web apps, mobile apps, and APIs. Universal 1-tap WhatsApp OTP, Google sign-in, RS256 JWKS tokens, and RFC 7636 PKCE.',
  icons: {
    icon: '/black-icon.svg',
    shortcut: '/black-icon.svg',
    apple: '/black-icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/black-icon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,300,400&display=swap"
          rel="stylesheet"
        />

        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('180_theme');
                if (!theme) {
                  theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
      </head>
      <body className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 min-h-screen flex flex-col selection:bg-blue-600 selection:text-white antialiased transition-colors duration-200">
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'text-sm font-medium border border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 text-zinc-900 dark:text-zinc-100 shadow-xl backdrop-blur-md rounded-2xl',
            duration: 4000,
          }}
        />
        <PortalShell>{children}</PortalShell>
      </body>
    </html>
  );
}
