'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import withAuth from '../hoc/withAuth';
import { apiService } from '../api/utils/apiService';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { format, addMonths, subMonths, subDays } from 'date-fns';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../../constants/consts';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import ForecastConfiguration from './ForecastConfiguration';
import TimeSeriesChart from './TimeSeriesChart';
import TrendAnalysis from './TrendAnalysis';
import RiskHeatmap from './RiskHeatmap';
import ForecastSummary from './ForecastSummary';

// TypeScript interfaces
interface HistoricalData {
  year: number;
  month: number;
  precinct: number;
  crimeType: number;
  count: number;
  timeOfDay: string;
  severity?: string;
  weather?: string;
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
}

interface ForecastParams {
  dateFrom: string;
  dateTo: string;
  forecastPeriod: number; // months ahead
  precincts: number[];
  crimeTypes: number[];
  timeOfDay: string[];
  model: 'linear' | 'polynomial' | 'seasonal' | 'arima';
  confidence: number;
}

const ForecastPage = () => {
  // State management
  const [loading, setLoading] = useState(false);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [selectedTab, setSelectedTab] = useState(0);

  // Forecast parameters
  const [forecastParams, setForecastParams] = useState<ForecastParams>({
    dateFrom: format(subMonths(new Date(), 24), 'yyyy-MM-dd'), // 2 years of historical data
    dateTo: format(subDays(new Date(), 1), 'yyyy-MM-dd'),
    forecastPeriod: 6, // 6 months ahead
    precincts: [],
    crimeTypes: [],
    timeOfDay: [],
    model: 'linear',
    confidence: 0.95
  });

  // Generate forecast using historical data patterns
  const generateForecast = useCallback(async () => {
    if (!forecastParams.dateFrom || !forecastParams.dateTo) {
      toast.error('Please select both start and end dates.');
      return;
    }

    if (forecastParams.forecastPeriod < 1 || forecastParams.forecastPeriod > 12) {
      toast.error('Forecast period must be between 1 and 12 months.');
      return;
    }

    setLoading(true);
    setForecastData([]);

    try {
      // First, fetch historical data from the incident API
      const historicalResponse = await apiService.get('/incident');
      console.log('Historical data fetched:', historicalResponse);

      if (!historicalResponse || !Array.isArray(historicalResponse)) {
        throw new Error('Invalid historical data format');
      }

      // Process and aggregate historical data
      const processedData = processHistoricalData(historicalResponse, forecastParams);
      setHistoricalData(processedData);

      // Generate predictions based on historical patterns
      const predictions = generatePredictions(processedData, forecastParams);
      setForecastData(predictions);

      toast.success(`Forecast generated successfully! Predicted ${predictions.length} data points for the next ${forecastParams.forecastPeriod} months.`);

    } catch (err: any) {
      console.error('Forecast generation error:', err);
      toast.error(`Failed to generate forecast: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [forecastParams]);

  // Process raw incident data into aggregated historical data
  const processHistoricalData = (rawData: any[], params: ForecastParams): HistoricalData[] => {
    const aggregated = new Map<string, HistoricalData>();

    rawData.forEach(incident => {
      // Apply filters
      if (params.precincts.length > 0 && !params.precincts.includes(incident.precinct)) return;
      if (params.crimeTypes.length > 0 && !params.crimeTypes.includes(incident.crimeType)) return;
      if (params.timeOfDay.length > 0 && !params.timeOfDay.includes(incident.timeOfDay)) return;

      // Create aggregation key
      const key = `${incident.year}-${incident.month}-${incident.precinct}-${incident.crimeType}`;
      
      if (aggregated.has(key)) {
        aggregated.get(key)!.count++;
      } else {
        aggregated.set(key, {
          year: incident.year,
          month: incident.month,
          precinct: incident.precinct,
          crimeType: incident.crimeType,
          count: 1,
          timeOfDay: incident.timeOfDay,
          severity: incident.severity,
          weather: incident.weather
        });
      }
    });

    return Array.from(aggregated.values()).sort((a, b) => 
      new Date(a.year, a.month - 1).getTime() - new Date(b.year, b.month - 1).getTime()
    );
  };

  // Generate predictions using simple statistical methods
  const generatePredictions = (historical: HistoricalData[], params: ForecastParams): ForecastData[] => {
    const predictions: ForecastData[] = [];
    const baseDate = new Date();

    // Group historical data by precinct and crime type
    const groups = new Map<string, HistoricalData[]>();
    
    historical.forEach(data => {
      const key = `${data.precinct}-${data.crimeType}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(data);
    });

    // Generate predictions for each group
    groups.forEach((groupData, key) => {
      const [precinct, crimeType] = key.split('-').map(Number);
      
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

        // Determine trend and risk level
        const recentAvg = groupData.slice(-6).reduce((sum, d) => sum + d.count, 0) / 6;
        const olderAvg = groupData.slice(-12, -6).reduce((sum, d) => sum + d.count, 0) / 6 || recentAvg;
        
        const trend: 'increasing' | 'decreasing' | 'stable' = 
          predictedCount > recentAvg * 1.1 ? 'increasing' :
          predictedCount < recentAvg * 0.9 ? 'decreasing' : 'stable';

        const riskLevel: 'low' | 'medium' | 'high' | 'critical' =
          predictedCount > recentAvg * 1.5 ? 'critical' :
          predictedCount > recentAvg * 1.2 ? 'high' :
          predictedCount > recentAvg * 0.8 ? 'medium' : 'low';

        predictions.push({
          year,
          month,
          precinct,
          crimeType,
          predictedCount: Math.max(0, Math.round(predictedCount)),
          confidence: Math.max(0.5, confidence - (monthOffset * 0.05)), // Confidence decreases with distance
          trend,
          riskLevel
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
      `Historical Period: ${forecastParams.dateFrom} to ${forecastParams.dateTo}`,
      `Forecast Period: ${forecastParams.forecastPeriod} months ahead`,
      `Model Used: ${forecastParams.model.toUpperCase()}`,
      `Confidence Level: ${(forecastParams.confidence * 100).toFixed(1)}%`,
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
    <div className="container mx-auto p-6 space-y-6">
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

      {/* Configuration Panel */}
      <ForecastConfiguration 
        params={forecastParams}
        onParamsChange={setForecastParams}
        onGenerate={generateForecast}
        loading={loading}
      />

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
              </h2>
            </div>
            
            <TabList className="flex border-b border-gray-200 bg-gray-50">
              {[
                { key: 'summary', label: 'Summary', icon: '📋' },
                { key: 'timeseries', label: 'Time Series', icon: '📈' },
                { key: 'trends', label: 'Trend Analysis', icon: '📊' },
                { key: 'heatmap', label: 'Risk Heatmap', icon: '🔥' }
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
                  forecastData={forecastData}
                  params={forecastParams}
                />
              </TabPanel>
              
              <TabPanel className="p-6">
                <TimeSeriesChart 
                  historicalData={historicalData}
                  forecastData={forecastData}
                  params={forecastParams}
                />
              </TabPanel>
              
              <TabPanel className="p-6">
                <TrendAnalysis 
                  historicalData={historicalData}
                  forecastData={forecastData}
                />
              </TabPanel>
              
              <TabPanel className="p-6">
                <RiskHeatmap 
                  forecastData={forecastData}
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
            <p className="text-gray-500 mb-4">Configure your forecast parameters above and click "Generate Forecast" to predict future crime patterns.</p>
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
