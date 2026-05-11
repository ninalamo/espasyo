'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ForecastIdRedirect() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/forecast/${params.id}/summary`);
  }, [params.id, router]);

  return null;
}
