'use client';

import { SessionProvider } from 'next-auth/react';
import '../app/globals.css';
import Navbar from '../components/Navbar';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import AuthListener from '../components/AuthListener';

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const pathname = usePathname();
  const showNavbar = pathname !== '/login';

  return (
    <html lang="en">
      <body className="bg-gray-100 text-gray-900">
        
        <SessionProvider>
          <AuthListener/>
          {showNavbar && <Navbar />}
          <main className="container mx-auto p-6">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
