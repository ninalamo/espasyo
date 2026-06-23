'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import type {
  ForecastData,
  ForecastFilterState,
  HistoricalData,
  ForecastSnapshot,
  ForecastParams,
  ForecastMetrics,
} from '../../types/forecast/ForecastBaseTypes';
import { initialForecastFilterState } from '../../types/forecast/ForecastBaseTypes';
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
  extendedForecastData: ExtendedForecastData[];
  forecastMapPoints: ForecastMapPoint[];
  activeModelLabel: string;
  dataQuality: any;
  filters: ForecastFilterState;
  filteredForecastData: ForecastData[];
  filteredForecastMapPoints: ForecastMapPoint[];
  analysisLoaded: boolean;
  forecastParams: ForecastParams;

  setFilters: (f: ForecastFilterState) => void;
  setFilteredForecastData: (d: ForecastData[]) => void;
  generateForecast: (clustersData: Cluster[], params: ForecastParams) => Promise<ForecastData[]>;
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
  const [activeModelLabel, setActiveModelLabel] = useState('');
  const [dataQuality, setDataQuality] = useState<any>(null);
  const [filters, setFilters] = useState<ForecastFilterState>(initialForecastFilterState);
  const [filteredForecastData, setFilteredForecastData] = useState<ForecastData[]>([]);
  const [filteredForecastMapPoints, setFilteredForecastMapPoints] = useState<ForecastMapPoint[]>([]);

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

  useEffect(() => {
    if (filteredForecastData.length > 0) {
      const forecastKeySet = new Set(filteredForecastData.map(f => `${f.precinct}-${f.crimeType}-${f.year}-${f.month}`));
      const filtered = forecastMapPoints.filter(p =>
        forecastKeySet.has(`${p.precinct}-${p.crimeType}-${p.forecastPeriod}`)
      );
      setFilteredForecastMapPoints(filtered);
    } else {
      setFilteredForecastMapPoints(forecastMapPoints);
    }
  }, [filteredForecastData, forecastMapPoints]);

  const loadForecast = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const data = await forecastApi.getById(id);
      setForecast(data);
      setForecastId(data.id);
      setHistoricalData(data.historicalData || []);
      setForecastData(data.predictions || []);
      setForecastMetrics(data.metrics ?? null);
      setFilteredForecastData(data.predictions || []);

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
          timeOfDayBreakdown: { morning: 1, afternoon: 1, evening: 1, night: 1 },
          primaryTimeOfDay: 'morning' as const,
          forecastPeriod: `${f.year}-${String(f.month).padStart(2, '0')}`,
          trend: f.trend,
        };
      });
      setForecastMapPoints(mapPoints);
      setFilteredForecastMapPoints(mapPoints);

      toast.success(`Loaded forecast: ${data.name}`);
    } catch {
      toast.error(`Failed to load forecast ${id}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateForecast = useCallback(async (clustersData: Cluster[], params: ForecastParams): Promise<ForecastData[]> => {
    setLoading(true);
    setForecastData([]);

    try {
      const aggregated = aggregateByMonth(clustersData);
      if (aggregated.length === 0) {
        toast.error('No data to forecast');
        return [];
      }
      setHistoricalData(aggregated);

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
        modelType: 'SSA',
        includeSeasonality: params.includeSeasonality,
        weightRecentData: params.weightRecentData,
      }) as any;

      if (!response?.series) throw new Error('Invalid API response');

      setActiveModelLabel('SSA (ML.NET)');
      const metrics = response.metrics as ForecastMetrics | undefined;
      setForecastMetrics(metrics ?? null);
      const predictions: ForecastData[] = response.series.flatMap((series: any) =>
        (series.forecasts || []).map((f: any) => ({
          year: new Date(f.timestamp).getFullYear(),
          month: new Date(f.timestamp).getMonth() + 1,
          precinct: series.precinct,
          crimeType: series.crimeType,
          predictedCount: Math.max(0, Math.round(f.forecast)),
          confidence: f.confidence ?? 0,
          lowerBound: f.lowerBound != null ? f.lowerBound : undefined,
          upperBound: f.upperBound != null ? f.upperBound : undefined,
          trend: f.trend || 'stable',
          riskLevel: f.riskLevel || 'medium',
        }))
      ).sort((a: ForecastData, b: ForecastData) =>
        new Date(a.year, a.month - 1).getTime() - new Date(b.year, b.month - 1).getTime()
      );

      setForecastData(predictions);
      setFilteredForecastData(predictions);

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
          timeOfDayBreakdown: { morning: 1, afternoon: 1, evening: 1, night: 1 },
          primaryTimeOfDay: 'morning' as const,
          forecastPeriod: `${f.year}-${String(f.month).padStart(2, '0')}`,
          trend: f.trend,
        };
      });
      setForecastMapPoints(mapPoints);
      setFilteredForecastMapPoints(mapPoints);

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
        params: { forecastPeriod: 6, model: 'ssa' as const, confidence: 0.95, includeSeasonality: true, weightRecentData: true },
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
        metadata: {
          totalClusters: clusters.length,
          totalPredictions: forecastData.length,
          activeModel: activeModelLabel,
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
  }, [forecastData, clusters, activeModelLabel, historicalData, forecastMetrics]);

  const clearForecast = useCallback(() => {
    setForecast(null);
    setForecastId(null);
    setClusters([]);
    setHistoricalData([]);
    setForecastData([]);
    setForecastMetrics(null);
    setExtendedForecastData([]);
    setForecastMapPoints([]);
    setActiveModelLabel('');
    setDataQuality(null);
    setFilteredForecastData([]);
    setFilteredForecastMapPoints([]);
  }, []);

  useEffect(() => {
    if (initialId) {
      loadForecast(initialId);
    }
  }, [initialId, loadForecast]);

  const value = useMemo(() => ({
    loading, forecastId, forecast, clusters, historicalData,
    forecastData, forecastMetrics, extendedForecastData, forecastMapPoints,
    activeModelLabel, dataQuality,
    filters, filteredForecastData, filteredForecastMapPoints,
    analysisLoaded, forecastParams,
    setFilters, setFilteredForecastData,
    generateForecast, saveCurrentForecast, loadForecast, clearForecast,
  }), [
    loading, forecastId, forecast, clusters, historicalData,
    forecastData, forecastMetrics, extendedForecastData, forecastMapPoints,
    activeModelLabel, dataQuality,
    filters, filteredForecastData, filteredForecastMapPoints,
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
