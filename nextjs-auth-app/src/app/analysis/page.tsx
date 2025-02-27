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
import { ClusterGroupResponse, Cluster } from '../../types/analysis/ClusterDto';
import { ErrorDto } from '../../types/ErrorDto';
import ScatterPlot from '../../components/ScatterPlot'; // Import the ScatterPlot component
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { clusterColorsMapping } from '../../types/ClusterColorsMapping';
import QueryBar from './QueryBar';
import FilterSection from './FilterSection';

const Map = dynamic(() => import('../../components/Map'), { ssr: false });

const AnalysisPage = () => {
  const { status } = useSession();
  const router = useRouter();
  const [dateTo, setDateTo] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 12), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  // clusters is assumed to be an array of ClusterGroup objects.
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [mapKey, setMapKey] = useState(0); // Force re-render of the Map
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  const [numberOfClusters, setNumberOfClusters] = useState(3);
  const [numberOfRuns, setNumberOfRuns] = useState(1);

  const [selectedCrimeTypes, setSelectedCrimeTypes] = useState<string[]>([]);
  const [selectedMotives, setSelectedMotives] = useState<string[]>([]);
  const [selectedPrecincts, setSelectedPrecincts] = useState<string[]>([]);
  const [selectedWeathers, setSelectedWeathers] = useState<string[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<string[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const handleFilter = async () => {
    console.log("Selected features:", selectedFeatures);

    if (!dateFrom || !dateTo) {
      toast.error("Please select both start and end dates.");
      return;
    }

    if (!selectedFeatures || selectedFeatures.length === 0) {
      toast.error("Please select a feature.");
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
      const payload = {
        dateFrom,
        dateTo,
        features: selectedFeatures,
        numberOfClusters,
        numberOfRuns,
        filters: {
          crimeTypes: selectedCrimeTypes,
          motives: selectedMotives,
          severities: selectedSeverities,
          weathers: selectedWeathers,
          precincts: selectedPrecincts
        }
      };

      console.log("Payload:", payload);

      const response = await apiService.put<ClusterGroupResponse | ErrorDto>(
        "/incident/grouped-clusters", payload
      );

      if ("message" in response) {
        toast.error(response.message);
      } else {
        console.log("Cluster data:", response);
        setClusters(response.clusterGroups);
        toast.success("Clusters generated successfully!");
      }
    } catch (err: any) {
      toast.error(`Failed to generate clusters. ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Prepare data for the ScatterPlot (flatten cluster items).
  const scatterData = clusters.flatMap(cluster =>
    cluster.clusterItems.map(item => ({
      x: Number(item.longitude.toFixed(6)),
      y: Number(item.latitude.toFixed(6)),
      clusterId: cluster.clusterId
    }))
  );

  // Prepare centroid data for ScatterPlot.
  const centroidData = clusters
    .filter(cluster => cluster.centroids && cluster.centroids.length === 2)
    .map(cluster => ({
      clusterId: cluster.clusterId,
      x: cluster.centroids[1], // assuming centroid is [lat, lon] => x = lon, y = lat
      y: cluster.centroids[0]
    }));

  // For the table, flatten all cluster items and include the cluster id.
  const tableData = clusters.flatMap(cluster =>
    cluster.clusterItems.map(item => ({
      clusterId: cluster.clusterId,
      caseId: item.caseId,
      latitude: item.latitude,
      longitude: item.longitude
    }))
  );

  // Function to convert tableData to CSV and trigger download.
  const downloadCSV = () => {
    const headers = ["Cluster ID", "Case ID", "Latitude", "Longitude"];
    const rows = tableData.map(item => `${item.clusterId},${item.caseId},${item.latitude},${item.longitude}`);
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "cluster_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="container mx-auto p-6">
      <ToastContainer />
      <h1 className="text-2xl font-semibold mb-4">Crime Analysis</h1>

      <QueryBar
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
        numberOfClusters={numberOfClusters} setNumberOfClusters={setNumberOfClusters}
        numberOfRuns={numberOfRuns} setNumberOfRuns={setNumberOfRuns}
        selectedFeatures={selectedFeatures} setSelectedFeatures={setSelectedFeatures}
        loading={loading}
        handleFilter={handleFilter}
      />

      {/* Filters */}
      <FilterSection
        selectedCrimeTypes={selectedCrimeTypes} setSelectedCrimeTypes={setSelectedCrimeTypes}
        selectedPrecinct={selectedPrecincts} setSelectedPrecinct={setSelectedPrecincts}
        selectedSeverity={selectedSeverities} setSelectedSeverity={setSelectedSeverities}
        selectedWeather={selectedWeathers} setSelectedWeather={setSelectedWeathers}
        selectedMotive={selectedMotives} setSelectedMotive={setSelectedMotives} />

      {/* Cluster Legend */}
      {clusters.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">Cluster Legend</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {clusters.map((c) => {
              const clusterId = c.clusterId;
              return (
                <div key={c.clusterId} className="flex items-center">
                  <span
                    className="w-4 h-4 mr-2 inline-block"
                    style={{ backgroundColor: clusterColorsMapping[c.clusterId] || '#D3D3D3' }}
                  ></span>
                  <span>Cluster {clusterId}: {c.clusterCount || 0}</span>
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
          <Tab className={({ selected }) => selected ? 'w-full py-2.5 text-sm font-medium text-blue-700 bg-white rounded-lg' : 'w-full py-2.5 text-sm font-medium text-blue-100 hover:bg-white/[0.12] hover:text-white'}>Table</Tab>
        </TabList>
        <TabPanels className="mt-2">
          <TabPanel>
            <Map key={mapKey} center={[14.4081, 121.0415]} zoom={14} clusters={clusters} clusterColorsMapping={clusterColorsMapping} />
          </TabPanel>
          <TabPanel>
            <ScatterPlot
              data={scatterData}
              clusterColorsMapping={clusterColorsMapping}
            />
          </TabPanel>
          <TabPanel>
            <div className="flex justify-end mb-2">
              <button onClick={downloadCSV} className="bg-green-600 text-white px-4 py-2 rounded-md">Download CSV</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full table-auto border-collapse border border-gray-300">
                <thead>
                  <tr>
                    <th className="px-4 py-2 border border-gray-300">Cluster ID</th>
                    <th className="px-4 py-2 border border-gray-300">Case ID</th>
                    <th className="px-4 py-2 border border-gray-300">Latitude</th>
                    <th className="px-4 py-2 border border-gray-300">Longitude</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map(item => (
                    <tr key={`${item.clusterId}_${item.caseId}`}>
                      <td className="px-4 py-2 border border-gray-300">{item.clusterId}</td>
                      <td className="px-4 py-2 border border-gray-300">{item.caseId}</td>
                      <td className="px-4 py-2 border border-gray-300">{item.latitude}</td>
                      <td className="px-4 py-2 border border-gray-300">{item.longitude}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
};

export default withAuth(AnalysisPage);
