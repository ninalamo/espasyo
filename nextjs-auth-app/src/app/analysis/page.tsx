// analysis.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import withAuth from '../hoc/withAuth';
import dynamic from 'next/dynamic';

const Map = dynamic(() => import('../../components/Map'), {
  ssr: false // This ensures that the map component only renders on the client side
});

const AnalysisPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Redirect to login if the user is not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-screen text-gray-700">Loading...</div>;
  }

  if (!session) {
    return null;
  }

  // Handle form submission for filtering
  const handleFilter = () => {
    // Placeholder for filter logic
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Crime Analysis</h1>

      {/* Date Range Selection and Filter Button */}
      <div className="mb-4 flex justify-end space-x-4 items-end">
        <div>
          <label htmlFor="startDate" className="block mb-2">Start Date:</label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-300 p-2 rounded-md"
          />
        </div>

        <div>
          <label htmlFor="endDate" className="block mb-2">End Date:</label>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-300 p-2 rounded-md"
          />
        </div>

        <button
          onClick={handleFilter}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition h-10"
        >
          Generate Cluster
        </button>
      </div>

      {/* Map centered on Muntinlupa City */}
      <div className="mt-6">
        <Map center={[14.4081, 121.0415]} zoom={14} />
      </div>
    </div>
  );
};

export default withAuth(AnalysisPage);
