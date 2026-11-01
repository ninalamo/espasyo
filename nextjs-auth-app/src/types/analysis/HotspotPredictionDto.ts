export interface HotspotPredictionResponse {
  features: {
    type: 'FeatureCollection';
    features: HotspotFeature[];
  };
  summary: HotspotPredictionSummary;
}

export interface HotspotFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  properties: {
    precinct: string;
    crimeType: string;
    clusterId: number;
    clusterIds?: number[];
    totalPredicted: number;
    confidence: number;
    severity: string;
    riskLevel: string;
    trend: string;
    forecastPoints: Array<{
      month: number;
      year: number;
      value: number;
      lower: number;
      upper: number;
    }>;
  };
}

export interface HotspotPredictionSummary {
  totalForecasts: number;
  highRiskPredictions: number;
  criticalRiskPredictions: number;
  overallTrend: string;
  dominantRiskLevel: string;
  averageConfidence: number;
  keyInsight: string;
  recommendedActions: string[];
  averageCompositeRiskScore: number;
  maxCompositeRiskScore: number;
}
