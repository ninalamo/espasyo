import { addMonths } from 'date-fns';
import {
  ForecastData,
  ModelName,
  SingleModelRun,
  EnsembleMonth,
  EnsembleSummary,
  MODEL_LABELS
} from '../types/forecast/EnsembleTypes';

interface HistoricalData {
  year: number;
  month: number;
  precinct: number;
  crimeType: number;
  count: number;
  timeOfDay: string;
  clusterId?: number;
}

interface EnsembleParams {
  forecastPeriod: number;
  includeSeasonality: boolean;
  weightRecentData: boolean;
}

interface ManpowerConfig {
  riskThresholds: {
    lowMax: number;
    mediumMax: number;
    highMax: number;
  };
}

const getShiftFromTimeOfDay = (timeOfDay: string): string => {
  if (!timeOfDay) return 'Unknown';
  const time = timeOfDay.toLowerCase();
  if (time.includes('morning') || time.includes('dawn') || time.includes('am') ||
      time.includes('06') || time.includes('07') || time.includes('08') ||
      time.includes('09') || time.includes('10') || time.includes('11') ||
      time.includes('12') || time.includes('13')) return 'Morning';
  if (time.includes('afternoon') || time.includes('evening') || time.includes('pm') ||
      time.includes('14') || time.includes('15') || time.includes('16') ||
      time.includes('17') || time.includes('18') || time.includes('19') ||
      time.includes('20') || time.includes('21')) return 'Afternoon';
  if (time.includes('night') || time.includes('midnight') ||
      time.includes('22') || time.includes('23') || time.includes('00') ||
      time.includes('01') || time.includes('02') || time.includes('03') ||
      time.includes('04') || time.includes('05')) return 'Night';
  return 'Unknown';
};

const calculateShiftPatterns = (data: HistoricalData[]): Map<string, { Morning: number; Afternoon: number; Night: number; total: number }> => {
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
};

const calculateLinearTrend = (data: HistoricalData[], monthsAhead: number): number => {
  if (data.length < 2) return data[0]?.count || 0;
  const recentData = data.slice(-12);
  const n = recentData.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  recentData.forEach((point, index) => {
    const x = index + 1;
    const y = point.count;
    sumX += x; sumY += y; sumXY += x * y; sumXX += x * x;
  });
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) || 0;
  const intercept = (sumY - slope * sumX) / n || 0;
  return intercept + slope * (n + monthsAhead);
};

const calculatePolynomialTrend = (data: HistoricalData[], monthsAhead: number): number => {
  if (data.length < 3) return calculateLinearTrend(data, monthsAhead);
  const recentData = data.slice(-12);
  const recent = recentData.slice(-3).reduce((sum, d) => sum + d.count, 0) / 3;
  const middle = recentData.slice(-6, -3).reduce((sum, d) => sum + d.count, 0) / 3;
  const older = recentData.slice(-9, -6).reduce((sum, d) => sum + d.count, 0) / 3;
  const acceleration = (recent - 2 * middle + older) / 2;
  const velocity = recent - middle;
  return Math.max(0, recent + velocity * monthsAhead + 0.5 * acceleration * monthsAhead * monthsAhead);
};

const calculateSeasonalForecast = (data: HistoricalData[], targetMonth: number): number => {
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
};

const calculateExponentialSmoothing = (data: HistoricalData[], monthsAhead: number): number => {
  if (data.length < 2) return calculateLinearTrend(data, monthsAhead);
  const alpha = 0.3;
  let smoothedValue = data[0].count;
  for (let i = 1; i < data.length; i++) {
    smoothedValue = alpha * data[i].count + (1 - alpha) * smoothedValue;
  }
  const overallTrend = calculateLinearTrend(data, 1) - calculateLinearTrend(data, 0);
  return Math.max(0, smoothedValue + (overallTrend * monthsAhead * 0.1));
};

const runSingleModel = (
  model: ModelName,
  historical: HistoricalData[],
  params: EnsembleParams,
  manpowerConfig: ManpowerConfig,
  shiftPatterns: Map<string, { Morning: number; Afternoon: number; Night: number; total: number }>
): ForecastData[] => {
  const predictions: ForecastData[] = [];
  const baseDate = new Date();
  const groups = new Map<string, HistoricalData[]>();

  historical.forEach(data => {
    const key = `${data.precinct}-${data.crimeType}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(data);
  });

  groups.forEach((groupData, key) => {
    const [precinct, crimeType] = key.split('-').map(Number);
    const groupShiftPattern = shiftPatterns.get(key) || { Morning: 0, Afternoon: 0, Night: 0, total: 0 };

    for (let monthOffset = 1; monthOffset <= params.forecastPeriod; monthOffset++) {
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
        case 'ses':
          predictedCount = calculateExponentialSmoothing(groupData, monthOffset);
          break;
      }

      const recentAvg = groupData.slice(-6).reduce((sum, d) => sum + d.count, 0) / 6;
      const trend: 'increasing' | 'decreasing' | 'stable' =
        predictedCount > recentAvg * 1.1 ? 'increasing' :
        predictedCount < recentAvg * 0.9 ? 'decreasing' : 'stable';

      const riskRatio = predictedCount / (recentAvg || 1);
      const riskLevel: 'low' | 'medium' | 'high' | 'critical' =
        riskRatio > manpowerConfig.riskThresholds.highMax ? 'critical' :
        riskRatio > manpowerConfig.riskThresholds.mediumMax ? 'high' :
        riskRatio > manpowerConfig.riskThresholds.lowMax ? 'medium' : 'low';

      const totalShifts = groupShiftPattern.Morning + groupShiftPattern.Afternoon + groupShiftPattern.Night;
      let morningPct = 33.3, afternoonPct = 33.3, nightPct = 33.4;
      if (totalShifts > 0) {
        morningPct = (groupShiftPattern.Morning / totalShifts) * 100;
        afternoonPct = (groupShiftPattern.Afternoon / totalShifts) * 100;
        nightPct = (groupShiftPattern.Night / totalShifts) * 100;
      }

      const shiftBreakdown = {
        Morning: { predicted: Math.round(predictedCount * morningPct / 100), percentage: morningPct, riskLevel: 'medium' },
        Afternoon: { predicted: Math.round(predictedCount * afternoonPct / 100), percentage: afternoonPct, riskLevel: 'medium' },
        Night: { predicted: Math.round(predictedCount * nightPct / 100), percentage: nightPct, riskLevel: 'medium' },
      };

      const dominantShift = Object.entries(shiftBreakdown).reduce((max, [shift, data]) =>
        data.predicted > shiftBreakdown[max as keyof typeof shiftBreakdown].predicted ? shift : max, 'Morning'
      );

      predictions.push({
        year, month, precinct, crimeType,
        predictedCount: Math.max(0, Math.round(predictedCount)),
        confidence: Math.max(0.5, 0.95 - (monthOffset * 0.05)),
        trend, riskLevel, shiftBreakdown, dominantShift,
      });
    }
  });

  return predictions.sort((a, b) =>
    new Date(a.year, a.month - 1).getTime() - new Date(b.year, b.month - 1).getTime()
  );
};

export const runAllModels = (
  historicalData: HistoricalData[],
  params: EnsembleParams,
  manpowerConfig: ManpowerConfig
): SingleModelRun[] => {
  const shiftPatterns = calculateShiftPatterns(historicalData);
  const models: ModelName[] = ['linear', 'polynomial', 'seasonal', 'ses'];

  return models.map(model => ({
    modelName: model,
    label: MODEL_LABELS[model],
    predictions: runSingleModel(model, historicalData, params, manpowerConfig, shiftPatterns),
  }));
};

export const computeConsensus = (modelRuns: SingleModelRun[]): EnsembleSummary => {
  if (modelRuns.length === 0) {
    return { totalMonths: 0, modelAgreementRates: {} as Record<ModelName, number>, overallAgreement: 0, months: [], modelRunLabels: {} as Record<ModelName, string> };
  }

  const modelRunLabels: Record<ModelName, string> = {} as Record<ModelName, string>;
  modelRuns.forEach(run => { modelRunLabels[run.modelName] = run.label; });

  const monthKeys = new Set<string>();
  modelRuns.forEach(run => {
    run.predictions.forEach(p => {
      monthKeys.add(`${p.year}-${String(p.month).padStart(2, '0')}`);
    });
  });

  const sortedMonthKeys = Array.from(monthKeys).sort();

  const months: EnsembleMonth[] = sortedMonthKeys.map(monthKey => {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    const modelResults = modelRuns.map(run => {
      const match = run.predictions.find(
        p => p.year === year && p.month === month
      );
      return {
        modelName: run.modelName,
        predictedCount: match?.predictedCount ?? 0,
        trend: match?.trend ?? ('stable' as const),
        riskLevel: match?.riskLevel ?? ('low' as const),
      };
    });

    const counts = modelResults.map(r => r.predictedCount);
    const sorted = [...counts].sort((a, b) => a - b);
    const ensembleAvg = counts.reduce((s, c) => s + c, 0) / counts.length;
    const ensembleMin = sorted[0];
    const ensembleMax = sorted[sorted.length - 1];
    const ensembleMedian = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    const trendCounts = { increasing: 0, decreasing: 0, stable: 0 };
    modelResults.forEach(r => { trendCounts[r.trend]++; });
    const dominantTrend = (Object.entries(trendCounts) as [string, number][])
      .sort((a, b) => b[1] - a[1])[0][0] as 'increasing' | 'decreasing' | 'stable';
    const agreementScore = Math.max(...Object.values(trendCounts)) / modelResults.length;

    const riskValues = { low: 1, medium: 2, high: 3, critical: 4 };
    const avgRisk = modelResults.reduce((s, r) => s + riskValues[r.riskLevel], 0) / modelResults.length;
    const consensusRisk: 'low' | 'medium' | 'high' | 'critical' =
      avgRisk >= 3.5 ? 'critical' : avgRisk >= 2.5 ? 'high' : avgRisk >= 1.5 ? 'medium' : 'low';

    return { year, month, modelResults, ensembleAvg, ensembleMin, ensembleMax, ensembleMedian, agreementScore, dominantTrend, consensusRisk };
  });

  const modelAgreementCounts: Record<string, number> = {};
  const modelTotalCounts: Record<string, number> = {};
  modelRuns.forEach(run => {
    modelAgreementCounts[run.modelName] = 0;
    modelTotalCounts[run.modelName] = 0;
  });

  months.forEach(m => {
    const majorityTrend = m.dominantTrend;
    m.modelResults.forEach(r => {
      modelTotalCounts[r.modelName]++;
      if (r.trend === majorityTrend) modelAgreementCounts[r.modelName]++;
    });
  });

  const modelAgreementRates = {} as Record<ModelName, number>;
  (Object.keys(modelTotalCounts) as ModelName[]).forEach(name => {
    modelAgreementRates[name] = modelTotalCounts[name] > 0
      ? modelAgreementCounts[name] / modelTotalCounts[name]
      : 0;
  });

  const overallAgreement = months.reduce((s, m) => s + m.agreementScore, 0) / months.length;

  return { totalMonths: months.length, modelAgreementRates, overallAgreement, months, modelRunLabels };
};


