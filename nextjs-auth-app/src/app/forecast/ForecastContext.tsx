'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import type {
  ForecastData,
  HistoricalData,
  ForecastSnapshot,
  ForecastParams,
  ForecastMetrics,
  ForecastApiResponse,
  RiskScoringConfig,
} from '../../types/forecast/ForecastBaseTypes';
import type { ExtendedForecastData, ForecastMapPoint } from '../../types/forecast/ExtendedForecastTypes';
import { forecastApi } from '../api/utils/forecastApi';
import { apiService } from '../api/utils/apiService';
import type { Cluster } from '../../types/analysis/ClusterDto';
import { toast } from 'react-toastify';
import { getSession } from 'next-auth/react';

interface ForecastContextValue {
  loading: boolean;
  forecastId: string | null;
  forecast: ForecastSnapshot | null;
  clusters: Cluster[];
  historicalData: HistoricalData[];
  forecastData: ForecastData[];
  forecastMetrics: ForecastMetrics | null;
  spatialData: any[];
  seasonalPredictions: any[];
  apiResponse: ForecastApiResponse | null;
  extendedForecastData: ExtendedForecastData[];
  forecastMapPoints: ForecastMapPoint[];
  dataQuality: any;
  analysisLoaded: boolean;
  forecastParams: ForecastParams;
  generateForecast: (clustersData: Cluster[], params: ForecastParams, riskScoringConfig?: RiskScoringConfig) => Promise<ForecastData[]>;
  saveCurrentForecast: (name: string) => Promise<string | null>;
  loadForecast: (id: string) => Promise<void>;
  clearForecast: () => void;
}

const ForecastContext = createContext<ForecastContextValue | null>(null);

export function ForecastProvider({ children, forecastId: initialId }: { children: ReactNode; forecastId?: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [forecastId, setForecastId] = useState<string | null>(initialId || null);
  const [forecast, setForecast] = useState<ForecastSnapshot | null>(null);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [forecastMetrics, setForecastMetrics] = useState<ForecastMetrics | null>(null);
  const [extendedForecastData, setExtendedForecastData] = useState<ExtendedForecastData[]>([]);
  const [forecastMapPoints, setForecastMapPoints] = useState<ForecastMapPoint[]>([]);
  const [spatialData, setSpatialData] = useState<any[]>([]);
  const [seasonalPredictions, setSeasonalPredictions] = useState<any[]>([]);
  const [apiResponse, setApiResponse] = useState<ForecastApiResponse | null>(null);

  const [dataQuality, setDataQuality] = useState<any>(null);
  const loadingRef = useRef<string | null>(null);

  const analysisLoaded = clusters.length > 0;
  const forecastParams: ForecastParams = useMemo(
    () => forecast?.params || {
      forecastPeriod: 6,
      model: 'ssa',
      confidence: 0.95,
      includeSeasonality: true,
      weightRecentData: true,
    },
    [forecast?.params]
  );

  const loadForecast = useCallback(async (id: string) => {
    if (id === loadingRef.current) return;
    loadingRef.current = id;
    setLoading(true);
    try {
      const data = await forecastApi.getById(id);
      setForecast(data);
      setForecastId(data.id);
      const histData = data.historicalData || [];
      setHistoricalData(histData);

      const historicalLookup = new Map<string, number>();
      histData.forEach((h: HistoricalData) => {
        historicalLookup.set(`${h.year}-${h.month}-${h.precinct}-${h.crimeType}`, h.count);
      });

      const predictions = (data.predictions || []).map(f => ({
        ...f,
        lastYearActual: f.lastYearActual ?? historicalLookup.get(`${f.year - 1}-${f.month}-${f.precinct}-${f.crimeType}`),
      }));
      setForecastData(predictions);
      setForecastMetrics(data.metrics ?? null);
      setSpatialData(data.spatialData ?? []);
      setSeasonalPredictions(data.seasonalPredictions ?? []);
      setApiResponse(data.apiResponse ?? null);

      const mapPoints = (data.predictions || []).map(f => {
        const precinctCoords: Record<number, { lat: number; lng: number }> = {
          0: { lat: 14.4291, lng: 121.0358 }, 1: { lat: 14.3856, lng: 121.0189 },
          2: { lat: 14.3734, lng: 121.0456 }, 3: { lat: 14.3589, lng: 121.0234 },
          4: { lat: 14.4081, lng: 121.0415 }, 5: { lat: 14.3945, lng: 121.0523 },
          6: { lat: 14.3712, lng: 121.0589 }, 7: { lat: 14.4456, lng: 121.0234 },
          8: { lat: 14.4178, lng: 121.0634 },
        };
        const coord = precinctCoords[f.precinct] || { lat: 14.4081, lng: 121.0415 };
        return {
          id: `${f.year}-${f.month}-${f.precinct}-${f.crimeType}`,
          latitude: coord.lat, longitude: coord.lng,
          risk: f.riskLevel, predictedCount: f.predictedCount, confidence: f.confidence,
          reliability: f.confidence, precinct: f.precinct, crimeType: f.crimeType,
          forecastPeriod: `${f.year}-${String(f.month).padStart(2, '0')}`,
          trend: f.trend,
        };
      });
      setForecastMapPoints(mapPoints);

      toast.success(`Loaded forecast: ${data.name}`);
    } catch (err) {
      loadingRef.current = null;
      toast.error(`Failed to load forecast: ${err instanceof Error ? err.message : id}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateForecast = useCallback(async (clustersData: Cluster[], params: ForecastParams, riskScoringConfig?: RiskScoringConfig): Promise<ForecastData[]> => {
    setLoading(true);
    setForecastData([]);

    try {
      const aggregated = aggregateByMonth(clustersData);
      if (aggregated.length === 0) {
        toast.error('No data to forecast');
        return [];
      }
      setHistoricalData(aggregated);

      const historicalLookup = new Map<string, number>();
      aggregated.forEach(h => {
        historicalLookup.set(`${h.year}-${h.month}-${h.precinct}-${h.crimeType}`, h.count);
      });

      const clusterGroups = clustersData.map(c => ({
        clusterId: c.clusterId,
        clusterItems: c.clusterItems.map(i => ({
          caseId: i.caseId, latitude: i.latitude, longitude: i.longitude,
          month: i.month, year: i.year, timeOfDay: i.timeOfDay,
          precinct: i.precinct, crimeType: i.crimeType,
        })),
        clusterCount: c.clusterItems.length,
      }));

      const response = await apiService.post('/incident/forecast/statistical', {
        clusterData: clusterGroups,
        horizon: params.forecastPeriod,
        confidenceLevel: params.confidence,
        modelType: params.model,
        riskScoringConfig: riskScoringConfig ?? undefined,
      }) as any;

      if (!response?.series) throw new Error('Invalid API response');

      setApiResponse(response);

      const metrics = response.metrics as ForecastMetrics | undefined;
      setForecastMetrics(metrics ?? null);
      setSpatialData(response.spatialRows ?? []);
      setSeasonalPredictions(response.seasonalPredictions ?? []);

      const compositeLookup = new Map<string, number>();
      (response.forecasts || []).forEach((r: any) => {
        const key = `${r.precinct}-${r.crimeType}-${new Date(r.timestamp).getTime()}`;
        if (r.compositeRiskScore != null) compositeLookup.set(key, r.compositeRiskScore);
      });

      const predictions: ForecastData[] = response.series.flatMap((series: any) =>
        (series.forecasts || []).map((f: any) => {
          const year = new Date(f.timestamp).getFullYear();
          const month = new Date(f.timestamp).getMonth() + 1;
          const lookupKey = `${series.precinct}-${series.crimeType}-${new Date(f.timestamp).getTime()}`;
          return {
            year,
            month,
            precinct: series.precinct,
            crimeType: series.crimeType,
            predictedCount: Math.max(0, f.forecast),
            confidence: f.confidence ?? 0,
            lowerBound: f.lowerBound != null ? f.lowerBound : undefined,
            upperBound: f.upperBound != null ? f.upperBound : undefined,
            lastYearActual: historicalLookup.get(`${year - 1}-${month}-${series.precinct}-${series.crimeType}`),
            trend: f.trend || 'stable',
            riskLevel: f.riskLevel || 'medium',
            compositeRiskScore: compositeLookup.get(lookupKey),
          };
        })
      ).sort((a: ForecastData, b: ForecastData) =>
        new Date(a.year, a.month - 1).getTime() - new Date(b.year, b.month - 1).getTime()
      );

      setForecastData(predictions);

      const mapPoints = predictions.map(f => {
        const precinctCoords: Record<number, { lat: number; lng: number }> = {
          0: { lat: 14.4291, lng: 121.0358 }, 1: { lat: 14.3856, lng: 121.0189 },
          2: { lat: 14.3734, lng: 121.0456 }, 3: { lat: 14.3589, lng: 121.0234 },
          4: { lat: 14.4081, lng: 121.0415 }, 5: { lat: 14.3945, lng: 121.0523 },
          6: { lat: 14.3712, lng: 121.0589 }, 7: { lat: 14.4456, lng: 121.0234 },
          8: { lat: 14.4178, lng: 121.0634 },
        };
        const coord = precinctCoords[f.precinct] || { lat: 14.4081, lng: 121.0415 };
        return {
          id: `${f.year}-${f.month}-${f.precinct}-${f.crimeType}`,
          latitude: coord.lat, longitude: coord.lng,
          risk: f.riskLevel, predictedCount: f.predictedCount, confidence: f.confidence,
          reliability: f.confidence, precinct: f.precinct, crimeType: f.crimeType,
          forecastPeriod: `${f.year}-${String(f.month).padStart(2, '0')}`,
          trend: f.trend,
        };
      });
      setForecastMapPoints(mapPoints);

      return predictions;
    } catch (err: any) {
      toast.error(`Forecast failed: ${err.message}`);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const buildNameSuffix = (data: ForecastData[]) => {
    if (data.length === 0) return '';
    const months = [...new Set(data.map(f => `${f.year}-${String(f.month).padStart(2, '0')}`))].sort();
    const range = months.length >= 2 ? `${months[0]} to ${months[months.length-1]}` : months[0];
    return ` — ${range} — ${format(new Date(), 'yyyy-MM-dd HH:mm')}`;
  };

  const saveCurrentForecast = useCallback(async (name: string): Promise<string | null> => {
    try {
      const session = await getSession();
      name = `${name}${buildNameSuffix(forecastData)}`;
      const snapshot = {
        name,
        forecastPeriod: forecastData.length > 0 ? new Date(Math.max(...forecastData.map(f => new Date(f.year, f.month).getTime()))).getMonth() - new Date().getMonth() + 1 : 6,
        params: { forecastPeriod: 6, model: 'linear' as const, confidence: 0.95, includeSeasonality: true, weightRecentData: true },
        predictions: forecastData,
        metrics: forecastMetrics,
        clusterData: clusters.map(c => ({
          clusterId: c.clusterId,
          clusterItems: c.clusterItems.map(i => ({
            caseId: i.caseId, latitude: i.latitude, longitude: i.longitude,
            month: i.month, year: i.year, timeOfDay: i.timeOfDay,
            precinct: i.precinct, crimeType: i.crimeType,
          })),
          clusterCount: c.clusterItems.length,
        })),
        generatedById: session?.user?.id,
        spatialData,
        seasonalPredictions,
        apiResponse: apiResponse ?? undefined,
        metadata: {
          totalClusters: clusters.length,
          totalPredictions: forecastData.length,
          activeModel: 'Linear',
          precincts: [...new Set(forecastData.map(f => f.precinct))],
          crimeTypes: [...new Set(forecastData.map(f => f.crimeType))],
        },
        historicalData,
      };

      const saved = await forecastApi.save(snapshot);
      setForecastId(saved.id);
      setForecast(saved);
      toast.success(`Forecast saved as "${name}"`);
      return saved.id;
    } catch (err: any) {
      toast.error(`Failed to save forecast: ${err.message}`);
      return null;
    }
  }, [forecastData, clusters, historicalData, forecastMetrics, spatialData, seasonalPredictions, apiResponse]);

  const clearForecast = useCallback(() => {
    setForecast(null);
    setForecastId(null);
    setClusters([]);
    setHistoricalData([]);
    setForecastData([]);
    setForecastMetrics(null);
    setExtendedForecastData([]);
    setForecastMapPoints([]);
    setSpatialData([]);
    setSeasonalPredictions([]);
    setApiResponse(null);

    setDataQuality(null);
  }, []);

  useEffect(() => {
    if (initialId) {
      loadForecast(initialId);
    }
  }, [initialId, loadForecast]);

  const value = useMemo(() => ({
    loading, forecastId, forecast, clusters, historicalData,
    forecastData, forecastMetrics, spatialData, seasonalPredictions, apiResponse,
    extendedForecastData, forecastMapPoints,
    activeModelLabel: 'Linear', dataQuality,
    analysisLoaded, forecastParams,
    generateForecast, saveCurrentForecast, loadForecast, clearForecast,
  }), [
    loading, forecastId, forecast, clusters, historicalData,
    forecastData, forecastMetrics, spatialData, seasonalPredictions, apiResponse,
    extendedForecastData, forecastMapPoints,
    dataQuality,
    analysisLoaded, forecastParams,
    generateForecast, saveCurrentForecast, loadForecast, clearForecast,
  ]);

  return (
    <ForecastContext.Provider value={value}>
      {children}
    </ForecastContext.Provider>
  );
}

function aggregateByMonth(clustersData: Cluster[]) {
  const map = new Map<string, { year: number; month: number; precinct: number; crimeType: number; count: number; timeOfDay: string }>();
  clustersData.forEach(c => c.clusterItems.forEach(item => {
    const key = `${item.year}-${item.month}-${item.precinct}-${item.crimeType}`;
    if (map.has(key)) map.get(key)!.count++;
    else map.set(key, { year: item.year, month: item.month, precinct: item.precinct, crimeType: item.crimeType, count: 1, timeOfDay: item.timeOfDay });
  }));
  return Array.from(map.values()).sort((a, b) => new Date(a.year, a.month - 1).getTime() - new Date(b.year, b.month - 1).getTime());
}

export function useForecast(): ForecastContextValue {
  const ctx = useContext(ForecastContext);
  if (!ctx) throw new Error('useForecast must be used within ForecastProvider');
  return ctx;
}
