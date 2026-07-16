export interface ForecastData {
  year: number;
  month: number;
  precinct: number;
  crimeType: number;
  shift?: 'Morning' | 'Afternoon' | 'Evening';
  predictedCount: number;
  confidence: number;
  lowerBound?: number;
  upperBound?: number;
  lastYearActual?: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}


export interface HistoricalData {
  year: number;
  month: number;
  precinct: number;
  crimeType: number;
  count: number;
  timeOfDay: string;
  clusterId?: number;
}

export interface ForecastParams {
  forecastPeriod: number;
  model: 'ssa';
  confidence: number;
  includeSeasonality: boolean;
  weightRecentData: boolean;
}

export interface ForecastFilterState {
  selectedPrecincts: number[];
  selectedCrimeTypes: number[];
  selectedRiskLevels: ('low' | 'medium' | 'high' | 'critical')[];
  selectedTrends: ('increasing' | 'decreasing' | 'stable')[];
  minConfidence: number;
  maxConfidence: number;
  minPredictedCount: number;
  maxPredictedCount: number;
  dateFrom: string;
  dateTo: string;
  showOnlyHighRisk: boolean;
  groupBy: 'precinct' | 'crimeType' | 'month' | 'risk';
}

export const initialForecastFilterState: ForecastFilterState = {
  selectedPrecincts: [],
  selectedCrimeTypes: [],
  selectedRiskLevels: ['low', 'medium', 'high', 'critical'],
  selectedTrends: ['increasing', 'decreasing', 'stable'],
  minConfidence: 0.0,
  maxConfidence: 1.0,
  minPredictedCount: 0,
  maxPredictedCount: 1000,
  dateFrom: '',
  dateTo: '',
  showOnlyHighRisk: false,
  groupBy: 'precinct'
};

export interface ForecastMetrics {
  meanAbsoluteError: number;
  rootMeanSquareError: number;
  meanAbsolutePercentageError: number;
  modelAccuracy: number;
}

export interface ForecastApiResponse {
  series?: any[];
  forecasts?: any[];
  spatial?: any[];
  metrics?: any;
  generatedAt?: string;
  modelUsed?: string;
  summary?: any;
  explanation?: any;
  dynamicThresholds?: any;
  temporalPatterns?: any;
  seasonalPredictions?: any[];
}

export interface ForecastSnapshot {
  id: string;
  name: string;
  createdAt: string;
  forecastPeriod: number;
  clusterSourceId?: string;
  predictions: ForecastData[];
  params: ForecastParams;
  dataQuality?: any;
  historicalData?: HistoricalData[];
  spatialData?: any[];
  seasonalPredictions?: any[];
  apiResponse?: ForecastApiResponse;
  metadata: ForecastMetadata;
  metrics?: ForecastMetrics | null;
}

export interface ForecastMetadata {
  totalClusters: number;
  totalPredictions: number;
  activeModel: string;
  analysisTimestamp?: string;
  precincts: number[];
  crimeTypes: number[];
}

export interface ForecastClusterItem {
  caseId: string;
  latitude: number;
  longitude: number;
  month: number;
  year: number;
  timeOfDay: string;
  precinct: number;
  crimeType: number;
}

export interface ForecastClusterGroup {
  clusterId: number;
  clusterItems: ForecastClusterItem[];
  clusterCount: number;
}

export interface CreateForecastRequest {
  name: string;
  forecastPeriod: number;
  clusterSourceId?: string;
  params: ForecastParams;
  predictions: ForecastData[];
  historicalData?: HistoricalData[];
  clusterData?: ForecastClusterGroup[];
  generatedById?: string;
  spatialData?: any[];
  seasonalPredictions?: any[];
  apiResponse?: ForecastApiResponse;
  metrics?: ForecastMetrics | null;
  metadata: ForecastSnapshot['metadata'];
}

export interface ForecastSummaryCard {
  id: string;
  name: string;
  createdAt: string;
  forecastPeriod: number;
  totalPredictions: number;
  activeModel: string;
  precinctCount: number;
  crimeTypeCount: number;
}

export interface ForecastComparisonDetail {
  precinct: string;
  crimeType: string;
  month: number;
  year: number;
  predictedValue: number;
  actualValue: number;
  absoluteError: number;
  percentageError: number;
}

export interface ForecastEvaluationResult {
  forecastRunId: string;
  totalComparisons: number;
  meanAbsoluteError: number;
  rootMeanSquareError: number;
  meanAbsolutePercentageError: number;
  isReliable: boolean;
  details: ForecastComparisonDetail[];
  warnings: string[];
}
