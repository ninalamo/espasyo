'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import withAuth from '../../hoc/withAuth';
import { apiService } from '../../api/utils/apiService';
import type { ClusterItem } from '../../../types/analysis/ClusterDto';
import type { HotspotFeature, HotspotPredictionResponse } from '../../../types/analysis/HotspotPredictionDto';

type HotspotClusterItem = Pick<
  ClusterItem,
  'caseId' | 'latitude' | 'longitude' | 'month' | 'year' | 'timeOfDay' | 'precinct' | 'crimeType'
>;

interface HotspotClusterGroup {
  clusterId: number;
  clusterItems: HotspotClusterItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHotspotClusterItem(value: unknown): value is HotspotClusterItem {
  if (!isRecord(value)) return false;
  return typeof value.caseId === 'string'
    && typeof value.latitude === 'number' && Number.isFinite(value.latitude)
    && typeof value.longitude === 'number' && Number.isFinite(value.longitude)
    && typeof value.month === 'number'
    && typeof value.year === 'number'
    && typeof value.timeOfDay === 'string'
    && typeof value.precinct === 'number'
    && typeof value.crimeType === 'number';
}

function isHotspotClusterGroup(value: unknown): value is HotspotClusterGroup {
  return isRecord(value)
    && typeof value.clusterId === 'number'
    && Array.isArray(value.clusterItems)
    && value.clusterItems.every(isHotspotClusterItem);
}

const RecommendationsPage = () => {
  const [clusters, setClusters] = useState<HotspotClusterGroup[]>([]);
  const [analysisTimestamp, setAnalysisTimestamp] = useState<string | null>(null);
  const [analysisLoaded, setAnalysisLoaded] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<HotspotPredictionResponse | null>(null);

  useEffect(() => {
    const savedClusters = localStorage.getItem('lastAnalysisClusters');
    if (!savedClusters) {
      setAnalysisLoaded(true);
      return;
    }

    try {
      const parsed: unknown = JSON.parse(savedClusters);
      if (!Array.isArray(parsed) || !parsed.every(isHotspotClusterGroup)) {
        throw new Error('Saved analysis data is incomplete or invalid. Run the analysis again before generating recommendations.');
      }

      setClusters(parsed);
      const savedTimestamp = localStorage.getItem('lastAnalysisTimestamp');
      if (savedTimestamp) {
        const timestamp = new Date(savedTimestamp);
        if (!Number.isNaN(timestamp.getTime())) {
          setAnalysisTimestamp(timestamp.toLocaleString());
        }
      }
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'Unable to read saved analysis data.');
    } finally {
      setAnalysisLoaded(true);
    }
  }, []);

  const generateRecommendations = async () => {
    if (clusters.length === 0) {
      setRequestError('The saved analysis contains no clusters. Run an analysis with crime data first.');
      return;
    }

    setLoading(true);
    setRequestError(null);
    setResult(null);

    try {
      const clusterData = clusters.map(cluster => ({
        clusterId: cluster.clusterId,
        clusterItems: cluster.clusterItems,
        clusterCount: cluster.clusterItems.length,
      }));
      const response = await apiService.post<HotspotPredictionResponse>(
        '/incident/forecast/hotspots',
        { clusterData },
      );

      if (!response?.features || !Array.isArray(response.features.features) || !response.summary) {
        throw new Error('The hotspot prediction service returned an invalid response.');
      }

      setResult(response);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Hotspot recommendations could not be generated.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/analysis" className="text-sm font-medium text-indigo-700 hover:text-indigo-900">
            ← Back to Analysis
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-gray-900">Hotspots &amp; Crime Prevention</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-600">
            Generate forecasted hotspot areas and prevention recommendations from the most recently saved analysis.
            Recommendations are informational and do not allocate patrol personnel.
          </p>
        </div>
        <button
          type="button"
          onClick={generateRecommendations}
          disabled={!analysisLoaded || loading || Boolean(analysisError) || clusters.length === 0}
          className="rounded-md bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Generating…' : result ? 'Regenerate Recommendations' : 'Generate Recommendations'}
        </button>
      </div>

      {!analysisLoaded && (
        <p role="status" className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">
          Loading saved analysis…
        </p>
      )}

      {analysisError && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {analysisError}
        </div>
      )}

      {analysisLoaded && !analysisError && clusters.length === 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">No saved analysis is available.</p>
          <p className="mt-1">Run or import an analysis before generating hotspot recommendations.</p>
        </div>
      )}

      {clusters.length > 0 && (
        <p className="text-xs text-gray-500">
          Source: {clusters.length} saved analysis clusters{analysisTimestamp ? ` · generated ${analysisTimestamp}` : ''}
        </p>
      )}

      {requestError && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {requestError}
        </div>
      )}

      {result && (
        <>
          {result.features.features.length === 0 ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-5" aria-live="polite">
              <h2 className="font-semibold text-amber-900">No forecast hotspot polygons were generated</h2>
              <p className="mt-1 text-sm text-amber-800">{result.summary.keyInsight}</p>
              <p className="mt-2 text-xs text-amber-800">
                An empty hotspot result does not establish that an area has no crime risk; it means this analysis did not produce qualifying spatial hotspots.
              </p>
            </section>
          ) : (
            <section aria-label="Hotspot summary" className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Forecast summary</h2>
                <p className="mt-1 text-sm text-gray-600">{result.summary.keyInsight}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard label="Identified hotspots" value={result.summary.totalForecasts.toLocaleString()} />
                <SummaryCard label="High risk" value={result.summary.highRiskPredictions.toLocaleString()} tone="orange" />
                <SummaryCard label="Critical risk" value={result.summary.criticalRiskPredictions.toLocaleString()} tone="red" />
                <SummaryCard label="Average confidence" value={`${(result.summary.averageConfidence * 100).toFixed(0)}%`} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SummaryCard label="Dominant risk level" value={result.summary.dominantRiskLevel} />
                <SummaryCard label="Overall trend" value={result.summary.overallTrend} />
              </div>
            </section>
          )}

          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-gray-900">Crime prevention recommendations</h2>
            {result.summary.recommendedActions.length > 0 ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-gray-700">
                {result.summary.recommendedActions.map((action, index) => <li key={`${index}-${action}`}>{action}</li>)}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-gray-600">The service returned no recommendations for this result.</p>
            )}
          </section>

          {result.features.features.length > 0 && (
            <HotspotTable features={result.features.features} />
          )}
        </>
      )}
    </main>
  );
};

function SummaryCard({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'orange' | 'red' }) {
  const toneClass = tone === 'red'
    ? 'border-red-200 bg-red-50 text-red-800'
    : tone === 'orange'
      ? 'border-orange-200 bg-orange-50 text-orange-800'
      : 'border-gray-200 bg-white text-gray-900';

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-75">{label}</p>
      <p className="mt-1 text-xl font-bold capitalize">{value}</p>
    </div>
  );
}

function HotspotTable({ features }: { features: HotspotFeature[] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-gray-900">Identified hotspot areas</h2>
        <p className="mt-1 text-sm text-gray-600">Forecast details returned for each hotspot polygon.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th scope="col" className="px-5 py-3">Precinct</th>
              <th scope="col" className="px-5 py-3">Crime type</th>
              <th scope="col" className="px-5 py-3">Cluster</th>
              <th scope="col" className="px-5 py-3">Forecast total</th>
              <th scope="col" className="px-5 py-3">Confidence</th>
              <th scope="col" className="px-5 py-3">Risk</th>
              <th scope="col" className="px-5 py-3">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {features.map((feature, index) => (
              <tr key={`${feature.properties.clusterId}-${feature.properties.precinct}-${feature.properties.crimeType}-${index}`}>
                <td className="whitespace-nowrap px-5 py-3">{feature.properties.precinct}</td>
                <td className="whitespace-nowrap px-5 py-3">{feature.properties.crimeType}</td>
                <td className="px-5 py-3">
                  {feature.properties.clusterIds?.length
                    ? feature.properties.clusterIds.join(', ')
                    : feature.properties.clusterId}
                </td>
                <td className="px-5 py-3">{feature.properties.totalPredicted.toLocaleString()}</td>
                <td className="px-5 py-3">{(feature.properties.confidence * 100).toFixed(0)}%</td>
                <td className="px-5 py-3 capitalize">{feature.properties.severity}</td>
                <td className="px-5 py-3 capitalize">{feature.properties.trend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default withAuth(RecommendationsPage);
