// Extended forecast data types for map visualization and enhanced analysis

export interface TimeOfDayBreakdown {
  morning: number;    // 6 AM - 12 PM
  afternoon: number;  // 12 PM - 6 PM
  evening: number;    // 6 PM - 12 AM
  night: number;      // 12 AM - 6 AM
}

export interface ReliabilityMetrics {
  score: number;              // 0-1, overall reliability score
  sampleSize: number;         // Historical data points used
  historicalVariance: number; // Variance in historical data
  confidenceInterval: number; // Width of confidence interval
  timeSpanCoverage: number;   // Years of historical data coverage
  seasonalPattern: boolean;   // Whether seasonal patterns were detected
}

export interface ExtendedForecastData {
  // Basic forecast data
  year: number;
  month: number;
  precinct: number;
  crimeType: number;
  predictedCount: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  
  // Extended spatial data
  latitude: number;
  longitude: number;
  clusterId?: number;
  
  // Time-of-day analysis
  timeOfDayBreakdown: TimeOfDayBreakdown;
  primaryTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  
  // Reliability metrics
  reliability: ReliabilityMetrics;
}

export interface ForecastMapPoint {
  id: string;
  latitude: number;
  longitude: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
  predictedCount: number;
  confidence: number;
  reliability: number;
  precinct: number;
  crimeType: number;
  timeOfDayBreakdown: TimeOfDayBreakdown;
  primaryTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  forecastPeriod: string; // "2024-03" format
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface ForecastMapFilters {
  minReliability: number;
  maxReliability: number;
  minConfidence: number;
  maxConfidence: number;
  riskLevels: ('low' | 'medium' | 'high' | 'critical')[];
  timeOfDay: ('morning' | 'afternoon' | 'evening' | 'night')[];
  precincts: number[];
  crimeTypes: number[];
  forecastPeriods: string[]; // Array of "YYYY-MM" strings
}

export interface MapForecastSummary {
  totalPoints: number;
  averageReliability: number;
  highRiskPoints: number;
  filteredPoints: number;
  timeOfDayDistribution: TimeOfDayBreakdown;
  riskLevelDistribution: Record<'low' | 'medium' | 'high' | 'critical', number>;
  precinctCoverage: number[];
  crimeTypeCoverage: number[];
}

// Utility functions for time of day categorization
export const categorizeTimeOfDay = (hour: number): 'morning' | 'afternoon' | 'evening' | 'night' => {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 24) return 'evening';
  return 'night';
};

export const getTimeOfDayHours = (category: 'morning' | 'afternoon' | 'evening' | 'night'): number[] => {
  switch (category) {
    case 'morning': return [6, 7, 8, 9, 10, 11];
    case 'afternoon': return [12, 13, 14, 15, 16, 17];
    case 'evening': return [18, 19, 20, 21, 22, 23];
    case 'night': return [0, 1, 2, 3, 4, 5];
  }
};

// Default filter values
export const DEFAULT_FORECAST_FILTERS: ForecastMapFilters = {
  minReliability: 0.3,
  maxReliability: 1.0,
  minConfidence: 0.5,
  maxConfidence: 1.0,
  riskLevels: ['low', 'medium', 'high', 'critical'],
  timeOfDay: ['morning', 'afternoon', 'evening', 'night'],
  precincts: [],
  crimeTypes: [],
  forecastPeriods: []
};

// Color mapping for risk levels on map
export const RISK_LEVEL_COLORS = {
  low: '#10B981',      // Green
  medium: '#F59E0B',   // Yellow/Amber
  high: '#EF4444',     // Red
  critical: '#7C2D12'  // Dark Red
};

// Color mapping for time of day
export const TIME_OF_DAY_COLORS = {
  morning: '#FED7AA',   // Light orange
  afternoon: '#FDE68A', // Light yellow
  evening: '#D8B4FE',   // Light purple
  night: '#A7F3D0'      // Light green
};

// Reliability score thresholds
export const RELIABILITY_THRESHOLDS = {
  excellent: 0.8,
  good: 0.6,
  fair: 0.4,
  poor: 0.2
} as const;
