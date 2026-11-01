export type ForecastRiskLevel = "low" | "medium" | "high" | "critical";

export interface StatisticalForecastRowDto {
  timestamp: string;
  precinct: number;
  crimeType: number;
  forecast: number;
  lastYearActual?: number | null;
  riskLevel: ForecastRiskLevel;
  compositeRiskScore: number;
  timeOfDay?: string | null;
}

export interface ForecastPointDto {
  timestamp: string;
  forecast: number;
  lastYearActual?: number | null;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  trend: string;
  riskLevel: ForecastRiskLevel;
}

export interface ForecastSeriesDto {
  precinct: number;
  crimeType: number;
  shift?: string | null;
  clusterId: number;
  requestedModel: string;
  effectiveModel: string;
  fallbackReason?: string | null;
  forecasts: ForecastPointDto[];
}

export interface StatisticalForecastSummaryDto {
  keyInsight: string;
  recommendedActions: string[];
}

export interface MonthlyForecastRiskPeriodDto {
  year: number;
  month: number;
  projectedIncidents: number;
  forecastByRiskLevel: Record<ForecastRiskLevel, number>;
}

export interface StatisticalForecastResponseDto {
  forecasts: StatisticalForecastRowDto[];
  series: ForecastSeriesDto[];
  summary: StatisticalForecastSummaryDto;
  monthlyRiskPeriods: MonthlyForecastRiskPeriodDto[];
}
