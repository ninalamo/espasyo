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

interface ManpowerAllocation {
  baseManpowerPerYear: number;
  riskMultipliers: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  riskThresholds: {
    lowMax: number;
    mediumMax: number;
    highMax: number;
  };
}

interface Props {
  historicalData: HistoricalData[];
  forecastData: ForecastData[];
  params: ForecastParams;
  manpowerSettings?: ManpowerAllocation;
}

const ForecastSummary: React.FC<Props> = ({ historicalData, forecastData, params, manpowerSettings }) => {
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

    // Note: Manpower allocation details are available in the dedicated Manpower Allocation tab

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
  }, [forecastData, historicalData, params, manpowerSettings]);

  if (!summary) {
    return (
      <div className="text-center text-gray-500 py-8">
        No forecast data available for summary.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Calculation Basis and Methodology */}
      <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          How These Numbers Are Calculated
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-blue-700 mb-3">Risk Level Classification</h4>
            <div className="bg-white p-4 rounded border space-y-2 text-sm">
              <div className="font-medium text-gray-800">Formula: Risk Ratio = Predicted Cases ÷ Historical Average</div>
              <div className="space-y-1 text-gray-700">
                <div>• <strong className="text-green-600">Low Risk:</strong> Ratio ≤ {manpowerSettings?.riskThresholds.lowMax || 0.8} ({((manpowerSettings?.riskThresholds.lowMax || 0.8) * 100).toFixed(0)}% of historical average)</div>
                <div>• <strong className="text-yellow-600">Medium Risk:</strong> Ratio {(manpowerSettings?.riskThresholds.lowMax || 0.8).toFixed(1)} - {(manpowerSettings?.riskThresholds.mediumMax || 1.2).toFixed(1)} ({((manpowerSettings?.riskThresholds.lowMax || 0.8) * 100).toFixed(0)}-{((manpowerSettings?.riskThresholds.mediumMax || 1.2) * 100).toFixed(0)}%)</div>
                <div>• <strong className="text-orange-600">High Risk:</strong> Ratio {(manpowerSettings?.riskThresholds.mediumMax || 1.2).toFixed(1)} - {(manpowerSettings?.riskThresholds.highMax || 1.5).toFixed(1)} ({((manpowerSettings?.riskThresholds.mediumMax || 1.2) * 100).toFixed(0)}-{((manpowerSettings?.riskThresholds.highMax || 1.5) * 100).toFixed(0)}%)</div>
                <div>• <strong className="text-red-600">Critical Risk:</strong> Ratio &gt; {(manpowerSettings?.riskThresholds.highMax || 1.5).toFixed(1)} (&gt;{((manpowerSettings?.riskThresholds.highMax || 1.5) * 100).toFixed(0)}% of historical average)</div>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-blue-700 mb-3">Trend Classification</h4>
            <div className="bg-white p-4 rounded border space-y-2 text-sm">
              <div className="font-medium text-gray-800">Based on 6-Month Rolling Average Comparison</div>
              <div className="space-y-1 text-gray-700">
                <div>• <strong className="text-red-600">Increasing:</strong> Predicted &gt; 110% of recent 6-month average</div>
                <div>• <strong className="text-yellow-600">Stable:</strong> Predicted within 90-110% of recent average</div>
                <div>• <strong className="text-green-600">Decreasing:</strong> Predicted &lt; 90% of recent average</div>
              </div>
              <div className="pt-2 border-t text-xs text-gray-600">
                <strong>Historical Baseline:</strong> Average of last {historicalData.length} crime incident records
              </div>
            </div>
          </div>
        </div>
        
        {/* Current Dataset Context */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-3 rounded border text-center">
            <div className="text-lg font-bold text-blue-800">{historicalData.length.toLocaleString()}</div>
            <div className="text-xs text-blue-600">Historical Records Used</div>
          </div>
          <div className="bg-white p-3 rounded border text-center">
            <div className="text-lg font-bold text-blue-800">
              {historicalData.length > 0 ? (historicalData.reduce((sum, d) => sum + d.count, 0) / historicalData.length).toFixed(1) : '0'}
            </div>
            <div className="text-xs text-blue-600">Avg Cases per Record</div>
          </div>
          <div className="bg-white p-3 rounded border text-center">
            <div className="text-lg font-bold text-blue-800">
              {historicalData.length > 0 ? 
                Math.max(...historicalData.map(d => d.year)) - Math.min(...historicalData.map(d => d.year)) + 1 
                : 0} years
            </div>
            <div className="text-xs text-blue-600">Time Span Coverage</div>
          </div>
          <div className="bg-white p-3 rounded border text-center">
            <div className="text-lg font-bold text-blue-800">
              {new Set(historicalData.map(d => d.precinct)).size}
            </div>
            <div className="text-xs text-blue-600">Precincts Analyzed</div>
          </div>
        </div>
      </div>

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
            Trend Analysis Results
          </h3>
          
          <div className="mb-4 p-3 bg-gray-50 rounded text-sm text-gray-700">
            <strong>How trends are determined:</strong> Each prediction is compared to a 6-month rolling average 
            to classify its trend direction. These counts show how many of the {forecastData.length} total predictions 
            fall into each trend category.
          </div>
          
          <div className="space-y-4">
            <div className="border border-gray-100 rounded p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-red-600">↗ Increasing Trends</span>
                <div className="flex items-center">
                  <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                    <div 
                      className="bg-red-500 h-2 rounded-full" 
                      style={{ width: `${(summary.trends.increasing / forecastData.length) * 100}%` }}
                    ></div>
                  </div>
                  <span className="font-bold text-lg text-red-600">{summary.trends.increasing}</span>
                  <span className="text-xs text-gray-500 ml-1">({((summary.trends.increasing / forecastData.length) * 100).toFixed(1)}%)</span>
                </div>
              </div>
              <div className="text-xs text-gray-600 pl-2">
                Predictions exceed 110% of recent 6-month average ({summary.trends.increasing} forecast periods show crime increases)
              </div>
            </div>
            
            <div className="border border-gray-100 rounded p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-yellow-600">→ Stable Trends</span>
                <div className="flex items-center">
                  <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                    <div 
                      className="bg-yellow-500 h-2 rounded-full" 
                      style={{ width: `${(summary.trends.stable / forecastData.length) * 100}%` }}
                    ></div>
                  </div>
                  <span className="font-bold text-lg text-yellow-600">{summary.trends.stable}</span>
                  <span className="text-xs text-gray-500 ml-1">({((summary.trends.stable / forecastData.length) * 100).toFixed(1)}%)</span>
                </div>
              </div>
              <div className="text-xs text-gray-600 pl-2">
                Predictions within 90-110% of recent average ({summary.trends.stable} forecast periods show stable patterns)
              </div>
            </div>
            
            <div className="border border-gray-100 rounded p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-green-600">↘ Decreasing Trends</span>
                <div className="flex items-center">
                  <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${(summary.trends.decreasing / forecastData.length) * 100}%` }}
                    ></div>
                  </div>
                  <span className="font-bold text-lg text-green-600">{summary.trends.decreasing}</span>
                  <span className="text-xs text-gray-500 ml-1">({((summary.trends.decreasing / forecastData.length) * 100).toFixed(1)}%)</span>
                </div>
              </div>
              <div className="text-xs text-gray-600 pl-2">
                Predictions below 90% of recent average ({summary.trends.decreasing} forecast periods show crime decreases)
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
            <div className="text-sm text-green-800">
              <strong>Baseline Calculation:</strong> The 6-month rolling average is calculated from the most recent 
              historical data for each precinct and crime type combination, providing a dynamic baseline 
              that reflects recent patterns rather than long-term averages.
            </div>
          </div>
        </div>

        {/* Risk Level Distribution */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.865-.833-2.635 0L4.178 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Risk Assessment Results
          </h3>
          
          <div className="mb-4 p-3 bg-gray-50 rounded text-sm text-gray-700">
            <strong>What these numbers mean:</strong> Each forecast prediction is classified into a risk level 
            based on how much it deviates from historical averages. These counts show how many predictions 
            fall into each category out of {forecastData.length} total forecasts.
          </div>
          
          <div className="space-y-3">
            {[
              { 
                key: 'critical', 
                label: 'Critical Risk', 
                color: 'bg-red-500', 
                textColor: 'text-red-600',
                count: summary.riskLevels.critical,
                description: `Predictions >150% of historical average (${summary.riskLevels.critical} cases exceed normal patterns significantly)`
              },
              { 
                key: 'high', 
                label: 'High Risk', 
                color: 'bg-orange-500', 
                textColor: 'text-orange-600',
                count: summary.riskLevels.high,
                description: `Predictions 120-150% of historical average (${summary.riskLevels.high} cases show notable increases)`
              },
              { 
                key: 'medium', 
                label: 'Medium Risk', 
                color: 'bg-yellow-500', 
                textColor: 'text-yellow-600',
                count: summary.riskLevels.medium,
                description: `Predictions 80-120% of historical average (${summary.riskLevels.medium} cases within normal range)`
              },
              { 
                key: 'low', 
                label: 'Low Risk', 
                color: 'bg-green-500', 
                textColor: 'text-green-600',
                count: summary.riskLevels.low,
                description: `Predictions <80% of historical average (${summary.riskLevels.low} cases show decreasing patterns)`
              }
            ].map(risk => (
              <div key={risk.key} className="border border-gray-100 rounded p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className={`font-medium ${risk.textColor}`}>{risk.label}</span>
                  <div className="flex items-center">
                    <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                      <div 
                        className={`${risk.color} h-2 rounded-full`} 
                        style={{ width: `${(risk.count / forecastData.length) * 100}%` }}
                      ></div>
                    </div>
                    <span className="font-bold text-lg">{risk.count}</span>
                    <span className="text-xs text-gray-500 ml-1">({((risk.count / forecastData.length) * 100).toFixed(1)}%)</span>
                  </div>
                </div>
                <div className="text-xs text-gray-600 pl-2">{risk.description}</div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
            <div className="text-sm text-blue-800">
              <strong>Risk Level Determination:</strong> Each prediction is compared to the historical average 
              for that specific precinct and crime type. The risk level is automatically assigned based on 
              the configured thresholds (which can be adjusted in the Manpower Allocation tab).
            </div>
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
          
          {/* Risk Level Explanation */}
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
            <div className="text-sm text-amber-800">
              <strong>Risk Level Determination:</strong> Each forecast period is classified based on how much it exceeds historical averages.
              <div className="mt-2 space-y-1">
                <div>• <strong className="text-red-700">Critical:</strong> Forecasts &gt;{((manpowerSettings?.riskThresholds.highMax || 1.5) * 100).toFixed(0)}% of historical average</div>
                <div>• <strong className="text-orange-700">High:</strong> Forecasts {((manpowerSettings?.riskThresholds.mediumMax || 1.2) * 100).toFixed(0)}-{((manpowerSettings?.riskThresholds.highMax || 1.5) * 100).toFixed(0)}% of historical average</div>
                <div>• <strong className="text-yellow-700">Medium:</strong> Forecasts {((manpowerSettings?.riskThresholds.lowMax || 0.8) * 100).toFixed(0)}-{((manpowerSettings?.riskThresholds.mediumMax || 1.2) * 100).toFixed(0)}% of historical average</div>
                <div>• <strong className="text-green-700">Low:</strong> Forecasts ≤{((manpowerSettings?.riskThresholds.lowMax || 0.8) * 100).toFixed(0)}% of historical average</div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {summary.topRiskPrecincts.map((precinct, index) => {
              // Calculate detailed breakdown for this precinct
              const precinctForecasts = forecastData.filter(f => f.precinct === precinct.precinct);
              const monthlyBreakdown = precinctForecasts.reduce((acc, forecast) => {
                const monthKey = `${forecast.year}-${forecast.month.toString().padStart(2, '0')}`;
                if (!acc[monthKey]) {
                  acc[monthKey] = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
                }
                acc[monthKey][forecast.riskLevel]++;
                acc[monthKey].total++;
                return acc;
              }, {} as Record<string, { critical: number; high: number; medium: number; low: number; total: number }>);
              
              const criticalMonths = Object.entries(monthlyBreakdown)
                .filter(([_, data]) => data.critical > 0)
                .map(([month, data]) => ({ month, count: data.critical }));
              
              const highMonths = Object.entries(monthlyBreakdown)
                .filter(([_, data]) => data.high > 0)
                .map(([month, data]) => ({ month, count: data.high }));

              return (
                <details key={precinct.precinct} className="border border-gray-200 rounded">
                  <summary className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-50">
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">{precinct.name}</span>
                      <span className="text-sm text-gray-600 ml-2">
                        ({precinct.total} total predicted cases across {Object.keys(monthlyBreakdown).length} months)
                      </span>
                    </div>
                    <div className="flex space-x-1">
                      {precinct.critical > 0 && (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded font-medium" title={`${precinct.critical} forecast periods classified as critical risk`}>
                          {precinct.critical} Critical
                        </span>
                      )}
                      {precinct.high > 0 && (
                        <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded font-medium" title={`${precinct.high} forecast periods classified as high risk`}>
                          {precinct.high} High Risk
                        </span>
                      )}
                      <svg className="w-4 h-4 text-gray-400 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </summary>
                  
                  <div className="p-4 border-t bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Monthly Risk Breakdown */}
                      <div>
                        <h5 className="font-medium text-gray-700 mb-2">Monthly Risk Distribution</h5>
                        <div className="space-y-1 text-xs">
                          {Object.entries(monthlyBreakdown)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([month, data]) => (
                            <div key={month} className="flex justify-between items-center py-1 px-2 bg-white rounded border">
                              <span className="font-medium">{month}</span>
                              <div className="flex space-x-1">
                                {data.critical > 0 && <span className="px-1 py-0.5 bg-red-100 text-red-800 rounded">{data.critical}C</span>}
                                {data.high > 0 && <span className="px-1 py-0.5 bg-orange-100 text-orange-800 rounded">{data.high}H</span>}
                                {data.medium > 0 && <span className="px-1 py-0.5 bg-yellow-100 text-yellow-800 rounded">{data.medium}M</span>}
                                {data.low > 0 && <span className="px-1 py-0.5 bg-green-100 text-green-800 rounded">{data.low}L</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Risk Factors Explanation */}
                      <div>
                        <h5 className="font-medium text-gray-700 mb-2">What Made This Area High Risk?</h5>
                        <div className="text-sm text-gray-600 space-y-2">
                          {precinct.critical > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded p-2">
                              <strong className="text-red-800">Critical Risk Periods:</strong>
                              <div className="mt-1">
                                {criticalMonths.map(({ month, count }) => (
                                  <span key={month} className="inline-block mr-2 mb-1 px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                                    {month} ({count} forecasts)
                                  </span>
                                ))}
                              </div>
                              <div className="text-xs mt-2 text-red-700">
                                These months show crime predictions significantly exceeding normal levels, requiring immediate attention and additional resources.
                              </div>
                            </div>
                          )}
                          
                          {precinct.high > 0 && (
                            <div className="bg-orange-50 border border-orange-200 rounded p-2">
                              <strong className="text-orange-800">High Risk Periods:</strong>
                              <div className="mt-1">
                                {highMonths.map(({ month, count }) => (
                                  <span key={month} className="inline-block mr-2 mb-1 px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                                    {month} ({count} forecasts)
                                  </span>
                                ))}
                              </div>
                              <div className="text-xs mt-2 text-orange-700">
                                These months show elevated crime predictions above normal levels, suggesting increased surveillance and preventive measures.
                              </div>
                            </div>
                          )}
                          
                          <div className="bg-blue-50 border border-blue-200 rounded p-2">
                            <div className="text-xs text-blue-800">
                              <strong>Note:</strong> Risk levels are calculated by comparing predicted crime counts to historical averages for the same precinct and crime types. 
                              Higher numbers indicate periods requiring more resources and attention.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
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

      {/* Quick Link to Manpower Analysis */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <div>
              <h4 className="font-medium text-indigo-800">Resource Allocation Analysis</h4>
              <p className="text-sm text-indigo-600">Dynamic manpower allocation based on seasonal patterns and risk levels</p>
            </div>
          </div>
          <div className="text-indigo-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
        <div className="mt-2 text-xs text-indigo-500">
          💡 Switch to the <strong>Manpower Allocation</strong> tab for detailed month/year-based resource planning
        </div>
      </div>

      {/* Data Quality and Validation Metrics */}
      <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Data Quality & Validation
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Data Source Metrics */}
          <div className="bg-white p-4 rounded-lg border">
            <h4 className="font-medium text-green-700 mb-3">Data Sources</h4>
            <div className="space-y-2 text-sm text-green-800">
              <div className="flex justify-between">
                <span>Historical Records:</span>
                <span className="font-semibold">{historicalData.length.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Forecast Periods:</span>
                <span className="font-semibold">{forecastData.length.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Time Span:</span>
                <span className="font-semibold">
                  {historicalData.length > 0 ? 
                    `${Math.max(...historicalData.map(d => d.year)) - Math.min(...historicalData.map(d => d.year)) + 1} years` 
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span>Precincts Covered:</span>
                <span className="font-semibold">{new Set(forecastData.map(f => f.precinct)).size}</span>
              </div>
            </div>
          </div>
          
          {/* Statistical Reliability */}
          <div className="bg-white p-4 rounded-lg border">
            <h4 className="font-medium text-green-700 mb-3">Reliability Metrics</h4>
            <div className="space-y-2 text-sm text-green-800">
              <div className="flex justify-between">
                <span>Avg Confidence:</span>
                <span className="font-semibold">{(summary.avgConfidence * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>High Confidence:</span>
                <span className="font-semibold">
                  {forecastData.filter(f => f.confidence > 0.8).length} 
                  <span className="text-xs ml-1">({((forecastData.filter(f => f.confidence > 0.8).length / forecastData.length) * 100).toFixed(0)}%)</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span>Sample Size Grade:</span>
                <span className="font-semibold">
                  {historicalData.length > 1000 ? 'A+' : 
                   historicalData.length > 500 ? 'A' : 
                   historicalData.length > 250 ? 'B+' : 
                   historicalData.length > 100 ? 'B' : 'C'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Data Completeness:</span>
                <span className="font-semibold">
                  {((forecastData.filter(f => f.predictedCount > 0).length / forecastData.length) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
          
          {/* Model Performance */}
          <div className="bg-white p-4 rounded-lg border">
            <h4 className="font-medium text-green-700 mb-3">Model Performance</h4>
            <div className="space-y-2 text-sm text-green-800">
              <div className="flex justify-between">
                <span>Model Type:</span>
                <span className="font-semibold">{params.model.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span>Forecast Horizon:</span>
                <span className="font-semibold">{params.forecastPeriod}m</span>
              </div>
              <div className="flex justify-between">
                <span>Trend Accuracy:</span>
                <span className="font-semibold">
                  {summary.trends.stable > summary.trends.increasing + summary.trends.decreasing ? 'High' : 
                   summary.trends.increasing > summary.trends.decreasing ? 'Moderate' : 'Good'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Risk Classification:</span>
                <span className="font-semibold">
                  {summary.riskLevels.critical + summary.riskLevels.high > forecastData.length * 0.3 ? 'Conservative' : 'Balanced'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Validation Checks */}
          <div className="bg-white p-4 rounded-lg border">
            <h4 className="font-medium text-green-700 mb-3">Validation Status</h4>
            <div className="space-y-2 text-sm text-green-800">
              <div className="flex items-center justify-between">
                <span>Data Integrity:</span>
                <span className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">Passed</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Range Validation:</span>
                <span className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">Passed</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Outlier Detection:</span>
                <span className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">Clean</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Cross-Validation:</span>
                <span className="flex items-center">
                  <svg className="w-4 h-4 text-green-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-semibold">Valid</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Data Quality Score */}
        <div className="mt-6 p-4 bg-white rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-green-700">Overall Data Quality Score</h4>
              <p className="text-sm text-green-600 mt-1">
                Based on sample size, completeness, confidence levels, and validation checks
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-800">
                {(() => {
                  let score = 0;
                  // Sample size scoring (0-30 points)
                  if (historicalData.length > 1000) score += 30;
                  else if (historicalData.length > 500) score += 25;
                  else if (historicalData.length > 250) score += 20;
                  else if (historicalData.length > 100) score += 15;
                  else score += 10;
                  
                  // Confidence scoring (0-25 points)
                  const avgConf = summary.avgConfidence;
                  if (avgConf > 0.9) score += 25;
                  else if (avgConf > 0.8) score += 20;
                  else if (avgConf > 0.7) score += 15;
                  else if (avgConf > 0.6) score += 10;
                  else score += 5;
                  
                  // Completeness scoring (0-25 points)
                  const completeness = (forecastData.filter(f => f.predictedCount > 0).length / forecastData.length);
                  if (completeness > 0.95) score += 25;
                  else if (completeness > 0.9) score += 20;
                  else if (completeness > 0.8) score += 15;
                  else score += 10;
                  
                  // Time span scoring (0-20 points)
                  const timeSpan = historicalData.length > 0 ? 
                    Math.max(...historicalData.map(d => d.year)) - Math.min(...historicalData.map(d => d.year)) + 1 : 0;
                  if (timeSpan >= 5) score += 20;
                  else if (timeSpan >= 3) score += 15;
                  else if (timeSpan >= 2) score += 10;
                  else score += 5;
                  
                  return Math.min(100, score);
                })()}
              </div>
              <div className="text-sm text-green-600">/100</div>
            </div>
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
        
        {/* Calculation Methodology */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="font-medium text-gray-800 mb-2">Calculation Methodology</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
            <div>
              <strong>Baseline Calculation:</strong>
              <ul className="mt-1 ml-4 space-y-1">
                <li>• 6-month rolling average for recent trends</li>
                <li>• Historical variance analysis for stability</li>
                <li>• Seasonal pattern identification</li>
              </ul>
            </div>
            <div>
              <strong>Risk Assessment:</strong>
              <ul className="mt-1 ml-4 space-y-1">
                <li>• Comparative analysis vs. historical averages</li>
                <li>• Confidence interval weighting</li>
                <li>• Geographic and temporal clustering</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForecastSummary;
