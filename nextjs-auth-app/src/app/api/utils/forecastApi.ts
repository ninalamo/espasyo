import type { ForecastSnapshot, CreateForecastRequest, ForecastSummaryCard, ForecastData, ForecastEvaluationResult } from '../../../types/forecast/ForecastBaseTypes';

const FORECAST_NAMES_KEY = 'forecastCustomNames';
const FORECAST_CACHE_KEY = 'forecastLocalCache';

function getStoredNames(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(FORECAST_NAMES_KEY) || '{}');
  } catch { return {}; }
}

function storeName(id: string, name: string): void {
  if (typeof window === 'undefined') return;
  try {
    const all = getStoredNames();
    all[id] = name;
    localStorage.setItem(FORECAST_NAMES_KEY, JSON.stringify(all));
  } catch {}
}

function removeStoredName(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const all = getStoredNames();
    delete all[id];
    localStorage.setItem(FORECAST_NAMES_KEY, JSON.stringify(all));
  } catch {}
}

/* Local cache: persists multi-barangay forecasts when the snapshot API is unavailable */
function getLocalCache(): ForecastSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(FORECAST_CACHE_KEY) || '[]');
  } catch { return []; }
}

function setLocalCache(snapshots: ForecastSnapshot[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FORECAST_CACHE_KEY, JSON.stringify(snapshots));
  } catch {}
}

function addToLocalCache(snapshot: ForecastSnapshot): void {
  const cache = getLocalCache().filter(s => s.id !== snapshot.id);
  cache.push(snapshot);
  setLocalCache(cache);
}

function removeFromLocalCache(id: string): void {
  setLocalCache(getLocalCache().filter(s => s.id !== id));
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

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

function toCrimeTypeInt(value: string | number): number {
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value >= 0 && value <= 19) return value;
    throw new Error(`Invalid numeric crimeType: ${value}`);
  }
  const mapped = CRIMETYPE_NAME_TO_INT[value];
  if (mapped !== undefined) return mapped;
  throw new Error(`Unknown crimeType name: "${value}"`);
}

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
  name?: string;
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
  shift?: string;
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
    const [response, localCache] = await Promise.all([
      this.fetchApi<GetForecastRunsResponse>('/ForecastRun'),
      Promise.resolve(getLocalCache()),
    ]);
    const storedNames = getStoredNames();

    const backendCards = response.runs.map(r => ({
      id: r.id,
      name: r.name || storedNames[r.id] || `${r.precinctName}`,
      createdAt: r.runAt,
      forecastPeriod: r.horizon,
      totalPredictions: r.totalSeries,
      activeModel: 'Linear',
      precinctCount: 1,
      crimeTypeCount: 0,
    }));

    const localCards: ForecastSummaryCard[] = localCache.map(s => ({
      id: s.id,
      name: s.name || storedNames[s.id] || `Forecast ${s.id.slice(0, 8)}`,
      createdAt: s.createdAt,
      forecastPeriod: s.forecastPeriod,
      totalPredictions: s.metadata?.totalPredictions || s.predictions.length,
      activeModel: s.metadata?.activeModel || 'Linear',
      precinctCount: s.metadata?.precincts?.length || [...new Set(s.predictions.map(p => p.precinct))].length,
      crimeTypeCount: s.metadata?.crimeTypes?.length || [...new Set(s.predictions.map(p => p.crimeType))].length,
    }));

    const localIds = new Set(localCards.map(c => c.id));
    return [...backendCards.filter(c => !localIds.has(c.id)), ...localCards];
  }

  async getById(id: string): Promise<ForecastSnapshot> {
    const local = getLocalCache().find(s => s.id === id);
    if (local) return local;

    try {
      const results = await this.fetchApi<ForecastResultDto[]>(`/ForecastRun/${id}/results`);

      const precincts = [...new Set(results.map(r => BARANGAY_NAME_TO_INT[r.precinct] ?? 0))];
      const crimeTypes = [...new Set(results.map(r => toCrimeTypeInt(r.crimeType)))];
      const storedNames = getStoredNames();

      return {
        id,
        name: storedNames[id] || `Forecast ${id.slice(0, 8)}`,
        createdAt: new Date().toISOString(),
        forecastPeriod: 6,
        predictions: results.map(r => ({
          year: r.year,
          month: r.month,
          precinct: BARANGAY_NAME_TO_INT[r.precinct] ?? 0,
          crimeType: toCrimeTypeInt(r.crimeType),
          shift: (r.shift === 'Morning' || r.shift === 'Afternoon' || r.shift === 'Evening' ? r.shift : undefined) as ForecastData['shift'],
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
          activeModel: 'Linear',
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
              shift: p.shift,
            })),
            spatialPredictions: (data.spatialData || []).map(s => {
              const dt = s.timestamp ? new Date(s.timestamp) : null;
              return {
                precinct: s.precinct,
                clusterId: s.clusterId,
                latitude: s.latitude,
                longitude: s.longitude,
                month: dt ? dt.getMonth() + 1 : 1,
                year: dt ? dt.getFullYear() : new Date().getFullYear(),
                predictedValue: s.forecast,
                lowerBound: s.lowerBound,
                upperBound: s.upperBound,
                confidence: s.confidence,
                riskLevel: s.riskLevel,
                trend: s.trend,
              };
            }),
            seasonalPredictions: (data.seasonalPredictions || []).map(s => ({
              precinct: s.precinct,
              crimeType: s.crimeType,
              trend: s.trend,
              seasonal: s.seasonal,
              residual: s.residual,
              strength: s.strength,
              peakMonth: s.peakMonth,
              troughMonth: s.troughMonth,
            })),
            generatedById: data.generatedById ?? '',
          }),
        });

        storeName(response.id, response.name);

        const snapshot: ForecastSnapshot = {
          id: response.id,
          name: response.name,
          createdAt: response.createdAt,
          forecastPeriod: data.forecastPeriod,
          predictions: data.predictions,
          metrics: data.metrics,
          params: data.params,
          spatialData: data.spatialData,
          seasonalPredictions: data.seasonalPredictions,
          apiResponse: data.apiResponse,
          metadata: {
            ...data.metadata,
            totalPredictions: response.totalPredictions,
            precincts: [...new Set(data.predictions.map(f => f.precinct))],
            crimeTypes: [...new Set(data.predictions.map(f => f.crimeType))],
          },
          historicalData: data.historicalData,
        };
        addToLocalCache(snapshot);
        return snapshot;
      } catch (error) {
        console.warn('Snapshot endpoint unavailable, saving locally:', error);
      }

      const localId = generateId();
      const snapshot: ForecastSnapshot = {
        id: localId,
        name: data.name,
        createdAt: new Date().toISOString(),
        forecastPeriod: data.forecastPeriod,
        predictions: data.predictions,
        metrics: data.metrics ?? null,
        params: data.params,
        spatialData: data.spatialData,
        seasonalPredictions: data.seasonalPredictions,
        apiResponse: data.apiResponse,
        metadata: {
          ...data.metadata,
          totalPredictions: data.predictions.length,
          precincts: [...new Set(data.predictions.map(f => f.precinct))],
          crimeTypes: [...new Set(data.predictions.map(f => f.crimeType))],
        },
        historicalData: data.historicalData,
      };
      storeName(localId, data.name);
      addToLocalCache(snapshot);
      return snapshot;
    }

    if (data.clusterData?.length) {
      try {
        const precinctList = await this.fetchApi<Array<{ id: string; name: string; code: string }>>('/manpower/precincts');
        const cd = data.clusterData!;
        const uniquePrecincts = [...new Set(cd.flatMap(c => c.clusterItems.map(i => i.precinct)))];

        const allResults = await Promise.all(uniquePrecincts.map(async (precinctNum) => {
          const precinctName = BARANGAY_INT_TO_NAME[precinctNum];
          const matched = precinctList.find(p => p.name === precinctName);
          const precinctId = matched?.id ?? '00000000-0000-0000-0000-000000000000';

          const mlResponse = await this.fetchApi<{ id: string }>('/ForecastRun', {
            method: 'POST',
            body: JSON.stringify({
              clusterData: cd.map(c => ({
                clusterId: c.clusterId,
                clusterItems: c.clusterItems.filter(i => i.precinct === precinctNum),
                clusterCount: c.clusterItems.filter(i => i.precinct === precinctNum).length,
              })).filter(c => c.clusterItems.length > 0),
              precinctId,
              horizon: data.params.forecastPeriod,
              confidenceLevel: data.params.confidence,
              modelType: 'Linear',
              name: data.name,
              includeSeasonality: data.params.includeSeasonality,
              weightRecentData: data.params.weightRecentData,
              generatedById: data.generatedById ?? '',
            }),
          });

          return this.fetchApi<ForecastResultDto[]>(`/ForecastRun/${mlResponse.id}/results`);
        }));

        const predictions: ForecastData[] = allResults.flat().map(r => ({
          year: r.year,
          month: r.month,
          precinct: BARANGAY_NAME_TO_INT[r.precinct] ?? 0,
          crimeType: toCrimeTypeInt(r.crimeType),
          shift: (r.shift === 'Morning' || r.shift === 'Afternoon' || r.shift === 'Evening' ? r.shift : undefined) as ForecastData['shift'],
          predictedCount: Math.max(0, Math.round(r.predictedValue)),
          confidence: r.confidence,
          trend: (r.trend === 'increasing' || r.trend === 'decreasing' || r.trend === 'stable' ? r.trend : 'stable') as ForecastData['trend'],
          riskLevel: (r.riskLevel === 'low' || r.riskLevel === 'medium' || r.riskLevel === 'high' || r.riskLevel === 'critical' ? r.riskLevel : 'medium') as ForecastData['riskLevel'],
        }));

        const localId = generateId();
        storeName(localId, data.name);

        const snapshot: ForecastSnapshot = {
          id: localId,
          name: data.name,
          createdAt: new Date().toISOString(),
          forecastPeriod: data.forecastPeriod,
          predictions,
          metrics: data.metrics ?? null,
          params: data.params,
          spatialData: data.spatialData,
          seasonalPredictions: data.seasonalPredictions,
          apiResponse: data.apiResponse,
          metadata: {
            ...data.metadata,
            totalPredictions: predictions.length,
            precincts: [...new Set(predictions.map(f => f.precinct))],
            crimeTypes: [...new Set(predictions.map(f => f.crimeType))],
          },
          historicalData: data.historicalData,
        };
        addToLocalCache(snapshot);
        return snapshot;
      } catch {
        throw new Error('Failed to save forecast via ML endpoint');
      }
    }

    throw new Error('No predictions or cluster data to save');
  }

  async delete(id: string): Promise<void> {
    removeFromLocalCache(id);
    try {
      await this.fetchApi<void>(`/ForecastRun/${id}`, { method: 'DELETE' });
    } catch {
      // Local-only forecast; nothing to delete on backend
    }
  }

  async evaluate(id: string): Promise<ForecastEvaluationResult> {
    return this.fetchApi<ForecastEvaluationResult>(`/ForecastRun/${id}/evaluate`);
  }
}

export const forecastApi = new ForecastApiService();


