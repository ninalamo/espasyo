export interface ForecastData {
  year: number;
  month: number;
  precinct: number;
  crimeType: number;
  predictedCount: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  shiftBreakdown?: ShiftBreakdown;
  dominantShift?: string;
}

export interface ShiftBreakdown {
  Morning: ShiftDetail;
  Afternoon: ShiftDetail;
  Night: ShiftDetail;
}

export interface ShiftDetail {
  predicted: number;
  percentage: number;
  riskLevel: string;
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
  model: 'linear' | 'polynomial' | 'seasonal' | 'arima';
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
  metadata: ForecastMetadata;
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
