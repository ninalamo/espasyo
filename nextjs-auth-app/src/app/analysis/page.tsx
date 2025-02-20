'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import withAuth from '../hoc/withAuth';
import dynamic from 'next/dynamic';
import { apiService } from '../api/utils/apiService';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { format, subMonths, subDays } from 'date-fns';

const Map = dynamic(() => import('../../components/Map'), {
  ssr: false // This ensures that the map component only renders on the client side
});

const AnalysisPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const handleFilter = async () => {
    if (!dateFrom || !dateTo) {
      setError("Please select both start and end dates.");
      toast.error("Please select both start and end dates.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiService.put("/incident/clusters", {
        dateFrom,
        dateTo
      });

      console.log("Cluster data:", response);
      toast.success("Success");
      // Handle response (e.g., update state, refresh map data)
    } catch (err) {
      if (err.response && err.response.status === 400) {
        const errorMessage = err.response.data.message || "Failed to generate clusters. Please try again.";
        setError(errorMessage);
        toast.error(errorMessage);
      } else {
        setError("Failed to generate clusters. Please try again.");
        toast.error("Failed to generate clusters. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <ToastContainer />
      <h1 className="text-2xl font-semibold mb-4">Crime Analysis</h1>

      {/* Error Message */}
      {error && <div className="text-red-600 mb-4">{error}</div>}

      {/* Date Range Selection and Filter Button */}
      <div className="mb-4 flex justify-end space-x-4 items-end">
        <div>
          <label htmlFor="dateFrom" className="block mb-2">Start Date:</label>
          <input
            type="date"
            id="dateFrom"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 p-2 rounded-md"
          />
        </div>

        <div>
          <label htmlFor="dateTo" className="block mb-2">End Date:</label>
          <input
            type="date"
            id="dateTo"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 p-2 rounded-md"
          />
        </div>

        <button
          onClick={handleFilter}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition h-10"
          disabled={loading}
        >
          {loading ? "Generating..." : "Generate Cluster"}
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
