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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Ubuntu:wght@300;400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-ubuntu bg-ubuntu-50 text-gray-900">
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
