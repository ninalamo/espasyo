'use client';

import { useAuth } from '../app/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function Navbar() {
    const { user, logout } = useAuth();
    const router = useRouter();

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    if (!user) return null; // Hide navbar if not logged in

    return (
        <nav>
            <a href="/home">Home</a>
            <a href="/about">About</a>
            <button onClick={handleLogout}>Logout</button>
        </nav>
    );
}
