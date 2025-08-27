// Enhanced forecast processing utilities

import { Cluster } from '../types/analysis/ClusterDto';
import { 
  ExtendedForecastData, 
  ForecastMapPoint, 
  ReliabilityMetrics,
  TimeOfDayBreakdown,
  categorizeTimeOfDay
} from '../types/forecast/ExtendedForecastTypes';

// Basic forecast data interface (existing)
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

interface HistoricalData {
  year: number;
  month: number;
  precinct: number;
  crimeType: number;
  count: number;
  timeOfDay: string;
  clusterId?: number;
}

/**
 * Calculate reliability metrics for a forecast based on historical data quality
 */
export const calculateReliabilityMetrics = (
  historicalData: HistoricalData[],
  forecast: ForecastData
): ReliabilityMetrics => {
  // Filter historical data relevant to this forecast
  const relevantData = historicalData.filter(h => 
    h.precinct === forecast.precinct && h.crimeType === forecast.crimeType
  );

  const sampleSize = relevantData.length;
  
  if (sampleSize === 0) {
    return {
      score: 0.1,
      sampleSize: 0,
      historicalVariance: 1.0,
      confidenceInterval: 1.0,
      timeSpanCoverage: 0,
      seasonalPattern: false
    };
  }

  // Calculate historical variance
  const counts = relevantData.map(d => d.count);
  const mean = counts.reduce((sum, c) => sum + c, 0) / counts.length;
  const variance = counts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / counts.length;
  const normalizedVariance = Math.min(variance / (mean + 1), 2.0); // Normalize relative to mean

  // Calculate time span coverage
  const years = Array.from(new Set(relevantData.map(d => d.year)));
  const timeSpanCoverage = years.length;
  
  // Check for seasonal patterns
  const monthlyData = new Array(12).fill(0);
  const monthlyCount = new Array(12).fill(0);
  
  relevantData.forEach(d => {
    monthlyData[d.month - 1] += d.count;
    monthlyCount[d.month - 1]++;
  });
  
  // Calculate seasonal variation
  const monthlyAverages = monthlyData.map((sum, i) => 
    monthlyCount[i] > 0 ? sum / monthlyCount[i] : 0
  );
  const overallAverage = monthlyAverages.reduce((sum, avg) => sum + avg, 0) / 12;
  const seasonalVariance = monthlyAverages.reduce((sum, avg) => 
    sum + Math.pow(avg - overallAverage, 2), 0
  ) / 12;
  
  const seasonalPattern = seasonalVariance > (overallAverage * 0.1); // 10% threshold
  
  // Calculate confidence interval width (proxy from historical variance)
  const confidenceInterval = Math.min(
    Math.sqrt(variance) / Math.max(mean, 1), 
    1.0
  );
  
  // Calculate overall reliability score
  let score = 0;
  
  // Sample size component (0-0.4)
  score += Math.min(sampleSize / 50, 1.0) * 0.4;
  
  // Variance component (0-0.3) - lower variance is better
  score += Math.max(0, 1 - normalizedVariance / 2) * 0.3;
  
  // Time span component (0-0.2)
  score += Math.min(timeSpanCoverage / 3, 1.0) * 0.2;
  
  // Confidence component (0-0.1)
  score += Math.max(0, forecast.confidence - 0.5) * 0.2;
  
  return {
    score: Math.min(score, 1.0),
    sampleSize,
    historicalVariance: normalizedVariance,
    confidenceInterval,
    timeSpanCoverage,
    seasonalPattern
  };
};

/**
 * Analyze time-of-day patterns from cluster data
 */
export const analyzeTimeOfDayPatterns = (
  clusters: Cluster[],
  precinct: number,
  crimeType: number
): TimeOfDayBreakdown => {
  // Filter cluster items for this precinct and crime type
  const relevantItems = clusters.flatMap(cluster =>
    cluster.clusterItems.filter(item =>
      item.precinct === precinct && item.crimeType === crimeType
    )
  );

  const breakdown = {
    morning: 0,
    afternoon: 0,
    evening: 0,
    night: 0
  };

  // Parse time strings and categorize
  relevantItems.forEach(item => {
    // Assume timeOfDay is in format "HH:mm" or contains hour information
    let hour = 12; // Default to afternoon if parsing fails
    
    if (item.timeOfDay) {
      // Try to extract hour from various time formats
      const timeMatch = item.timeOfDay.match(/(\d{1,2})/);
      if (timeMatch) {
        hour = parseInt(timeMatch[1]);
      } else {
        // Handle named time periods
        const timeLower = item.timeOfDay.toLowerCase();
        if (timeLower.includes('morning') || timeLower.includes('dawn')) hour = 8;
        else if (timeLower.includes('afternoon') || timeLower.includes('noon')) hour = 14;
        else if (timeLower.includes('evening') || timeLower.includes('dusk')) hour = 20;
        else if (timeLower.includes('night') || timeLower.includes('midnight')) hour = 2;
      }
    }
    
    const timeCategory = categorizeTimeOfDay(hour);
    breakdown[timeCategory]++;
  });

  // If no data found, distribute evenly
  if (breakdown.morning + breakdown.afternoon + breakdown.evening + breakdown.night === 0) {
    return { morning: 1, afternoon: 1, evening: 1, night: 1 };
  }

  return breakdown;
};

/**
 * Get spatial coordinates for a forecast based on cluster centroids or precinct mapping
 */
export const getGeographicCoordinates = (
  forecast: ForecastData,
  clusters: Cluster[]
): { latitude: number; longitude: number; clusterId?: number } => {
  // First, try to find relevant clusters
  const relevantClusters = clusters.filter(cluster =>
    cluster.clusterItems.some(item =>
      item.precinct === forecast.precinct && 
      item.crimeType === forecast.crimeType
    )
  );

  if (relevantClusters.length > 0) {
    // Use the centroid of the most relevant cluster
    const primaryCluster = relevantClusters.sort((a, b) => {
      const aRelevant = a.clusterItems.filter(item =>
        item.precinct === forecast.precinct && item.crimeType === forecast.crimeType
      ).length;
      const bRelevant = b.clusterItems.filter(item =>
        item.precinct === forecast.precinct && item.crimeType === forecast.crimeType
      ).length;
      return bRelevant - aRelevant;
    })[0];

    // Calculate centroid of relevant items
    const relevantItems = primaryCluster.clusterItems.filter(item =>
      item.precinct === forecast.precinct && item.crimeType === forecast.crimeType
    );

    if (relevantItems.length > 0) {
      const avgLat = relevantItems.reduce((sum, item) => sum + item.latitude, 0) / relevantItems.length;
      const avgLng = relevantItems.reduce((sum, item) => sum + item.longitude, 0) / relevantItems.length;
      
      return {
        latitude: avgLat,
        longitude: avgLng,
        clusterId: primaryCluster.clusterId
      };
    }
  }

  // Fallback: use precinct-based coordinates (approximate)
  return getPrecinctCoordinates(forecast.precinct);
};

/**
 * Get approximate coordinates for precinct centers
 * This is a simplified mapping - in a real system, you'd have a proper precinct boundary database
 */
export const getPrecinctCoordinates = (precinct: number): { latitude: number; longitude: number } => {
  // Basic precinct coordinate mapping for demonstration
  // In production, this would come from a proper geographic database
  const precinctCoords: Record<number, { latitude: number; longitude: number }> = {
    1: { latitude: 40.7831, longitude: -73.9712 }, // Upper West Side
    2: { latitude: 40.7589, longitude: -73.9851 }, // Midtown West
    3: { latitude: 40.7505, longitude: -73.9934 }, // Lower West Side
    4: { latitude: 40.7505, longitude: -74.0134 }, // Greenwich Village
    5: { latitude: 40.7282, longitude: -73.9942 }, // Chinatown
    6: { latitude: 40.7505, longitude: -73.9742 }, // SoHo
    7: { latitude: 40.7192, longitude: -74.0065 }, // Financial District
    8: { latitude: 40.7831, longitude: -73.9512 }, // Upper East Side
    9: { latitude: 40.7589, longitude: -73.9651 }, // Midtown East
    10: { latitude: 40.7505, longitude: -73.9542 }, // Gramercy
    // Add more precincts as needed
  };

  return precinctCoords[precinct] || { latitude: 40.7589, longitude: -73.9851 }; // Default to Midtown
};

/**
 * Convert basic forecast data to extended forecast data with all enhancements
 */
export const enhanceForecastData = (
  basicForecast: ForecastData,
  historicalData: HistoricalData[],
  clusters: Cluster[]
): ExtendedForecastData => {
  const reliability = calculateReliabilityMetrics(historicalData, basicForecast);
  const timeOfDayBreakdown = analyzeTimeOfDayPatterns(clusters, basicForecast.precinct, basicForecast.crimeType);
  const coordinates = getGeographicCoordinates(basicForecast, clusters);
  
  // Determine primary time of day
  const maxTime = Math.max(
    timeOfDayBreakdown.morning,
    timeOfDayBreakdown.afternoon, 
    timeOfDayBreakdown.evening,
    timeOfDayBreakdown.night
  );
  
  let primaryTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' = 'morning';
  if (timeOfDayBreakdown.afternoon === maxTime) primaryTimeOfDay = 'afternoon';
  else if (timeOfDayBreakdown.evening === maxTime) primaryTimeOfDay = 'evening';
  else if (timeOfDayBreakdown.night === maxTime) primaryTimeOfDay = 'night';

  return {
    ...basicForecast,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    clusterId: coordinates.clusterId,
    timeOfDayBreakdown,
    primaryTimeOfDay,
    reliability
  };
};

/**
 * Convert extended forecast data to map points
 */
export const createForecastMapPoints = (
  extendedForecasts: ExtendedForecastData[],
  minReliabilityThreshold: number = 0.3
): ForecastMapPoint[] => {
  return extendedForecasts
    .filter(forecast => forecast.reliability.score >= minReliabilityThreshold)
    .map(forecast => ({
      id: `${forecast.year}-${forecast.month}-${forecast.precinct}-${forecast.crimeType}`,
      latitude: forecast.latitude,
      longitude: forecast.longitude,
      risk: forecast.riskLevel,
      predictedCount: forecast.predictedCount,
      confidence: forecast.confidence,
      reliability: forecast.reliability.score,
      precinct: forecast.precinct,
      crimeType: forecast.crimeType,
      timeOfDayBreakdown: forecast.timeOfDayBreakdown,
      primaryTimeOfDay: forecast.primaryTimeOfDay,
      forecastPeriod: `${forecast.year}-${String(forecast.month).padStart(2, '0')}`,
      trend: forecast.trend
    }));
};

/**
 * Filter forecasts based on reliability and other quality metrics
 */
export const filterReliableForecasts = (
  forecasts: ExtendedForecastData[],
  minReliability: number = 0.3,
  minSampleSize: number = 5,
  maxVariance: number = 1.5
): ExtendedForecastData[] => {
  return forecasts.filter(forecast => {
    const { reliability } = forecast;
    
    return (
      reliability.score >= minReliability &&
      reliability.sampleSize >= minSampleSize &&
      reliability.historicalVariance <= maxVariance
    );
  });
};

/**
 * Calculate summary statistics for forecast quality
 */
export const calculateForecastQualityMetrics = (forecasts: ExtendedForecastData[]) => {
  if (forecasts.length === 0) {
    return {
      averageReliability: 0,
      averageSampleSize: 0,
      reliableCount: 0,
      unreliableCount: 0,
      seasonalPatternsDetected: 0,
      timeSpanCoverage: 0
    };
  }

  const totalReliability = forecasts.reduce((sum, f) => sum + f.reliability.score, 0);
  const totalSampleSize = forecasts.reduce((sum, f) => sum + f.reliability.sampleSize, 0);
  const reliableCount = forecasts.filter(f => f.reliability.score >= 0.6).length;
  const unreliableCount = forecasts.length - reliableCount;
  const seasonalPatternsDetected = forecasts.filter(f => f.reliability.seasonalPattern).length;
  const avgTimeSpan = forecasts.reduce((sum, f) => sum + f.reliability.timeSpanCoverage, 0) / forecasts.length;

  return {
    averageReliability: totalReliability / forecasts.length,
    averageSampleSize: totalSampleSize / forecasts.length,
    reliableCount,
    unreliableCount,
    seasonalPatternsDetected,
    timeSpanCoverage: avgTimeSpan
  };
};
