"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LegacyRiskPeriodsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/forecast/new");
  }, [router]);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <p role="status" className="text-sm text-gray-600">
        Risk period summaries are now part of the Forecast workflow. Redirecting…
      </p>
      <Link href="/forecast/new" className="mt-3 inline-block text-sm font-medium text-indigo-700 hover:text-indigo-900">
        Continue to Forecast
      </Link>
    </main>
  );
}
