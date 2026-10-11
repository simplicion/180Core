import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';
import '@/lib/api';

export const metadata: Metadata = {
  title: '180 Profile — Universal Identity, Security & Wallet',
  description: 'Manage your unified 180 Profile, prepaid wallet balance, top-ups, and developer authorizations.',
  icons: {
    icon: [
      { url: '/black-icon.svg', media: '(prefers-color-scheme: light)' },
      { url: '/white-icon.svg', media: '(prefers-color-scheme: dark)' },
      { url: '/black-icon.svg' },
    ],
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
    <html lang="en">
      <head>
        <link rel="icon" href="/black-icon.svg" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/white-icon.svg" media="(prefers-color-scheme: dark)" />
        <link rel="apple-touch-icon" href="/black-icon.svg" />
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,300,400&display=swap"
          rel="stylesheet"
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
      </body>
    </html>
  );
}
