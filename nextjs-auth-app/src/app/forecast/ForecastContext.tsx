'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type {
  ForecastData,
  ForecastFilterState,
  HistoricalData,
  ForecastSnapshot,
  ForecastParams,
} from '../../types/forecast/ForecastBaseTypes';
import { initialForecastFilterState } from '../../types/forecast/ForecastBaseTypes';
import type { ExtendedForecastData, ForecastMapPoint, ManpowerAllocation } from '../../types/forecast/ExtendedForecastTypes';
import { DEFAULT_MANPOWER_ALLOCATION } from '../../types/forecast/ExtendedForecastTypes';
import type { SingleModelRun, EnsembleSummary } from '../../types/forecast/EnsembleTypes';
import { forecastApi, saveForecastToLocal, loadForecastFromLocal } from '../api/utils/forecastApi';
import { apiService } from '../api/utils/apiService';
import { processClusterData, convertHistoricalDataToClusters } from '../../utils/forecastHelpers';
import { runAllModels, computeConsensus } from '../../utils/forecastEnsemble';
import {
  enhanceForecastData,
  filterReliableForecasts,
  createForecastMapPoints,
} from '../../utils/forecastEnhancements';
import type { Cluster } from '../../types/analysis/ClusterDto';
import { toast } from 'react-toastify';

interface ForecastContextValue {
  loading: boolean;
  forecastId: string | null;
  forecast: ForecastSnapshot | null;
  clusters: Cluster[];
  historicalData: HistoricalData[];
  forecastData: ForecastData[];
  extendedForecastData: ExtendedForecastData[];
  forecastMapPoints: ForecastMapPoint[];
  modelRuns: SingleModelRun[];
  ensembleSummary: EnsembleSummary | null;
  activeModelLabel: string;
  dataQuality: any;
  manpowerSettings: ManpowerAllocation;
  filters: ForecastFilterState;
  filteredForecastData: ForecastData[];
  filteredForecastMapPoints: ForecastMapPoint[];
  analysisLoaded: boolean;
  forecastParams: ForecastParams;

  setFilters: (f: ForecastFilterState) => void;
  setFilteredForecastData: (d: ForecastData[]) => void;
  setManpowerSettings: (s: ManpowerAllocation) => void;
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
  const [extendedForecastData, setExtendedForecastData] = useState<ExtendedForecastData[]>([]);
  const [forecastMapPoints, setForecastMapPoints] = useState<ForecastMapPoint[]>([]);
  const [modelRuns, setModelRuns] = useState<SingleModelRun[]>([]);
  const [ensembleSummary, setEnsembleSummary] = useState<EnsembleSummary | null>(null);
  const [activeModelLabel, setActiveModelLabel] = useState('');
  const [dataQuality, setDataQuality] = useState<any>(null);
  const [manpowerSettings, setManpowerSettings] = useState<ManpowerAllocation>(DEFAULT_MANPOWER_ALLOCATION);
  const [filters, setFilters] = useState<ForecastFilterState>(initialForecastFilterState);
  const [filteredForecastData, setFilteredForecastData] = useState<ForecastData[]>([]);
  const [filteredForecastMapPoints, setFilteredForecastMapPoints] = useState<ForecastMapPoint[]>([]);

  const analysisLoaded = clusters.length > 0;
  const forecastParams: ForecastParams = forecast?.params || {
    forecastPeriod: 6,
    model: 'polynomial',
    confidence: 0.95,
    includeSeasonality: true,
    weightRecentData: true,
  };

  useEffect(() => {
    if (initialId) {
      loadForecast(initialId);
    } else {
      const local = loadForecastFromLocal();
      if (local) {
        setForecast(local);
        setForecastId(local.id);
        setClusters([]);
        setHistoricalData(local.historicalData || []);
        setForecastData(local.predictions || []);
        setFilteredForecastData(local.predictions || []);
      }
    }
  }, [initialId]);

  useEffect(() => {
    if (filteredForecastData.length > 0) {
      const enhanced = filteredForecastData.map(f => {
        const existing = extendedForecastData.find(
          e => e.precinct === f.precinct && e.crimeType === f.crimeType && e.year === f.year && e.month === f.month
        );
        if (existing) return existing;
        return enhanceForecastData(f as any, historicalData, clusters);
      });
      const reliable = filterReliableForecasts(enhanced, 0.3, 3, 1.5);
      const points = createForecastMapPoints(reliable, 0.3);
      setFilteredForecastMapPoints(points);
    } else {
      setFilteredForecastMapPoints(forecastMapPoints);
    }
  }, [filteredForecastData]);

  const loadForecast = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const data = await forecastApi.getById(id);
      setForecast(data);
      setForecastId(data.id);
      setHistoricalData(data.historicalData || []);
      setForecastData(data.predictions || []);
      setFilteredForecastData(data.predictions || []);
      if (data.params) {
        setManpowerSettings(DEFAULT_MANPOWER_ALLOCATION);
      }
      toast.success(`Loaded forecast: ${data.name}`);
    } catch {
      const local = loadForecastFromLocal();
      if (local && local.id === id) {
        setForecast(local);
        setForecastId(local.id);
        setHistoricalData(local.historicalData || []);
        setForecastData(local.predictions || []);
        setFilteredForecastData(local.predictions || []);
        toast.info('Loaded forecast from local storage');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const generateForecast = useCallback(async (clustersData: Cluster[], params: ForecastParams): Promise<ForecastData[]> => {
    setLoading(true);
    setForecastData([]);

    try {
      const processed = processClusterData(clustersData);
      setHistoricalData(processed);

      const thresholds = DEFAULT_MANPOWER_ALLOCATION.riskThresholds;
      const ensembleRuns = runAllModels(processed, {
        forecastPeriod: params.forecastPeriod,
        includeSeasonality: true,
        weightRecentData: true,
      }, { riskThresholds: thresholds });
      setModelRuns(ensembleRuns);
      const consensus = computeConsensus(ensembleRuns);
      setEnsembleSummary(consensus);

      let predictions: ForecastData[];

      try {
        const clusterGroups = convertHistoricalDataToClusters(clustersData, processed);
        const response = await apiService.post('/incident/forecast/statistical', {
          clusterData: clusterGroups,
          horizon: params.forecastPeriod,
          confidenceLevel: params.confidence,
          modelType: 'SSA',
          includeSeasonality: params.includeSeasonality,
          weightRecentData: params.weightRecentData,
        }) as any;

        if (response?.series) {
          setActiveModelLabel('SSA (ML.NET)');
          predictions = response.series.flatMap((series: any) =>
            (series.forecasts || []).map((f: any) => ({
              year: new Date(f.timestamp).getFullYear(),
              month: new Date(f.timestamp).getMonth() + 1,
              precinct: series.precinct,
              crimeType: series.crimeType,
              predictedCount: Math.max(0, Math.round(f.forecast)),
              confidence: f.confidence,
              trend: f.trend || 'stable',
              riskLevel: f.riskLevel || 'medium',
            }))
          ).sort((a: ForecastData, b: ForecastData) =>
            new Date(a.year, a.month - 1).getTime() - new Date(b.year, b.month - 1).getTime()
          );
        } else {
          throw new Error('Invalid response');
        }
      } catch {
        setActiveModelLabel(`${params.model.toUpperCase()} (local fallback)`);
        predictions = ensembleRuns[1]?.predictions || [];
      }

      setForecastData(predictions);
      setFilteredForecastData(predictions);

      const enhanced = predictions.map(f => enhanceForecastData(f as any, processed, clustersData));
      setExtendedForecastData(enhanced);

      const reliable = filterReliableForecasts(enhanced, 0.3, 3, 1.5);
      const points = createForecastMapPoints(reliable, 0.3);
      setForecastMapPoints(points);

      return predictions;
    } catch (err: any) {
      toast.error(`Forecast generation failed: ${err.message}`);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const saveCurrentForecast = useCallback(async (name: string): Promise<string | null> => {
    try {
      const snapshot = {
        name,
        forecastPeriod: forecastData.length > 0 ? new Date(Math.max(...forecastData.map(f => new Date(f.year, f.month).getTime()))).getMonth() - new Date().getMonth() + 1 : 6,
        params: { forecastPeriod: 6, model: 'polynomial' as const, confidence: 0.95, includeSeasonality: true, weightRecentData: true },
        predictions: forecastData,
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
      saveForecastToLocal(saved);
      setForecastId(saved.id);
      setForecast(saved);
      toast.success(`Forecast saved as "${name}"`);
      return saved.id;
    } catch (err: any) {
      toast.error(`Failed to save forecast: ${err.message}`);
      return null;
    }
  }, [forecastData, clusters, activeModelLabel, historicalData]);

  const clearForecast = useCallback(() => {
    setForecast(null);
    setForecastId(null);
    setClusters([]);
    setHistoricalData([]);
    setForecastData([]);
    setExtendedForecastData([]);
    setForecastMapPoints([]);
    setModelRuns([]);
    setEnsembleSummary(null);
    setActiveModelLabel('');
    setDataQuality(null);
    setFilteredForecastData([]);
    setFilteredForecastMapPoints([]);
  }, []);

  const value = useMemo(() => ({
    loading, forecastId, forecast, clusters, historicalData,
    forecastData, extendedForecastData, forecastMapPoints,
    modelRuns, ensembleSummary, activeModelLabel, dataQuality,
    manpowerSettings, filters, filteredForecastData, filteredForecastMapPoints,
    analysisLoaded, forecastParams,
    setFilters, setFilteredForecastData, setManpowerSettings,
    generateForecast, saveCurrentForecast, loadForecast, clearForecast,
  }), [
    loading, forecastId, forecast, clusters, historicalData,
    forecastData, extendedForecastData, forecastMapPoints,
    modelRuns, ensembleSummary, activeModelLabel, dataQuality,
    manpowerSettings, filters, filteredForecastData, filteredForecastMapPoints,
    analysisLoaded, forecastParams,
  ]);

  return (
    <ForecastContext.Provider value={value}>
      {children}
    </ForecastContext.Provider>
  );
}

export function useForecast(): ForecastContextValue {
  const ctx = useContext(ForecastContext);
  if (!ctx) throw new Error('useForecast must be used within ForecastProvider');
  return ctx;
}
