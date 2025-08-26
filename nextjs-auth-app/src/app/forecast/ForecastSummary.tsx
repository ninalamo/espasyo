'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../../constants/consts';

interface HistoricalData {
  year: number;
  month: number;
  precinct: number;
  crimeType: number;
  count: number;
  timeOfDay: string;
}

interface ForecastData {
  year: number;
  month: number;
  precinct: number;
  crimeType: number;
  predictedCount: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface ForecastParams {
  model: string;
  forecastPeriod: number;
  confidence: number;
}

interface Props {
  historicalData: HistoricalData[];
  forecastData: ForecastData[];
  params: ForecastParams;
}

const ForecastSummary: React.FC<Props> = ({ historicalData, forecastData, params }) => {
  const summary = useMemo(() => {
    if (forecastData.length === 0) return null;

    // Overall statistics
    const totalPredicted = forecastData.reduce((sum, f) => sum + f.predictedCount, 0);
    const avgConfidence = forecastData.reduce((sum, f) => sum + f.confidence, 0) / forecastData.length;
    
    // Historical baseline
    const historicalTotal = historicalData.reduce((sum, h) => sum + h.count, 0);
    const historicalAvgMonthly = historicalTotal / Math.max(1, 
      historicalData.length / Object.keys(
        historicalData.reduce((acc, h) => ({ ...acc, [`${h.year}-${h.month}`]: true }), {})
      ).length
    );

    // Trends
    const trends = {
      increasing: forecastData.filter(f => f.trend === 'increasing').length,
      decreasing: forecastData.filter(f => f.trend === 'decreasing').length,
      stable: forecastData.filter(f => f.trend === 'stable').length
    };

    // Risk levels
    const riskLevels = {
      low: forecastData.filter(f => f.riskLevel === 'low').length,
      medium: forecastData.filter(f => f.riskLevel === 'medium').length,
      high: forecastData.filter(f => f.riskLevel === 'high').length,
      critical: forecastData.filter(f => f.riskLevel === 'critical').length
    };

    // Top risk areas
    const precinctRisk = forecastData.reduce((acc, f) => {
      const key = f.precinct;
      if (!acc[key]) acc[key] = { total: 0, high: 0, critical: 0 };
      acc[key].total += f.predictedCount;
      if (f.riskLevel === 'high') acc[key].high++;
      if (f.riskLevel === 'critical') acc[key].critical++;
      return acc;
    }, {} as Record<number, { total: number; high: number; critical: number }>);

    const topRiskPrecincts = Object.entries(precinctRisk)
      .sort(([,a], [,b]) => (b.critical + b.high) - (a.critical + a.high))
      .slice(0, 5)
      .map(([precinct, data]) => ({
        precinct: parseInt(precinct),
        name: GetPrecinctsDictionary[parseInt(precinct)] || `Precinct ${precinct}`,
        ...data
      }));

    // Crime type predictions
    const crimeTypeStats = forecastData.reduce((acc, f) => {
      const key = f.crimeType;
      if (!acc[key]) acc[key] = { total: 0, instances: 0 };
      acc[key].total += f.predictedCount;
      acc[key].instances++;
      return acc;
    }, {} as Record<number, { total: number; instances: number }>);

    const topCrimeTypes = Object.entries(crimeTypeStats)
      .sort(([,a], [,b]) => b.total - a.total)
      .slice(0, 5)
      .map(([crimeType, data]) => ({
        crimeType: parseInt(crimeType),
        name: CrimeTypesDictionary[parseInt(crimeType)] || `Crime Type ${crimeType}`,
        predicted: data.total,
        avgPerMonth: Math.round(data.total / params.forecastPeriod)
      }));

    // Monthly forecast distribution
    const monthlyForecast = forecastData.reduce((acc, f) => {
      const key = `${f.year}-${String(f.month).padStart(2, '0')}`;
      if (!acc[key]) acc[key] = 0;
      acc[key] += f.predictedCount;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalPredicted,
      avgConfidence,
      historicalAvgMonthly,
      trends,
      riskLevels,
      topRiskPrecincts,
      topCrimeTypes,
      monthlyForecast,
      changeFromHistorical: ((totalPredicted / params.forecastPeriod) - historicalAvgMonthly) / historicalAvgMonthly * 100
    };
  }, [forecastData, historicalData, params]);

  if (!summary) {
    return (
      <div className="text-center text-gray-500 py-8">
        No forecast data available for summary.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-600 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-blue-800">Total Predicted Cases</p>
              <p className="text-2xl font-bold text-blue-900">{summary.totalPredicted.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-600 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-green-800">Avg Confidence</p>
              <p className="text-2xl font-bold text-green-900">{(summary.avgConfidence * 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className={`bg-gradient-to-r p-4 rounded-lg border ${
          summary.changeFromHistorical > 10 
            ? 'from-red-50 to-pink-50 border-red-200' 
            : summary.changeFromHistorical < -10 
              ? 'from-green-50 to-emerald-50 border-green-200'
              : 'from-yellow-50 to-amber-50 border-yellow-200'
        }`}>
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${
              summary.changeFromHistorical > 10 
                ? 'bg-red-600' 
                : summary.changeFromHistorical < -10 
                  ? 'bg-green-600'
                  : 'bg-yellow-600'
            }`}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="ml-4">
              <p className={`text-sm font-medium ${
                summary.changeFromHistorical > 10 
                  ? 'text-red-800' 
                  : summary.changeFromHistorical < -10 
                    ? 'text-green-800'
                    : 'text-yellow-800'
              }`}>Change from Historical</p>
              <p className={`text-2xl font-bold ${
                summary.changeFromHistorical > 10 
                  ? 'text-red-900' 
                  : summary.changeFromHistorical < -10 
                    ? 'text-green-900'
                    : 'text-yellow-900'
              }`}>
                {summary.changeFromHistorical > 0 ? '+' : ''}{summary.changeFromHistorical.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-600 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-purple-800">Forecast Period</p>
              <p className="text-2xl font-bold text-purple-900">{params.forecastPeriod} months</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Distribution */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            Trend Analysis
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Increasing Trends</span>
              <div className="flex items-center">
                <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                  <div 
                    className="bg-red-500 h-2 rounded-full" 
                    style={{ width: `${(summary.trends.increasing / forecastData.length) * 100}%` }}
                  ></div>
                </div>
                <span className="font-semibold text-red-600">{summary.trends.increasing}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Stable Trends</span>
              <div className="flex items-center">
                <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                  <div 
                    className="bg-yellow-500 h-2 rounded-full" 
                    style={{ width: `${(summary.trends.stable / forecastData.length) * 100}%` }}
                  ></div>
                </div>
                <span className="font-semibold text-yellow-600">{summary.trends.stable}</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Decreasing Trends</span>
              <div className="flex items-center">
                <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${(summary.trends.decreasing / forecastData.length) * 100}%` }}
                  ></div>
                </div>
                <span className="font-semibold text-green-600">{summary.trends.decreasing}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Level Distribution */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.865-.833-2.635 0L4.178 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Risk Assessment
          </h3>
          <div className="space-y-3">
            {[
              { key: 'critical', label: 'Critical Risk', color: 'bg-red-500', count: summary.riskLevels.critical },
              { key: 'high', label: 'High Risk', color: 'bg-orange-500', count: summary.riskLevels.high },
              { key: 'medium', label: 'Medium Risk', color: 'bg-yellow-500', count: summary.riskLevels.medium },
              { key: 'low', label: 'Low Risk', color: 'bg-green-500', count: summary.riskLevels.low }
            ].map(risk => (
              <div key={risk.key} className="flex justify-between items-center">
                <span className="text-gray-600">{risk.label}</span>
                <div className="flex items-center">
                  <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                    <div 
                      className={`${risk.color} h-2 rounded-full`} 
                      style={{ width: `${(risk.count / forecastData.length) * 100}%` }}
                    ></div>
                  </div>
                  <span className="font-semibold">{risk.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Risk Areas and Crime Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Top Risk Areas
          </h3>
          <div className="space-y-3">
            {summary.topRiskPrecincts.map((precinct, index) => (
              <div key={precinct.precinct} className="flex justify-between items-center">
                <div>
                  <span className="font-medium text-gray-900">{precinct.name}</span>
                  <span className="text-sm text-gray-600 ml-2">
                    ({precinct.total} predicted cases)
                  </span>
                </div>
                <div className="flex space-x-1">
                  {precinct.critical > 0 && (
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                      {precinct.critical} Critical
                    </span>
                  )}
                  {precinct.high > 0 && (
                    <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded">
                      {precinct.high} High
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Predicted Crime Types
          </h3>
          <div className="space-y-3">
            {summary.topCrimeTypes.map((crime, index) => (
              <div key={crime.crimeType} className="flex justify-between items-center">
                <div>
                  <span className="font-medium text-gray-900">{crime.name}</span>
                  <span className="text-sm text-gray-600 ml-2">
                    (avg {crime.avgPerMonth}/month)
                  </span>
                </div>
                <span className="font-semibold text-purple-600">
                  {crime.predicted} cases
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Model Information */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">
              Forecast generated using {params.model.toUpperCase()} model with {(params.confidence * 100).toFixed(0)}% confidence level
            </span>
          </div>
          <span className="text-xs text-gray-500">
            Generated on {format(new Date(), 'PPp')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ForecastSummary;
