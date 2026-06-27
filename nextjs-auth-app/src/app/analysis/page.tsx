'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import withAuth from '../hoc/withAuth';
import dynamic from 'next/dynamic';
import { apiService } from '../api/utils/apiService';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { format, subMonths, subDays } from 'date-fns';
import { ClusterGroupResponse, Cluster, BarangayDataItem, ClustedDataTableRow } from '../../types/analysis/ClusterDto';
import { ErrorDto } from '../../types/ErrorDto';
import { clusterColorsMapping } from '../../types/ClusterColorsMapping';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../../constants/consts';
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
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(["Latitude", "Longitude"]);
  const [lastAnalysisParams, setLastAnalysisParams] = useState<any>(null);

  const [numberOfClusters, setNumberOfClusters] = useState(0);
  const [numberOfRuns, setNumberOfRuns] = useState(1);
  const [filterState, setFilterState] = useState<FilterState>(initialFilterState);

  // Load existing analysis data from localStorage on component mount
  useEffect(() => {
    const loadSavedAnalysis = () => {
      try {
        const savedClusters = localStorage.getItem('lastAnalysisClusters');
        const savedParams = localStorage.getItem('lastAnalysisParams');
        const savedTimestamp = localStorage.getItem('lastAnalysisTimestamp');
        
        if (savedClusters && savedParams) {
          const clustersData = JSON.parse(savedClusters);
          const paramsData = JSON.parse(savedParams);
          const timestamp = savedTimestamp ? new Date(savedTimestamp).toLocaleString() : 'Unknown';
          
          // Restore cluster data
          setClusters(clustersData);
          setLastAnalysisParams(paramsData);
          
          // Restore form parameters if they exist
          if (paramsData.dateFrom) setDateFrom(paramsData.dateFrom);
          if (paramsData.dateTo) setDateTo(paramsData.dateTo);
          if (paramsData.features) setSelectedFeatures(paramsData.features);
          if (paramsData.numberOfClusters) setNumberOfClusters(paramsData.numberOfClusters);
          if (paramsData.numberOfRuns) setNumberOfRuns(paramsData.numberOfRuns);
          
          // Force map re-render
          setMapKey(prevKey => prevKey + 1);
          
          // Calculate data summary
          const totalItems = clustersData.reduce((sum: number, cluster: any) => sum + cluster.clusterItems.length, 0);
          
          
          toast.success(`Loaded previous analysis: ${clustersData.length} clusters, ${totalItems} data points (${timestamp})`);
        }
      } catch (error) {
        console.error('Error loading saved analysis:', error);
        // Clear corrupted data
        localStorage.removeItem('lastAnalysisClusters');
        localStorage.removeItem('lastAnalysisParams');
        localStorage.removeItem('lastAnalysisTimestamp');
      }
    };
    
    loadSavedAnalysis();
  }, []); // Run only on component mount

  const handleFilterChange = useCallback((newFilterState: FilterState) => {
    setFilterState(newFilterState);
  }, []);

  const buildFilters = useCallback(() => {
    const filters: Record<string, string[]> = {};
    if (selectedFeatures.includes("CrimeType") && filterState.selectedCrimeTypes.length > 0) {
      filters.crimeTypes = filterState.selectedCrimeTypes;
    }
    if (selectedFeatures.includes("Severity") && filterState.selectedSeverity.length > 0) {
      filters.severities = filterState.selectedSeverity;
    }
    return filters;
  }, [selectedFeatures, filterState]);

  const handleFilter = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      toast.error("Please select both start and end dates.");
      return;
    }
    if (!selectedFeatures || selectedFeatures.length === 0) {
      toast.error("Please select a feature.");
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
        filters: buildFilters(),
      };

      const response = await apiService.put<ClusterGroupResponse | ErrorDto>(
        "/incident/grouped-clusters", payload
      );

      if ("message" in response) {
        toast.error(response.message);
      } else {
        setClusters(response.clusterGroups);
        setLastAnalysisParams(payload);
        
        // Save analysis data to localStorage for forecasting
        localStorage.setItem('lastAnalysisClusters', JSON.stringify(response.clusterGroups));
        localStorage.setItem('lastAnalysisParams', JSON.stringify(payload));
        localStorage.setItem('lastAnalysisTimestamp', new Date().toISOString());
        
        toast.success(`Analysis complete! Generated ${response.clusterGroups.length} clusters with ${response.clusterGroups.reduce((sum, c) => sum + (c.clusterCount || 0), 0)} data points.`);
      }
    } catch (err: any) {
      toast.error(`Failed to generate clusters. ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedFeatures, numberOfClusters, numberOfRuns, buildFilters]);

  // Analysis summary data
  const analysisSummary = useMemo(() => {
    if (clusters.length === 0) return null;
    
    const totalCases = clusters.reduce((sum, c) => sum + (c.clusterCount || 0), 0);
    const precincts = new Set(clusters.flatMap(c => c.clusterItems.map(i => i.precinct)));
    const timeRange = clusters.flatMap(c => c.clusterItems.map(i => new Date(i.year, i.month - 1)))
      .reduce((acc, date) => ({
        min: !acc.min || date < acc.min ? date : acc.min,
        max: !acc.max || date > acc.max ? date : acc.max
      }), { min: null as Date | null, max: null as Date | null });
      
    const crimeTypes = new Set(clusters.flatMap(c => c.clusterItems.map(i => i.crimeType)));
    
    // Check if data was loaded from localStorage
    const savedTimestamp = localStorage.getItem('lastAnalysisTimestamp');
    const analysisDate = savedTimestamp ? new Date(savedTimestamp).toLocaleString() : new Date().toLocaleString();
    const isFromCache = Boolean(savedTimestamp);
    
    return {
      totalCases,
      totalClusters: clusters.length,
      precinctCount: precincts.size,
      dateRange: timeRange.min && timeRange.max ? 
        `${format(timeRange.min, 'MMM yyyy')} - ${format(timeRange.max, 'MMM yyyy')}` : 'N/A',
      crimeTypesCount: crimeTypes.size,
      features: selectedFeatures.join(', ') || 'None',
      analysisDate,
      isFromCache
    };
  }, [clusters, selectedFeatures]);

  // Download analysis as CSV
  const downloadAnalysisCSV = useCallback(() => {
    if (clusters.length === 0) {
      toast.error('No analysis data to download');
      return;
    }

    // Flatten cluster data for CSV
    const csvData = clusters.flatMap(cluster =>
      cluster.clusterItems.map(item => ({
        ClusterId: cluster.clusterId,
        CaseId: item.caseId || 'N/A',
        Year: item.year,
        Month: item.month,
        CrimeType: item.crimeType,
        CrimeTypeName: CrimeTypesDictionary[item.crimeType] || 'Unknown',
        Precinct: item.precinct,
        PrecinctName: GetPrecinctsDictionary[item.precinct] || 'Unknown',
        Latitude: item.latitude,
        Longitude: item.longitude,
        Severity: item.severity || 'N/A',
        Motive: item.motive || 'N/A',
        Weather: item.weather || 'N/A',
        ClusterColor: clusterColorsMapping[cluster.clusterId] || '#D3D3D3'
      }))
    );

    // Convert to CSV format
    const escapeCsv = (val: unknown): string => {
      const s = val == null ? '' : String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => 
        headers.map(header => 
          escapeCsv(row[header as keyof typeof row])
        ).join(',')
      )
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crime-analysis-data-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Analysis data downloaded as CSV successfully!');
  }, [clusters]);

  // Download analysis as JSON
  const downloadAnalysisJSON = useCallback(() => {
    if (clusters.length === 0) {
      toast.error('No analysis data to download');
      return;
    }

    const analysisData = {
      metadata: {
        exportDate: new Date().toISOString(),
        analysisDate: analysisSummary?.analysisDate || 'Unknown',
        totalClusters: clusters.length,
        totalCases: clusters.reduce((sum, c) => sum + (c.clusterCount || 0), 0),
        parameters: lastAnalysisParams,
        version: '1.0'
      },
      clusters: clusters.map(cluster => ({
        ...cluster,
        clusterItems: cluster.clusterItems.map(item => ({
          ...item,
          crimeTypeName: CrimeTypesDictionary[item.crimeType] || 'Unknown',
          precinctName: GetPrecinctsDictionary[item.precinct] || 'Unknown',
          clusterColor: clusterColorsMapping[cluster.clusterId] || '#D3D3D3'
        }))
      }))
    };

    // Create and download file
    const blob = new Blob([JSON.stringify(analysisData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crime-analysis-data-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Analysis data downloaded as JSON successfully!');
  }, [clusters, analysisSummary, lastAnalysisParams]);

  // Clear analysis data from localStorage and state
  const clearAnalysisData = useCallback(() => {
    // Clear localStorage
    localStorage.removeItem('lastAnalysisClusters');
    localStorage.removeItem('lastAnalysisParams');
    localStorage.removeItem('lastAnalysisTimestamp');
    
    // Clear state
    setClusters([]);
    setLastAnalysisParams(null);
    setMapKey(prevKey => prevKey + 1); // Force map re-render
    
    toast.success('Analysis data cleared successfully!');
  }, []);

  const downloadAnalysisReport = useCallback(() => {
    if (!analysisSummary || !lastAnalysisParams) {
      toast.error('No analysis data to download');
      return;
    }

    // Generate summary report
    const reportLines = [
      '# Crime Analysis Report',
      `Generated on: ${analysisSummary.analysisDate}`,
      '',
      '## Analysis Parameters',
      `Date Range: ${lastAnalysisParams.dateFrom} to ${lastAnalysisParams.dateTo}`,
      `Features: ${lastAnalysisParams.features.join(', ')}`,
      `Number of Clusters: ${lastAnalysisParams.numberOfClusters}`,
      `Number of Runs: ${lastAnalysisParams.numberOfRuns}`,
      '',
      '## Results Summary',
      `Total Cases Analyzed: ${analysisSummary.totalCases}`,
      `Clusters Generated: ${analysisSummary.totalClusters}`,
      `Precincts Involved: ${analysisSummary.precinctCount}`,
      `Time Period: ${analysisSummary.dateRange}`,
      `Crime Types: ${analysisSummary.crimeTypesCount}`,
      '',
      '## Cluster Details',
      clusters.map((cluster, idx) => {
        const avgLat = cluster.clusterItems.reduce((sum, item) => sum + item.latitude, 0) / cluster.clusterItems.length;
        const avgLng = cluster.clusterItems.reduce((sum, item) => sum + item.longitude, 0) / cluster.clusterItems.length;
        const precinctStats = cluster.clusterItems.reduce((acc, item) => {
          const precinct = GetPrecinctsDictionary[item.precinct] || `Precinct ${item.precinct}`;
          acc[precinct] = (acc[precinct] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        const topPrecinct = Object.entries(precinctStats).sort(([,a], [,b]) => b - a)[0];
        
        return [
          `### Cluster ${cluster.clusterId}`,
          `- Cases: ${cluster.clusterCount}`,
          `- Center: ${avgLat.toFixed(6)}, ${avgLng.toFixed(6)}`,
          `- Primary Location: ${topPrecinct[0]} (${topPrecinct[1]} cases)`,
          `- Color: ${clusterColorsMapping[cluster.clusterId] || '#D3D3D3'}`,
          ''
        ].join('\n');
      }).join('\n'),
      ''
    ].filter(line => line !== '').join('\n');

    // Create and download file
    const blob = new Blob([reportLines], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crime-analysis-report-${format(new Date(), 'yyyy-MM-dd-HHmm')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Analysis report downloaded successfully!');
  }, [analysisSummary, lastAnalysisParams, clusters]);

  return (
    <div className="h-full p-6 space-y-6 overflow-auto">
      <ToastContainer />
      
      {/* Header with title and analysis summary */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Crime Data Analysis</h1>
          <p className="text-gray-600">Advanced clustering and pattern analysis for crime data insights</p>
        </div>
        
        {analysisSummary && (
            <div className="bg-gradient-to-r from-ubuntu-50 to-aubergine-50 border border-ubuntu-200 rounded-lg p-4 min-w-fit">
            <h3 className="font-semibold text-blue-800 mb-2 flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              Last Analysis Results
              {analysisSummary?.isFromCache && (
                <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full" title="Data loaded from cache">
                  📂 Cached
                </span>
              )}
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Cases:</span>
                <span className="font-semibold ml-2 text-blue-800">{analysisSummary.totalCases}</span>
              </div>
              <div>
                <span className="text-gray-600">Clusters:</span>
                <span className="font-semibold ml-2 text-blue-800">{analysisSummary.totalClusters}</span>
              </div>
              <div>
                <span className="text-gray-600">Precincts:</span>
                <span className="font-semibold ml-2 text-blue-800">{analysisSummary.precinctCount}</span>
              </div>
              <div>
                <span className="text-gray-600">Period:</span>
                <span className="font-semibold ml-2 text-blue-800">{analysisSummary.dateRange}</span>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={downloadAnalysisReport}
                className="flex-1 bg-ubuntu-500 text-white text-sm px-3 py-2 rounded-md hover:bg-ubuntu-700 transition flex items-center justify-center"
                title="Download analysis report (Markdown)"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Report
              </button>
              <button
                onClick={downloadAnalysisCSV}
                className="flex-1 bg-green-600 text-white text-sm px-3 py-2 rounded-md hover:bg-green-700 transition flex items-center justify-center"
                title="Download analysis data as CSV"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a4 4 0 01-4-4V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSV
              </button>
              <button
                onClick={downloadAnalysisJSON}
                className="flex-1 bg-purple-600 text-white text-sm px-3 py-2 rounded-md hover:bg-purple-700 transition flex items-center justify-center"
                title="Download analysis data as JSON"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                JSON
              </button>
              <button
                onClick={clearAnalysisData}
                className="flex-1 bg-red-600 text-white text-sm px-3 py-2 rounded-md hover:bg-red-700 transition flex items-center justify-center"
                title="Clear all saved analysis data"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Analysis Configuration */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center">
            <svg className="w-5 h-5 mr-2 text-ubuntu-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Analysis Configuration
          </h2>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Query Parameters */}
          <QueryBar
            dateFrom={dateFrom} setDateFrom={setDateFrom}
            dateTo={dateTo} setDateTo={setDateTo}
            numberOfClusters={numberOfClusters} setNumberOfClusters={setNumberOfClusters}
            numberOfRuns={numberOfRuns} setNumberOfRuns={setNumberOfRuns}
            selectedFeatures={selectedFeatures} setSelectedFeatures={setSelectedFeatures}
          />

          {/* Feature Value Filters */}
          <FilterSection
            selectedFeatures={selectedFeatures}
            onFilterChange={handleFilterChange}
          />

          {/* Run Analysis Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              onClick={handleFilter}
              className="bg-gradient-to-r from-ubuntu-500 to-ubuntu-700 text-white px-8 py-3 rounded-lg hover:from-ubuntu-700 hover:to-aubergine-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center font-medium shadow-lg hover:shadow-xl"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing Analysis...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Run Analysis
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {clusters.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Analysis Results
              </h2>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-500">
                  Generated {clusters.length} clusters • {clusters.reduce((sum, c) => sum + (c.clusterCount || 0), 0)} total cases
                </div>
                <Link
                  href="/forecast/new"
                  className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-md hover:bg-indigo-200 transition text-sm flex items-center"
                  title="Use these clusters for forecasting"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Use for Forecasting
                </Link>
                <button
                  onClick={clearAnalysisData}
                  className="bg-red-100 text-red-700 px-3 py-1 rounded-md hover:bg-red-200 transition text-sm flex items-center"
                  title="Clear analysis data"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear
                </button>
              </div>
            </div>
          </div>
          
          {/* Cluster Legend */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Cluster Distribution</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {clusters.map(c => (
                <div key={c.clusterId} className="flex items-center justify-between bg-white px-3 py-2 rounded-md border">
                  <div className="flex items-center">
                    <span
                      className="w-4 h-4 mr-2 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: clusterColorsMapping[c.clusterId] || '#D3D3D3' }}
                    ></span>
                    <span className="text-sm font-medium">Cluster {c.clusterId}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {c.clusterCount || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Filters Applied Summary */}
          {lastAnalysisParams && (
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Filters & Features Applied</h3>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span><span className="text-gray-500">Features:</span> <span className="font-medium">{(lastAnalysisParams.features as string[]).join(', ')}</span></span>
                <span><span className="text-gray-500">Date:</span> <span className="font-medium">{lastAnalysisParams.dateFrom} → {lastAnalysisParams.dateTo}</span></span>
                {lastAnalysisParams.numberOfClusters > 0 && (
                  <span><span className="text-gray-500">Clusters:</span> <span className="font-medium">{lastAnalysisParams.numberOfClusters}</span></span>
                )}
                {lastAnalysisParams.filters && (lastAnalysisParams.filters as Record<string, string[]>).crimeTypes?.length > 0 && (
                  <span><span className="text-gray-500">Crime Types:</span> <span className="font-medium">{(lastAnalysisParams.filters as any).crimeTypes.map((id: string) => CrimeTypesDictionary[parseInt(id)] || id).join(', ')}</span></span>
                )}
                {lastAnalysisParams.filters && (lastAnalysisParams.filters as Record<string, string[]>).severities?.length > 0 && (
                  <span><span className="text-gray-500">Severity:</span> <span className="font-medium">{(lastAnalysisParams.filters as any).severities.join(', ')}</span></span>
                )}
                {(!lastAnalysisParams.filters || Object.keys(lastAnalysisParams.filters).length === 0) && (
                  <span className="text-gray-400 italic">No additional filters applied</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analysis Visualizations */}
      <AnalysisTabs
        clusters={clusters}
        mapKey={mapKey}
        analysisParams={lastAnalysisParams}
      />

    </div>
  );
};

export default withAuth(AnalysisPage);
