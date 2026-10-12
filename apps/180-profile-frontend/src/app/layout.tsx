import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { FloatingSupportWidget } from '@workspace/ui';
import './globals.css';
import '@/lib/api';

export const metadata: Metadata = {
  title: '180 Profile — Universal Identity, Security & Wallet',
  description: 'Manage your unified 180 Profile, prepaid wallet balance, top-ups, and developer authorizations.',
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
    <html lang="en">
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
      <body className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-blue-500/20 selection:text-blue-950">
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.06)',
            },
          }}
        />
        {children}
        <FloatingSupportWidget backendUrl="http://localhost:4003" />
      </body>
    </html>
  );
}
