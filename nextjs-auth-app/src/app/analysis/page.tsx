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
import { ClusterGroupResponse, Cluster , ClusterItem } from '../../types/analysis/ClusterDto';
import { ErrorDto } from '../../types/ErrorDto';
import ScatterPlot from '../../components/ScatterPlot'; // Import the ScatterPlot component
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { clusterColorsMapping } from '../../types/ClusterColorsMapping';
import QueryBar from './QueryBar';
import FeatureSelect from './FeatureSelect';
import MultiSelectDropdown from '../../components/MultiSelectDropdown';
import FilterSection from './FilterSection';

const Map = dynamic(() => import('../../components/Map'), { ssr: false });

const AnalysisPage = () => {
  const { status } = useSession();
  const router = useRouter();
  const [dateFrom, setDateFrom] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [mapKey, setMapKey] = useState(0); // Add key to force re-render
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]); // Default to first feature

  const [numberOfClusters, setNumberOfClusters] = useState(3);
  const [numberOfRuns, setNumberOfRuns] = useState(1); // New state for number of runs

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

    if (selectedFeatures === null || selectedFeatures.length === 0) {
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
      const payload =  {
        dateFrom,
        dateTo,
        features: [...selectedFeatures, "Latitude", "Longitude"],
        numberOfClusters,
        numberOfRuns,
        filters:{
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
        selectedMotive={selectedMotives} setSelectedMotive={setSelectedMotives}/>

      {/* Cluster Id Legend */}
      {clusters.length > 0 && (
        <div className="mb-4 ">
          <h2 className="text-xl font-semibold mb-2">Cluster Legend</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {clusters.map((c, index) => {
              const clusterId = index + 1;
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
        </TabList>
        <TabPanels className="mt-2">
          <TabPanel>
            <Map
              key={mapKey}
              center={[14.4081, 121.0415]}
              zoom={14}
              clusters={clusters}
              clusterColorsMapping={clusterColorsMapping} />
          </TabPanel>
            <TabPanel>
            <ScatterPlot
              data={clusters.flatMap(cluster =>
              cluster.clusterItems.map(item => ({
                x: Number(item.longitude.toFixed(6)),
                y: Number(item.latitude.toFixed(6)),
                clusterId: cluster.clusterId
              }))
              )}
              clusterColorsMapping={clusterColorsMapping} />
            </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
};

export default withAuth(AnalysisPage);
