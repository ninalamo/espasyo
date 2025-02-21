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
import ScatterPlot from '../../components/ScatterPlot'; // Import the ScatterPlot component
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';

const Map = dynamic(() => import('../../components/Map'), { ssr: false });

const features = ["CrimeType", "Severity", "PoliceDistrict", "Weather", "CrimeMotive"];

const AnalysisPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [clusters, setClusters] = useState<ClusterDto[]>([]);
  const [mapKey, setMapKey] = useState(0); // Add key to force re-render
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(features);
  const [numberOfClusters, setNumberOfClusters] = useState(3);
  const [numberOfRuns, setNumberOfRuns] = useState(1); // New state for number of runs

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const handleFeatureChange = (feature: string) => {
    setSelectedFeatures(prevFeatures =>
      prevFeatures.includes(feature)
        ? prevFeatures.filter(f => f !== feature)
        : [...prevFeatures, feature]
    );
  };

  const handleSelectAll = () => {
    setSelectedFeatures(features);
  };

  const handleFilter = async () => {
    if (!dateFrom || !dateTo) {
      toast.error("Please select both start and end dates.");
      return;
    }

    if (selectedFeatures.length === 0) {
      toast.error("Please select at least one feature.");
      return;
    }

    if (numberOfClusters < 3 || numberOfClusters > 10) {
      toast.error("Number of clusters must be between 3 and 10.");
      return;
    }

    if (numberOfRuns < 1 || numberOfRuns > 10) {
      toast.error("Number of runs must be between 1 and 10.");
      return;
    }

    setLoading(true);
    setClusters([]);  // Clear the clusters
    setMapKey((prevKey) => prevKey + 1); // Force re-render of the Map

    try {
      const response = await apiService.put<ClusterResponse | ErrorDto>(
        "/incident/clusters",
        { dateFrom, dateTo, features: selectedFeatures, numberOfClusters, numberOfRuns }
      );

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

  const formattedData = clusters.map(d => ({
    x: d.latitude,
    y: d.longitude,
    clusterId: d.clusterId
  }));

  const clusterColors = [
    '#FF5733', '#33FF57', '#3357FF', '#F033FF', '#FF33A1',
    '#33FFF7', '#FFA533', '#FF33D1', '#D1FF33', '#33FF85'
  ];

  const clusterCounts = clusters.reduce((acc, cluster) => {
    acc[cluster.clusterId] = (acc[cluster.clusterId] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  return (
    <div className="container mx-auto p-6">
      <ToastContainer />
      <h1 className="text-2xl font-semibold mb-4">Crime Analysis</h1>

      <div className="mb-4 flex flex-col items-end space-y-2">
        <div className="flex space-x-4 items-end">
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

          <div>
            <label htmlFor="numberOfClusters" className="block mb-2">Number of Clusters:</label>
            <input
              type="number"
              id="numberOfClusters"
              value={numberOfClusters}
              onChange={(e) => {
                const value = Math.min(10, Math.max(3, Number(e.target.value)));
                setNumberOfClusters(value);
              }}
              className="border border-gray-300 p-2 rounded-md"
            />
          </div>

          {/* New Number of Runs input */}
          <div>
            <label htmlFor="numberOfRuns" className="block mb-2">Number of Runs:</label>
            <input
              type="number"
              id="numberOfRuns"
              value={numberOfRuns}
              onChange={(e) => {
                const value = Math.min(10, Math.max(1, Number(e.target.value)));
                setNumberOfRuns(value);
              }}
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

        <div className="flex space-x-4 items-center">
          <span>Select Features:</span>
          {features.map(feature => (
            <div key={feature} className="flex items-center">
              <input
                type="checkbox"
                id={feature}
                checked={selectedFeatures.includes(feature)}
                onChange={() => handleFeatureChange(feature)}
                className="mr-2"
              />
              <label htmlFor={feature}>{feature}</label>
            </div>
          ))}
          <button
            onClick={handleSelectAll}
            className="text-blue-600 hover:underline transition h-10"
          >
            Select All
          </button>
        </div>
      </div>

      {clusters.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">Cluster Legend</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[...Array(numberOfClusters)].map((_, index) => (
              <div key={index} className="flex items-center">
                <span className={`w-4 h-4 mr-2 inline-block`} style={{ backgroundColor: clusterColors[index % clusterColors.length] }}></span>
                <span>Cluster {index + 1}: {clusterCounts[index + 1] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <TabGroup>
        <TabList className="flex p-1 space-x-1 bg-blue-900/20 rounded-xl">
          <Tab className={({ selected }) => selected ? 'w-full py-2.5 text-sm font-medium text-blue-700 bg-white rounded-lg' : 'w-full py-2.5 text-sm font-medium text-blue-100 hover:bg-white/[0.12] hover:text-white'}>Map</Tab>
          <Tab className={({ selected }) => selected ? 'w-full py-2.5 text-sm font-medium text-blue-700 bg-white rounded-lg' : 'w-full py-2.5 text-sm font-medium text-blue-100 hover:bg-white/[0.12] hover:text-white'}>Graph</Tab>
        </TabList>
        <TabPanels className="mt-2">
          <TabPanel><Map key={mapKey} center={[14.4081, 121.0415]} zoom={14} clusters={clusters} /></TabPanel>
          <TabPanel><ScatterPlot data={formattedData} /></TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
};

export default withAuth(AnalysisPage);
