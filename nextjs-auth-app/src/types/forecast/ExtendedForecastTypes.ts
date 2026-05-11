// Extended forecast data types for map visualization and enhanced analysis

import type { ForecastData } from './ForecastBaseTypes';

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

export interface ExtendedForecastData extends ForecastData {
  latitude: number;
  longitude: number;
  clusterId?: number;
  timeOfDayBreakdown: TimeOfDayBreakdown;
  primaryTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
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

export interface SeasonalMultipliers {
  spring: number;  // March, April, May
  summer: number;  // June, July, August
  fall: number;    // September, October, November
  winter: number;  // December, January, February
}

export interface MonthlyMultipliers {
  january: number;
  february: number;
  march: number;
  april: number;
  may: number;
  june: number;
  july: number;
  august: number;
  september: number;
  october: number;
  november: number;
  december: number;
}

export interface YearlyAdjustments {
  baseYear: number;           // Reference year for calculations
  yearOverYearGrowth: number; // Annual growth factor (e.g., 1.02 for 2% growth)
  enableYearlyAdjustment: boolean;
}

export interface ManpowerAllocation {
  baseManpowerPerYear: number;
  riskMultipliers: {
    low: number;      // e.g., 0.8
    medium: number;   // e.g., 1.0
    high: number;     // e.g., 1.3
    critical: number; // e.g., 1.6
  };
  riskThresholds: {
    lowMax: number;      // e.g., 0.8 (80% of avg)
    mediumMax: number;   // e.g., 1.2 (120% of avg)
    highMax: number;     // e.g., 1.5 (150% of avg)
    // critical is anything above highMax
  };
  seasonalMultipliers: SeasonalMultipliers;
  monthlyMultipliers: MonthlyMultipliers;
  yearlyAdjustments: YearlyAdjustments;
  enableSeasonalAdjustment: boolean;
  enableMonthlyAdjustment: boolean;
}

export interface ManpowerRecommendation {
  precinct: number;
  precinctName: string;
  currentAllocation: number;
  recommendedAllocation: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  predictedCases: number;
  changeFromBase: number; // percentage change from base allocation
  justification: string;
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

// Default manpower allocation settings
export const DEFAULT_MANPOWER_ALLOCATION: ManpowerAllocation = {
  baseManpowerPerYear: 25, // Realistic baseline for a small precinct if no actual data
  riskMultipliers: {
    low: 0.8,      // 20% reduction for low risk
    medium: 1.0,   // Base allocation for medium risk
    high: 1.3,     // 30% increase for high risk
    critical: 1.6  // 60% increase for critical risk
  },
  riskThresholds: {
    lowMax: 0.8,     // Up to 80% of historical average = low risk
    mediumMax: 1.2,  // 80-120% of historical average = medium risk
    highMax: 1.5     // 120-150% of historical average = high risk
    // Above 150% = critical risk
  },
  seasonalMultipliers: {
    spring: 1.0,   // March, April, May (dry season transition)
    summer: 1.0,   // June, July, August (wet season start)
    fall: 1.0,     // September, October, November (wet season peak)
    winter: 1.0    // December, January, February (dry season)
  },
  monthlyMultipliers: {
    january: 1.0,  // Dry/cool season
    february: 1.0, // Dry/cool season  
    march: 1.0,    // Hot/dry season start
    april: 1.0,    // Hot/dry season peak
    may: 1.0,      // Hot/dry season end, wet season transition
    june: 1.0,     // Wet season start
    july: 1.0,     // Wet season
    august: 1.0,   // Wet season peak
    september: 1.0, // Wet season peak
    october: 1.0,  // Wet season end
    november: 1.0, // Transition to dry season
    december: 1.0  // Dry season start
  },
  yearlyAdjustments: {
    baseYear: new Date().getFullYear(),
    yearOverYearGrowth: 1.02, // 2% annual growth
    enableYearlyAdjustment: true
  },
  enableSeasonalAdjustment: false, // Disabled by default for tropical climates like Philippines
  enableMonthlyAdjustment: true
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
