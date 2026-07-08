'use client';

import Link from 'next/link';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { useForecast } from '../../ForecastContext';
import { Skeleton, CardSkeleton, ChartSkeleton } from '../../../../components/ui/skeleton';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../../../../constants/consts';
import dynamic from 'next/dynamic';

const ForecastMap = dynamic(() => import('../../../../components/ForecastMap'), {
  ssr: false,
  loading: () => <div className="h-[500px] rounded-lg border border-gray-200 bg-gray-50 animate-pulse flex items-center justify-center text-sm text-gray-400">Loading map...</div>,
});
import { ForecastTrendChart } from '../../../../components/ForecastTrendChart';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function OverviewPage() {
  const { forecastData, forecastParams, historicalData, forecastId, loading, spatialData, seasonalPredictions, apiResponse } = useForecast();

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
          href={`/manpower?forecastId=${forecastId}`}
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
              { key: 'seasonal', label: 'Seasonal', icon: '🌙' },
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

            {/* Seasonal Tab */}
            <TabPanel className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-800 mb-2">Seasonal Pattern Predictions</h3>
                <p className="text-sm text-gray-600">Monthly decomposition showing peak/trough crime periods and seasonal strength per precinct and crime type.</p>
              </div>

              {apiResponse?.explanation?.trendAnalysis && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                  {apiResponse.explanation.trendAnalysis}
                </div>
              )}

              {apiResponse?.temporalPatterns && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {apiResponse.temporalPatterns.peakTimeOfDay && (
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-blue-700 capitalize">{apiResponse.temporalPatterns.peakTimeOfDay}</div>
                      <div className="text-xs text-blue-600">Peak Time of Day</div>
                    </div>
                  )}
                  {apiResponse.temporalPatterns.peakMonth && (
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-red-700">{monthNames[apiResponse.temporalPatterns.peakMonth - 1]}</div>
                      <div className="text-xs text-red-600">Peak Month</div>
                    </div>
                  )}
                  {apiResponse.temporalPatterns.troughMonth && (
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-green-700">{monthNames[apiResponse.temporalPatterns.troughMonth - 1]}</div>
                      <div className="text-xs text-green-600">Trough Month</div>
                    </div>
                  )}
                  {apiResponse.temporalPatterns.weekendEffect != null && (
                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-purple-700">{apiResponse.temporalPatterns.weekendEffect > 1 ? `${((apiResponse.temporalPatterns.weekendEffect - 1) * 100).toFixed(0)}% higher` : `${((1 - apiResponse.temporalPatterns.weekendEffect) * 100).toFixed(0)}% lower`}</div>
                      <div className="text-xs text-purple-600">Weekend Effect</div>
                    </div>
                  )}
                </div>
              )}

              {seasonalPredictions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Precinct</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Crime Type</th>
                        <th className="text-center px-3 py-2 font-medium text-gray-600">Peak Month</th>
                        <th className="text-center px-3 py-2 font-medium text-gray-600">Trough Month</th>
                        <th className="text-center px-3 py-2 font-medium text-gray-600">Seasonal Strength</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Monthly Pattern</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seasonalPredictions.map((sp: any, i: number) => (
                        <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2">{GetPrecinctsDictionary[sp.precinct] || sp.precinct}</td>
                          <td className="px-3 py-2">{CrimeTypesDictionary[sp.crimeType] || sp.crimeType}</td>
                          <td className="px-3 py-2 text-center font-medium text-red-600">{monthNames[sp.peakMonth - 1]}</td>
                          <td className="px-3 py-2 text-center font-medium text-green-600">{monthNames[sp.troughMonth - 1]}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="font-medium">{sp.strength?.seasonal != null ? (sp.strength.seasonal * 100).toFixed(0) + '%' : '-'}</span>
                          </td>
                          <td className="px-3 py-2">
                            {sp.seasonal && (
                              <div className="flex items-end gap-0.5 h-6" title={sp.seasonal.map((v: number, mi: number) => `${monthNames[mi]}: ${(v * 100).toFixed(0)}%`).join(', ')}>
                                {sp.seasonal.map((v: number, mi: number) => (
                                  <div
                                    key={mi}
                                    className="w-4 bg-indigo-400 rounded-t"
                                    style={{ height: `${Math.max(4, Math.min(32, Math.round(v * 20)))}px` }}
                                  />
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>No seasonal prediction data available for this forecast.</p>
                </div>
              )}

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
