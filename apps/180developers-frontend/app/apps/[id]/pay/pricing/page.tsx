'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/context/ProjectContext';

export default function PayPricingPage() {
  const router = useRouter();
  const { projectId } = useProject();

  useEffect(() => {
    if (projectId && projectId !== 'default') {
      router.replace(`/apps/${projectId}/pay`);
    }
  }, [projectId, router]);

  return null;
}
