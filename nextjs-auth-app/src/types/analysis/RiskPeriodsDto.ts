export type ForecastRiskLevel = "low" | "medium" | "high" | "critical";

export interface StatisticalForecastRowDto {
  timestamp: string;
  precinct: number;
  crimeType: number;
  forecast: number;
  riskLevel: ForecastRiskLevel;
  compositeRiskScore: number;
  timeOfDay?: string | null;
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
  summary: StatisticalForecastSummaryDto;
  monthlyRiskPeriods: MonthlyForecastRiskPeriodDto[];
}
