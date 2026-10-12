'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function PayGeoPricingPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  useEffect(() => {
    if (id) {
      router.replace(`/apps/${id}/pay/pricing`);
    }
  }, [id, router]);

  return null;
}
