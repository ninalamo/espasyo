import type { ForecastSnapshot, CreateForecastRequest, ForecastSummaryCard, ForecastData, ForecastEvaluationResult } from '../../../types/forecast/ForecastBaseTypes';

/* Mapping: Barangay enum int → name (matches backend seed data) */
const BARANGAY_INT_TO_NAME: Record<number, string> = {
  0: 'Alabang', 1: 'Bayanan', 2: 'Buli', 3: 'Cupang',
  4: 'Poblacion', 5: 'Putatan', 6: 'Tunasan', 7: 'Ayala_Alabang', 8: 'Sucat',
};

const BARANGAY_NAME_TO_INT: Record<string, number> = {
  'Alabang': 0, 'Bayanan': 1, 'Buli': 2, 'Cupang': 3,
  'Poblacion': 4, 'Putatan': 5, 'Tunasan': 6, 'Ayala_Alabang': 7, 'Sucat': 8,
};

const CRIMETYPE_NAME_TO_INT: Record<string, number> = {
  'Arson': 0, 'Assault': 1, 'Burglary': 2, 'Corruption': 3,
  'Counterfeiting': 4, 'CyberCrime': 5, 'DomesticViolence': 6,
  'DrugTrafficking': 7, 'Embezzlement': 8, 'Extortion': 9,
  'Fraud': 10, 'HumanTrafficking': 11, 'Homicide': 12,
  'IllegalPossessionOfFirearms': 13, 'Kidnapping': 14, 'Murder': 15,
  'Rape': 16, 'Robbery': 17, 'Theft': 18, 'Vandalism': 19,
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://localhost:7007/api';

/* Backend response shapes (api/ForecastRun) */
interface ForecastRunResult {
  id: string;
  precinctName: string;
  precinctCode: string;
  runAt: string;
  horizon: number;
  modelType: string;
  status: string;
  totalSeries: number;
  generatedById: string;
}

interface GetForecastRunsResponse {
  runs: ForecastRunResult[];
  totalCount: number;
}

interface SaveForecastSnapshotResponse {
  id: string;
  name: string;
  createdAt: string;
  totalPredictions: number;
}

interface ForecastResultDto {
  id: string;
  precinct: string;
  crimeType: string;
  month: number;
  year: number;
  predictedValue: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  riskLevel: string;
  trend: string;
}

class ForecastApiService {
  private async fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`${response.status} ${errorData}`);
    }

    if (response.status === 204) return {} as T;
    return response.json();
  }

  async list(): Promise<ForecastSummaryCard[]> {
    const response = await this.fetchApi<GetForecastRunsResponse>('/ForecastRun');
    return response.runs.map(r => ({
      id: r.id,
      name: `${r.precinctName} - ${r.modelType}`,
      createdAt: r.runAt,
      forecastPeriod: r.horizon,
      totalPredictions: r.totalSeries,
      activeModel: r.modelType,
      precinctCount: 1,
      crimeTypeCount: 0,
    }));
  }

  async getById(id: string): Promise<ForecastSnapshot> {
    try {
      const results = await this.fetchApi<ForecastResultDto[]>(`/ForecastRun/${id}/results`);

      const precincts = [...new Set(results.map(r => BARANGAY_NAME_TO_INT[r.precinct] ?? 0))];
      const crimeTypes = [...new Set(results.map(r => CRIMETYPE_NAME_TO_INT[r.crimeType] ?? 0))];

      return {
        id,
        name: `Forecast ${id.slice(0, 8)}`,
        createdAt: new Date().toISOString(),
        forecastPeriod: 6,
        predictions: results.map(r => ({
          year: r.year,
          month: r.month,
          precinct: BARANGAY_NAME_TO_INT[r.precinct] ?? 0,
          crimeType: CRIMETYPE_NAME_TO_INT[r.crimeType] ?? 0,
          predictedCount: Math.max(0, Math.round(r.predictedValue)),
          confidence: r.confidence,
          trend: (r.trend === 'increasing' || r.trend === 'decreasing' || r.trend === 'stable' ? r.trend : 'stable') as ForecastData['trend'],
          riskLevel: (r.riskLevel === 'low' || r.riskLevel === 'medium' || r.riskLevel === 'high' || r.riskLevel === 'critical' ? r.riskLevel : 'medium') as ForecastData['riskLevel'],
        })),
        params: {
          forecastPeriod: 6,
          model: 'ssa',
          confidence: 0.95,
          includeSeasonality: true,
          weightRecentData: true,
        },
        metadata: {
          totalClusters: 0,
          totalPredictions: results.length,
          activeModel: 'SSA',
          precincts,
          crimeTypes,
        },
        historicalData: undefined,
      };
    } catch {
      throw new Error(`Forecast ${id} not found`);
    }
  }

  async save(data: CreateForecastRequest): Promise<ForecastSnapshot> {
    if (data.predictions?.length) {
      try {
        const response = await this.fetchApi<SaveForecastSnapshotResponse>('/ForecastRun/snapshot', {
          method: 'POST',
          body: JSON.stringify({
            name: data.name,
            forecastPeriod: data.forecastPeriod,
            confidenceLevel: data.params.confidence,
            predictions: data.predictions.map(p => ({
              precinct: p.precinct,
              crimeType: p.crimeType,
              month: p.month,
              year: p.year,
              predictedValue: p.predictedCount,
              lowerBound: p.lowerBound ?? p.predictedCount * 0.9,
              upperBound: p.upperBound ?? p.predictedCount * 1.1,
              confidence: p.confidence,
              riskLevel: p.riskLevel,
              trend: p.trend,
            })),
            generatedById: data.generatedById ?? '',
          }),
        });

        return {
          id: response.id,
          name: response.name,
          createdAt: response.createdAt,
          forecastPeriod: data.forecastPeriod,
          predictions: data.predictions,
          metrics: data.metrics,
          params: data.params,
          metadata: {
            ...data.metadata,
            totalPredictions: response.totalPredictions,
            precincts: [...new Set(data.predictions.map(f => f.precinct))],
            crimeTypes: [...new Set(data.predictions.map(f => f.crimeType))],
          },
          historicalData: data.historicalData,
        };
      } catch (error) {
        console.warn('Snapshot endpoint unavailable, falling back to ML endpoint:', error);
      }
    }

    if (data.clusterData?.length) {
      try {
        const precincts = await this.fetchApi<Array<{ id: string; name: string; code: string }>>('/manpower/precincts');
        const firstItem = data.clusterData[0]?.clusterItems[0];
        const precinctName = firstItem != null ? BARANGAY_INT_TO_NAME[firstItem.precinct] : '';
        const matched = precincts.find(p => p.name === precinctName);
        const precinctId = matched?.id ?? '00000000-0000-0000-0000-000000000000';

        const mlResponse = await this.fetchApi<{ id: string }>('/ForecastRun', {
          method: 'POST',
          body: JSON.stringify({
            clusterData: data.clusterData,
            precinctId,
            horizon: data.params.forecastPeriod,
            confidenceLevel: data.params.confidence,
            modelType: 'SSA',
            includeSeasonality: data.params.includeSeasonality,
            weightRecentData: data.params.weightRecentData,
            generatedById: data.generatedById ?? '',
          }),
        });

        const results = await this.fetchApi<ForecastResultDto[]>(`/ForecastRun/${mlResponse.id}/results`);

        const predictions: ForecastData[] = results.map(r => ({
          year: r.year,
          month: r.month,
          precinct: BARANGAY_NAME_TO_INT[r.precinct] ?? 0,
          crimeType: CRIMETYPE_NAME_TO_INT[r.crimeType] ?? 0,
          predictedCount: Math.max(0, Math.round(r.predictedValue)),
          confidence: r.confidence,
          trend: (r.trend === 'increasing' || r.trend === 'decreasing' || r.trend === 'stable' ? r.trend : 'stable') as ForecastData['trend'],
          riskLevel: (r.riskLevel === 'low' || r.riskLevel === 'medium' || r.riskLevel === 'high' || r.riskLevel === 'critical' ? r.riskLevel : 'medium') as ForecastData['riskLevel'],
        }));

        return {
          id: mlResponse.id,
          name: data.name,
          createdAt: new Date().toISOString(),
          forecastPeriod: data.forecastPeriod,
          predictions,
          metrics: data.metrics,
          params: data.params,
          metadata: {
            ...data.metadata,
            totalPredictions: predictions.length,
            precincts: [...new Set(predictions.map(f => f.precinct))],
            crimeTypes: [...new Set(predictions.map(f => f.crimeType))],
          },
          historicalData: data.historicalData,
        };
      } catch {
        throw new Error('Failed to save forecast via ML endpoint');
      }
    }

    throw new Error('No predictions or cluster data to save');
  }

  async delete(id: string): Promise<void> {
    await this.fetchApi<void>(`/ForecastRun/${id}`, { method: 'DELETE' });
  }

  async evaluate(id: string): Promise<ForecastEvaluationResult> {
    return this.fetchApi<ForecastEvaluationResult>(`/ForecastRun/${id}/evaluate`);
  }
}

export const forecastApi = new ForecastApiService();


