'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import withAuth from '../hoc/withAuth';
import { apiService } from '../api/utils/apiService';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { format, addMonths, subMonths, subDays } from 'date-fns';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../../constants/consts';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { Cluster } from '../../types/analysis/ClusterDto';
import Link from 'next/link';
import TimeSeriesChart from './TimeSeriesChart';
import TrendAnalysis from './TrendAnalysis';
import RiskHeatmap from './RiskHeatmap';
import ForecastSummary from './ForecastSummary';
import ForecastMap from './ForecastMap';
import { 
  ExtendedForecastData,
  ForecastMapPoint,
  ManpowerAllocation,
  DEFAULT_MANPOWER_ALLOCATION
} from '../../types/forecast/ExtendedForecastTypes';
import { 
  calculateReliabilityMetrics,
  analyzeTimeOfDayPatterns,
  getGeographicCoordinates,
  createForecastMapPoints,
  enhanceForecastData,
  filterReliableForecasts,
  calculateForecastQualityMetrics
} from '../../utils/forecastEnhancements';
import SimpleForecastMap from '../../components/SimpleForecastMap';
import ManpowerAllocationComponent from './ManpowerAllocation';
import ForecastDocumentation from './ForecastDocumentation';
import ForecastFilters, { ForecastFilterState, initialForecastFilterState } from './ForecastFilters';

// TypeScript interfaces
interface HistoricalData {
  year: number;
  month: number;
  precinct: number;
  crimeType: number;
  count: number;
  timeOfDay: string;
  clusterId?: number;
}

interface ForecastData {
  year: number;
  month: number;
  precinct: number;
  crimeType: number;
  predictedCount: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  // Enhanced with shift-based data
  shiftBreakdown?: {
    Morning: { predicted: number; percentage: number; riskLevel: string };
    Afternoon: { predicted: number; percentage: number; riskLevel: string };
    Night: { predicted: number; percentage: number; riskLevel: string };
  };
  dominantShift?: string;
}

interface ForecastParams {
  forecastPeriod: number; // months ahead
  model: 'linear' | 'polynomial' | 'seasonal' | 'arima';
  confidence: number;
  includeSeasonality: boolean;
  weightRecentData: boolean;
}

const ForecastPage = () => {
  // State management
  const [loading, setLoading] = useState(false);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [extendedForecastData, setExtendedForecastData] = useState<ExtendedForecastData[]>([]);
  const [forecastMapPoints, setForecastMapPoints] = useState<ForecastMapPoint[]>([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [analysisLoaded, setAnalysisLoaded] = useState(false);
  const [manpowerSettings, setManpowerSettings] = useState<ManpowerAllocation>(DEFAULT_MANPOWER_ALLOCATION);
  
  // Filtering state
  const [forecastFilters, setForecastFilters] = useState<ForecastFilterState>(initialForecastFilterState);
  const [filteredForecastData, setFilteredForecastData] = useState<ForecastData[]>([]);
  
  // UI state
  const [showDataRequirements, setShowDataRequirements] = useState(false);
  const [showInfoModals, setShowInfoModals] = useState({
    summary: false,
    timeseries: false,
    trends: false,
    heatmap: false,
    manpower: false,
    map: false,
    documentation: false
  });

  // Helper function to toggle info modals
  const toggleInfoModal = (tabKey: string) => {
    setShowInfoModals(prev => ({
      ...prev,
      [tabKey]: !prev[tabKey as keyof typeof prev]
    }));
  };

  // Forecast parameters
  const [forecastParams, setForecastParams] = useState<ForecastParams>({
    forecastPeriod: 6, // 6 months ahead
    model: 'polynomial', // Fixed polynomial model
    confidence: 0.95,
    includeSeasonality: true,
    weightRecentData: true
  });

  // Upload analysis state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Handle analysis file upload
  const handleAnalysisUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setUploadError('Please select a valid JSON file');
      return;
    }

    try {
      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });

      const analysisData = JSON.parse(fileContent);
      
      // Validate the uploaded data structure
      if (!analysisData.clusters || !Array.isArray(analysisData.clusters)) {
        setUploadError('Invalid analysis file format: clusters array not found');
        return;
      }

      // Check if there's existing data and ask for confirmation
      const existingClusters = localStorage.getItem('lastAnalysisClusters');
      if (existingClusters) {
        const confirmed = window.confirm(
          'This will overwrite your existing analysis data. Do you want to continue?'
        );
        if (!confirmed) {
          return;
        }
      }

      // Save to localStorage
      localStorage.setItem('lastAnalysisClusters', JSON.stringify(analysisData.clusters));
      if (analysisData.metadata?.parameters) {
        localStorage.setItem('lastAnalysisParams', JSON.stringify(analysisData.metadata.parameters));
      }
      localStorage.setItem('lastAnalysisTimestamp', new Date().toISOString());

      // Update state
      setClusters(analysisData.clusters);
      setAnalysisLoaded(true);

      const totalItems = analysisData.clusters.reduce((sum: number, cluster: any) => sum + (cluster.clusterItems?.length || 0), 0);
      
      toast.success(`Analysis data uploaded successfully! ${analysisData.clusters.length} clusters, ${totalItems} data points`);
      setShowUploadModal(false);
      setUploadError(null);
      
      // Reset file input
      event.target.value = '';
      
    } catch (error) {
      setUploadError(`Failed to process file: ${error}`);
    }
  }, []);

  // Load existing analysis data from localStorage
  useEffect(() => {
    const savedClusters = localStorage.getItem('lastAnalysisClusters');
    const savedParams = localStorage.getItem('lastAnalysisParams');
    const savedTimestamp = localStorage.getItem('lastAnalysisTimestamp');
    
    if (savedClusters && savedParams) {
      try {
        const clustersData = JSON.parse(savedClusters);
        const paramsData = JSON.parse(savedParams);
        const timestamp = savedTimestamp ? new Date(savedTimestamp).toLocaleString() : 'Unknown';
        
        setClusters(clustersData);
        setAnalysisLoaded(true);
        
        // Calculate total data points and time range for debugging
        const totalItems = clustersData.reduce((sum: number, cluster: any) => sum + cluster.clusterItems.length, 0);
        const allItems = clustersData.flatMap((cluster: any) => cluster.clusterItems);
        const years = new Set(allItems.map((item: any) => item.year));
        const months = new Set(allItems.map((item: any) => `${item.year}-${item.month.toString().padStart(2, '0')}`));
        const precincts = new Set(allItems.map((item: any) => item.precinct));
        const crimeTypes = new Set(allItems.map((item: any) => item.crimeType));
        
        console.log('📊 Analysis Data Summary:', {
          clusters: clustersData.length,
          totalDataPoints: totalItems,
          timeSpan: `${years.size} years, ${months.size} months`,
          precincts: Array.from(precincts),
          crimeTypes: Array.from(crimeTypes),
          analysisTime: timestamp
        });
        
        toast.success(`Analysis data loaded: ${clustersData.length} clusters, ${totalItems} data points (${timestamp})`);
        
      } catch (error) {
        console.error('Error loading saved analysis:', error);
        toast.error('Failed to load previous analysis data');
      }
    }
  }, []);

  // Generate forecast using statistical APIs and clustering analysis
  const generateForecast = useCallback(async () => {
    if (!analysisLoaded || clusters.length === 0) {
      toast.error('Please run clustering analysis first to generate forecasts.');
      return;
    }

    if (forecastParams.forecastPeriod < 1 || forecastParams.forecastPeriod > 12) {
      toast.error('Forecast period must be between 1 and 12 months.');
      return;
    }

    setLoading(true);
    setForecastData([]);

    try {
      // Process clustering data into historical patterns
      const processedData = processClusterData(clusters);
      setHistoricalData(processedData);

      // Call statistical forecasting API
      const predictions = await callStatisticalForecastingAPI(processedData, forecastParams);
      setForecastData(predictions);
      setFilteredForecastData(predictions); // Initialize filtered data

      // Enhance forecasts with reliability scoring, time-of-day analysis, and spatial mapping
      console.log('🔬 Enhancing forecasts with reliability scoring and spatial mapping...');
      const enhancedForecasts = predictions.map(forecast => 
        enhanceForecastData(forecast, processedData, clusters)
      );
      setExtendedForecastData(enhancedForecasts);

      // Filter reliable forecasts for map display
      const reliableForecasts = filterReliableForecasts(enhancedForecasts, 0.3, 3, 1.5);
      const mapPoints = createForecastMapPoints(reliableForecasts, 0.3);
      setForecastMapPoints(mapPoints);

      // Log quality metrics
      const qualityMetrics = calculateForecastQualityMetrics(enhancedForecasts);
      console.log('📊 Forecast Quality Metrics:', qualityMetrics);

      // Calculate shift patterns for analysis summary
      const shiftPatterns = calculateShiftPatterns(processedData);
      const shiftsWithData = Array.from(shiftPatterns.values()).filter(pattern => pattern.total > 0).length;
      console.log(`📊 Shift Analysis: ${shiftsWithData} precinct/crime-type combinations have time-of-day data`);
      
      toast.success(`Shift-based forecast generated! ${predictions.length} predictions with time-of-day analysis (${mapPoints.length} reliable for map display) from ${clusters.length} clusters.`);

    } catch (err: any) {
      console.error('Forecast generation error:', err);
      toast.error(`Failed to generate forecast: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [forecastParams, clusters, analysisLoaded]);

  // Call statistical forecasting API service
  const callStatisticalForecastingAPI = async (historicalData: HistoricalData[], params: ForecastParams): Promise<ForecastData[]> => {
    try {
      // Convert cluster data for the API
      const clusterGroups = convertHistoricalDataToClusters(clusters, historicalData);
      
      // Prepare request for .NET API
      const requestData = {
        clusterData: clusterGroups,
        horizon: params.forecastPeriod,
        confidenceLevel: params.confidence,
        modelType: params.model.toUpperCase() === 'ARIMA' ? 'SSA' : 'SSA', // Use SSA as default
        includeSeasonality: params.includeSeasonality,
        weightRecentData: params.weightRecentData
      };
      
      // Call the .NET statistical forecasting endpoint
      const response = await apiService.post('/incident/forecast/statistical', requestData) as any;
      
      if (response && response.series) {
        toast.success('Generated reliable statistical forecasts using ML.NET');
        return processMLNetForecastResponse(response, params);
      } else {
        throw new Error('Invalid response from forecasting service');
      }
      
    } catch (error) {
      console.warn('ML.NET forecasting failed, using fallback:', error);
      toast.warning('Using local forecasting methods as fallback');
      return generatePredictions(historicalData, params, manpowerSettings);
    }
  };

  // Process cluster data into historical patterns
  const processClusterData = (clustersData: Cluster[]): HistoricalData[] => {
    const aggregated = new Map<string, HistoricalData>();

    clustersData.forEach(cluster => {
      cluster.clusterItems.forEach(item => {
        // Create aggregation key
        const key = `${item.year}-${item.month}-${item.precinct}-${item.crimeType}`;
        
        if (aggregated.has(key)) {
          aggregated.get(key)!.count++;
        } else {
          aggregated.set(key, {
            year: item.year,
            month: item.month,
            precinct: item.precinct,
            crimeType: item.crimeType,
            count: 1,
            timeOfDay: item.timeOfDay,
            clusterId: cluster.clusterId // Include cluster information
          });
        }
      });
    });

    return Array.from(aggregated.values()).sort((a, b) => 
      new Date(a.year, a.month - 1).getTime() - new Date(b.year, b.month - 1).getTime()
    );
  };

  // Helper function to map time of day to shift
  const getShiftFromTimeOfDay = (timeOfDay: string): string => {
    if (!timeOfDay) return 'Unknown';
    
    const time = timeOfDay.toLowerCase();
    if (time.includes('morning') || time.includes('dawn') || time.includes('am') || 
        (time.includes('06') || time.includes('07') || time.includes('08') || 
         time.includes('09') || time.includes('10') || time.includes('11') ||
         time.includes('12') || time.includes('13'))) {
      return 'Morning';
    } else if (time.includes('afternoon') || time.includes('evening') || time.includes('pm') ||
               (time.includes('14') || time.includes('15') || time.includes('16') ||
                time.includes('17') || time.includes('18') || time.includes('19') ||
                time.includes('20') || time.includes('21'))) {
      return 'Afternoon';
    } else if (time.includes('night') || time.includes('midnight') ||
               (time.includes('22') || time.includes('23') || time.includes('00') ||
                time.includes('01') || time.includes('02') || time.includes('03') ||
                time.includes('04') || time.includes('05'))) {
      return 'Night';
    }
    
    return 'Unknown';
  };

  // Calculate shift patterns from historical data
  const calculateShiftPatterns = (data: HistoricalData[]): Map<string, { Morning: number; Afternoon: number; Night: number; total: number }> => {
    const shiftPatterns = new Map<string, { Morning: number; Afternoon: number; Night: number; total: number }>();
    
    data.forEach(item => {
      const key = `${item.precinct}-${item.crimeType}`;
      const shift = getShiftFromTimeOfDay(item.timeOfDay);
      
      if (shift === 'Unknown') return;
      
      if (!shiftPatterns.has(key)) {
        shiftPatterns.set(key, { Morning: 0, Afternoon: 0, Night: 0, total: 0 });
      }
      
      const pattern = shiftPatterns.get(key)!;
      if (shift === 'Morning') pattern.Morning += item.count;
      else if (shift === 'Afternoon') pattern.Afternoon += item.count;
      else if (shift === 'Night') pattern.Night += item.count;
      
      pattern.total += item.count;
    });
    
    return shiftPatterns;
  };

  // Apply shift patterns to predictions
  const applyShiftPatterns = (basePrediction: number, shiftPatterns: { Morning: number; Afternoon: number; Night: number; total: number }) => {
    if (shiftPatterns.total === 0) {
      // Default equal distribution if no shift data
      return {
        Morning: { predicted: Math.round(basePrediction * 0.33), percentage: 33.3, riskLevel: 'medium' },
        Afternoon: { predicted: Math.round(basePrediction * 0.33), percentage: 33.3, riskLevel: 'medium' },
        Night: { predicted: Math.round(basePrediction * 0.34), percentage: 33.4, riskLevel: 'medium' }
      };
    }
    
    const morningRatio = shiftPatterns.Morning / shiftPatterns.total;
    const afternoonRatio = shiftPatterns.Afternoon / shiftPatterns.total;
    const nightRatio = shiftPatterns.Night / shiftPatterns.total;
    
    const morningPredicted = Math.round(basePrediction * morningRatio);
    const afternoonPredicted = Math.round(basePrediction * afternoonRatio);
    const nightPredicted = basePrediction - morningPredicted - afternoonPredicted; // Ensure total matches
    
    // Determine risk levels based on concentration
    const getRiskLevel = (percentage: number) => {
      if (percentage > 50) return 'critical';
      if (percentage > 40) return 'high';
      if (percentage > 25) return 'medium';
      return 'low';
    };
    
    return {
      Morning: { 
        predicted: morningPredicted, 
        percentage: morningRatio * 100, 
        riskLevel: getRiskLevel(morningRatio * 100) 
      },
      Afternoon: { 
        predicted: afternoonPredicted, 
        percentage: afternoonRatio * 100, 
        riskLevel: getRiskLevel(afternoonRatio * 100) 
      },
      Night: { 
        predicted: nightPredicted, 
        percentage: nightRatio * 100, 
        riskLevel: getRiskLevel(nightRatio * 100) 
      }
    };
  };

  // Generate predictions with shift-based enhancements
  const generatePredictions = (historical: HistoricalData[], params: ForecastParams, manpowerConfig: ManpowerAllocation): ForecastData[] => {
    const predictions: ForecastData[] = [];
    const baseDate = new Date();

    // Calculate shift patterns for all data
    const shiftPatterns = calculateShiftPatterns(historical);
    console.log('🕐 Shift Patterns Calculated:', Object.fromEntries(shiftPatterns));

    // Group historical data by precinct and crime type
    const groups = new Map<string, HistoricalData[]>();
    
    historical.forEach(data => {
      const key = `${data.precinct}-${data.crimeType}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(data);
    });

    // Generate predictions for each group with shift analysis
    groups.forEach((groupData, key) => {
      const [precinct, crimeType] = key.split('-').map(Number);
      const groupShiftPattern = shiftPatterns.get(key) || { Morning: 0, Afternoon: 0, Night: 0, total: 0 };
      
      for (let monthOffset = 1; monthOffset <= params.forecastPeriod; monthOffset++) {
        const forecastDate = addMonths(baseDate, monthOffset);
        const year = forecastDate.getFullYear();
        const month = forecastDate.getMonth() + 1;

        let predictedCount = 0;
        let confidence = params.confidence;

        switch (params.model) {
          case 'linear':
            predictedCount = calculateLinearTrend(groupData, monthOffset);
            break;
          case 'polynomial':
            predictedCount = calculatePolynomialTrend(groupData, monthOffset);
            break;
          case 'seasonal':
            predictedCount = calculateSeasonalForecast(groupData, month);
            break;
          case 'arima':
            predictedCount = calculateSimpleARIMA(groupData, monthOffset);
            break;
          default:
            predictedCount = calculateLinearTrend(groupData, monthOffset);
        }

        // Determine trend and risk level using configurable thresholds
        const recentAvg = groupData.slice(-6).reduce((sum, d) => sum + d.count, 0) / 6;
        const olderAvg = groupData.slice(-12, -6).reduce((sum, d) => sum + d.count, 0) / 6 || recentAvg;
        
        const trend: 'increasing' | 'decreasing' | 'stable' = 
          predictedCount > recentAvg * 1.1 ? 'increasing' :
          predictedCount < recentAvg * 0.9 ? 'decreasing' : 'stable';

        // Use configurable risk thresholds
        const riskRatio = predictedCount / recentAvg;
        const riskLevel: 'low' | 'medium' | 'high' | 'critical' =
          riskRatio > manpowerConfig.riskThresholds.highMax ? 'critical' :
          riskRatio > manpowerConfig.riskThresholds.mediumMax ? 'high' :
          riskRatio > manpowerConfig.riskThresholds.lowMax ? 'medium' : 'low';

        // Apply shift patterns to the prediction
        const shiftBreakdown = applyShiftPatterns(Math.max(0, Math.round(predictedCount)), groupShiftPattern);
        const dominantShift = Object.entries(shiftBreakdown).reduce((max, [shift, data]) => 
          data.predicted > shiftBreakdown[max].predicted ? shift : max, 'Morning'
        );

        predictions.push({
          year,
          month,
          precinct,
          crimeType,
          predictedCount: Math.max(0, Math.round(predictedCount)),
          confidence: Math.max(0.5, confidence - (monthOffset * 0.05)), // Confidence decreases with distance
          trend,
          riskLevel,
          // Enhanced shift-based data
          shiftBreakdown,
          dominantShift
        });
      }
    });

    return predictions.sort((a, b) => 
      new Date(a.year, a.month - 1).getTime() - new Date(b.year, b.month - 1).getTime()
    );
  };

  // Simple linear trend calculation
  const calculateLinearTrend = (data: HistoricalData[], monthsAhead: number): number => {
    if (data.length < 2) return data[0]?.count || 0;

    const recentData = data.slice(-12); // Last 12 months
    const n = recentData.length;
    
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    recentData.forEach((point, index) => {
      const x = index + 1;
      const y = point.count;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) || 0;
    const intercept = (sumY - slope * sumX) / n || 0;

    return intercept + slope * (n + monthsAhead);
  };

  // Polynomial trend (quadratic)
  const calculatePolynomialTrend = (data: HistoricalData[], monthsAhead: number): number => {
    if (data.length < 3) return calculateLinearTrend(data, monthsAhead);

    const recentData = data.slice(-12);
    const n = recentData.length;
    
    // Simple quadratic approximation
    const recent = recentData.slice(-3).reduce((sum, d) => sum + d.count, 0) / 3;
    const middle = recentData.slice(-6, -3).reduce((sum, d) => sum + d.count, 0) / 3;
    const older = recentData.slice(-9, -6).reduce((sum, d) => sum + d.count, 0) / 3;

    const acceleration = (recent - 2 * middle + older) / 2;
    const velocity = recent - middle;

    return Math.max(0, recent + velocity * monthsAhead + 0.5 * acceleration * monthsAhead * monthsAhead);
  };

  // Seasonal forecast based on historical monthly patterns
  const calculateSeasonalForecast = (data: HistoricalData[], targetMonth: number): number => {
    const monthlyAvg = new Array(12).fill(0);
    const monthlyCount = new Array(12).fill(0);

    data.forEach(point => {
      const monthIndex = point.month - 1;
      monthlyAvg[monthIndex] += point.count;
      monthlyCount[monthIndex]++;
    });

    // Calculate average for target month
    const targetMonthIndex = targetMonth - 1;
    if (monthlyCount[targetMonthIndex] === 0) {
      return data.reduce((sum, d) => sum + d.count, 0) / data.length || 0;
    }

    const seasonalBase = monthlyAvg[targetMonthIndex] / monthlyCount[targetMonthIndex];
    
    // Apply recent trend
    const recentTrend = calculateLinearTrend(data, 1) / (data[data.length - 1]?.count || 1);
    
    return seasonalBase * recentTrend;
  };

  // Simple ARIMA-like calculation
  const calculateSimpleARIMA = (data: HistoricalData[], monthsAhead: number): number => {
    if (data.length < 4) return calculateLinearTrend(data, monthsAhead);

    const recent = data.slice(-6);
    const weights = [0.4, 0.25, 0.15, 0.1, 0.07, 0.03]; // More weight to recent data
    
    let weightedSum = 0;
    let totalWeight = 0;

    recent.forEach((point, index) => {
      const weight = weights[index] || 0.01;
      weightedSum += point.count * weight;
      totalWeight += weight;
    });

    const baseValue = weightedSum / totalWeight;
    
    // Add random walk component (simplified)
    const randomComponent = (Math.random() - 0.5) * 0.2 * baseValue;
    
    return Math.max(0, baseValue + randomComponent);
  };

  // Convert historical data back to cluster format for API
  const convertHistoricalDataToClusters = (clusters: Cluster[], historicalData: HistoricalData[]) => {
    return clusters.map(cluster => ({
      clusterId: cluster.clusterId,
      clusterItems: cluster.clusterItems.map(item => ({
        caseId: item.caseId,
        latitude: item.latitude,
        longitude: item.longitude,
        month: item.month,
        year: item.year,
        timeOfDay: item.timeOfDay,
        precinct: item.precinct,
        crimeType: item.crimeType
      })),
      clusterCount: cluster.clusterItems.length
    }));
  };

  // Process ML.NET forecast response
  const processMLNetForecastResponse = (response: any, params: ForecastParams): ForecastData[] => {
    const predictions: ForecastData[] = [];
    
    if (!response.series || !Array.isArray(response.series)) {
      throw new Error('Invalid forecast response format');
    }
    
    response.series.forEach((series: any) => {
      const { precinct, crimeType, forecasts } = series;
      
      forecasts.forEach((forecast: any) => {
        const forecastDate = new Date(forecast.timestamp);
        
        predictions.push({
          year: forecastDate.getFullYear(),
          month: forecastDate.getMonth() + 1,
          precinct: precinct,
          crimeType: crimeType,
          predictedCount: Math.max(0, Math.round(forecast.forecast)),
          confidence: forecast.confidence,
          trend: forecast.trend as 'increasing' | 'decreasing' | 'stable',
          riskLevel: forecast.riskLevel as 'low' | 'medium' | 'high' | 'critical'
        });
      });
    });
    
    return predictions.sort((a, b) => 
      new Date(a.year, a.month - 1).getTime() - new Date(b.year, b.month - 1).getTime()
    );
  };

  // Clear analysis data from localStorage
  const clearAnalysisData = useCallback(() => {
    localStorage.removeItem('lastAnalysisClusters');
    localStorage.removeItem('lastAnalysisParams');
    localStorage.removeItem('lastAnalysisTimestamp');
    
    setClusters([]);
    setHistoricalData([]);
    setForecastData([]);
    setExtendedForecastData([]);
    setForecastMapPoints([]);
    setAnalysisLoaded(false);
    
    toast.info('Analysis data cleared from storage');
  }, []);

  // Download forecast report
  const downloadForecastReport = useCallback(() => {
    if (forecastData.length === 0) {
      toast.error('No forecast data to download');
      return;
    }

    const reportLines = [
      '# Crime Forecast Report',
      `Generated on: ${new Date().toLocaleString()}`,
      '',
      '## Forecast Parameters',
      `Analysis Clusters: ${clusters.length} clusters from previous analysis`,
      `Forecast Period: ${forecastParams.forecastPeriod} months ahead`,
      `Model Used: ${forecastParams.model.toUpperCase()}`,
      `Confidence Level: ${(forecastParams.confidence * 100).toFixed(1)}%`,
      `Seasonality: ${forecastParams.includeSeasonality ? 'Included' : 'Excluded'}`,
      `Recent Data Weighting: ${forecastParams.weightRecentData ? 'Enabled' : 'Disabled'}`,
      '',
      '## Forecast Summary',
      `Total Predictions: ${forecastData.length}`,
      `High Risk Periods: ${forecastData.filter(f => f.riskLevel === 'high' || f.riskLevel === 'critical').length}`,
      `Increasing Trends: ${forecastData.filter(f => f.trend === 'increasing').length}`,
      '',
      '## Detailed Predictions',
      'Date,Precinct,Crime Type,Predicted Count,Confidence,Trend,Risk Level',
      ...forecastData.map(f => {
        const precinct = GetPrecinctsDictionary[f.precinct] || `Precinct ${f.precinct}`;
        const crimeType = CrimeTypesDictionary[f.crimeType] || `Crime Type ${f.crimeType}`;
        const date = format(new Date(f.year, f.month - 1), 'yyyy-MM');
        return `${date},${precinct},${crimeType},${f.predictedCount},${(f.confidence * 100).toFixed(1)}%,${f.trend},${f.riskLevel}`;
      })
    ].join('\n');

    const blob = new Blob([reportLines], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crime-forecast-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Forecast report downloaded successfully!');
  }, [forecastData, forecastParams]);

  return (
    <div className="h-full p-6 space-y-6 overflow-auto">
      <ToastContainer />
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Crime Forecasting</h1>
          <p className="text-gray-600">Predict future crime patterns based on historical data analysis</p>
        </div>

        {forecastData.length > 0 && (
          <button
            onClick={downloadForecastReport}
            className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Forecast
          </button>
        )}
      </div>

      {/* Data Requirements & Disclaimer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="font-semibold text-blue-800">📊 Data Requirements & Forecast Reliability</h3>
          </div>
          <button
            onClick={() => setShowDataRequirements(!showDataRequirements)}
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center"
          >
            {showDataRequirements ? 'Hide Details' : 'Show Details'}
            <svg className={`w-4 h-4 ml-1 transform transition-transform ${showDataRequirements ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        
        {showDataRequirements && (
          <div className="mt-4 pt-4 border-t border-blue-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-700">
              {/* Minimum Requirements */}
              <div>
                <h4 className="font-medium mb-2">🎯 Minimum Data Requirements:</h4>
                <ul className="space-y-1 text-xs">
                  <li>• <strong>1,000+ incidents</strong> total</li>
                  <li>• <strong>24+ months</strong> of historical data</li>
                  <li>• <strong>5+ incidents</strong> per precinct/crime type</li>
                  <li>• <strong>3+ precincts</strong> geographic coverage</li>
                  <li>• <strong>2+ crime types</strong> for pattern analysis</li>
                </ul>
              </div>
              
              {/* Reliability Levels */}
              <div>
                <h4 className="font-medium mb-2">🔍 Reliability Scoring:</h4>
                <ul className="space-y-1 text-xs">
                  <li>• <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1"></span><strong>80%+</strong> Excellent (50+ incidents/category, 3+ years)</li>
                  <li>• <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mr-1"></span><strong>60-79%</strong> Good (25+ incidents/category, 2+ years)</li>
                  <li>• <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mr-1"></span><strong>40-59%</strong> Fair (10+ incidents/category, 1+ year)</li>
                  <li>• <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1"></span><strong>&lt;40%</strong> Poor (limited data, filtered from map)</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-100 rounded border-l-4 border-blue-400">
              <p className="text-sm text-blue-800">
                <strong>⚠️ Important:</strong> Forecast accuracy depends heavily on data quality and quantity. 
                Predictions with reliability scores below 60% should be used with caution and supplemented with expert judgment. 
                For critical operational decisions, ensure your dataset meets the recommended requirements above.
              </p>
            </div>
            
            <div className="mt-3 text-xs text-blue-600">
              <strong>💡 Tip:</strong> The system automatically filters low-reliability forecasts from map display. 
              Check the console for detailed quality metrics after generating forecasts.
            </div>
          </div>
        )}
      </div>

      {/* Analysis Status & Configuration */}
      {!analysisLoaded ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-yellow-600 mr-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.865-.833-2.635 0L4.178 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-800 mb-2">No Analysis Data Found</h3>
              <p className="text-sm text-yellow-700 mb-4">
                Crime forecasting requires clustering analysis data to generate predictions. 
                You can run a new analysis or upload previously downloaded analysis data.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/analysis"
                  className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Run New Analysis
                </Link>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Analysis Data
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Forecast Configuration
              </h2>
              <div className="flex items-center space-x-3">
                <div className="flex items-center text-sm text-green-600">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Analysis Data Loaded ({clusters.length} clusters)
                </div>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-md hover:bg-blue-200 transition flex items-center"
                  title="Upload new analysis data"
                >
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload
                </button>
                <button
                  onClick={clearAnalysisData}
                  className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-md hover:bg-red-200 transition flex items-center"
                  title="Clear stored analysis data"
                >
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear Data
                </button>
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Forecast Parameters - Simplified */}
            <div className="max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  📅 Forecast Period (Months)
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={forecastParams.forecastPeriod}
                  onChange={(e) => setForecastParams({...forecastParams, forecastPeriod: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="How many months ahead to predict"
                />
                <p className="text-xs text-gray-500 mt-1">Recommended: 3-6 months for reliable predictions</p>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-blue-800">Using Polynomial Model</span>
                </div>
                <p className="text-xs text-blue-600 mt-1">Advanced quadratic trend analysis for accurate crime pattern forecasting</p>
              </div>
            </div>

            {/* Advanced Options - Collapsed by default */}
            <details className="border border-gray-200 rounded-md">
              <summary className="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-100">
                ⚙️ Advanced Options
              </summary>
              <div className="p-4 space-y-4 bg-white">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confidence Level: {(forecastParams.confidence * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0.8"
                    max="0.99"
                    step="0.01"
                    value={forecastParams.confidence}
                    onChange={(e) => setForecastParams({...forecastParams, confidence: parseFloat(e.target.value)})}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">Higher confidence = more conservative predictions</p>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={forecastParams.weightRecentData}
                    onChange={(e) => setForecastParams({...forecastParams, weightRecentData: e.target.checked})}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Prioritize Recent Trends</span>
                  <span className="text-xs text-gray-500 ml-2">(gives more weight to latest 6 months)</span>
                </div>
              </div>
            </details>

            {/* Generate Button */}
            <div className="flex justify-center pt-4 border-t border-gray-200">
              <button
                onClick={generateForecast}
                disabled={loading}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center font-medium shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Forecast...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Generate Forecast from Analysis
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forecast Filters */}
      {forecastData.length > 0 && (
        <ForecastFilters
          forecastData={forecastData}
          filters={forecastFilters}
          onFiltersChange={setForecastFilters}
          onFilteredDataChange={setFilteredForecastData}
        />
      )}

      {/* Results Tabs */}
      {(historicalData.length > 0 || forecastData.length > 0) && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <TabGroup selectedIndex={selectedTab} onChange={setSelectedTab}>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Forecast Results
                {filteredForecastData.length !== forecastData.length && filteredForecastData.length > 0 && (
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                    {filteredForecastData.length} of {forecastData.length} filtered
                  </span>
                )}
              </h2>
            </div>
            
            <TabList className="flex border-b border-gray-200 bg-gray-50">
              {[
                { key: 'summary', label: 'Summary', icon: '📋' },
                { key: 'timeseries', label: 'Time Series', icon: '📈' },
                { key: 'trends', label: 'Trend Analysis', icon: '📊' },
                { key: 'heatmap', label: 'Risk Heatmap', icon: '🔥' },
                { key: 'manpower', label: 'Manpower Allocation', icon: '👮' },
                { key: 'map', label: 'Forecast Map', icon: '🗺️' },
                { key: 'documentation', label: 'Documentation', icon: '📚' }
              ].map((tab, index) => (
                <Tab
                  key={tab.key}
                  className={({ selected }) =>
                    selected
                      ? 'relative flex-1 py-3 px-4 text-sm font-medium text-blue-700 bg-white border-b-2 border-blue-600 focus:outline-none'
                      : 'relative flex-1 py-3 px-4 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 focus:outline-none'
                  }
                >
                  <span className="flex items-center justify-center w-full">
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleInfoModal(tab.key);
                      }}
                      className="ml-2 p-1 rounded-full hover:bg-blue-100 hover:text-blue-600 transition-colors cursor-pointer"
                      title={`Learn about ${tab.label}`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleInfoModal(tab.key);
                        }
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                  </span>
                </Tab>
              ))}
            </TabList>

            <TabPanels>
              <TabPanel className="p-6">
                <ForecastSummary 
                  historicalData={historicalData}
                  forecastData={filteredForecastData.length > 0 ? filteredForecastData : forecastData}
                  params={forecastParams}
                  manpowerSettings={manpowerSettings}
                />
              </TabPanel>
              
              <TabPanel className="p-6">
                <TimeSeriesChart 
                  historicalData={historicalData}
                  forecastData={filteredForecastData.length > 0 ? filteredForecastData : forecastData}
                  params={forecastParams}
                />
              </TabPanel>
              
              <TabPanel className="p-6">
                <TrendAnalysis 
                  historicalData={historicalData}
                  forecastData={filteredForecastData.length > 0 ? filteredForecastData : forecastData}
                />
              </TabPanel>
              
              <TabPanel className="p-6">
                <RiskHeatmap 
                  forecastData={filteredForecastData.length > 0 ? filteredForecastData : forecastData}
                />
              </TabPanel>
              
              <TabPanel className="p-6">
                <ManpowerAllocationComponent 
                  historicalData={historicalData}
                  forecastData={filteredForecastData.length > 0 ? filteredForecastData : forecastData}
                  manpowerSettings={manpowerSettings}
                  onSettingsChange={setManpowerSettings}
                />
              </TabPanel>
              
              <TabPanel className="p-6">
                <ForecastMap 
                  center={[14.4081, 121.0415]} // Muntinlupa center
                  zoom={13}
                  forecastPoints={forecastMapPoints}
                  loading={loading}
                />
              </TabPanel>
              
              <TabPanel className="p-6">
                <ForecastDocumentation 
                  historicalData={historicalData}
                  forecastData={filteredForecastData.length > 0 ? filteredForecastData : forecastData}
                />
              </TabPanel>
            </TabPanels>
          </TabGroup>
        </div>
      )}

      {/* Info Modals for Each Tab */}
      {/* Summary Info Modal */}
      {showInfoModals.summary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                  <span className="mr-2">📋</span>
                  Forecast Summary - How It Works
                </h3>
                <button 
                  onClick={() => toggleInfoModal('summary')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4 text-sm">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">🎯 What is the Summary Tab?</h4>
                  <p className="text-blue-700">The Summary tab provides a high-level overview of your forecast results, including key metrics, risk distributions, and accuracy indicators for all precincts and crime types.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">📊 Key Metrics Displayed</h4>
                    <ul className="text-green-700 space-y-1">
                      <li>• <strong>Total Predicted Cases:</strong> Sum across all precincts/crime types</li>
                      <li>• <strong>Average Confidence:</strong> Mean prediction reliability</li>
                      <li>• <strong>Risk Distribution:</strong> Breakdown by Low/Medium/High/Critical</li>
                      <li>• <strong>Trend Analysis:</strong> Increasing/Decreasing/Stable patterns</li>
                      <li>• <strong>Top Risk Areas:</strong> Precincts requiring immediate attention</li>
                    </ul>
                  </div>
                  
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-orange-800 mb-2">🔍 How Risk Levels Are Calculated</h4>
                    <ul className="text-orange-700 space-y-1">
                      <li>• <strong>Dynamic Thresholds:</strong> Based on data distribution percentiles</li>
                      <li>• <strong>25th Percentile:</strong> Low risk threshold</li>
                      <li>• <strong>75th Percentile:</strong> Medium→High risk threshold</li>
                      <li>• <strong>90th Percentile:</strong> High→Critical risk threshold</li>
                      <li>• <strong>Confidence Weighting:</strong> Lower confidence = higher risk adjustment</li>
                    </ul>
                  </div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-purple-800 mb-2">⚡ Quick Actions Available</h4>
                  <ul className="text-purple-700 space-y-1">
                    <li>• <strong>Export Data:</strong> Download forecast results as CSV/Excel</li>
                    <li>• <strong>Filter Results:</strong> Focus on specific precincts, crime types, or risk levels</li>
                    <li>• <strong>Drill Down:</strong> Click on any metric to see detailed breakdowns</li>
                    <li>• <strong>Compare Periods:</strong> View month-by-month predictions</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                <p className="text-xs text-gray-600">
                  💡 <strong>Pro Tip:</strong> Use the Summary tab first to get an overall understanding of your forecast, then dive into specific tabs for detailed analysis of areas showing high risk levels.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time Series Info Modal */}
      {showInfoModals.timeseries && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                  <span className="mr-2">📈</span>
                  Time Series Analysis - Temporal Patterns
                </h3>
                <button 
                  onClick={() => toggleInfoModal('timeseries')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4 text-sm">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">📈 What is Time Series Analysis?</h4>
                  <p className="text-blue-700">Time series analysis shows how crime patterns change over time, helping you identify seasonal trends, cyclical patterns, and long-term trajectories for better resource planning.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">📊 Chart Components</h4>
                    <ul className="text-green-700 space-y-1">
                      <li>• <strong>Historical Line:</strong> Past crime data (solid blue line)</li>
                      <li>• <strong>Forecast Line:</strong> Predicted future values (dashed red line)</li>
                      <li>• <strong>Confidence Bands:</strong> Gray shaded areas showing uncertainty</li>
                      <li>• <strong>Trend Line:</strong> Overall directional movement</li>
                      <li>• <strong>Seasonal Patterns:</strong> Recurring monthly/yearly cycles</li>
                    </ul>
                  </div>
                  
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-orange-800 mb-2">🔄 Prediction Models Used</h4>
                    <ul className="text-orange-700 space-y-1">
                      <li>• <strong>Linear Regression:</strong> Basic trend extrapolation</li>
                      <li>• <strong>Polynomial:</strong> Captures curved trends and accelerations</li>
                      <li>• <strong>Seasonal ARIMA:</strong> Accounts for cyclical patterns</li>
                      <li>• <strong>Weighted Recent:</strong> Emphasizes more recent data</li>
                      <li>• <strong>Ensemble:</strong> Combines multiple models for accuracy</li>
                    </ul>
                  </div>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 mb-2">🎯 How to Interpret Charts</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-yellow-700">
                    <div>
                      <h5 className="font-medium mb-1">Trend Patterns:</h5>
                      <ul className="space-y-1">
                        <li>• <strong>Upward slope:</strong> Increasing crime trend</li>
                        <li>• <strong>Downward slope:</strong> Decreasing crime trend</li>
                        <li>• <strong>Flat line:</strong> Stable crime levels</li>
                        <li>• <strong>Zigzag pattern:</strong> Volatile/unpredictable</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium mb-1">Confidence Indicators:</h5>
                      <ul className="space-y-1">
                        <li>• <strong>Narrow bands:</strong> High prediction confidence</li>
                        <li>• <strong>Wide bands:</strong> High uncertainty</li>
                        <li>• <strong>Growing bands:</strong> Uncertainty increases over time</li>
                        <li>• <strong>R² Score:</strong> Model accuracy (closer to 1.0 = better)</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-purple-800 mb-2">🛠️ Interactive Features</h4>
                  <ul className="text-purple-700 space-y-1">
                    <li>• <strong>Zoom & Pan:</strong> Focus on specific time periods</li>
                    <li>• <strong>Toggle Lines:</strong> Show/hide historical vs forecast data</li>
                    <li>• <strong>Hover Details:</strong> Get exact values for any point</li>
                    <li>• <strong>Export Chart:</strong> Download as image or data file</li>
                    <li>• <strong>Filter by:</strong> Precinct, crime type, confidence level</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                <p className="text-xs text-gray-600">
                  💡 <strong>Pro Tip:</strong> Look for seasonal patterns (crime spikes during certain months) and use confidence bands to assess prediction reliability. Wide bands suggest more uncertainty.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trend Analysis Info Modal */}
      {showInfoModals.trends && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                  <span className="mr-2">📊</span>
                  Trend Analysis - Pattern Recognition
                </h3>
                <button 
                  onClick={() => toggleInfoModal('trends')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4 text-sm">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">📊 What is Trend Analysis?</h4>
                  <p className="text-blue-700">Trend analysis identifies directional changes in crime patterns, helping you understand whether crime is increasing, decreasing, or remaining stable across different dimensions.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-red-800 mb-2">📈 Increasing Trends</h4>
                    <ul className="text-red-700 space-y-1">
                      <li>• Rising crime rates</li>
                      <li>• Requires immediate attention</li>
                      <li>• Higher resource allocation needed</li>
                      <li>• Preventive measures urgent</li>
                    </ul>
                  </div>
                  
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-yellow-800 mb-2">➡️ Stable Trends</h4>
                    <ul className="text-yellow-700 space-y-1">
                      <li>• Consistent crime levels</li>
                      <li>• Maintain current strategies</li>
                      <li>• Monitor for changes</li>
                      <li>• Balanced resource distribution</li>
                    </ul>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">📉 Decreasing Trends</h4>
                    <ul className="text-green-700 space-y-1">
                      <li>• Declining crime rates</li>
                      <li>• Strategies working effectively</li>
                      <li>• Resource reallocation opportunity</li>
                      <li>• Continue successful approaches</li>
                    </ul>
                  </div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-purple-800 mb-2">🔬 Trend Calculation Methods</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-purple-700">
                    <div>
                      <h5 className="font-medium mb-1">Statistical Methods:</h5>
                      <ul className="space-y-1">
                        <li>• <strong>Linear Regression:</strong> Overall slope direction</li>
                        <li>• <strong>Moving Averages:</strong> Smoothed trend lines</li>
                        <li>• <strong>Seasonal Decomposition:</strong> Trend vs seasonal effects</li>
                        <li>• <strong>Mann-Kendall Test:</strong> Statistical significance</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium mb-1">Confidence Metrics:</h5>
                      <ul className="space-y-1">
                        <li>• <strong>R-squared:</strong> How well trend explains data</li>
                        <li>• <strong>P-value:</strong> Statistical significance</li>
                        <li>• <strong>Confidence Interval:</strong> Range of likely values</li>
                        <li>• <strong>Trend Strength:</strong> Rate of change per month</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-orange-800 mb-2">🎯 Actionable Insights</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-orange-700">
                    <div>
                      <h5 className="font-medium mb-1">For Increasing Trends:</h5>
                      <ul className="space-y-1">
                        <li>• Increase patrol frequency</li>
                        <li>• Deploy additional officers</li>
                        <li>• Implement prevention programs</li>
                        <li>• Analyze root causes</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium mb-1">For Decreasing Trends:</h5>
                      <ul className="space-y-1">
                        <li>• Document successful strategies</li>
                        <li>• Maintain current approaches</li>
                        <li>• Consider resource reallocation</li>
                        <li>• Share best practices</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                <p className="text-xs text-gray-600">
                  💡 <strong>Pro Tip:</strong> Pay special attention to precincts with increasing trends and high confidence scores - these areas need immediate intervention and increased resource allocation.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Risk Heatmap Info Modal */}
      {showInfoModals.heatmap && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                  <span className="mr-2">🔥</span>
                  Risk Heatmap - Spatial Risk Visualization
                </h3>
                <button 
                  onClick={() => toggleInfoModal('heatmap')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4 text-sm">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">🔥 What is Risk Heatmap?</h4>
                  <p className="text-blue-700">The Risk Heatmap provides a visual representation of crime risk levels across precincts and crime types, using color intensity to show areas requiring immediate attention.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-red-800 mb-2">🎨 Color Coding System</h4>
                    <ul className="text-red-700 space-y-1">
                      <li>• <span className="inline-block w-4 h-4 bg-red-600 rounded mr-2"></span><strong>Dark Red:</strong> Critical risk (&gt;90th percentile)</li>
                      <li>• <span className="inline-block w-4 h-4 bg-orange-500 rounded mr-2"></span><strong>Orange:</strong> High risk (75-90th percentile)</li>
                      <li>• <span className="inline-block w-4 h-4 bg-yellow-500 rounded mr-2"></span><strong>Yellow:</strong> Medium risk (25-75th percentile)</li>
                      <li>• <span className="inline-block w-4 h-4 bg-green-500 rounded mr-2"></span><strong>Green:</strong> Low risk (&lt;25th percentile)</li>
                      <li>• <span className="inline-block w-4 h-4 bg-gray-300 rounded mr-2"></span><strong>Gray:</strong> No data available</li>
                    </ul>
                  </div>
                  
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-purple-800 mb-2">🔍 Risk Calculation Formula</h4>
                    <ul className="text-purple-700 space-y-1">
                      <li>• <strong>Base Risk:</strong> Predicted count / Historical average</li>
                      <li>• <strong>Confidence Weight:</strong> Lower confidence = Higher risk</li>
                      <li>• <strong>Trend Factor:</strong> Increasing trends boost risk</li>
                      <li>• <strong>Seasonal Adjustment:</strong> Account for time-of-year patterns</li>
                      <li>• <strong>Dynamic Thresholds:</strong> Percentile-based cutoffs</li>
                    </ul>
                  </div>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 mb-2">📈 How to Read the Heatmap</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-yellow-700">
                    <div>
                      <h5 className="font-medium mb-1">Rows (Precincts):</h5>
                      <ul className="space-y-1">
                        <li>• Each row represents a police precinct</li>
                        <li>• Look for rows with many red/orange cells</li>
                        <li>• These precincts need immediate attention</li>
                        <li>• Green rows indicate lower overall risk</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium mb-1">Columns (Crime Types):</h5>
                      <ul className="space-y-1">
                        <li>• Each column represents a crime type</li>
                        <li>• Look for columns with many red/orange cells</li>
                        <li>• These crime types are trending upward</li>
                        <li>• Patterns reveal city-wide crime trends</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-800 mb-2">🎯 Strategic Applications</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-green-700">
                    <div>
                      <h5 className="font-medium mb-1">Resource Allocation:</h5>
                      <ul className="space-y-1">
                        <li>• Deploy more officers to red/orange areas</li>
                        <li>• Reduce resources in consistently green areas</li>
                        <li>• Plan patrol routes based on risk patterns</li>
                        <li>• Schedule shifts during high-risk periods</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium mb-1">Prevention Programs:</h5>
                      <ul className="space-y-1">
                        <li>• Target community programs to hot spots</li>
                        <li>• Focus crime prevention on specific types</li>
                        <li>• Coordinate with other agencies</li>
                        <li>• Monitor intervention effectiveness</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                <p className="text-xs text-gray-600">
                  💡 <strong>Pro Tip:</strong> Focus on the darkest red cells first - these represent the highest risk combinations of precinct and crime type that need immediate intervention.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manpower Allocation Info Modal */}
      {showInfoModals.manpower && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                  <span className="mr-2">👮</span>
                  Manpower Allocation - Resource Optimization
                </h3>
                <button 
                  onClick={() => toggleInfoModal('manpower')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4 text-sm">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">👮 What is Manpower Allocation?</h4>
                  <p className="text-blue-700">This section provides data-driven recommendations for optimal officer deployment based on forecast risk levels, current allocations, and historical effectiveness patterns.</p>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-orange-800 mb-2">📊 Risk Level Determination (Alabang Example)</h4>
                  <div className="text-orange-700">
                    <p className="mb-2"><strong>Why was Alabang deemed LOW risk?</strong></p>
                    <ul className="space-y-1">
                      <li>• <strong>Risk Distribution:</strong> 0 Critical (0%), 0 High (0%), 2 Medium (22.2%), 7 Low (77.8%)</li>
                      <li>• <strong>Majority Rule:</strong> 77.8% of forecast periods show LOW risk</li>
                      <li>• <strong>Forecast vs Historical:</strong> Predicted count is 172 vs historical average</li>
                      <li>• <strong>Dynamic Thresholds:</strong> Based on 25th percentile cutoff</li>
                      <li>• <strong>Confidence Factor:</strong> High confidence predictions carry more weight</li>
                    </ul>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">📊 Current vs Recommended</h4>
                    <ul className="text-green-700 space-y-1">
                      <li>• <strong>Current Allocation:</strong> From live precinct data</li>
                      <li>• <strong>Recommended:</strong> Based on risk assessment</li>
                      <li>• <strong>Change %:</strong> Adjustment needed</li>
                      <li>• <strong>Justification:</strong> Detailed explanation with calculations</li>
                      <li>• <strong>Shift Analysis:</strong> Time-of-day breakdowns</li>
                    </ul>
                  </div>
                  
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-purple-800 mb-2">🔄 Dynamic Factors</h4>
                    <ul className="text-purple-700 space-y-1">
                      <li>• <strong>Monthly Variations:</strong> Crime patterns by month</li>
                      <li>• <strong>Yearly Growth:</strong> Long-term trend adjustments</li>
                      <li>• <strong>Seasonal Patterns:</strong> Weather/holiday effects</li>
                      <li>• <strong>Risk Multipliers:</strong> Low=0.8x, High=1.5x, Critical=2.0x</li>
                      <li>• <strong>Confidence Weighting:</strong> Uncertainty adjustments</li>
                    </ul>
                  </div>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 mb-2">🕰️ Shift-Based Analysis</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-yellow-700">
                    <div>
                      <h5 className="font-medium">Morning (6 AM-2 PM):</h5>
                      <ul>
                        <li>• Business hours crimes</li>
                        <li>• Theft, fraud patterns</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium">Evening (2 PM-10 PM):</h5>
                      <ul>
                        <li>• Rush hour incidents</li>
                        <li>• Public space crimes</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium">Night (10 PM-6 AM):</h5>
                      <ul>
                        <li>• Higher risk period</li>
                        <li>• Violent crimes peak</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-red-800 mb-2">⚠️ Action Required Indicators</h4>
                  <ul className="text-red-700 space-y-1">
                    <li>• <strong>Red Change %:</strong> &gt;+10% increase needed immediately</li>
                    <li>• <strong>Critical Risk:</strong> Multiple high-risk forecast periods</li>
                    <li>• <strong>Increasing Trends:</strong> Upward crime trajectory</li>
                    <li>• <strong>Low Coverage:</strong> Insufficient 24/7 staffing</li>
                    <li>• <strong>High Confidence:</strong> Reliable predictions requiring action</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                <p className="text-xs text-gray-600">
                  💡 <strong>Pro Tip:</strong> The detailed risk calculations show why each precinct gets its risk level. Low risk (like Alabang) means most forecast periods predict stable/decreasing crime, allowing resource reallocation.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forecast Map Info Modal */}
      {showInfoModals.map && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                  <span className="mr-2">🗺️</span>
                  Forecast Map - Geographic Risk Distribution
                </h3>
                <button 
                  onClick={() => toggleInfoModal('map')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4 text-sm">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">🗺️ What is the Forecast Map?</h4>
                  <p className="text-blue-700">The Forecast Map visualizes predicted crime hotspots geographically, showing where crimes are most likely to occur and helping you plan patrol routes and resource deployment.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-red-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-red-800 mb-2">📍 Map Markers Explained</h4>
                    <ul className="text-red-700 space-y-1">
                      <li>• <strong>Red Circles:</strong> Critical risk areas (immediate attention)</li>
                      <li>• <strong>Orange Circles:</strong> High risk zones (increased patrols)</li>
                      <li>• <strong>Yellow Circles:</strong> Medium risk areas (regular monitoring)</li>
                      <li>• <strong>Green Circles:</strong> Low risk zones (minimal resources)</li>
                      <li>• <strong>Circle Size:</strong> Predicted crime volume</li>
                    </ul>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">🔍 Data Reliability Filter</h4>
                    <ul className="text-green-700 space-y-1">
                      <li>• <strong>High Confidence:</strong> Only reliable predictions shown</li>
                      <li>• <strong>Geographic Accuracy:</strong> Precise location mapping</li>
                      <li>• <strong>Historical Validation:</strong> Based on past crime locations</li>
                      <li>• <strong>Pattern Recognition:</strong> Recurring hotspot identification</li>
                      <li>• <strong>Quality Threshold:</strong> Minimum reliability requirements</li>
                    </ul>
                  </div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-purple-800 mb-2">🛠️ Interactive Features</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-purple-700">
                    <div>
                      <h5 className="font-medium mb-1">Map Controls:</h5>
                      <ul className="space-y-1">
                        <li>• <strong>Zoom In/Out:</strong> Focus on specific areas</li>
                        <li>• <strong>Pan & Drag:</strong> Navigate across the city</li>
                        <li>• <strong>Layer Toggle:</strong> Show/hide different data</li>
                        <li>• <strong>Marker Clustering:</strong> Group nearby predictions</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium mb-1">Click Actions:</h5>
                      <ul className="space-y-1">
                        <li>• <strong>Marker Details:</strong> View prediction specifics</li>
                        <li>• <strong>Confidence Score:</strong> Reliability percentage</li>
                        <li>• <strong>Crime Type:</strong> Specific offense predicted</li>
                        <li>• <strong>Time Period:</strong> When crime is expected</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 mb-2">🎯 Strategic Applications</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-yellow-700">
                    <div>
                      <h5 className="font-medium mb-1">Patrol Planning:</h5>
                      <ul className="space-y-1">
                        <li>• Route optimization based on hotspots</li>
                        <li>• Timing patrols during high-risk periods</li>
                        <li>• Coordinating multi-precinct responses</li>
                        <li>• Positioning quick response units</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium mb-1">Prevention Strategies:</h5>
                      <ul>
                        <li>• Community outreach in hotspots</li>
                        <li>• Environmental crime prevention</li>
                        <li>• Business partnership programs</li>
                        <li>• Public awareness campaigns</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                <p className="text-xs text-gray-600">
                  💡 <strong>Pro Tip:</strong> Use the map to identify geographic crime clusters and plan patrol routes that efficiently cover multiple high-risk areas in a single route.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Documentation Info Modal */}
      {showInfoModals.documentation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                  <span className="mr-2">📚</span>
                  Documentation - Technical References
                </h3>
                <button 
                  onClick={() => toggleInfoModal('documentation')}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4 text-sm">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">📚 What is Documentation?</h4>
                  <p className="text-blue-700">The Documentation tab provides comprehensive technical details about data sources, algorithms, statistical methods, and system architecture used in the forecasting process.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-green-800 mb-2">📊 Data & Methodology</h4>
                    <ul className="text-green-700 space-y-1">
                      <li>• <strong>Data Sources:</strong> Historical crime databases</li>
                      <li>• <strong>Processing Pipeline:</strong> Cleaning and validation steps</li>
                      <li>• <strong>Statistical Models:</strong> Algorithms and parameters</li>
                      <li>• <strong>Validation Methods:</strong> Accuracy testing approaches</li>
                      <li>• <strong>Confidence Calculation:</strong> Reliability metrics</li>
                    </ul>
                  </div>
                  
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-orange-800 mb-2">🔬 Technical Details</h4>
                    <ul className="text-orange-700 space-y-1">
                      <li>• <strong>Model Performance:</strong> R² scores, RMSE values</li>
                      <li>• <strong>Cross-Validation:</strong> Out-of-sample testing</li>
                      <li>• <strong>Feature Engineering:</strong> Variable transformations</li>
                      <li>• <strong>Hyperparameters:</strong> Model configuration details</li>
                      <li>• <strong>API Specifications:</strong> Integration documentation</li>
                    </ul>
                  </div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-purple-800 mb-2">📈 Quality Metrics</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-purple-700">
                    <div>
                      <h5 className="font-medium mb-1">Accuracy Measures:</h5>
                      <ul className="space-y-1">
                        <li>• <strong>Mean Absolute Error:</strong> Average prediction error</li>
                        <li>• <strong>Root Mean Square Error:</strong> Standard deviation of errors</li>
                        <li>• <strong>Mean Absolute Percentage Error:</strong> Relative accuracy</li>
                        <li>• <strong>R-squared:</strong> Variance explained by model</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium mb-1">Reliability Indicators:</h5>
                      <ul className="space-y-1">
                        <li>• <strong>Confidence Intervals:</strong> Prediction uncertainty</li>
                        <li>• <strong>P-values:</strong> Statistical significance</li>
                        <li>• <strong>Cross-validation Score:</strong> Generalization ability</li>
                        <li>• <strong>Feature Importance:</strong> Variable contributions</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-yellow-800 mb-2">🛠️ System Architecture</h4>
                  <ul className="text-yellow-700 space-y-1">
                    <li>• <strong>Frontend:</strong> React/Next.js with TypeScript</li>
                    <li>• <strong>Backend:</strong> .NET Core API with Entity Framework</li>
                    <li>• <strong>Database:</strong> SQL Server with optimized queries</li>
                    <li>• <strong>ML Pipeline:</strong> Python scikit-learn models</li>
                    <li>• <strong>Visualization:</strong> Chart.js and Leaflet maps</li>
                    <li>• <strong>Security:</strong> JWT authentication and role-based access</li>
                  </ul>
                </div>
                
                <div className="bg-red-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-red-800 mb-2">🔍 Who Should Use Documentation?</h4>
                  <ul className="text-red-700 space-y-1">
                    <li>• <strong>Data Scientists:</strong> Understanding model internals</li>
                    <li>• <strong>IT Administrators:</strong> System maintenance and updates</li>
                    <li>• <strong>Auditors:</strong> Compliance and accuracy verification</li>
                    <li>• <strong>Researchers:</strong> Methodology validation and improvement</li>
                    <li>• <strong>Managers:</strong> Understanding system capabilities and limitations</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                <p className="text-xs text-gray-600">
                  💡 <strong>Pro Tip:</strong> Check the Documentation tab to understand model performance metrics and validate that the system meets your accuracy requirements for operational use.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {historicalData.length === 0 && forecastData.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Forecast Generated</h3>
            <p className="text-gray-500 mb-4">Configure your forecast parameters above and click &quot;Generate Forecast&quot; to predict future crime patterns.</p>
            <div className="text-sm text-gray-400">
              <p>🔍 Select historical date range for training data</p>
              <p>📅 Choose forecast period (1-12 months ahead)</p>
              <p>🎯 Pick prediction model (Linear, Polynomial, Seasonal, ARIMA)</p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Analysis Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Upload Analysis Data</h3>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadError(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">
                  Upload a JSON file containing analysis data downloaded from the Analysis page.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <h4 className="text-sm font-medium text-blue-800 mb-2">Supported Format:</h4>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>• JSON files exported from the Analysis page</li>
                    <li>• Files must contain clusters and metadata</li>
                    <li>• Previously downloaded analysis results</li>
                  </ul>
                </div>
                
                {uploadError && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {uploadError}
                  </div>
                )}
                
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleAnalysisUpload}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadError(null);
                  }}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default withAuth(ForecastPage);
