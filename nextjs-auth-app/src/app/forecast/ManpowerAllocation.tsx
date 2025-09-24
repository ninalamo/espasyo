'use client';

import { useMemo, useState, useCallback } from 'react';
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

  // Calculate dynamic thresholds based on historical data distribution
  const calculateDynamicThresholds = useCallback(() => {
    if (forecastData.length === 0) return manpowerSettings.riskThresholds;

    // Calculate actual prediction vs historical ratios from all forecast data
    const ratios: number[] = [];
    
    forecastData.forEach(forecast => {
      // Find corresponding historical data for this precinct/crime type
      const historicalMatches = historicalData.filter(h => 
        h.precinct === forecast.precinct && h.crimeType === forecast.crimeType
      );
      
      if (historicalMatches.length > 0) {
        const historicalAvg = historicalMatches.reduce((sum, h) => sum + h.count, 0) / historicalMatches.length;
        if (historicalAvg > 0) {
          ratios.push(forecast.predictedCount / historicalAvg);
        }
      }
    });

    if (ratios.length === 0) return manpowerSettings.riskThresholds;

    // Sort ratios to find percentiles
    ratios.sort((a, b) => a - b);
    
    // Calculate percentiles for dynamic thresholds
    const percentile25 = ratios[Math.floor(ratios.length * 0.25)] || 0.8;
    const percentile75 = ratios[Math.floor(ratios.length * 0.75)] || 1.3;
    const percentile90 = ratios[Math.floor(ratios.length * 0.90)] || 1.5;

    // Dynamic threshold formula:
    // Low: Below 25th percentile (bottom quarter of predictions)
    // Medium: 25th to 75th percentile (middle half)
    // High: 75th to 90th percentile (upper quarter)
    // Critical: Above 90th percentile (top 10%)
    
    return {
      lowMax: Math.max(0.6, Math.min(1.0, percentile25)), // Clamp between 0.6 and 1.0
      mediumMax: Math.max(1.0, Math.min(1.4, percentile75)), // Clamp between 1.0 and 1.4
      highMax: Math.max(1.3, Math.min(2.0, percentile90)) // Clamp between 1.3 and 2.0
    };
  }, [forecastData, historicalData, manpowerSettings.riskThresholds]);

  // Get dynamic thresholds
  const dynamicThresholds = calculateDynamicThresholds();

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

  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  return (
    <div className="space-y-6">
      {/* Simple Configuration */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-blue-800 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Manpower Planning
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              How it works
            </button>
            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              {showAdvancedSettings ? 'Hide' : 'Show'} Advanced
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-blue-700 mb-1">
              Current Personnel per Precinct
            </label>
            <input
              type="number"
              min="10"
              max="500"
              value={manpowerSettings.baseManpowerPerYear}
              onChange={(e) => onSettingsChange({
                ...manpowerSettings,
                baseManpowerPerYear: parseInt(e.target.value) || 100
              })}
              className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-blue-700 mb-1">
              High Risk Adjustment
            </label>
            <select
              value={manpowerSettings.riskMultipliers.high}
              onChange={(e) => {
                const multiplier = parseFloat(e.target.value);
                onSettingsChange({
                  ...manpowerSettings,
                  riskMultipliers: { 
                    ...manpowerSettings.riskMultipliers, 
                    high: multiplier, 
                    critical: multiplier * 1.3 // Critical is always 30% higher
                  }
                });
              }}
              className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value={1.2}>Conservative (+20%)</option>
              <option value={1.3}>Standard (+30%)</option>
              <option value={1.5}>Aggressive (+50%)</option>
            </select>
          </div>
        </div>

        {/* Dynamic Threshold Display */}
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs">
          <h4 className="font-medium text-green-800 mb-1 flex items-center">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Auto-calculated Risk Thresholds
          </h4>
          <div className="text-green-700 flex space-x-4">
            <span><strong>Low:</strong> ≤{(dynamicThresholds.lowMax * 100).toFixed(0)}%</span>
            <span><strong>Medium:</strong> ≤{(dynamicThresholds.mediumMax * 100).toFixed(0)}%</span>
            <span><strong>High:</strong> ≤{(dynamicThresholds.highMax * 100).toFixed(0)}%</span>
            <span><strong>Critical:</strong> &gt;{(dynamicThresholds.highMax * 100).toFixed(0)}%</span>
          </div>
          <div className="text-green-600 mt-1 text-xs">
            🤖 These thresholds are automatically calculated from your forecast data patterns
          </div>
        </div>

        {/* Explanation Modal/Toggle */}
        {showExplanation && (
          <div className="mt-4 p-3 bg-white border border-blue-200 rounded text-xs">
            <h4 className="font-medium text-blue-800 mb-2">How Dynamic Manpower Allocation Works:</h4>
            <div className="text-blue-700 space-y-1">
              <p>• <strong>Base Personnel:</strong> Current number of officers per precinct</p>
              <p>• <strong>Automatic Risk Assessment:</strong> System analyzes your forecast vs historical data</p>
              <p>• <strong>Dynamic Thresholds:</strong> Risk levels calculated from data distribution (25th, 75th, 90th percentiles)</p>
              <p>• <strong>Smart Allocation:</strong> Personnel recommendations based on risk level and your adjustment preference</p>
              <p>• <strong>No Manual Tuning:</strong> System automatically adapts to your data patterns</p>
            </div>
            <div className="mt-2 p-2 bg-blue-50 rounded">
              <p className="font-medium text-blue-800">Formula:</p>
              <p className="text-blue-700">• Low Risk: Bottom 25% of predictions (0.6-1.0x historical average)</p>
              <p className="text-blue-700">• Medium Risk: Middle 50% of predictions (1.0-1.4x historical average)</p>
              <p className="text-blue-700">• High Risk: Upper 25% of predictions (1.3-2.0x historical average)</p>
              <p className="text-blue-700">• Critical Risk: Top 10% of predictions (&gt;90th percentile)</p>
            </div>
          </div>
        )}

        {/* Advanced Settings */}
        {showAdvancedSettings && (
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded">
            <h4 className="text-sm font-medium text-gray-800 mb-3">Advanced Configuration</h4>
            
            <div className="text-xs">
              {/* Time Adjustments */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Time-based Adjustments</label>
                <div className="space-y-2">
                  <label className="flex items-center text-xs">
                    <input
                      type="checkbox"
                      checked={manpowerSettings.enableSeasonalAdjustment}
                      onChange={(e) => onSettingsChange({ ...manpowerSettings, enableSeasonalAdjustment: e.target.checked })}
                      className="mr-2 scale-75"
                    />
                    Seasonal patterns (tropical climate - usually not needed)
                  </label>
                  <label className="flex items-center text-xs">
                    <input
                      type="checkbox"
                      checked={manpowerSettings.enableMonthlyAdjustment}
                      onChange={(e) => onSettingsChange({ ...manpowerSettings, enableMonthlyAdjustment: e.target.checked })}
                      className="mr-2 scale-75"
                    />
                    Monthly variations
                  </label>
                  <label className="flex items-center text-xs">
                    <input
                      type="checkbox"
                      checked={manpowerSettings.yearlyAdjustments.enableYearlyAdjustment}
                      onChange={(e) => onSettingsChange({
                        ...manpowerSettings,
                        yearlyAdjustments: { ...manpowerSettings.yearlyAdjustments, enableYearlyAdjustment: e.target.checked }
                      })}
                      className="mr-2 scale-75"
                    />
                    Yearly growth trends
                  </label>
                </div>
                {manpowerSettings.yearlyAdjustments.enableYearlyAdjustment && (
                  <div className="mt-2 text-xs">
                    <label className="block text-gray-600 mb-1">Annual Growth Rate</label>
                    <input
                      type="number" step="0.01" min="0.9" max="1.2"
                      value={manpowerSettings.yearlyAdjustments.yearOverYearGrowth}
                      onChange={(e) => onSettingsChange({
                        ...manpowerSettings,
                        yearlyAdjustments: { ...manpowerSettings.yearlyAdjustments, yearOverYearGrowth: parseFloat(e.target.value) || 1.02 }
                      })}
                      className="w-full px-2 py-1 text-xs border rounded"
                    />
                    <span className="text-gray-500">({((manpowerSettings.yearlyAdjustments.yearOverYearGrowth - 1) * 100).toFixed(1)}% annually)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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