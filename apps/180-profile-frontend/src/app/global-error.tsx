'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-[#F8FAFC] text-slate-900 min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white border border-slate-200 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 mx-auto flex items-center justify-center text-xl font-bold">
            !
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Something went wrong</h2>
          <p className="text-xs text-slate-500">
            {error?.message || 'A critical rendering error occurred in 180 Profile.'}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 cursor-pointer transition-colors"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
