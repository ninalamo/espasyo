'use client';

import { useCallback, useMemo, useState } from 'react';
import withAuth from '../../components/hoc/withAuth';
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
import FilterSection, { FilterState, initialFilterState } from './FilterSection';

const Map = dynamic(() => import('../../components/Map'), { ssr: false });

const AnalysisPage = () => {

  const [dateTo, setDateTo] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 12), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [mapKey, setMapKey] = useState(0);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);

  const [numberOfClusters, setNumberOfClusters] = useState(3);
  const [numberOfRuns, setNumberOfRuns] = useState(1);

  // Lifted filter state from FilterSection
  const [parentFilterState, setParentFilterState] = useState<FilterState>(initialFilterState);

  const handleFilter = useCallback(async () => {
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
    setClusters([]); // Clear clusters
    setMapKey((prevKey) => prevKey + 1); // Force re-render of the Map

    try {
      const payload = {
        dateFrom,
        dateTo,
        features: selectedFeatures,
        numberOfClusters,
        numberOfRuns,
        filters: {
          crimeTypes: parentFilterState.selectedCrimeTypes,
          motives: parentFilterState.selectedMotive,
          severities: parentFilterState.selectedSeverity,
          weathers: parentFilterState.selectedWeather,
          precincts: parentFilterState.selectedPrecinct,
        },
      };

      console.log("Payload:", payload);
      const response = await apiService.put<ClusterGroupResponse | ErrorDto>(
        "/incident/grouped-clusters", payload
      );

      if ("message" in response) {
        toast.error(response.message);
      } else {
        setClusters(response.clusterGroups);
        toast.success("Clusters generated successfully!");
      }
    } catch (err: any) {
      toast.error(`Failed to generate clusters. ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedFeatures, numberOfClusters, numberOfRuns, parentFilterState]);

  // Prepare data for ScatterPlot.
  const scatterData = useMemo(() => {
    return clusters.flatMap(cluster =>
      cluster.clusterItems.map(item => ({
        x: Number(item.longitude.toFixed(6)),
        y: Number(item.latitude.toFixed(6)),
        clusterId: cluster.clusterId,
      }))
    );
  }, [clusters]);

  // Prepare data for table display.
  const tableData = useMemo(() => {
    return clusters.flatMap(cluster =>
      cluster.clusterItems.map(item => ({
        clusterId: cluster.clusterId,
        caseId: item.caseId,
        latitude: item.latitude,
        longitude: item.longitude,
      }))
    );
  }, [clusters]);

  return (
    <div className="container mx-auto p-6">
      <ToastContainer />
      <h1 className="text-2xl font-semibold mb-4">Crime Analysis</h1>

      {/* Query Bar */}
      <QueryBar
        dateFrom={dateFrom} setDateFrom={setDateFrom}
        dateTo={dateTo} setDateTo={setDateTo}
        numberOfClusters={numberOfClusters} setNumberOfClusters={setNumberOfClusters}
        numberOfRuns={numberOfRuns} setNumberOfRuns={setNumberOfRuns}
        selectedFeatures={selectedFeatures} setSelectedFeatures={setSelectedFeatures}
      />


      {/* Filter Section */}
      <FilterSection
        selectedFeatures={selectedFeatures}
        onFilterChange={(filterState) => setParentFilterState(filterState)}
      />


      {/* Process Button (always visible) */}
      <div className="flex justify-end my-4">
        <button
          onClick={handleFilter}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Processing..." : "Run Analysis"}
        </button>
      </div>




      {/* Cluster Legend */}
      {clusters.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">Cluster Legend</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {clusters.map(c => (
              <div key={c.clusterId} className="flex items-center">
                <span
                  className="w-4 h-4 mr-2 inline-block"
                  style={{ backgroundColor: clusterColorsMapping[c.clusterId] || '#D3D3D3' }}
                ></span>
                <span>Cluster {c.clusterId}: {c.clusterCount || 0}</span>
              </div>
            ))}
            <div className="col-span-full flex justify-end">
              <span
                className="w-4 h-4 mr-2 inline-block"
                style={{ backgroundColor: '#D3D3D3' }}
              ></span>
              <span>
                Total: {clusters.reduce((total, c) => total + (c.clusterCount || 0), 0)}
              </span>
            </div>
          </div>
        </div>
      )}



      {/* Tabs for Map, Graph, Table */}
      <TabGroup>
        <TabList className="flex p-1 space-x-1 bg-blue-900/20 rounded-xl">
          <Tab className={({ selected }) =>
            selected ? 'w-full py-2.5 text-sm font-medium text-blue-700 bg-white rounded-lg'
              : 'w-full py-2.5 text-sm font-medium text-blue-100 hover:bg-white/[0.12] hover:text-white'
          }>
            Map
          </Tab>
          <Tab className={({ selected }) =>
            selected ? 'w-full py-2.5 text-sm font-medium text-blue-700 bg-white rounded-lg'
              : 'w-full py-2.5 text-sm font-medium text-blue-100 hover:bg-white/[0.12] hover:text-white'
          }>
            Graph
          </Tab>
          <Tab className={({ selected }) =>
            selected ? 'w-full py-2.5 text-sm font-medium text-blue-700 bg-white rounded-lg'
              : 'w-full py-2.5 text-sm font-medium text-blue-100 hover:bg-white/[0.12] hover:text-white'
          }>
            Table
          </Tab>
        </TabList>
        <TabPanels className="mt-2">
          <TabPanel>
            <Map key={mapKey} center={[14.4081, 121.0415]} zoom={14} clusters={clusters} clusterColorsMapping={clusterColorsMapping} />
          </TabPanel>
          <TabPanel>
            <ScatterPlot data={scatterData} clusterColorsMapping={clusterColorsMapping} />
          </TabPanel>
          <TabPanel>
            <div className="flex justify-end mb-2">
              <button onClick={() => {
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
              }} className="bg-green-600 text-white px-4 py-2 rounded-md">
                Download CSV
              </button>
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
