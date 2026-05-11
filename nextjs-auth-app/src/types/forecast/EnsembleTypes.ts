export type ModelName = 'linear' | 'polynomial' | 'seasonal' | 'ses';

export interface SingleModelRun {
  modelName: ModelName;
  label: string;
  predictions: ForecastData[];
}

export interface EnsembleMonth {
  year: number;
  month: number;
  modelResults: {
    modelName: ModelName;
    predictedCount: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }[];
  ensembleAvg: number;
  ensembleMin: number;
  ensembleMax: number;
  ensembleMedian: number;
  agreementScore: number;
  dominantTrend: 'increasing' | 'decreasing' | 'stable';
  consensusRisk: 'low' | 'medium' | 'high' | 'critical';
}

export interface EnsembleSummary {
  totalMonths: number;
  modelAgreementRates: Record<ModelName, number>;
  overallAgreement: number;
  months: EnsembleMonth[];
  modelRunLabels: Record<ModelName, string>;
}

export interface ForecastData {
  year: number;
  month: number;
  precinct: number;
  crimeType: number;
  predictedCount: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  shiftBreakdown?: {
    Morning: { predicted: number; percentage: number; riskLevel: string };
    Afternoon: { predicted: number; percentage: number; riskLevel: string };
    Night: { predicted: number; percentage: number; riskLevel: string };
  };
  dominantShift?: string;
}

export const MODEL_LABELS: Record<ModelName, string> = {
  linear: 'Linear (OLS)',
  polynomial: 'Polynomial (Quadratic)',
  seasonal: 'Seasonal (Monthly Avg)',
  ses: 'SES (Exp. Smoothing)'
};

export const MODEL_COLORS: Record<ModelName, string> = {
  linear: '#3B82F6',
  polynomial: '#8B5CF6',
  seasonal: '#10B981',
  ses: '#F59E0B'
};
