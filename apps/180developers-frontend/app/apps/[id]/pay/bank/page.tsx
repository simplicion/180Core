'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function PayBankRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    const id = params?.id || 'default';
    router.replace(`/apps/${id}/pay/payouts?drawer=bank`);
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-2 text-xs text-zinc-500 font-mono">
        <Loader2 className="w-5 h-5 animate-spin text-purple-600 dark:text-purple-400" />
        <span>Redirecting to Settlements &amp; Instant Payouts...</span>
      </div>
    </div>
  );
}
