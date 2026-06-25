'use client';

import { useState, useEffect, useCallback } from 'react';
import withAuth from '../../hoc/withAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import type { Cluster } from '../../../types/analysis/ClusterDto';
import type { ForecastData, ForecastMetrics, ForecastParams } from '../../../types/forecast/ForecastBaseTypes';
import { format } from 'date-fns';
import { apiService } from '../../api/utils/apiService';
import { forecastApi } from '../../api/utils/forecastApi';
import { getSession } from 'next-auth/react';
import ForecastSummary from '../ForecastSummary';

function aggregateByMonth(clustersData: Cluster[]) {
  const map = new Map<string, { year: number; month: number; precinct: number; crimeType: number; count: number; timeOfDay: string }>();
  clustersData.forEach(c => c.clusterItems.forEach(item => {
    const key = `${item.year}-${item.month}-${item.precinct}-${item.crimeType}`;
    if (map.has(key)) map.get(key)!.count++;
    else map.set(key, { year: item.year, month: item.month, precinct: item.precinct, crimeType: item.crimeType, count: 1, timeOfDay: item.timeOfDay });
  }));
  return Array.from(map.values()).sort((a, b) => new Date(a.year, a.month - 1).getTime() - new Date(b.year, b.month - 1).getTime());
}

type Step = 'data' | 'configure' | 'generate' | 'review';

export default withAuth(function NewForecastPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('data');
  const [loading, setLoading] = useState(false);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [analysisLoaded, setAnalysisLoaded] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [forecastParams, setForecastParams] = useState<ForecastParams>({
    forecastPeriod: 6,
    model: 'ssa',
    confidence: 0.95,
    includeSeasonality: true,
    weightRecentData: true,
  });

  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [forecastMetrics, setForecastMetrics] = useState<ForecastMetrics | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [activeModelLabel, setActiveModelLabel] = useState('');
  const [forecastName, setForecastName] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('lastAnalysisClusters');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setClusters(data);
        setAnalysisLoaded(true);
      } catch {}
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'lastAnalysisClusters' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          setClusters(data);
          setAnalysisLoaded(true);
          toast.success('New analysis data detected');
          setStep('configure');
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) { setUploadError('Please select a JSON file'); return; }
    try {
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
      });
      const data = JSON.parse(content);
      if (!data.clusters || !Array.isArray(data.clusters)) {
        setUploadError('Invalid format: clusters array not found');
        return;
      }
      localStorage.setItem('lastAnalysisClusters', JSON.stringify(data.clusters));
      if (data.metadata?.parameters) {
        localStorage.setItem('lastAnalysisParams', JSON.stringify(data.metadata.parameters));
      }
      localStorage.setItem('lastAnalysisTimestamp', new Date().toISOString());
      setClusters(data.clusters);
      setAnalysisLoaded(true);
      toast.success(`Loaded ${data.clusters.length} clusters`);
      setShowUploadModal(false);
      setUploadError(null);
    } catch (err) {
      setUploadError(`Failed: ${err}`);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!analysisLoaded || clusters.length === 0) {
      toast.error('Please load analysis data first');
      return;
    }
    if (forecastParams.forecastPeriod < 1 || forecastParams.forecastPeriod > 12) {
      toast.error('Forecast period must be 1-12 months');
      return;
    }

    setLoading(true);
    setStep('generate');

    try {
      const aggregated = aggregateByMonth(clusters);
      setHistoricalData(aggregated);

      const clusterGroups = clusters.map(c => ({
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
        horizon: forecastParams.forecastPeriod,
        confidenceLevel: forecastParams.confidence,
        includeSeasonality: forecastParams.includeSeasonality,
        weightRecentData: forecastParams.weightRecentData,
      }) as any;

      if (!response?.series) throw new Error('Invalid API response');

      setActiveModelLabel('ML.NET');
      const metrics = response.metrics as ForecastMetrics | undefined;
      setForecastMetrics(metrics ?? null);
      const predictions: ForecastData[] = response.series.flatMap((series: any) =>
        (series.forecasts || []).map((f: any) => ({
          year: new Date(f.timestamp).getFullYear(),
          month: new Date(f.timestamp).getMonth() + 1,
          precinct: series.precinct,
          crimeType: series.crimeType,
          predictedCount: Math.max(0, Math.round(f.forecast)),
          confidence: f.confidence || forecastParams.confidence,
          trend: f.trend || 'stable',
          riskLevel: f.riskLevel || 'medium',
        }))
      ).sort((a: ForecastData, b: ForecastData) =>
        new Date(a.year, a.month - 1).getTime() - new Date(b.year, b.month - 1).getTime()
      );

      setForecastData(predictions);
      toast.success(`Generated ${predictions.length} predictions`);
      setStep('review');
    } catch (err: any) {
      toast.error(`Generation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [analysisLoaded, clusters, forecastParams]);

  const buildNameSuffix = (data: ForecastData[]) => {
    if (data.length === 0) return '';
    const months = [...new Set(data.map(f => `${f.year}-${String(f.month).padStart(2, '0')}`))].sort();
    const range = months.length >= 2 ? `${months[0]} to ${months[months.length-1]}` : months[0];
    return ` — ${range} — ${format(new Date(), 'yyyy-MM-dd HH:mm')}`;
  };

  const handleSave = useCallback(async () => {
    if (!forecastName.trim()) {
      toast.error('Please enter a forecast name before saving');
      return;
    }
    const name = `${forecastName.trim()}${buildNameSuffix(forecastData)}`;
    console.log('/forecast/new',name);
    setSaveLoading(true);
    try {
      const session = await getSession();
      const snapshot = {
        name,
        forecastPeriod: forecastParams.forecastPeriod,
        params: forecastParams,
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
        historicalData,
        metadata: {
          totalClusters: clusters.length,
          totalPredictions: forecastData.length,
          activeModel: activeModelLabel,
          precincts: [...new Set(forecastData.map(f => f.precinct))],
          crimeTypes: [...new Set(forecastData.map(f => f.crimeType))],
        },
      };

      const saved = await forecastApi.save(snapshot);
      toast.success(`Saved as "${name}"`);
      router.push(`/forecast/${saved.id}/summary`);
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
    } finally {
      setSaveLoading(false);
    }
  }, [forecastName, forecastParams, forecastData, forecastMetrics, clusters, historicalData, activeModelLabel, router]);

  const dataLoaded = analysisLoaded && clusters.length > 0;

  return (
    <div className="h-full p-6 space-y-6 overflow-auto">
      <ToastContainer />

      <div className="mb-6">
        <Link href="/forecast" className="text-ubuntu-600 hover:text-blue-800 text-sm flex items-center mb-4">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Forecasts
        </Link>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">New Forecast</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center mb-8">
        {[
          { key: 'data', label: 'Load Data', icon: '📂' },
          { key: 'configure', label: 'Configure', icon: '⚙️' },
          { key: 'generate', label: 'Generate', icon: '🔮' },
          { key: 'review', label: 'Review & Save', icon: '✅' },
        ].map((s, i) => {
          const isActive = step === s.key;
          const isDone = ['data', 'configure', 'generate', 'review'].indexOf(step) > i;
          return (
            <div key={s.key} className="flex items-center">
              <div className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition ${
                isActive ? 'bg-indigo-600 text-white shadow-lg' :
                isDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                <span className="mr-2">{isDone ? '✓' : s.icon}</span>
                {s.label}
              </div>
              {i < 3 && <div className={`w-12 h-0.5 mx-2 ${['data', 'configure', 'generate', 'review'].indexOf(step) > i ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Load Data */}
      {step === 'data' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Choose Data Source</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/analysis"
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-indigo-400 hover:bg-indigo-50 transition text-center"
            >
              <div className="text-3xl mb-3">📊</div>
              <h3 className="font-medium text-gray-800">Run New Analysis</h3>
              <p className="text-sm text-gray-500 mt-1">Go to the Analysis page to run K-Means clustering</p>
            </Link>

            <button
              onClick={() => setShowUploadModal(true)}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-indigo-400 hover:bg-indigo-50 transition text-center"
            >
              <div className="text-3xl mb-3">📁</div>
              <h3 className="font-medium text-gray-800">Upload JSON</h3>
              <p className="text-sm text-gray-500 mt-1">Upload a previously exported analysis file</p>
            </button>

            <button
              onClick={() => {
                const saved = localStorage.getItem('lastAnalysisClusters');
                if (saved) {
                  try {
                    const data = JSON.parse(saved);
                    setClusters(data);
                    setAnalysisLoaded(true);
                    toast.success(`Loaded ${data.length} clusters from cache`);
                  } catch {}
                } else {
                  toast.error('No cached analysis found');
                }
              }}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-indigo-400 hover:bg-indigo-50 transition text-center"
            >
              <div className="text-3xl mb-3">💾</div>
              <h3 className="font-medium text-gray-800">Use Cached Data</h3>
              <p className="text-sm text-gray-500 mt-1">Load the most recent analysis from localStorage</p>
            </button>
          </div>

          {dataLoaded && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 font-medium">✓ {clusters.length} clusters loaded</p>
              <p className="text-green-600 text-sm mt-1">
                {clusters.reduce((s, c) => s + c.clusterItems.length, 0)} total data points
              </p>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setStep('configure')}
              disabled={!dataLoaded}
              className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50 font-medium"
            >
              Next: Configure
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 'configure' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Forecast Parameters</h2>
          <div className="max-w-md space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Forecast Period (Months)
              </label>
              <input
                type="number"
                min="1" max="12"
                value={forecastParams.forecastPeriod}
                onChange={e => setForecastParams({ ...forecastParams, forecastPeriod: parseInt(e.target.value) || 6 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">Recommended: 3-6 months</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700">
                Singular Spectrum Analysis — <span className="text-gray-500">statistical time-series decomposition via ML.NET</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confidence: {(forecastParams.confidence * 100).toFixed(0)}%
              </label>
              <input
                type="range" min="0.8" max="0.99" step="0.01"
                value={forecastParams.confidence}
                onChange={e => setForecastParams({ ...forecastParams, confidence: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={forecastParams.weightRecentData}
                onChange={e => setForecastParams({ ...forecastParams, weightRecentData: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">Prioritize recent trends (last 6 months)</span>
            </div>
          </div>

          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep('data')} className="text-gray-600 hover:text-gray-800 font-medium">
              Back
            </button>
            <button
              onClick={handleGenerate}
              className="bg-gradient-to-r from-ubuntu-500 to-aubergine-600 text-white px-8 py-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 transition font-medium shadow-lg"
            >
              Generate Forecast
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Generating */}
      {step === 'generate' && loading && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <div className="text-center">
            <svg className="animate-spin h-12 w-12 text-indigo-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Generating Forecast</h3>
            <p className="text-gray-500">Running statistical models and computing predictions...</p>
          </div>
        </div>
      )}

      {/* Step 4: Review & Save */}
      {step === 'review' && forecastData.length > 0 && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Preview Results</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-indigo-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-indigo-700">{forecastData.length}</div>
                <div className="text-xs text-indigo-600">Predictions</div>
              </div>
              <div className="bg-ubuntu-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-ubuntu-700">{new Set(forecastData.map(f => `${f.year}-${f.month}`)).size}</div>
                <div className="text-xs text-ubuntu-600">Months</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-700">{new Set(forecastData.map(f => f.precinct)).size}</div>
                <div className="text-xs text-purple-600">Precincts</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-700">{activeModelLabel}</div>
                <div className="text-xs text-green-600">Model Used</div>
              </div>
            </div>
            <div className="mb-4">
              <ForecastSummary
                historicalData={historicalData}
                forecastData={forecastData}
                params={forecastParams}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Forecast Name</label>
            <input
              type="text"
              value={forecastName}
              onChange={e => setForecastName(e.target.value)}
              placeholder={`Forecast ${format(new Date(), 'yyyy-MM-dd HHmm')}`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setStep('configure')} className="px-6 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition font-medium">
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={saveLoading}
              className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-2 rounded-lg hover:from-green-700 hover:to-emerald-700 transition font-medium shadow-lg disabled:opacity-50"
            >
              {saveLoading ? 'Saving...' : 'Save & Explore'}
            </button>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Upload Analysis Data</h3>
              <button onClick={() => { setShowUploadModal(false); setUploadError(null); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">Upload a JSON file exported from the Analysis page.</p>
            {uploadError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{uploadError}</div>
            )}
            <input
              type="file" accept=".json,application/json"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-ubuntu-50 file:text-ubuntu-700 hover:file:bg-blue-100"
            />
            <div className="flex justify-end mt-4">
              <button onClick={() => { setShowUploadModal(false); setUploadError(null); }} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
