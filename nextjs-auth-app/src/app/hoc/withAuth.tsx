// src/hoc/withAuth.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';

interface WithAuthProps {
  children: ReactNode;
}

const withAuth = <P extends WithAuthProps>(WrappedComponent: React.ComponentType<P>) => {
  return function WithAuth(props: P) {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
      if (status === 'unauthenticated') {
        router.push('/login'); // Redirect to login page if unauthenticated
      }
    }, [status, router]);

    if (status === 'loading') {
      return <div className="flex items-center justify-center min-h-screen text-gray-700">Loading...</div>;
    }

    if (!session) {
      return null; // Prevent rendering while redirecting
    }

    return <WrappedComponent {...props} />;
  };
};

export default withAuth;
