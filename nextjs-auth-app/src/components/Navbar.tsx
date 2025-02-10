'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Navbar() {
    const { data: session } = useSession();
    const router = useRouter();

    return (
        <nav className="bg-blue-600 text-white py-4 shadow-md">
            <div className="container mx-auto flex justify-between items-center px-6">
                <h1 className="text-xl font-semibold">Espasyo</h1>
                {session ? (
                    <div className="flex items-center gap-4">
                        <span className="text-sm">{session.user?.name || session.user?.email}</span>
                        <button
                            onClick={() => signOut()}
                            className="bg-red-500 hover:bg-red-700 px-4 py-2 rounded-md transition"
                        >
                            Logout
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => router.push('/login')}
                        className="bg-green-500 hover:bg-green-700 px-4 py-2 rounded-md transition"
                    >
                        Login
                    </button>
                )}
            </div>
        </nav>
    );
}
