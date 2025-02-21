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
import { clusterColorsMapping } from '../../types/ClusterColorsMapping';
import QueryBar from './QueryBar';

const Map = dynamic(() => import('../../components/Map'), { ssr: false });

const features = ["CrimeType", "Severity", "PoliceDistrict", "Weather", "CrimeMotive"];

const AnalysisPage = () => {
  const { status } = useSession();
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [clusters, setClusters] = useState<ClusterDto[]>([]);
  const [mapKey, setMapKey] = useState(0); // Add key to force re-render
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(features);
  const [selectedFeature, setSelectedFeature] = useState<string>(features[0]); // Default to first feature

  const [numberOfClusters, setNumberOfClusters] = useState(3);
  const [numberOfRuns, setNumberOfRuns] = useState(1); // New state for number of runs

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);



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


  const clusterCounts = clusters.reduce((acc, cluster) => {
    acc[cluster.clusterId] = (acc[cluster.clusterId] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  return (
    <div className="container mx-auto p-6">
      <ToastContainer />
      <h1 className="text-2xl font-semibold mb-4">Crime Analysis</h1>

      <QueryBar
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
        numberOfClusters={numberOfClusters} setNumberOfClusters={setNumberOfClusters}
        numberOfRuns={numberOfRuns} setNumberOfRuns={setNumberOfRuns}
        selectedFeature={selectedFeature} setSelectedFeature={setSelectedFeature}
        loading={loading}
        handleFilter={handleFilter}
      />

      {/* Cluster Id Legend */}
      {clusters.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">Cluster Legend</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[...Array(numberOfClusters)].map((_, index) => {
              const clusterId = index + 1;
              return (
                <div key={clusterId} className="flex items-center">
                  <span
                    className="w-4 h-4 mr-2 inline-block"
                    style={{ backgroundColor: clusterColorsMapping[clusterId] || '#D3D3D3' }}
                  ></span>
                  <span>Cluster {clusterId}: {clusterCounts[clusterId] || 0}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <TabGroup>
        <TabList className="flex p-1 space-x-1 bg-blue-900/20 rounded-xl">
          <Tab className={({ selected }) => selected ? 'w-full py-2.5 text-sm font-medium text-blue-700 bg-white rounded-lg' : 'w-full py-2.5 text-sm font-medium text-blue-100 hover:bg-white/[0.12] hover:text-white'}>Map</Tab>
          <Tab className={({ selected }) => selected ? 'w-full py-2.5 text-sm font-medium text-blue-700 bg-white rounded-lg' : 'w-full py-2.5 text-sm font-medium text-blue-100 hover:bg-white/[0.12] hover:text-white'}>Graph</Tab>
        </TabList>
        <TabPanels className="mt-2">
          <TabPanel><Map key={mapKey} center={[14.4081, 121.0415]} zoom={14} clusters={clusters} clusterColorsMapping={clusterColorsMapping} /></TabPanel>
          <TabPanel>
            <ScatterPlot data={clusters.map(d => ({
              x: d.longitude,
              y: d.latitude,
              clusterId: d.clusterId
            }))} clusterColorsMapping={clusterColorsMapping} /></TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
};

export default withAuth(AnalysisPage);
