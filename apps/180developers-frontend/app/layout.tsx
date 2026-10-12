import React from 'react';
import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { FloatingSupportWidget } from '@workspace/ui';
import PortalShell from '../components/layout/PortalShell';
import './globals.css';

export const metadata: Metadata = {
  title: '180 Developers | Universal Identity & OAuth 2.0 API',
  description:
    'Integrate 180 Identity into your web apps, mobile apps, and APIs. Universal 1-tap WhatsApp OTP, Google sign-in, RS256 JWKS tokens, and RFC 7636 PKCE.',
  icons: {
    icon: [
      { url: '/180-core-icon.png', media: '(prefers-color-scheme: light)' },
      { url: '/180-core-icon-dark.png', media: '(prefers-color-scheme: dark)' },
      { url: '/180-core-icon.png' },
    ],
    shortcut: '/180-core-icon.png',
    apple: '/180-core-icon.png',
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
        <link rel="icon" href="/180-core-icon.png" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/180-core-icon-dark.png" media="(prefers-color-scheme: dark)" />
        <link rel="apple-touch-icon" href="/180-core-icon.png" />
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

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window === 'undefined') return;
                var KEY = '__180_chunk_auto_heal__';
                function heal() {
                  var last = parseInt(sessionStorage.getItem(KEY) || '0', 10);
                  if (Date.now() - last > 8000) {
                    sessionStorage.setItem(KEY, Date.now().toString());
                    window.location.reload();
                  }
                }
                window.addEventListener('error', function(e) {
                  var t = e.target;
                  if (t && t.tagName === 'SCRIPT' && t.src && (t.src.indexOf('/_next/') !== -1 || t.src.indexOf('main-app.js') !== -1)) {
                    heal();
                  } else if (e.message && (e.message.indexOf('Loading chunk') !== -1 || e.message.indexOf('ChunkLoadError') !== -1)) {
                    heal();
                  }
                }, true);
                window.addEventListener('unhandledrejection', function(e) {
                  var reason = e.reason && (e.reason.message || e.reason.name || '');
                  if (typeof reason === 'string' && (reason.indexOf('ChunkLoadError') !== -1 || reason.indexOf('Loading chunk') !== -1)) {
                    heal();
                  }
                });
              })();
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
        <FloatingSupportWidget backendUrl="http://localhost:4003" />
      </body>
    </html>
  );
}
