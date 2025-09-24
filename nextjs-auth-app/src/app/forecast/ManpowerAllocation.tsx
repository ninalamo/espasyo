'use client';

import { useMemo } from 'react';
import { GetPrecinctsDictionary } from '../../constants/consts';
import type { 
  ManpowerAllocation as ManpowerAllocationType, 
  ManpowerRecommendation
} from '../../types/forecast/ExtendedForecastTypes';
import { DEFAULT_MANPOWER_ALLOCATION } from '../../types/forecast/ExtendedForecastTypes';

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

interface Props {
  historicalData: HistoricalData[];
  forecastData: ForecastData[];
  manpowerSettings: ManpowerAllocationType;
  onSettingsChange: (settings: ManpowerAllocationType) => void;
}

const ManpowerAllocation: React.FC<Props> = ({ 
  historicalData, 
  forecastData, 
  manpowerSettings, 
  onSettingsChange 
}) => {
  // Helper function to get season from month
  const getSeason = (month: number): keyof typeof manpowerSettings.seasonalMultipliers => {
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'fall';
    return 'winter';
  };

  // Helper function to get month name for monthly multipliers
  const getMonthName = (month: number): keyof typeof manpowerSettings.monthlyMultipliers => {
    const months: (keyof typeof manpowerSettings.monthlyMultipliers)[] = [
      'december', 'january', 'february', 'march', 'april', 'may',
      'june', 'july', 'august', 'september', 'october', 'november'
    ];
    return months[month] || 'january';
  };

  // Helper function to calculate dynamic multiplier based on month/year
  const calculateDynamicMultiplier = (month: number, year: number, baseMultiplier: number): number => {
    let totalMultiplier = baseMultiplier;

    // Apply seasonal adjustment if enabled
    if (manpowerSettings.enableSeasonalAdjustment) {
      const season = getSeason(month);
      totalMultiplier *= manpowerSettings.seasonalMultipliers[season];
    }

    // Apply monthly adjustment if enabled
    if (manpowerSettings.enableMonthlyAdjustment) {
      const monthName = getMonthName(month);
      totalMultiplier *= manpowerSettings.monthlyMultipliers[monthName];
    }

    // Apply yearly adjustment if enabled
    if (manpowerSettings.yearlyAdjustments.enableYearlyAdjustment) {
      const yearsDiff = year - manpowerSettings.yearlyAdjustments.baseYear;
      const yearlyFactor = Math.pow(manpowerSettings.yearlyAdjustments.yearOverYearGrowth, yearsDiff);
      totalMultiplier *= yearlyFactor;
    }

    return totalMultiplier;
  };

  const manpowerRecommendations = useMemo(() => {
    if (forecastData.length === 0) return [];

    // Calculate recommendations per precinct with month/year context
    const precinctData = new Map<number, {
      totalPredicted: number;
      totalHistorical: number;
      riskCounts: Record<string, number>;
      dominantRisk: 'low' | 'medium' | 'high' | 'critical';
      monthlyBreakdown: Record<string, { predicted: number; risk: string; year: number; month: number }>;
    }>();

    // Aggregate forecast data by precinct with monthly details
    forecastData.forEach(forecast => {
      const precinct = forecast.precinct;
      const monthKey = `${forecast.year}-${forecast.month.toString().padStart(2, '0')}`;
      
      if (!precinctData.has(precinct)) {
        precinctData.set(precinct, {
          totalPredicted: 0,
          totalHistorical: 0,
          riskCounts: { low: 0, medium: 0, high: 0, critical: 0 },
          dominantRisk: 'low',
          monthlyBreakdown: {}
        });
      }
      
      const data = precinctData.get(precinct)!;
      data.totalPredicted += forecast.predictedCount;
      data.riskCounts[forecast.riskLevel]++;
      data.monthlyBreakdown[monthKey] = {
        predicted: forecast.predictedCount,
        risk: forecast.riskLevel,
        year: forecast.year,
        month: forecast.month
      };
    });

    // Add historical data for context
    historicalData.forEach(historical => {
      const precinct = historical.precinct;
      if (precinctData.has(precinct)) {
        precinctData.get(precinct)!.totalHistorical += historical.count;
      }
    });

    // Determine dominant risk level and calculate dynamic recommendations
    const recommendations: ManpowerRecommendation[] = [];
    
    precinctData.forEach((data, precinct) => {
      // Find dominant risk level
      const riskEntries = Object.entries(data.riskCounts) as [keyof typeof data.riskCounts, number][];
      const dominantRisk = riskEntries.reduce((max, current) => 
        current[1] > max[1] ? current : max
      )[0] as 'low' | 'medium' | 'high' | 'critical';

      // Calculate dynamic recommended manpower based on monthly patterns
      const baseAllocation = manpowerSettings.baseManpowerPerYear;
      const riskMultiplier = manpowerSettings.riskMultipliers[dominantRisk];
      
      // Calculate weighted average allocation across all forecast months
      let totalWeightedAllocation = 0;
      let totalMonths = 0;
      
      Object.values(data.monthlyBreakdown).forEach(monthData => {
        const dynamicMultiplier = calculateDynamicMultiplier(
          monthData.month, 
          monthData.year, 
          riskMultiplier
        );
        totalWeightedAllocation += baseAllocation * dynamicMultiplier;
        totalMonths++;
      });
      
      const recommendedAllocation = totalMonths > 0 
        ? Math.round(totalWeightedAllocation / totalMonths)
        : Math.round(baseAllocation * riskMultiplier);
      
      // Calculate change percentage
      const changeFromBase = ((recommendedAllocation - baseAllocation) / baseAllocation) * 100;

      // Generate enhanced justification with dynamic factors
      const criticalCount = data.riskCounts.critical;
      const highCount = data.riskCounts.high;
      const monthCount = Object.keys(data.monthlyBreakdown).length;
      
      let justification = '';
      let dynamicFactors = [];
      
      if (manpowerSettings.enableSeasonalAdjustment) {
        dynamicFactors.push('seasonal patterns');
      }
      if (manpowerSettings.enableMonthlyAdjustment) {
        dynamicFactors.push('monthly variations');
      }
      if (manpowerSettings.yearlyAdjustments.enableYearlyAdjustment) {
        dynamicFactors.push('yearly growth trends');
      }
      
      // Add note about Philippines context if no dynamic factors are enabled
      if (dynamicFactors.length === 0) {
        dynamicFactors.push('base risk levels only - suitable for tropical climate');
      }
      
      const factorsText = dynamicFactors.length > 0 
        ? ` (adjusted for ${dynamicFactors.join(', ')})` 
        : '';
      
      if (dominantRisk === 'critical') {
        justification = `${criticalCount} critical risk periods across ${monthCount} months${factorsText}. Significant manpower increase required.`;
      } else if (dominantRisk === 'high') {
        justification = `${highCount} high risk periods across ${monthCount} months${factorsText}. Increased surveillance recommended.`;
      } else if (dominantRisk === 'medium') {
        justification = `Stable crime patterns expected across ${monthCount} months${factorsText}. Dynamic allocation applied.`;
      } else {
        justification = `Low crime activity predicted across ${monthCount} months${factorsText}. Resource reallocation opportunity.`;
      }

      recommendations.push({
        precinct,
        precinctName: GetPrecinctsDictionary[precinct] || `Precinct ${precinct}`,
        currentAllocation: baseAllocation,
        recommendedAllocation,
        riskLevel: dominantRisk,
        predictedCases: data.totalPredicted,
        changeFromBase,
        justification
      });
    });

    return recommendations.sort((a, b) => {
      // Sort by risk level priority (critical first), then by precinct
      const riskPriority = { critical: 4, high: 3, medium: 2, low: 1 };
      const aPriority = riskPriority[a.riskLevel];
      const bPriority = riskPriority[b.riskLevel];
      
      if (aPriority !== bPriority) return bPriority - aPriority;
      return a.precinct - b.precinct;
    });
  }, [forecastData, historicalData, manpowerSettings]);

  const totalManpowerRequired = manpowerRecommendations.reduce(
    (sum, rec) => sum + rec.recommendedAllocation, 0
  );
  
  const totalBaseManpower = manpowerRecommendations.reduce(
    (sum, rec) => sum + rec.currentAllocation, 0
  );

  const overallChange = totalBaseManpower > 0 
    ? ((totalManpowerRequired - totalBaseManpower) / totalBaseManpower) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Configuration Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Manpower Allocation Settings
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Base Manpower Setting */}
          <div>
            <label className="block text-sm font-medium text-blue-700 mb-2">
              Base Manpower per Precinct (per year)
            </label>
            <input
              type="number"
              min="1"
              max="1000"
              value={manpowerSettings.baseManpowerPerYear}
              onChange={(e) => onSettingsChange({
                ...manpowerSettings,
                baseManpowerPerYear: parseInt(e.target.value) || 0
              })}
              className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Risk Thresholds */}
          <div>
            <label className="block text-sm font-medium text-blue-700 mb-2">
              Risk Level Thresholds (% of Historical Average)
            </label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-600 w-16">Low ≤</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="2.0"
                  value={manpowerSettings.riskThresholds.lowMax}
                  onChange={(e) => onSettingsChange({
                    ...manpowerSettings,
                    riskThresholds: {
                      ...manpowerSettings.riskThresholds,
                      lowMax: parseFloat(e.target.value) || 0.8
                    }
                  })}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                />
                <span className="text-xs text-gray-600">({(manpowerSettings.riskThresholds.lowMax * 100).toFixed(0)}%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-600 w-16">Mid ≤</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="2.0"
                  value={manpowerSettings.riskThresholds.mediumMax}
                  onChange={(e) => onSettingsChange({
                    ...manpowerSettings,
                    riskThresholds: {
                      ...manpowerSettings.riskThresholds,
                      mediumMax: parseFloat(e.target.value) || 1.2
                    }
                  })}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                />
                <span className="text-xs text-gray-600">({(manpowerSettings.riskThresholds.mediumMax * 100).toFixed(0)}%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-600 w-16">High ≤</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="2.0"
                  value={manpowerSettings.riskThresholds.highMax}
                  onChange={(e) => onSettingsChange({
                    ...manpowerSettings,
                    riskThresholds: {
                      ...manpowerSettings.riskThresholds,
                      highMax: parseFloat(e.target.value) || 1.5
                    }
                  })}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                />
                <span className="text-xs text-gray-600">({(manpowerSettings.riskThresholds.highMax * 100).toFixed(0)}%)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-600 w-16">Critical &gt;</span>
                <span className="flex-1 px-2 py-1 text-sm bg-gray-100 rounded text-gray-700">
                  {(manpowerSettings.riskThresholds.highMax * 100).toFixed(0)}%
                </span>
                <span className="text-xs text-gray-600">(auto)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Multipliers */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-blue-700 mb-2">
            Manpower Multipliers by Risk Level
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(manpowerSettings.riskMultipliers).map(([risk, multiplier]) => (
              <div key={risk}>
                <label className="block text-xs text-gray-600 mb-1 capitalize">{risk}</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="3.0"
                  value={multiplier}
                  onChange={(e) => onSettingsChange({
                    ...manpowerSettings,
                    riskMultipliers: {
                      ...manpowerSettings.riskMultipliers,
                      [risk]: parseFloat(e.target.value) || 1.0
                    }
                  })}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500">({(multiplier * 100).toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Philippines Context Info */}
        <div className="mt-6 mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="text-sm font-medium text-green-800 mb-2 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Philippines Climate Considerations
          </h4>
          <div className="text-xs text-green-700 space-y-1">
            <p><strong>Tropical Climate:</strong> Philippines has less seasonal variation compared to temperate countries.</p>
            <p><strong>Two Main Seasons:</strong> Dry season (November-April) and Wet season (May-October).</p>
            <p><strong>Recommendation:</strong> Focus on monthly patterns rather than seasonal adjustments for better accuracy.</p>
          </div>
        </div>

        {/* Dynamic Allocation Settings */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-blue-700 mb-3">
            Dynamic Allocation Settings
          </label>
          <div className="space-y-4">
            {/* Toggle Controls */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={manpowerSettings.enableSeasonalAdjustment}
                  onChange={(e) => onSettingsChange({
                    ...manpowerSettings,
                    enableSeasonalAdjustment: e.target.checked
                  })}
                  className="mr-2"
                />
                <div className="flex flex-col">
                  <span className="text-sm text-gray-700">Enable Seasonal Adjustments</span>
                  <span className="text-xs text-gray-500">Note: Philippines has tropical climate - seasonal patterns may be less significant</span>
                </div>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={manpowerSettings.enableMonthlyAdjustment}
                  onChange={(e) => onSettingsChange({
                    ...manpowerSettings,
                    enableMonthlyAdjustment: e.target.checked
                  })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Enable Monthly Variations</span>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={manpowerSettings.yearlyAdjustments.enableYearlyAdjustment}
                  onChange={(e) => onSettingsChange({
                    ...manpowerSettings,
                    yearlyAdjustments: {
                      ...manpowerSettings.yearlyAdjustments,
                      enableYearlyAdjustment: e.target.checked
                    }
                  })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Enable Yearly Growth</span>
              </div>
            </div>

            {/* Seasonal Multipliers */}
            {manpowerSettings.enableSeasonalAdjustment && (
              <div className="bg-blue-25 p-4 rounded border">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Seasonal Multipliers (Philippines Context)</h4>
                <div className="mb-3 text-xs text-blue-700 bg-blue-50 p-2 rounded">
                  Philippines climate: Dry season (Nov-Apr), Wet season (May-Oct). Default is 1.0 (no adjustment) as tropical climate has less seasonal crime variation.
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(manpowerSettings.seasonalMultipliers).map(([season, multiplier]) => {
                    const seasonLabels = {
                      spring: 'Mar-May (Hot/Dry)',
                      summer: 'Jun-Aug (Wet Start)', 
                      fall: 'Sep-Nov (Wet Peak)',
                      winter: 'Dec-Feb (Cool/Dry)'
                    };
                    
                    return (
                      <div key={season}>
                        <label className="block text-xs text-gray-600 mb-1">
                          {seasonLabels[season as keyof typeof seasonLabels]}
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="2.0"
                          value={multiplier}
                          onChange={(e) => onSettingsChange({
                            ...manpowerSettings,
                            seasonalMultipliers: {
                              ...manpowerSettings.seasonalMultipliers,
                              [season]: parseFloat(e.target.value) || 1.0
                            }
                          })}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                        <div className="text-xs text-gray-500 mt-1">Current: {(multiplier * 100).toFixed(0)}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Yearly Growth Settings */}
            {manpowerSettings.yearlyAdjustments.enableYearlyAdjustment && (
              <div className="bg-green-25 p-4 rounded border">
                <h4 className="text-sm font-medium text-green-800 mb-2">Yearly Growth Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Base Year</label>
                    <input
                      type="number"
                      min="2020"
                      max="2030"
                      value={manpowerSettings.yearlyAdjustments.baseYear}
                      onChange={(e) => onSettingsChange({
                        ...manpowerSettings,
                        yearlyAdjustments: {
                          ...manpowerSettings.yearlyAdjustments,
                          baseYear: parseInt(e.target.value) || new Date().getFullYear()
                        }
                      })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Annual Growth Rate</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.9"
                      max="1.2"
                      value={manpowerSettings.yearlyAdjustments.yearOverYearGrowth}
                      onChange={(e) => onSettingsChange({
                        ...manpowerSettings,
                        yearlyAdjustments: {
                          ...manpowerSettings.yearlyAdjustments,
                          yearOverYearGrowth: parseFloat(e.target.value) || 1.02
                        }
                      })}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                    <span className="text-xs text-gray-500">({((manpowerSettings.yearlyAdjustments.yearOverYearGrowth - 1) * 100).toFixed(1)}% annually)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Allocation Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-600 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-700">Base Allocation</p>
              <p className="text-2xl font-bold text-gray-900">{totalBaseManpower.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Static baseline</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-600 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-700">Dynamic Allocation</p>
              <p className="text-2xl font-bold text-gray-900">{totalManpowerRequired.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Time-adjusted</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-600 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-700">Active Adjustments</p>
              <p className="text-2xl font-bold text-gray-900">
                {[
                  manpowerSettings.enableSeasonalAdjustment && 'S',
                  manpowerSettings.enableMonthlyAdjustment && 'M', 
                  manpowerSettings.yearlyAdjustments.enableYearlyAdjustment && 'Y'
                ].filter(Boolean).join('+') || 'None'}
              </p>
              <p className="text-xs text-gray-500">S=Seasonal, M=Monthly, Y=Yearly</p>
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-lg border ${
          overallChange > 10 
            ? 'bg-red-50 border-red-200' 
            : overallChange < -10 
              ? 'bg-green-50 border-green-200'
              : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${
              overallChange > 10 
                ? 'bg-red-600' 
                : overallChange < -10 
                  ? 'bg-green-600'
                  : 'bg-yellow-600'
            }`}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="ml-4">
              <p className={`text-sm font-medium ${
                overallChange > 10 
                  ? 'text-red-700' 
                  : overallChange < -10 
                    ? 'text-green-700'
                    : 'text-yellow-700'
              }`}>Overall Change</p>
              <p className={`text-2xl font-bold ${
                overallChange > 10 
                  ? 'text-red-900' 
                  : overallChange < -10 
                    ? 'text-green-900'
                    : 'text-yellow-900'
              }`}>
                {overallChange > 0 ? '+' : ''}{overallChange.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Recommendations */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center">
            <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Manpower Recommendations by Precinct
          </h3>
        </div>

        <div className="p-6">
          {manpowerRecommendations.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No forecast data available for manpower recommendations.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Precinct</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700">Risk Level</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700">Predicted Cases</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700">Current</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700">Recommended</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700">Change</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Justification</th>
                  </tr>
                </thead>
                <tbody>
                  {manpowerRecommendations.map((rec, index) => (
                    <tr key={rec.precinct} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="py-3 px-4 font-medium text-gray-900">{rec.precinctName}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          rec.riskLevel === 'critical' ? 'bg-red-100 text-red-800' :
                          rec.riskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                          rec.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {rec.riskLevel.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-medium">{rec.predictedCases}</td>
                      <td className="py-3 px-4 text-center">{rec.currentAllocation}</td>
                      <td className="py-3 px-4 text-center font-bold">{rec.recommendedAllocation}</td>
                      <td className={`py-3 px-4 text-center font-medium ${
                        rec.changeFromBase > 10 ? 'text-red-600' :
                        rec.changeFromBase < -10 ? 'text-green-600' :
                        'text-gray-600'
                      }`}>
                        {rec.changeFromBase > 0 ? '+' : ''}{rec.changeFromBase.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">{rec.justification}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManpowerAllocation;