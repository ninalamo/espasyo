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
import { ClusterDto, ClusterResponse } from '../analysis/ClusterDto';
import { ErrorDto } from '../../types/ErrorDto';

const Map = dynamic(() => import('../../components/Map'), { ssr: false });

const AnalysisPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [clusters, setClusters] = useState<ClusterDto[]>([]);
  const [mapKey, setMapKey] = useState(0); // Add key to force re-render

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-screen text-gray-700">Loading...</div>;
  }

  if (!session) return null;

  const handleFilter = async () => {
    if (!dateFrom || !dateTo) {
      toast.error("Please select both start and end dates.");
      return;
    }

    setLoading(true);
    setClusters([]);  // Clear the clusters
    setMapKey((prevKey) => prevKey + 1); // Force re-render of the Map

    try {
      const response = await apiService.put<ClusterResponse | ErrorDto>("/incident/clusters", { dateFrom, dateTo });

      if ("message" in response) {
        toast.error(response.message);
      } else {
        console.log("Cluster data:", response);
        setClusters(response.result);
        toast.success("Clusters generated successfully!");
      }
    } catch (err: any) {
      toast.error(`Failed to generate clusters. ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <ToastContainer />
      <h1 className="text-2xl font-semibold mb-4">Crime Analysis</h1>

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

      <div className="mt-6">
        <Map key={mapKey} center={[14.4081, 121.0415]} zoom={14} clusters={clusters} />
      </div>
    </div>
  );
};

export default withAuth(AnalysisPage);
