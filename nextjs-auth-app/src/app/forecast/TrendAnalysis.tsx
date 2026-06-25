'use client';

import { useMemo, useState } from 'react';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../../constants/consts';
import InfoBadge from '../../components/InfoBadge';
import TrendAnalysisMethodologyModal from './modals/TrendAnalysisMethodologyModal';
import type { HistoricalData, ForecastData } from '../../types/forecast/ForecastBaseTypes';

interface Props {
  historicalData: HistoricalData[];
  forecastData: ForecastData[];
  forecastId?: string | null;
}

const MANPOWER_CASES_PER_OFFICER = 15;
const MANPOWER_BASE: Record<string, number> = { critical: 8, high: 6, medium: 4, low: 2 };

type TrendRow = {
  id: number; name: string;
  increasing: number; decreasing: number; stable: number;
  totalPredicted: number; totalTrendCount: number;
  increasingRate: number; avgPerMonth: number;
  suggestedOfficers?: number;
  highRisk?: number; criticalRisk?: number;
  avgConfidence?: number;
};

const TrendAnalysis: React.FC<Props> = ({ historicalData, forecastData, forecastId }) => {
  const [isMethodologyModalOpen, setIsMethodologyModalOpen] = useState(false);
  const [selectedPrecinct, setSelectedPrecinct] = useState<number | null>(null);
  const [selectedCrimeType, setSelectedCrimeType] = useState<number | null>(null);

  const getPrecinctRisk = (high: number, critical: number): string =>
    critical > 0 ? 'critical' : high > 0 ? 'high' : 'medium';

  const analysis = useMemo(() => {
    if (forecastData.length === 0) return null;

    // Analyze trends by precinct
    const precinctTrends = forecastData.reduce((acc, item) => {
      const key = item.precinct;
      if (!acc[key]) {
        acc[key] = {
          name: GetPrecinctsDictionary[key] || `Precinct ${key}`,
          increasing: 0,
          decreasing: 0,
          stable: 0,
          totalPredicted: 0,
          highRisk: 0,
          criticalRisk: 0,
          totalTrendCount: 0,
          increasingRate: 0,
        };
      }
      
      acc[key][item.trend]++;
      acc[key].totalPredicted += item.predictedCount;
      acc[key].totalTrendCount++;
      acc[key].increasingRate = acc[key].increasing / acc[key].totalTrendCount;
      if (item.riskLevel === 'high') acc[key].highRisk++;
      if (item.riskLevel === 'critical') acc[key].criticalRisk++;
      
      return acc;
    }, {} as Record<number, any>);

    // Analyze trends by crime type
    const crimeTypeTrends = forecastData.reduce((acc, item) => {
      const key = item.crimeType;
      if (!acc[key]) {
        acc[key] = {
          name: CrimeTypesDictionary[key] || `Crime Type ${key}`,
          increasing: 0,
          decreasing: 0,
          stable: 0,
          totalPredicted: 0,
          avgConfidence: 0,
          confidenceSum: 0,
          count: 0,
          totalTrendCount: 0,
          increasingRate: 0,
        };
      }
      
      acc[key][item.trend]++;
      acc[key].totalPredicted += item.predictedCount;
      acc[key].confidenceSum += item.confidence;
      acc[key].count++;
      acc[key].avgConfidence = acc[key].confidenceSum / acc[key].count;
      acc[key].totalTrendCount++;
      acc[key].increasingRate = acc[key].increasing / acc[key].totalTrendCount;
      
      return acc;
    }, {} as Record<number, any>);

    // Calculate seasonal patterns from historical data
    const seasonalPattern = historicalData.reduce((acc, item) => {
      const month = item.month;
      if (!acc[month]) {
        acc[month] = { total: 0, count: 0, avg: 0 };
      }
      acc[month].total += item.count;
      acc[month].count++;
      acc[month].avg = acc[month].total / acc[month].count;
      return acc;
    }, {} as Record<number, any>);

    // Identify most concerning trends (by increasing rate)
    const concerningPrecincts = Object.entries(precinctTrends)
      .map(([id, data]) => ({ id: parseInt(id), ...data }))
      .filter(p => p.increasingRate > 0.5 && p.totalTrendCount >= 3)
      .sort((a, b) => b.increasingRate - a.increasingRate || (b.criticalRisk + b.highRisk) - (a.criticalRisk + a.highRisk))
      .slice(0, 5);

    const emergingThreats = Object.entries(crimeTypeTrends)
      .map(([id, data]) => ({ id: parseInt(id), ...data }))
      .filter(c => c.increasingRate > 0.5 && c.totalTrendCount >= 3)
      .sort((a, b) => b.increasingRate - a.increasingRate)
      .slice(0, 5);

    // Calculate overall statistics
    const forecastMonths = [...new Set(forecastData.map(f => `${f.year}-${String(f.month).padStart(2, '0')}`))].sort();
    const monthCount = forecastMonths.length;
    const forecastTimeRange = monthCount > 0 ? {
      min: forecastMonths[0],
      max: forecastMonths[monthCount - 1]
    } : null;

    // Add avg per month and suggested officers to each trend item
    const enrich = (items: any[], isPrecinct: boolean) =>
      items.map(item => ({
        ...item,
        avgPerMonth: Math.round(item.totalPredicted / monthCount),
        ...(isPrecinct ? { suggestedOfficers: Math.max(MANPOWER_BASE[getPrecinctRisk(item.highRisk || 0, item.criticalRisk || 0)], Math.ceil(item.avgPerMonth / MANPOWER_CASES_PER_OFFICER)) } : {}),
      }));

    const overallStats = {
      totalForecasts: forecastData.length,
      avgConfidence: forecastData.reduce((sum, f) => sum + f.confidence, 0) / forecastData.length,
      totalIncreasing: forecastData.filter(f => f.trend === 'increasing').length,
      totalDecreasing: forecastData.filter(f => f.trend === 'decreasing').length,
      totalStable: forecastData.filter(f => f.trend === 'stable').length,
      uniquePrecincts: new Set(forecastData.map(f => f.precinct)).size,
      uniqueCrimeTypes: new Set(forecastData.map(f => f.crimeType)).size,
      timeSpan: historicalData.length > 0 ? {
        minYear: Math.min(...historicalData.map(d => d.year)),
        maxYear: Math.max(...historicalData.map(d => d.year))
      } : null,
      forecastTimeRange,
      monthCount
    };

    return {
      precinctTrends: enrich(Object.entries(precinctTrends).map(([id, data]) => ({ 
        id: parseInt(id), 
        ...data 
      })), true),
      crimeTypeTrends: enrich(Object.entries(crimeTypeTrends).map(([id, data]) => ({ 
        id: parseInt(id), 
        ...data 
      })), false),
      seasonalPattern,
      concerningPrecincts: enrich(concerningPrecincts, true),
      emergingThreats: enrich(emergingThreats, false),
      overallStats
    };
  }, [historicalData, forecastData]);

  if (!analysis) {
    return (
      <div className="text-center text-gray-500 py-8">
        No trend analysis data available.
      </div>
    );
  }

  const TrendBar = ({ increasing, stable, decreasing, total } : { increasing: number; stable: number; decreasing: number; total: number }) => {
    if (total === 0) return null;
    const upPct = (increasing / total) * 100;
    const stablePct = (stable / total) * 100;
    const downPct = (decreasing / total) * 100;
    const netDir = increasing > decreasing ? 'up' : decreasing > increasing ? 'down' : 'flat';
    const netColor = netDir === 'up' ? 'text-red-600' : netDir === 'down' ? 'text-green-600' : 'text-yellow-600';
    const netLabel = netDir === 'up' ? 'Net increasing' : netDir === 'down' ? 'Net decreasing' : 'Net stable';
    return (
      <div className="mt-1">
        <div className="flex items-center gap-2">
          <div className="flex h-3 w-28 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
            {increasing > 0 && <div className="bg-red-500 h-full" style={{ width: `${upPct}%` }} title={`${upPct.toFixed(0)}% increasing`} />}
            {stable > 0 && <div className="bg-yellow-500 h-full" style={{ width: `${stablePct}%` }} title={`${stablePct.toFixed(0)}% stable`} />}
            {decreasing > 0 && <div className="bg-green-500 h-full" style={{ width: `${downPct}%` }} title={`${downPct.toFixed(0)}% decreasing`} />}
          </div>
          <span className={`text-xs font-semibold ${netColor}`}>{netLabel}</span>
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {increasing} inc · {stable} stable · {decreasing} dec ({total} forecast items)
        </div>
      </div>
    );
  };

  const getTrendColor = (increasing: number, decreasing: number, stable: number) => {
    const total = increasing + decreasing + stable;
    const upPercent = (increasing / total) * 100;
    const downPercent = (decreasing / total) * 100;

    if (upPercent > 50) return 'text-red-600 bg-red-50 border-red-200';
    if (downPercent > 50) return 'text-green-600 bg-green-50 border-green-200';
    return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  };

  return (
    <div className="space-y-6">
      {/* Concerning Precincts Alert */}
      {analysis.concerningPrecincts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-6 h-6 text-red-600 mr-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.865-.833-2.635 0L4.178 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <h3 className="font-semibold text-red-800 mb-2">⚠️ High Priority Areas</h3>
              <p className="text-sm text-red-700 mb-3">
                These precincts show increasing crime trends and require immediate attention:
              </p>
              <div className="space-y-2">
                {analysis.concerningPrecincts.map(precinct => (
                  <div
                    key={precinct.id}
                    onClick={() => setSelectedPrecinct(selectedPrecinct === precinct.id ? null : precinct.id)}
                    className={`bg-white p-3 rounded border cursor-pointer transition ${
                      selectedPrecinct === precinct.id ? 'border-blue-500 ring-2 ring-blue-200' : ''
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-900">{precinct.name}</span>
                      <div className="flex space-x-2">
                        {precinct.criticalRisk > 0 && (
                          <span className="px-2 py-1 text-xs bg-red-600 text-white rounded">
                            {precinct.criticalRisk} Critical
                          </span>
                        )}
                        {precinct.highRisk > 0 && (
                          <span className="px-2 py-1 text-xs bg-orange-500 text-white rounded">
                            {precinct.highRisk} High Risk
                          </span>
                        )}
                        {precinct.suggestedOfficers && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-ubuntu-700 rounded">
                            👮 {precinct.suggestedOfficers}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {(precinct.increasingRate * 100).toFixed(0)}% increasing ({precinct.increasing}/{precinct.totalTrendCount}), avg {precinct.avgPerMonth} / month
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {analysis.overallStats.forecastTimeRange && (
        <div className="text-sm text-gray-500 -mb-4">
          Forecast period: {analysis.overallStats.forecastTimeRange.min} to {analysis.overallStats.forecastTimeRange.max} ({analysis.overallStats.monthCount} months)
        </div>
      )}

      {(selectedPrecinct !== null || selectedCrimeType !== null) && (
        <div className="flex items-center gap-2 text-sm text-ubuntu-700 bg-ubuntu-50 border border-blue-200 rounded-lg px-4 py-2">
          <span>🔍 Showing trends for <strong>{selectedPrecinct !== null ? GetPrecinctsDictionary[selectedPrecinct] : ''}{selectedCrimeType !== null ? CrimeTypesDictionary[selectedCrimeType] : ''}</strong></span>
          <button
            onClick={() => { setSelectedPrecinct(null); setSelectedCrimeType(null); }}
            className="ml-2 text-ubuntu-600 hover:text-blue-800 underline"
          >
            Clear
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Precinct Trends */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-ubuntu-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Precinct Trend Analysis
          </h3>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {analysis.precinctTrends
              .sort((a, b) => {
                if (selectedCrimeType !== null) {
                  // When a crime type is selected, sort by relevance to that crime type
                  const aCount = forecastData.filter(f => f.precinct === a.id && f.crimeType === selectedCrimeType).reduce((s, f) => s + f.predictedCount, 0);
                  const bCount = forecastData.filter(f => f.precinct === b.id && f.crimeType === selectedCrimeType).reduce((s, f) => s + f.predictedCount, 0);
                  if (aCount !== bCount) return bCount - aCount;
                }
                return b.totalPredicted - a.totalPredicted;
              })
              .map(precinct => {
                const isSelected = selectedPrecinct === precinct.id;
                return (
                  <div
                    key={precinct.id}
                    onClick={() => setSelectedPrecinct(isSelected ? null : precinct.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition ${
                      isSelected
                        ? 'border-blue-500 bg-ubuntu-50 ring-2 ring-blue-200'
                        : getTrendColor(precinct.increasing, precinct.decreasing, precinct.stable)
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{precinct.name}</span>
                          {precinct.suggestedOfficers && (
                            <span className="text-xs bg-blue-100 text-ubuntu-700 px-1.5 py-0.5 rounded flex-shrink-0" title={`Suggested officers: ~${precinct.avgPerMonth} monthly cases ÷ ${MANPOWER_CASES_PER_OFFICER} per officer`}>
                              👮 {precinct.suggestedOfficers}
                            </span>
                          )}
                        </div>
                        <TrendBar
                          increasing={precinct.increasing}
                          stable={precinct.stable}
                          decreasing={precinct.decreasing}
                          total={precinct.totalTrendCount}
                        />
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="font-semibold">{precinct.avgPerMonth}</div>
                        <div className="text-xs text-gray-600">avg / month</div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Click a precinct to see its crime type breakdown &nbsp;·&nbsp; 👮 = suggested officers
          </div>
          <a href={forecastId ? `/manpower?forecastId=${forecastId}` : '/manpower'} className="mt-2 inline-block text-xs text-ubuntu-600 hover:text-blue-800">
            → View on Manpower Allocation page
          </a>
        </div>

        {/* Crime Type Trends */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Crime Type Trends{selectedPrecinct !== null ? ` — ${GetPrecinctsDictionary[selectedPrecinct]}` : ''}
          </h3>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {(selectedPrecinct !== null
              ? analysis.crimeTypeTrends.filter(ct =>
                  forecastData.some(f => f.crimeType === ct.id && f.precinct === selectedPrecinct)
                )
              : analysis.crimeTypeTrends
            )
              .sort((a, b) => {
                if (selectedPrecinct !== null) {
                  const aCount = forecastData.filter(f => f.crimeType === a.id && f.precinct === selectedPrecinct).reduce((s, f) => s + f.predictedCount, 0);
                  const bCount = forecastData.filter(f => f.crimeType === b.id && f.precinct === selectedPrecinct).reduce((s, f) => s + f.predictedCount, 0);
                  if (aCount !== bCount) return bCount - aCount;
                }
                return b.totalPredicted - a.totalPredicted;
              })
              .map(crime => {
                const isSelected = selectedCrimeType === crime.id;
                return (
                  <div
                    key={crime.id}
                    onClick={() => setSelectedCrimeType(isSelected ? null : crime.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition ${
                      isSelected
                        ? 'border-blue-500 bg-ubuntu-50 ring-2 ring-blue-200'
                        : getTrendColor(crime.increasing, crime.decreasing, crime.stable)
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center">
                          <span className="font-medium truncate">{crime.name}</span>
                        </div>
                        <TrendBar
                          increasing={crime.increasing}
                          stable={crime.stable}
                          decreasing={crime.decreasing}
                          total={crime.totalTrendCount}
                        />
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="font-semibold">{crime.avgPerMonth}</div>
                        <div className="text-xs text-gray-600">avg / month</div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Emerging Threats */}
      {analysis.emergingThreats.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Emerging Crime Threats
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analysis.emergingThreats.map((threat, index) => (
              <div key={threat.id} className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-orange-900">{threat.name}</span>
                  <span className="text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded">
                    #{index + 1}
                  </span>
                </div>
                <div className="text-sm text-orange-700">
                  <div className="mb-1">{(threat.increasingRate * 100).toFixed(0)}% increasing ({threat.increasing}/{threat.totalTrendCount})</div>
                  <div className="mb-1">avg {threat.avgPerMonth} / month</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seasonal Pattern */}
      {historicalData.length > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Historical Seasonal Pattern
          </h3>
          <p className="text-sm text-gray-600 mb-4">Average monthly incident counts from historical data. Higher bars indicate months with more past incidents.</p>
          <div className="flex items-end h-40 gap-1">
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(month => {
              const data = analysis.seasonalPattern[month];
              const avg = data ? data.avg : 0;
              const maxAvg = Math.max(...Object.values(analysis.seasonalPattern).map((d: any) => d.avg), 1);
              const height = (avg / maxAvg) * 100;
              const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              return (
                <div key={month} className="flex-1 flex flex-col items-center">
                  <div className="text-xs text-gray-500 mb-1">{avg.toFixed(1)}</div>
                  <div
                    className="w-full bg-green-500 rounded-t"
                    style={{ height: `${height}%` }}
                    title={`${monthNames[month - 1]}: avg ${avg.toFixed(1)} incidents`}
                  ></div>
                  <div className="text-xs text-gray-600 mt-1">{monthNames[month - 1]}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Methodology and Data Information */}
      <div className="bg-ubuntu-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-ubuntu-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <div>
              <h4 className="font-medium text-blue-800">Understanding the Analysis</h4>
              <p className="text-sm text-ubuntu-600 mt-1">
                Learn about trend indicators, calculation methods, data sources, and important limitations.
              </p>
            </div>
          </div>
          <InfoBadge
            onClick={() => setIsMethodologyModalOpen(true)}
            tooltip="Click for detailed methodology and data information"
          />
        </div>
      </div>

      {/* Modals */}
      <TrendAnalysisMethodologyModal
        isOpen={isMethodologyModalOpen}
        onClose={() => setIsMethodologyModalOpen(false)}
        historicalData={historicalData}
        overallStats={analysis.overallStats}
      />
    </div>
  );
};

export default TrendAnalysis;
