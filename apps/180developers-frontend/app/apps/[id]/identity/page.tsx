'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function IdentityIndexRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    if (params?.id) {
      router.replace(`/apps/${params.id}/identity/users`);
    }
  }, [params?.id, router]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
