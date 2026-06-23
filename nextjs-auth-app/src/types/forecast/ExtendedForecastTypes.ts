// Extended forecast data types for map visualization and enhanced analysis

import type { ForecastData } from './ForecastBaseTypes';

export interface ReliabilityMetrics {
  score: number;              // 0-1, overall reliability score
  sampleSize: number;         // Historical data points used
  historicalVariance: number; // Variance in historical data
  confidenceInterval: number; // Width of confidence interval
  timeSpanCoverage: number;   // Years of historical data coverage
  seasonalPattern: boolean;   // Whether seasonal patterns were detected
}

export interface ExtendedForecastData extends ForecastData {
  latitude: number;
  longitude: number;
  clusterId?: number;
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
  forecastPeriod: string; // "2024-03" format
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface ForecastMapFilters {
  minReliability: number;
  maxReliability: number;
  minConfidence: number;
  maxConfidence: number;
  riskLevels: ('low' | 'medium' | 'high' | 'critical')[];
  precincts: number[];
  crimeTypes: number[];
  forecastPeriods: string[]; // Array of "YYYY-MM" strings
}

export interface MapForecastSummary {
  totalPoints: number;
  averageReliability: number;
  highRiskPoints: number;
  filteredPoints: number;
  riskLevelDistribution: Record<'low' | 'medium' | 'high' | 'critical', number>;
  precinctCoverage: number[];
  crimeTypeCoverage: number[];
}

// Default filter values
export const DEFAULT_FORECAST_FILTERS: ForecastMapFilters = {
  minReliability: 0.3,
  maxReliability: 1.0,
  minConfidence: 0.5,
  maxConfidence: 1.0,
  riskLevels: ['low', 'medium', 'high', 'critical'],
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

// Reliability score thresholds
export const RELIABILITY_THRESHOLDS = {
  excellent: 0.8,
  good: 0.6,
  fair: 0.4,
  poor: 0.2
} as const;
