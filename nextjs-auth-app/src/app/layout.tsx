'use client';

import { SessionProvider } from 'next-auth/react';
import '../app/globals.css';
import DashboardLayout from '../components/DashboardLayout';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-100 text-gray-900">
        <SessionProvider>
          {isLoginPage ? (
            // Login page with simple layout
            <main className="min-h-screen flex items-center justify-center">
              {children}
            </main>
          ) : (
            // All other pages with dashboard layout
            <DashboardLayout>
              {children}
            </DashboardLayout>
          )}
        </SessionProvider>
      </body>
    </html>
  );
}
