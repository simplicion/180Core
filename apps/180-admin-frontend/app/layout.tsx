import React from 'react';
import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import AdminShellLayout from '../components/layout/AdminShellLayout';
import './globals.css';

export const metadata: Metadata = {
  title: '180 Core Super Admin | Global Control Center',
  description:
    'Universal governance panel for 180 Core: Developer Directory, Active App Fleet, Multi-Currency 180 Pay Treasury, Settlement & Payout Desk, and Live Support Bug Tracker.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,400,300&display=swap"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('180_theme');
                if (theme === 'light') {
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className="bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 min-h-screen antialiased selection:bg-blue-600 selection:text-white">
        <Toaster
          position="top-right"
          toastOptions={{
            className:
              'text-xs font-medium border border-zinc-200 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 text-zinc-900 dark:text-zinc-100 shadow-xl backdrop-blur-md rounded-2xl',
            duration: 4000,
          }}
        />
        <AdminShellLayout>{children}</AdminShellLayout>
      </body>
    </html>
  );
}
