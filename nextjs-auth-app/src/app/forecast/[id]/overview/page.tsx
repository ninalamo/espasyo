'use client';

import Link from 'next/link';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { useForecast } from '../../ForecastContext';
import { Skeleton, CardSkeleton, ChartSkeleton } from '../../../../components/ui/skeleton';
import { GetPrecinctsDictionary } from '../../../../constants/consts';
import dynamic from 'next/dynamic';

const ForecastMap = dynamic(() => import('../../../../components/ForecastMap'), {
  ssr: false,
  loading: () => <div className="h-[500px] rounded-lg border border-gray-200 bg-gray-50 animate-pulse flex items-center justify-center text-sm text-gray-400">Loading map...</div>,
});
import { ForecastTrendChart } from '../../../../components/ForecastTrendChart';

export default function OverviewPage() {
  const { forecastData, forecastParams, historicalData, forecastId, loading, spatialData, apiResponse } = useForecast();

  if (loading || forecastData.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-12 w-48 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <ChartSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Forecast Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Review forecast results and build a manpower allocation plan</p>
        </div>
        <Link
          href={`/precincts?forecastId=${forecastId}`}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-ubuntu-500 to-ubuntu-700 text-white px-6 py-3 rounded-lg hover:from-ubuntu-700 hover:to-aubergine-700 transition font-medium shadow-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Build Manpower Plan
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <TabGroup>
          <TabList className="flex border-b border-gray-200 bg-gray-50">
            {[
              { key: 'temporal', label: 'Temporal', icon: '📈' },
              { key: 'spatial', label: 'Spatial (Forecast Map)', icon: '🗺️' },
              { key: 'shift', label: 'Shift Distribution', icon: '🌙' },
            ].map(tab => (
              <Tab
                key={tab.key}
                className={({ selected }) =>
                  selected
                    ? 'flex-1 py-3 px-4 text-sm font-medium text-ubuntu-700 bg-white border-b-2 border-ubuntu-500 focus:outline-none'
                    : 'flex-1 py-3 px-4 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 focus:outline-none'
                }
              >
                <span className="flex items-center justify-center gap-2">
                  <span>{tab.icon}</span>
                  {tab.label}
                </span>
              </Tab>
            ))}
          </TabList>

          <TabPanels>
            {/* Temporal Tab */}
            <TabPanel className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-2">Crime Trends Over Time</h3>
                <p className="text-sm text-gray-600">Year-over-year comparison within the forecast window. Toggle between consolidated (total) and individual crime types. Switch to yearly view when the forecast window spans 12+ months.</p>
              </div>

              {apiResponse?.explanation && (
                <div className="bg-ubuntu-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                  <p className="font-medium mb-1">{apiResponse.explanation.modelDescription}</p>
                  <p>{apiResponse.explanation.dataQualityNotes}</p>
                </div>
              )}

              <ForecastTrendChart
                historicalData={historicalData}
                forecastData={forecastData}
              />

              {apiResponse?.summary?.keyInsight && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                  <strong>Key Insight:</strong> {apiResponse.summary.keyInsight}
                </div>
              )}

              {apiResponse?.summary?.recommendedActions?.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <h4 className="font-medium text-green-800 text-sm mb-2">Recommended Actions</h4>
                  <ul className="text-sm text-green-700 space-y-1">
                    {apiResponse!.summary.recommendedActions.map((a: string, i: number) => (
                      <li key={i}>• {a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </TabPanel>

            {/* Spatial Tab */}
            <TabPanel className="p-6 space-y-6">
              {apiResponse?.explanation && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <p>{apiResponse.explanation.riskAssessmentLogic}</p>
                </div>
              )}

              <ForecastMap
                center={[14.4081, 121.0415]}
                zoom={13}
                spatialData={spatialData}
                dateRange={`${forecastData?.[0]?.year ? forecastData[0].year + '/' + String(forecastData[0].month).padStart(2, '0') : ''} — ${forecastData?.[forecastData.length - 1]?.year ? forecastData[forecastData.length - 1].year + '/' + String(forecastData[forecastData.length - 1].month).padStart(2, '0') : forecastParams?.forecastPeriod + ' months'}`}
              />

              {apiResponse?.explanation?.howToInterpret && (
                <div className="bg-ubuntu-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  <strong>How to interpret:</strong> {apiResponse.explanation.howToInterpret}
                </div>
              )}
            </TabPanel>

            {/* Shift Distribution Tab */}
            <TabPanel className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-2">Where &amp; When to Deploy</h3>
                <p className="text-sm text-gray-600">Forecasted crime demand by precinct and shift (Morning/Afternoon/Evening). Use this to decide how to distribute officers across your patrol sectors.</p>
              </div>

              <div className="flex items-center justify-between bg-ubuntu-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">Ready to allocate officers based on this distribution?</p>
                <Link
                  href={`/precincts?forecastId=${forecastId}`}
                  className="inline-flex items-center gap-2 bg-ubuntu-600 text-white px-4 py-2 rounded-lg hover:bg-ubuntu-700 transition text-sm font-medium whitespace-nowrap"
                >
                  Build Manpower Plan →
                </Link>
              </div>

              {apiResponse?.explanation?.trendAnalysis && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                  {apiResponse.explanation.trendAnalysis}
                </div>
              )}

              {(() => {
                const shifts = ['Morning', 'Afternoon', 'Evening'] as const;
                const apiForecasts = apiResponse?.forecasts;
                const hasApiShiftData = Array.isArray(apiForecasts) && apiForecasts.some((f: any) => f.timeOfDay);
                const hasForecastShiftData = forecastData.some(f => f.shift != null);

                type ShiftRow = { shift: string; totalPredicted: number; avgMonthly: number; trend: string };
                type PrecinctRow = { precinct: number; rows: ShiftRow[]; totalAvg: number; dominant: string };

                let precinctRows: PrecinctRow[];

                if (hasApiShiftData) {
                  const items = (apiForecasts as any[])
                    .filter((f: any) => f.timeOfDay)
                    .map((f: any) => {
                      const dt = new Date(f.timestamp);
                      return {
                        precinct: f.precinct,
                        shift: f.timeOfDay as string,
                        predictedCount: Math.max(0, f.forecast ?? 0),
                        trend: (f.trend || 'stable') as string,
                        year: dt.getFullYear(),
                        month: dt.getMonth() + 1,
                      };
                    });

                  const months = new Set(items.map(d => `${d.year}-${d.month}`));
                  const monthCount = months.size || 1;

                  const precinctMap = new Map<number, Map<string, { totalPredicted: number; trends: string[] }>>();
                  for (const item of items) {
                    if (!precinctMap.has(item.precinct)) precinctMap.set(item.precinct, new Map());
                    const shiftMap = precinctMap.get(item.precinct)!;
                    if (!shiftMap.has(item.shift)) shiftMap.set(item.shift, { totalPredicted: 0, trends: [] });
                    const agg = shiftMap.get(item.shift)!;
                    agg.totalPredicted += item.predictedCount;
                    agg.trends.push(item.trend);
                  }

                  precinctRows = [...precinctMap.entries()]
                    .map(([precinct, shiftMap]) => {
                      const rows: ShiftRow[] = [];
                      for (const s of shifts) {
                        const agg = shiftMap.get(s);
                        if (!agg) continue;
                        const avgMonthly = agg.totalPredicted / monthCount;
                        const inc = agg.trends.filter(t => t === 'increasing').length;
                        const dec = agg.trends.filter(t => t === 'decreasing').length;
                        const trend = inc > dec ? 'increasing' : dec > inc ? 'decreasing' : 'stable';
                        rows.push({ shift: s, totalPredicted: agg.totalPredicted, avgMonthly, trend });
                      }
                      const totalAvg = rows.reduce((sum, r) => sum + r.avgMonthly, 0);
                      const top = rows.reduce((a, b) => (b.avgMonthly > a.avgMonthly ? b : a), rows[0] || { shift: '', avgMonthly: 0 } as ShiftRow);
                      const topShare = totalAvg > 0 ? (top.avgMonthly / totalAvg) * 100 : 0;
                      const dominant = rows.length === 0 ? '—' : topShare >= 45 ? `${top.shift}-dominant` : 'Balanced';
                      return { precinct, rows, totalAvg, dominant };
                    })
                    .filter(pr => pr.rows.length > 0)
                    .sort((a, b) => b.totalAvg - a.totalAvg);
                } else {
                  const months = new Set(forecastData.map(f => `${f.year}-${f.month}`));
                  const monthCount = months.size || 1;

                  precinctRows = [...new Set(forecastData.map(f => f.precinct))]
                    .map(p => {
                      const precinctItems = forecastData.filter(f => f.precinct === p);
                      const rows: ShiftRow[] = [];
                      for (const s of shifts) {
                        let shiftItems: typeof precinctItems;
                        if (hasForecastShiftData) {
                          shiftItems = precinctItems.filter(f => f.shift === s);
                        } else {
                          const share = s === 'Morning' ? 0.3 : s === 'Afternoon' ? 0.4 : 0.3;
                          shiftItems = precinctItems.map(f => ({ ...f, predictedCount: f.predictedCount * share }));
                        }
                        if (shiftItems.length === 0) continue;
                        const totalPredicted = shiftItems.reduce((sum, f) => sum + f.predictedCount, 0);
                        const avgMonthly = totalPredicted / monthCount;
                        const inc = shiftItems.filter(f => f.trend === 'increasing').length;
                        const dec = shiftItems.filter(f => f.trend === 'decreasing').length;
                        const trend = inc > dec ? 'increasing' : dec > inc ? 'decreasing' : 'stable';
                        rows.push({ shift: s, totalPredicted, avgMonthly, trend });
                      }
                      const totalAvg = rows.reduce((sum, r) => sum + r.avgMonthly, 0);
                      const top = rows.reduce((a, b) => (b.avgMonthly > a.avgMonthly ? b : a), rows[0] || { shift: '', avgMonthly: 0 } as ShiftRow);
                      const topShare = totalAvg > 0 ? (top.avgMonthly / totalAvg) * 100 : 0;
                      const dominant = rows.length === 0 ? '—' : topShare >= 45 ? `${top.shift}-dominant` : 'Balanced';
                      return { precinct: p, rows, totalAvg, dominant };
                    })
                    .filter(pr => pr.rows.length > 0)
                    .sort((a, b) => b.totalAvg - a.totalAvg);
                }

                const shiftColors: Record<string, string> = {
                  Morning: 'bg-amber-400',
                  Afternoon: 'bg-ubuntu-500',
                  Evening: 'bg-indigo-500',
                };

                return (
                  <div className="space-y-4">
                    {precinctRows.map(pr => {
                      const precinctName = GetPrecinctsDictionary[pr.precinct] || `Precinct ${pr.precinct}`;
                      return (
                        <div key={pr.precinct} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-800">{precinctName}</h4>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${pr.dominant === 'Balanced' ? 'bg-gray-100 text-gray-600' : 'bg-indigo-50 text-indigo-700'}`}>
                                {pr.dominant}
                              </span>
                            </div>
                            <span className="text-sm text-gray-500">Avg {Math.round(pr.totalAvg)} incidents/month</span>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            {pr.rows.map(r => {
                              const share = pr.totalAvg > 0 ? (r.avgMonthly / pr.totalAvg) * 100 : 0;
                              const trendColor = r.trend === 'increasing' ? 'text-red-600' : r.trend === 'decreasing' ? 'text-green-600' : 'text-gray-500';
                              const trendIcon = r.trend === 'increasing' ? '↑' : r.trend === 'decreasing' ? '↓' : '→';
                              return (
                                <div key={r.shift} className="space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium text-gray-700">{r.shift}</span>
                                    <span className="font-semibold text-gray-900">{share.toFixed(0)}%</span>
                                  </div>
                                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${shiftColors[r.shift] || 'bg-ubuntu-500'}`}
                                      style={{ width: `${Math.max(share, 2)}%` }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-500">{Math.round(r.avgMonthly)}/mo</span>
                                    <span className={trendColor}>{trendIcon} {r.trend}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {apiResponse?.explanation?.confidenceExplanation && (
                <div className="bg-ubuntu-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  {apiResponse.explanation.confidenceExplanation}
                </div>
              )}

              {apiResponse?.explanation?.limitationsAndCaveats && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <strong>Limitations:</strong> {apiResponse.explanation.limitationsAndCaveats}
                </div>
              )}
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </div>
    </div>
  );
}
