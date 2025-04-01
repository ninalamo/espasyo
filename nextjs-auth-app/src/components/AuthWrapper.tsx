'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Define the type for the component props
interface AuthWrapperProps {
    children: React.ReactNode; // This ensures that the 'children' prop can be any valid React child
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    if (status === 'loading') return <p>Loading...</p>;
    if (!session) return null;

    return <>{children}</>;
}
