'use client';

import AuthWrapper from "../components/AuthWrapper";
import { signOut, useSession } from 'next-auth/react';

export default function Home() {
    const { data: session } = useSession();

    return (
        <AuthWrapper>
            <div className="p-6">
                <h1>Welcome, {session?.user?.name}!</h1>
                <button onClick={() => signOut()} className="bg-red-600 text-white px-4 py-2 rounded-md">
                    Logout
                </button>
            </div>
        </AuthWrapper>
    );
}
