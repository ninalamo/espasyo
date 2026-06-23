'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function HeatmapRedirect() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/forecast/${params.id}/overview`);
  }, [params.id, router]);

  return null;
}
