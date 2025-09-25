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

  // Forecast parameters
  const [forecastParams, setForecastParams] = useState<ForecastParams>({
    forecastPeriod: 6, // 6 months ahead
    model: 'polynomial', // Fixed polynomial model
    confidence: 0.95,
    includeSeasonality: true,
    weightRecentData: true
  });

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
    ].join('\\n');

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
            <div className="flex items-start">
              <div className="flex-1">
            
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
            <div>
              <h3 className="font-semibold text-yellow-800 mb-2">No Analysis Data Found</h3>
              <p className="text-sm text-yellow-700 mb-4">
                Crime forecasting requires clustering analysis data to generate predictions. 
                Please run the clustering analysis first to identify crime patterns.
              </p>
              <Link
                href="/analysis"
                className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Go to Analysis Page
              </Link>
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
                      ? 'flex-1 py-3 px-4 text-sm font-medium text-blue-700 bg-white border-b-2 border-blue-600 focus:outline-none'
                      : 'flex-1 py-3 px-4 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 focus:outline-none'
                  }
                >
                  <span className="flex items-center justify-center">
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
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
    </div>
  );
};

export default withAuth(ForecastPage);
