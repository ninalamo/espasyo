import type { ForecastSnapshot, CreateForecastRequest, ForecastSummaryCard, ForecastData } from '../../../types/forecast/ForecastBaseTypes';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5041/api';

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
    try {
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
    } catch {
      return loadForecastListFromLocal();
    }
  }

  async getById(id: string): Promise<ForecastSnapshot> {
    const fromLocal = loadForecastFromLocal();
    if (fromLocal?.id === id) return fromLocal;

    try {
      const results = await this.fetchApi<ForecastResultDto[]>(`/ForecastRun/${id}/results`);

      const precincts = [...new Set(results.map(r => parseInt(r.precinct) || 0))];
      const crimeTypes = [...new Set(results.map(r => parseInt(r.crimeType) || 0))];

      return {
        id,
        name: `Forecast ${id.slice(0, 8)}`,
        createdAt: new Date().toISOString(),
        forecastPeriod: 6,
        predictions: results.map(r => ({
          year: r.year,
          month: r.month,
          precinct: parseInt(r.precinct) || 0,
          crimeType: parseInt(r.crimeType) || 0,
          predictedCount: Math.max(0, Math.round(r.predictedValue)),
          confidence: r.confidence,
          trend: (r.trend === 'increasing' || r.trend === 'decreasing' || r.trend === 'stable' ? r.trend : 'stable') as ForecastData['trend'],
          riskLevel: (r.riskLevel === 'low' || r.riskLevel === 'medium' || r.riskLevel === 'high' || r.riskLevel === 'critical' ? r.riskLevel : 'medium') as ForecastData['riskLevel'],
        })),
        params: {
          forecastPeriod: 6,
          model: 'polynomial',
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
      };
    } catch {
      throw new Error(`Forecast ${id} not found`);
    }
  }

  async save(data: CreateForecastRequest): Promise<ForecastSnapshot> {
    const snapshot: ForecastSnapshot = {
      id: `local-${Date.now()}`,
      name: data.name,
      createdAt: new Date().toISOString(),
      forecastPeriod: data.forecastPeriod,
      predictions: data.predictions,
      params: data.params,
      metadata: data.metadata,
    };
    return snapshot;
  }

  async delete(id: string): Promise<void> {
    return;
  }
}

export const forecastApi = new ForecastApiService();

export const FORECAST_STORAGE_KEY = 'lastForecastData';
export const FORECAST_LIST_KEY = 'savedForecastsList';

export function saveForecastToLocal(forecast: ForecastSnapshot): void {
  try {
    localStorage.setItem(FORECAST_STORAGE_KEY, JSON.stringify(forecast));

    const list = loadForecastListFromLocal();
    const existingIdx = list.findIndex(f => f.id === forecast.id);
    const card: ForecastSummaryCard = {
      id: forecast.id,
      name: forecast.name,
      createdAt: forecast.createdAt,
      forecastPeriod: forecast.forecastPeriod,
      totalPredictions: forecast.metadata.totalPredictions,
      activeModel: forecast.metadata.activeModel,
      precinctCount: forecast.metadata.precincts.length,
      crimeTypeCount: forecast.metadata.crimeTypes.length,
    };

    if (existingIdx >= 0) {
      list[existingIdx] = card;
    } else {
      list.unshift(card);
    }
    localStorage.setItem(FORECAST_LIST_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {}
}

export function loadForecastFromLocal(): ForecastSnapshot | null {
  try {
    const raw = localStorage.getItem(FORECAST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadForecastListFromLocal(): ForecastSummaryCard[] {
  try {
    const raw = localStorage.getItem(FORECAST_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearLocalForecast(): void {
  try {
    localStorage.removeItem(FORECAST_STORAGE_KEY);
  } catch {}
}
