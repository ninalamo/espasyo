import type { HistoricalData, ForecastData, ShiftBreakdown } from '../types/forecast/ForecastBaseTypes';
import type { Cluster } from '../types/analysis/ClusterDto';
import type { ManpowerAllocation } from '../types/forecast/ExtendedForecastTypes';
import { addMonths } from 'date-fns';

export function getShiftFromTimeOfDay(timeOfDay: string): string {
  if (!timeOfDay) return 'Unknown';

  const time = timeOfDay.toLowerCase();
  if (time.includes('morning') || time.includes('dawn') || time.includes('am') ||
      time.includes('06') || time.includes('07') || time.includes('08') ||
      time.includes('09') || time.includes('10') || time.includes('11') ||
      time.includes('12') || time.includes('13')) {
    return 'Morning';
  }
  if (time.includes('afternoon') || time.includes('evening') || time.includes('pm') ||
      time.includes('14') || time.includes('15') || time.includes('16') ||
      time.includes('17') || time.includes('18') || time.includes('19') ||
      time.includes('20') || time.includes('21')) {
    return 'Afternoon';
  }
  if (time.includes('night') || time.includes('midnight') ||
      time.includes('22') || time.includes('23') || time.includes('00') ||
      time.includes('01') || time.includes('02') || time.includes('03') ||
      time.includes('04') || time.includes('05')) {
    return 'Night';
  }

  return 'Unknown';
}

export function processClusterData(clustersData: Cluster[]): HistoricalData[] {
  const aggregated = new Map<string, HistoricalData>();

  clustersData.forEach(cluster => {
    cluster.clusterItems.forEach(item => {
      const key = `${item.year}-${item.month}-${item.precinct}-${item.crimeType}`;

      if (aggregated.has(key)) {
        aggregated.get(key)!.count++;
      } else {
        aggregated.set(key, {
          year: item.year,
          month: item.month,
          precinct: item.precinct,
          crimeType: item.crimeType,
          count: 1,
          timeOfDay: item.timeOfDay,
          clusterId: cluster.clusterId,
        });
      }
    });
  });

  return Array.from(aggregated.values()).sort(
    (a, b) => new Date(a.year, a.month - 1).getTime() - new Date(b.year, b.month - 1).getTime()
  );
}

export function calculateShiftPatterns(
  data: HistoricalData[]
): Map<string, { Morning: number; Afternoon: number; Night: number; total: number }> {
  const shiftPatterns = new Map<string, { Morning: number; Afternoon: number; Night: number; total: number }>();

  data.forEach(item => {
    const key = `${item.precinct}-${item.crimeType}`;
    const shift = getShiftFromTimeOfDay(item.timeOfDay);

    if (shift === 'Unknown') return;

    if (!shiftPatterns.has(key)) {
      shiftPatterns.set(key, { Morning: 0, Afternoon: 0, Night: 0, total: 0 });
    }

    const pattern = shiftPatterns.get(key)!;
    if (shift === 'Morning') pattern.Morning += item.count;
    else if (shift === 'Afternoon') pattern.Afternoon += item.count;
    else if (shift === 'Night') pattern.Night += item.count;

    pattern.total += item.count;
  });

  return shiftPatterns;
}

export function applyShiftPatterns(
  basePrediction: number,
  shiftPatterns: { Morning: number; Afternoon: number; Night: number; total: number }
): ShiftBreakdown {
  if (shiftPatterns.total === 0) {
    return {
      Morning: { predicted: Math.round(basePrediction * 0.33), percentage: 33.3, riskLevel: 'medium' },
      Afternoon: { predicted: Math.round(basePrediction * 0.33), percentage: 33.3, riskLevel: 'medium' },
      Night: { predicted: Math.round(basePrediction * 0.34), percentage: 33.4, riskLevel: 'medium' },
    };
  }

  const morningRatio = shiftPatterns.Morning / shiftPatterns.total;
  const afternoonRatio = shiftPatterns.Afternoon / shiftPatterns.total;
  const nightRatio = shiftPatterns.Night / shiftPatterns.total;

  const morningPredicted = Math.round(basePrediction * morningRatio);
  const afternoonPredicted = Math.round(basePrediction * afternoonRatio);
  const nightPredicted = basePrediction - morningPredicted - afternoonPredicted;

  const getRiskLevel = (percentage: number) => {
    if (percentage > 50) return 'critical';
    if (percentage > 40) return 'high';
    if (percentage > 25) return 'medium';
    return 'low';
  };

  return {
    Morning: { predicted: morningPredicted, percentage: morningRatio * 100, riskLevel: getRiskLevel(morningRatio * 100) },
    Afternoon: { predicted: afternoonPredicted, percentage: afternoonRatio * 100, riskLevel: getRiskLevel(afternoonRatio * 100) },
    Night: { predicted: nightPredicted, percentage: nightRatio * 100, riskLevel: getRiskLevel(nightRatio * 100) },
  };
}

export function convertHistoricalDataToClusters(clusters: Cluster[], historicalData: HistoricalData[]) {
  return clusters.map(cluster => ({
    clusterId: cluster.clusterId,
    clusterItems: cluster.clusterItems.map(item => ({
      caseId: item.caseId,
      latitude: item.latitude,
      longitude: item.longitude,
      month: item.month,
      year: item.year,
      timeOfDay: item.timeOfDay,
      precinct: item.precinct,
      crimeType: item.crimeType,
    })),
    clusterCount: cluster.clusterItems.length,
  }));
}

export function calculateLinearTrend(data: HistoricalData[], monthsAhead: number): number {
  if (data.length < 2) return data[0]?.count || 0;

  const recentData = data.slice(-12);
  const n = recentData.length;

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

  recentData.forEach((point, index) => {
    const x = index + 1;
    const y = point.count;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) || 0;
  const intercept = (sumY - slope * sumX) / n || 0;

  return intercept + slope * (n + monthsAhead);
}

export function calculatePolynomialTrend(data: HistoricalData[], monthsAhead: number): number {
  if (data.length < 3) return calculateLinearTrend(data, monthsAhead);

  const recentData = data.slice(-12);

  const recent = recentData.slice(-3).reduce((sum, d) => sum + d.count, 0) / 3;
  const middle = recentData.slice(-6, -3).reduce((sum, d) => sum + d.count, 0) / 3;
  const older = recentData.slice(-9, -6).reduce((sum, d) => sum + d.count, 0) / 3;

  const acceleration = (recent - 2 * middle + older) / 2;
  const velocity = recent - middle;

  return Math.max(0, recent + velocity * monthsAhead + 0.5 * acceleration * monthsAhead * monthsAhead);
}

export function calculateSeasonalForecast(data: HistoricalData[], targetMonth: number): number {
  const monthlyAvg = new Array(12).fill(0);
  const monthlyCount = new Array(12).fill(0);

  data.forEach(point => {
    monthlyAvg[point.month - 1] += point.count;
    monthlyCount[point.month - 1]++;
  });

  const targetMonthIndex = targetMonth - 1;
  if (monthlyCount[targetMonthIndex] === 0) {
    return data.reduce((sum, d) => sum + d.count, 0) / data.length || 0;
  }

  const seasonalBase = monthlyAvg[targetMonthIndex] / monthlyCount[targetMonthIndex];
  const recentTrend = calculateLinearTrend(data, 1) / (data[data.length - 1]?.count || 1);

  return seasonalBase * recentTrend;
}

export function calculateExponentialSmoothing(data: HistoricalData[], monthsAhead: number): number {
  if (data.length < 2) return calculateLinearTrend(data, monthsAhead);

  const alpha = 0.3;
  let smoothedValue = data[0].count;

  for (let i = 1; i < data.length; i++) {
    smoothedValue = alpha * data[i].count + (1 - alpha) * smoothedValue;
  }

  const overallTrend = calculateLinearTrend(data, 1) - calculateLinearTrend(data, 0);

  return Math.max(0, smoothedValue + overallTrend * monthsAhead * 0.1);
}

export function determineTrend(predictedCount: number, recentAvg: number): 'increasing' | 'decreasing' | 'stable' {
  if (recentAvg === 0) return 'stable';
  if (predictedCount > recentAvg * 1.1) return 'increasing';
  if (predictedCount < recentAvg * 0.9) return 'decreasing';
  return 'stable';
}

export function determineRiskLevel(
  predictedCount: number,
  recentAvg: number,
  thresholds: ManpowerAllocation['riskThresholds']
): 'low' | 'medium' | 'high' | 'critical' {
  const riskRatio = predictedCount / (recentAvg || 1);
  if (riskRatio > thresholds.highMax) return 'critical';
  if (riskRatio > thresholds.mediumMax) return 'high';
  if (riskRatio > thresholds.lowMax) return 'medium';
  return 'low';
}

export function generatePredictions(
  historical: HistoricalData[],
  forecastPeriod: number,
  model: 'linear' | 'polynomial' | 'seasonal' | 'arima',
  thresholds: ManpowerAllocation['riskThresholds']
): ForecastData[] {
  const predictions: ForecastData[] = [];
  const baseDate = new Date();
  const shiftPatterns = calculateShiftPatterns(historical);

  const groups = new Map<string, HistoricalData[]>();
  historical.forEach(data => {
    const key = `${data.precinct}-${data.crimeType}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(data);
  });

  groups.forEach((groupData, key) => {
    const [precinct, crimeType] = key.split('-').map(Number);
    const groupShiftPattern = shiftPatterns.get(key) || { Morning: 0, Afternoon: 0, Night: 0, total: 0 };

    for (let monthOffset = 1; monthOffset <= forecastPeriod; monthOffset++) {
      const forecastDate = addMonths(baseDate, monthOffset);
      const year = forecastDate.getFullYear();
      const month = forecastDate.getMonth() + 1;

      let predictedCount = 0;
      switch (model) {
        case 'linear':
          predictedCount = calculateLinearTrend(groupData, monthOffset);
          break;
        case 'polynomial':
          predictedCount = calculatePolynomialTrend(groupData, monthOffset);
          break;
        case 'seasonal':
          predictedCount = calculateSeasonalForecast(groupData, month);
          break;
        case 'arima':
          predictedCount = calculateExponentialSmoothing(groupData, monthOffset);
          break;
        default:
          predictedCount = calculateLinearTrend(groupData, monthOffset);
      }

      const recentAvg = groupData.slice(-6).reduce((sum, d) => sum + d.count, 0) / 6;
      const olderAvg = groupData.slice(-12, -6).reduce((sum, d) => sum + d.count, 0) / 6 || recentAvg;

      const trend = determineTrend(predictedCount, recentAvg);
      const riskLevel = determineRiskLevel(predictedCount, recentAvg, thresholds);
      const shiftBreakdown = applyShiftPatterns(Math.max(0, Math.round(predictedCount)), groupShiftPattern);
      const dominantShift = Object.entries(shiftBreakdown).reduce(
        (max, [shift, data]) => data.predicted > shiftBreakdown[max as keyof ShiftBreakdown].predicted ? shift : max,
        'Morning' as string
      );

      predictions.push({
        year,
        month,
        precinct,
        crimeType,
        predictedCount: Math.max(0, Math.round(predictedCount)),
        confidence: Math.max(0.5, 0.95 - monthOffset * 0.05),
        trend,
        riskLevel,
        shiftBreakdown,
        dominantShift,
      });
    }
  });

  return predictions.sort(
    (a, b) => new Date(a.year, a.month - 1).getTime() - new Date(b.year, b.month - 1).getTime()
  );
}
