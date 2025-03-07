'use client';

import { signOut, useSession } from 'next-auth/react';
import withAuth from './hoc/withAuth';

const Home = () => {
  const { data: session } = useSession();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-gray-900">
      <div className="bg-white shadow-md rounded-lg p-6 w-full max-w-md">
        <h1 className="text-2xl font-semibold text-center mb-4">
          Welcome, {session?.user?.name || session?.user?.email}!
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

export default withAuth(Home);
