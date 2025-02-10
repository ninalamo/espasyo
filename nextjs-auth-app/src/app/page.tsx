'use client';

import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import withAuth from './hoc/withAuth'; // Assuming HOC withAuth is also typed

// Define the types for the session (if not already inferred by next-auth)
interface User {
    id: string;
    username?: string;
    email: string;
    token: string;
}

interface Session {
    user?: User;
    expires: string;
}

// Define component props if needed
const Home = () => {
    const { data: session, status } = useSession<Session>(); // Type the session with your custom Session interface
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
        return null; // Avoid rendering anything while redirecting
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-gray-900">
            <div className="bg-white shadow-md rounded-lg p-6 w-full max-w-md">
                <h1 className="text-2xl font-semibold text-center mb-4">
                    Welcome, {session.user?.username || session.user?.email}!
                </h1>
                <div>Session: {JSON.stringify(session, null, 2)}</div>

                <button
                    onClick={() => signOut()}
                    className="w-full bg-red-600 text-white py-2 rounded-md hover:bg-red-700 transition"
                >
                    Logout
                </button>
            </div>
        </div>
    );
};

// Wrapping the component with the withAuth HOC to enforce authentication
export default withAuth(Home);
