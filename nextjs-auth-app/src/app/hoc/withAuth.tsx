// src/hoc/withAuth.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';

interface WithAuthProps {
  children: ReactNode;
}

const withAuth = <P extends object>(WrappedComponent: React.ComponentType<P>) => {
  // This HOC takes in a component, and ensures the user is authenticated before rendering it
  return function WithAuth(props: P) {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
      if (status === 'unauthenticated') {
        router.push('/login'); // Redirect to login page if unauthenticated
      }
    }, [status, router]);

    if (status === 'loading') {
      // Render loading state until the session status is determined
      return <div className="flex items-center justify-center min-h-screen text-gray-700">Loading...</div>;
    }

    if (!session) {
      // Return null to prevent rendering while redirecting
      return null;
    }

    // Render the wrapped component if the user is authenticated
    return <WrappedComponent {...props} />;
  };
};

export default withAuth;
