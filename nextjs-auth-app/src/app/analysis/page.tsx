'use client';

import { useCallback, useMemo, useState } from 'react';
import withAuth from '../hoc/withAuth';
import dynamic from 'next/dynamic';
import { apiService } from '../api/utils/apiService';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { format, subMonths, subDays } from 'date-fns';
import { ClusterGroupResponse, Cluster, BarangayDataItem, ClustedDataTableRow } from '../../types/analysis/ClusterDto';
import { ErrorDto } from '../../types/ErrorDto';
import { clusterColorsMapping } from '../../types/ClusterColorsMapping';
import QueryBar from './QueryBar';
import FilterSection, { FilterState, initialFilterState } from './FilterSection';
import AnalysisTabs from './AnalysisTabs';

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
        console.log("response", response);
        setClusters(response.clusterGroups);
        toast.success("Clusters generated successfully!");
      }
    } catch (err: any) {
      toast.error(`Failed to generate clusters. ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedFeatures, numberOfClusters, numberOfRuns, parentFilterState]);


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
          </div>
        </div>
      )}



      {/* Tabs for Map, Graph, Table */}
      <AnalysisTabs
        clusters={clusters}
        mapKey={mapKey}
      />

    </div>
  );
};

export default withAuth(AnalysisPage);
