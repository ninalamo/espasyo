'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { User, ChevronDown } from 'lucide-react'; // Import caret icon
import Link from 'next/link';


export default function Navbar() {
    const { data: session } = useSession(); // session is typed automatically by NextAuth | https://next-auth.js.org/getting-started/client#usesession
    const router = useRouter();
    const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
    const dropdownRef = useRef<HTMLDivElement | null>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <nav className="bg-blue-600 text-white py-4 shadow-md">
            <div className="container mx-auto flex justify-between items-center px-6">
                <h1 className="text-xl font-semibold">Crime Reporting Tool</h1>

                <div className="flex items-center gap-6">
                    {/* Navigation Links */}
                    <Link href="/" className="hover:underline">
                        Home
                    </Link>
                    <Link href="/crime-record" className="hover:underline">
                        Crime Records
                    </Link>

                    {session && (
                        <div className="relative" ref={dropdownRef}>
                            {/* User Dropdown Toggle */}
                            <div
                                className="flex items-center gap-2 cursor-pointer"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            >
                                <span>{session.user?.name || session.user?.email}</span>
                                <User className="w-5 h-5" />
                                <ChevronDown className="w-4 h-4" /> {/* Caret Icon */}
                            </div>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                                <div className="absolute right-0 mt-2 bg-white text-gray-900 rounded-md shadow-lg py-2 w-40">
                                    <button
                                        onClick={() => signOut()}
                                        className="block w-full text-left px-4 py-2 hover:bg-gray-200"
                                    >
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {!session && (
                        <button
                            onClick={() => router.push('/login')}
                            className="bg-green-500 hover:bg-green-700 px-4 py-2 rounded-md transition"
                        >
                            Login
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
}
