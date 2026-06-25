'use client';

import { SessionProvider } from 'next-auth/react';
import DashboardLayout from '../components/DashboardLayout';
import { usePathname } from 'next/navigation';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <SessionProvider>
      {isLoginPage ? (
        <main className="min-h-screen flex items-center justify-center">
          {children}
        </main>
      ) : (
        <DashboardLayout>
          {children}
        </DashboardLayout>
      )}
    </SessionProvider>
  );
}
