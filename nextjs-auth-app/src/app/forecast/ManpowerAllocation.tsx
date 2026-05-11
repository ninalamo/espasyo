'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { GetPrecinctsDictionary, PrecinctNumberToNameMap, PrecinctGuidToNumberMap } from '../../constants/consts';
import type { 
  ManpowerAllocation as ManpowerAllocationType, 
  ManpowerRecommendation
} from '../../types/forecast/ExtendedForecastTypes';
import { DEFAULT_MANPOWER_ALLOCATION } from '../../types/forecast/ExtendedForecastTypes';
import { manpowerApi, ManpowerAllocation as ManpowerApiType } from '../../utils/manpowerApi';

interface HistoricalData {
  year: number;
  month: number;
  precinct: number;
  crimeType: number;
  count: number;
  timeOfDay: string;
}

interface ShiftAnalysis {
  shift: string;
  crimeCount: number;
  percentage: number;
  recommendedOfficers: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface PrecinctShiftData {
  precinct: number;
  precinctName: string;
  totalCrimes: number;
  shifts: ShiftAnalysis[];
  dominantShift: string;
  coverage24h: boolean;
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
  // State for actual manpower data from API
  const [actualManpowerData, setActualManpowerData] = useState<ManpowerApiType[]>([]);
  const [isLoadingManpower, setIsLoadingManpower] = useState(true);
  const [manpowerError, setManpowerError] = useState<string | null>(null);
  const [dataFetchTimestamp, setDataFetchTimestamp] = useState<string | null>(null);
  
  // Fetch actual manpower allocations from API
  useEffect(() => {
    const fetchManpowerData = async () => {
      try {
        setIsLoadingManpower(true);
        setManpowerError(null);
        const data = await manpowerApi.getAllManpower();
        setActualManpowerData(data);
        // Set timestamp when data is successfully fetched
        setDataFetchTimestamp(new Date().toLocaleString());
      } catch (error) {
        console.error('Failed to fetch manpower data:', error);
        setManpowerError(error instanceof Error ? error.message : 'Failed to fetch manpower data');
        setActualManpowerData([]);
        setDataFetchTimestamp(null);
      } finally {
        setIsLoadingManpower(false);
      }
    };
    
    fetchManpowerData();
  }, []);
  
  // Helper function to get actual allocation for a precinct from API data
  const getActualAllocation = useCallback((precinct: number): number => {
    if (actualManpowerData.length === 0) {
      return 0; // No allocation data exists
    }
    
    // Find the GUID for this precinct number by searching the mapping
    const precinctGuid = Object.entries(PrecinctGuidToNumberMap).find(
      ([guid, precinctNum]) => precinctNum === precinct
    )?.[0];
    
    if (!precinctGuid) {
      return 0; // Unknown precinct number
    }
    
    // Find allocations that match this precinct by GUID
    // The API returns precinctId as GUID
    const precinctAllocations = actualManpowerData.filter(allocation => {
      return allocation.precinctId === precinctGuid;
    });
    
    if (precinctAllocations.length === 0) {
      return 0; // No allocation exists for this precinct
    }
    
    // Sum all head counts for this precinct (in case of multiple entries/shifts)
    return precinctAllocations.reduce((total, allocation) => {
      const headCount = allocation.headCount || allocation.officerCount || allocation.allocatedCount || 0;
      return total + headCount;
    }, 0);
  }, [actualManpowerData]);
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

  // Helper function to map time of day to shift
  const getShiftFromTimeOfDay = (timeOfDay: string): string => {
    if (!timeOfDay) return 'Unknown';
    
    const time = timeOfDay.toLowerCase();
    if (time.includes('morning') || time.includes('dawn') || time.includes('am') || 
        (time.includes('06') || time.includes('07') || time.includes('08') || 
         time.includes('09') || time.includes('10') || time.includes('11') ||
         time.includes('12') || time.includes('13'))) {
      return 'Morning';
    } else if (time.includes('afternoon') || time.includes('evening') || time.includes('pm') ||
               (time.includes('14') || time.includes('15') || time.includes('16') ||
                time.includes('17') || time.includes('18') || time.includes('19') ||
                time.includes('20') || time.includes('21'))) {
      return 'Afternoon';
    } else if (time.includes('night') || time.includes('midnight') ||
               (time.includes('22') || time.includes('23') || time.includes('00') ||
                time.includes('01') || time.includes('02') || time.includes('03') ||
                time.includes('04') || time.includes('05'))) {
      return 'Night';
    }
    
    return 'Unknown';
  };

  // Calculate shift-based analysis
  const calculateShiftAnalysis = useMemo(() => {
    if (historicalData.length === 0 && forecastData.length === 0) return [];

    const precinctShiftData = new Map<number, Map<string, number>>();
    const allShifts = ['Morning', 'Afternoon', 'Night'];

    // Analyze historical data for shift patterns
    historicalData.forEach(data => {
      const shift = getShiftFromTimeOfDay(data.timeOfDay);
      if (shift === 'Unknown') return;

      if (!precinctShiftData.has(data.precinct)) {
        precinctShiftData.set(data.precinct, new Map());
      }
      
      const precinctData = precinctShiftData.get(data.precinct)!;
      precinctData.set(shift, (precinctData.get(shift) || 0) + data.count);
    });

    // Convert to analysis format
    const shiftAnalysisResults: PrecinctShiftData[] = [];

    precinctShiftData.forEach((shiftData, precinct) => {
      const totalCrimes = Array.from(shiftData.values()).reduce((sum, count) => sum + count, 0);
      if (totalCrimes === 0) return;

      const shifts: ShiftAnalysis[] = allShifts.map(shift => {
        const crimeCount = shiftData.get(shift) || 0;
        const percentage = totalCrimes > 0 ? (crimeCount / totalCrimes) * 100 : 0;
        
        // Calculate recommended officers based on actual allocation data only
        const actualAllocation = getActualAllocation(precinct);
        let recommendedOfficers = 0;
        
        if (actualAllocation > 0) {
          const baseOfficersPerShift = Math.max(2, Math.floor(actualAllocation / 3)); // Divide by 3 shifts
          const crimeRatio = percentage / 33.33; // 33.33% would be equal distribution
          recommendedOfficers = Math.round(baseOfficersPerShift * crimeRatio);
          
          // Apply minimum staffing rules only if we have actual data
          recommendedOfficers = Math.max(1, recommendedOfficers); // At least 1 officer per shift
          if (shift === 'Night') recommendedOfficers = Math.max(2, recommendedOfficers); // Night shift minimum 2
        }
        
        // Determine risk level based on crime concentration
        let riskLevel: 'low' | 'medium' | 'high' | 'critical';
        if (percentage > 50) riskLevel = 'critical';
        else if (percentage > 40) riskLevel = 'high';
        else if (percentage > 25) riskLevel = 'medium';
        else riskLevel = 'low';

        return {
          shift,
          crimeCount,
          percentage,
          recommendedOfficers,
          riskLevel
        };
      });

      // Find dominant shift
      const dominantShift = shifts.reduce((max, current) => 
        current.crimeCount > max.crimeCount ? current : max
      ).shift;

      // Check 24/7 coverage (all shifts have at least some activity)
      const coverage24h = shifts.every(s => s.crimeCount > 0);

      shiftAnalysisResults.push({
        precinct,
        precinctName: GetPrecinctsDictionary[precinct] || `Precinct ${precinct}`,
        totalCrimes,
        shifts,
        dominantShift,
        coverage24h
      });
    });

    return shiftAnalysisResults.sort((a, b) => b.totalCrimes - a.totalCrimes);
  }, [historicalData, forecastData, actualManpowerData, getActualAllocation]);

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

      // Get actual current allocation from API
      const currentAllocation = getActualAllocation(precinct);
      
      // Skip precincts that have no manpower allocation data
      if (currentAllocation === 0) {
        return; // Don't include in recommendations
      }
      
      // Calculate recommendations since we have actual baseline data
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
        totalWeightedAllocation += currentAllocation * dynamicMultiplier;
        totalMonths++;
      });
      
      const recommendedAllocation = totalMonths > 0 
        ? Math.round(totalWeightedAllocation / totalMonths)
        : Math.round(currentAllocation * riskMultiplier);
      
      // Calculate change percentage from current allocation
      const changeFromBase = ((recommendedAllocation - currentAllocation) / currentAllocation) * 100;

      // Generate enhanced justification with detailed risk computation
      const criticalCount = data.riskCounts.critical;
      const highCount = data.riskCounts.high;
      const mediumCount = data.riskCounts.medium;
      const lowCount = data.riskCounts.low;
      const monthCount = Object.keys(data.monthlyBreakdown).length;
      
      // Calculate risk breakdown percentages
      const totalMonthsWithRisk = criticalCount + highCount + mediumCount + lowCount;
      const criticalPct = totalMonthsWithRisk > 0 ? (criticalCount / totalMonthsWithRisk * 100).toFixed(1) : '0';
      const highPct = totalMonthsWithRisk > 0 ? (highCount / totalMonthsWithRisk * 100).toFixed(1) : '0';
      const mediumPct = totalMonthsWithRisk > 0 ? (mediumCount / totalMonthsWithRisk * 100).toFixed(1) : '0';
      const lowPct = totalMonthsWithRisk > 0 ? (lowCount / totalMonthsWithRisk * 100).toFixed(1) : '0';
      
      // Create risk breakdown text
      const riskBreakdown = `Risk distribution: ${criticalCount} Critical (${criticalPct}%), ${highCount} High (${highPct}%), ${mediumCount} Medium (${mediumPct}%), ${lowCount} Low (${lowPct}%)`;
      
      // Calculate predicted vs historical ratio for this precinct
      const historicalTotal = data.totalHistorical;
      const predictedTotal = data.totalPredicted;
      const predictionRatio = historicalTotal > 0 ? (predictedTotal / historicalTotal).toFixed(2) : 'N/A';
      const predictionText = predictionRatio !== 'N/A' 
        ? ` Forecast vs historical ratio: ${predictionRatio}x.` 
        : '';
      
      // Get current dynamic thresholds for context
      const thresholdText = ` Dynamic thresholds: Low ≤${(dynamicThresholds.lowMax * 100).toFixed(0)}%, Medium ≤${(dynamicThresholds.mediumMax * 100).toFixed(0)}%, High ≤${(dynamicThresholds.highMax * 100).toFixed(0)}%, Critical >${(dynamicThresholds.highMax * 100).toFixed(0)}%.`;
      
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
        justification = `${dominantRisk.toUpperCase()} RISK LEVEL determined by majority of forecast periods. ${riskBreakdown} across ${monthCount} months${factorsText}.${predictionText}${thresholdText} Significant manpower increase required.`;
      } else if (dominantRisk === 'high') {
        justification = `${dominantRisk.toUpperCase()} RISK LEVEL determined by majority of forecast periods. ${riskBreakdown} across ${monthCount} months${factorsText}.${predictionText}${thresholdText} Increased surveillance recommended.`;
      } else if (dominantRisk === 'medium') {
        justification = `${dominantRisk.toUpperCase()} RISK LEVEL determined by majority of forecast periods. ${riskBreakdown} across ${monthCount} months${factorsText}.${predictionText}${thresholdText} Stable crime patterns expected.`;
      } else {
        justification = `${dominantRisk.toUpperCase()} RISK LEVEL determined by majority of forecast periods. ${riskBreakdown} across ${monthCount} months${factorsText}.${predictionText}${thresholdText} Resource reallocation opportunity due to predicted decrease in crime activity.`;
      }

      recommendations.push({
        precinct,
        precinctName: GetPrecinctsDictionary[precinct] || `Precinct ${precinct}`,
        currentAllocation: currentAllocation,
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
  }, [forecastData, historicalData, manpowerSettings, actualManpowerData, getActualAllocation]);

  const totalManpowerRequired = manpowerRecommendations.reduce(
    (sum, rec) => sum + rec.recommendedAllocation, 0
  );
  
  const totalCurrentManpower = manpowerRecommendations.reduce(
    (sum, rec) => sum + rec.currentAllocation, 0
  );

  const overallChange = totalCurrentManpower > 0 
    ? ((totalManpowerRequired - totalCurrentManpower) / totalCurrentManpower) * 100 
    : 0; // No change when no current data

  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showShiftAnalysis, setShowShiftAnalysis] = useState(false);
  const [selectedPrecinctForShifts, setSelectedPrecinctForShifts] = useState<number | null>(null);

  // Show loading state while fetching manpower data
  if (isLoadingManpower) {
    return (
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-4"></div>
            <div>
              <h3 className="text-lg font-semibold text-blue-800">Loading Manpower Data...</h3>
              <p className="text-sm text-blue-600">Fetching actual allocations from API</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Show error state if manpower API failed
  if (manpowerError) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8">
          <div className="flex items-center">
            <svg className="w-8 h-8 text-red-500 mr-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-red-800">Failed to Load Manpower Data</h3>
              <p className="text-sm text-red-600">{manpowerError}</p>
              <p className="text-xs text-red-500 mt-1">Using forecast recommendations only</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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

        <div className="text-center py-4">
          <p className="text-blue-700 text-sm">
            Manpower recommendations are calculated automatically based on actual allocation data and forecast risk levels.
          </p>
          <p className="text-blue-600 text-xs mt-2">
            No manual configuration needed - the system adapts to your data.
          </p>
        </div>
        
        {/* Filter Behavior Explanation */}
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-4 h-4 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs">
              <h4 className="font-medium text-yellow-800 mb-1">How Forecast Filters Affect This Tab:</h4>
              <div className="text-yellow-700 space-y-1">
                <p><strong>✅ What Changes with Filters:</strong></p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li><strong>Recommended Manpower:</strong> Recalculated based on filtered forecast data (e.g., &quot;burglar only&quot;)</li>
                  <li><strong>Risk Assessments:</strong> Updated to reflect only the filtered crime types/periods</li>
                  <li><strong>Dynamic Thresholds:</strong> Adjusted based on filtered data distribution</li>
                  <li><strong>Justifications:</strong> Show reasoning based only on filtered forecasts</li>
                </ul>
                <p className="mt-2"><strong>🔒 What Stays the Same:</strong></p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li><strong>Current Manpower:</strong> Real deployment data from API - not affected by analysis filters</li>
                  <li><strong>Actual Officer Counts:</strong> Shows what&apos;s actually deployed regardless of which crimes you&apos;re analyzing</li>
                </ul>
                <p className="mt-2 text-yellow-600 font-medium">💡 This design lets you see how different crime patterns would affect staffing needs while keeping real-world context.</p>
              </div>
            </div>
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

      {/* Current Manpower by Precinct */}
      {actualManpowerData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Current Manpower by Precinct
              {dataFetchTimestamp && (
                <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                  As of {dataFetchTimestamp}
                </span>
              )}
              <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                🔒 Real Deployment Data
              </span>
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              This shows actual officer deployments from the system database - not affected by forecast filters.
            </p>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(() => {
                // Group actual manpower data by precinct
                const precinctMap = new Map<string, {
                  precinctName: string;
                  precinctId?: string;
                  shifts: Array<{ shift: string; headCount: number; id: string }>;
                  totalHeadCount: number;
                }>();
                
                actualManpowerData.forEach(allocation => {
                  const precinctKey = allocation.precinctId;
                  const precinctName = allocation.precinctName || allocation.precinct || 'Unknown Precinct';
                  const shiftName = allocation.shift || 'Not Specified';
                  const headCount = allocation.headCount || allocation.officerCount || allocation.allocatedCount || 0;
                  
                  if (!precinctMap.has(precinctKey)) {
                    precinctMap.set(precinctKey, {
                      precinctName,
                      precinctId: allocation.precinctId || allocation.precinct,
                      shifts: [],
                      totalHeadCount: 0
                    });
                  }
                  
                  const precinctData = precinctMap.get(precinctKey)!;
                  precinctData.shifts.push({
                    shift: shiftName,
                    headCount,
                    id: allocation.id
                  });
                  precinctData.totalHeadCount += headCount;
                });
                
                return Array.from(precinctMap.values()).map((precinctData, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <div>
                          <h4 className="font-semibold text-gray-900 text-sm">
                            {precinctData.precinctName}
                          </h4>
                          {precinctData.precinctId && (
                            <p className="text-xs text-gray-500">ID: {precinctData.precinctId}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">
                          {precinctData.totalHeadCount}
                        </div>
                        <div className="text-xs text-gray-500">officers</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h5 className="text-xs font-medium text-gray-700 mb-2">By Shift:</h5>
                      {precinctData.shifts.map((shift, shiftIndex) => {
                        const shiftColor = shift.shift === 'Morning' ? 'bg-yellow-100 text-yellow-800' :
                                          shift.shift === 'Evening' || shift.shift === 'Afternoon' ? 'bg-orange-100 text-orange-800' :
                                          shift.shift === 'Night' ? 'bg-blue-100 text-blue-800' :
                                          'bg-gray-100 text-gray-800';
                        
                        return (
                          <div key={shiftIndex} className="flex items-center justify-between text-xs">
                            <span className={`px-2 py-1 rounded-full ${shiftColor} font-medium`}>
                              {shift.shift}
                            </span>
                            <span className="font-semibold text-gray-900">
                              {shift.headCount} officers
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Coverage indicator */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">Coverage:</span>
                        <span className="text-xs font-medium">
                          {precinctData.shifts.length === 3 ? (
                            <span className="text-green-600">24/7 ✓</span>
                          ) : precinctData.shifts.length === 2 ? (
                            <span className="text-yellow-600">Partial</span>
                          ) : (
                            <span className="text-orange-600">Limited</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
            
            {/* Summary row */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Total Active Officers:</span>
                </div>
                <div className="flex items-center">
                  <span className="text-2xl font-bold text-blue-600 mr-2">{totalCurrentManpower}</span>
                  <span className="text-sm text-gray-500">across all precincts</span>
                </div>
              </div>
              
              <div className="mt-2 text-xs text-gray-500 text-center">
                Data refreshed automatically from Precinct Management
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No Real Data Notice */}
      {actualManpowerData.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.865-.833-2.635 0L4.178 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <h4 className="text-amber-800 font-medium">No Manpower Allocation Data Available</h4>
              <p className="text-amber-700 text-sm mt-1">
                No actual manpower allocations found in the system. Recommendations are based on forecast data and baseline calculations only.
                To see actual vs. recommended comparisons, please add manpower allocations via the Precincts page.
              </p>
              <p className="text-amber-600 text-xs mt-2">
                📊 All &quot;Current Allocation&quot; values show 0 • Using baseline of {manpowerSettings.baseManpowerPerYear} officers per precinct for calculations
              </p>
            </div>
          </div>
        </div>
      )}
      
      {actualManpowerData.length > 0 && totalCurrentManpower === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-blue-800 font-medium">Precinct Name Mismatch</h4>
              <p className="text-blue-700 text-sm mt-1">
                Found {actualManpowerData.length} manpower allocation(s) in the system, but could not match them to forecast precincts.
                This may be due to precinct name differences between the forecast and manpower data.
              </p>
              <p className="text-blue-600 text-xs mt-2">
                🔍 Available allocations: {actualManpowerData.map(a => a.precinct || a.precinctName || 'Unknown').join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Manpower Overview Cards */}
      <div className="space-y-6">
        {/* Primary Metrics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Allocation Card */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-blue-600 rounded-lg shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-blue-900">Current Deployment</h3>
                  <p className="text-sm text-blue-700">Active officers across all precincts</p>
                </div>
              </div>
            </div>
            
            <div className="mt-4">
              {isLoadingManpower ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                  <p className="text-lg text-blue-700">Loading deployment data...</p>
                </div>
              ) : manpowerError ? (
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-red-700">Error</p>
                  <p className="text-sm text-red-600 bg-red-100 rounded p-2">{manpowerError}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-4xl font-bold text-blue-900">
                    {totalCurrentManpower.toLocaleString()}
                    <span className="text-lg font-medium text-blue-700 ml-2">officers</span>
                  </p>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className={`px-3 py-1 rounded-full ${
                      totalCurrentManpower === 0 
                        ? 'bg-red-100 text-red-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {totalCurrentManpower === 0 ? '⚠️ No deployment data' : '✅ Live data'}
                    </span>
                    {dataFetchTimestamp && (
                      <span className="text-blue-600">Updated: {dataFetchTimestamp}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recommended Allocation Card */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-green-600 rounded-lg shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-green-900">AI Recommendation</h3>
                  <p className="text-sm text-green-700">Optimal allocation based on forecast</p>
                </div>
              </div>
            </div>
            
            <div className="mt-4 space-y-2">
              <p className="text-4xl font-bold text-green-900">
                {totalManpowerRequired.toLocaleString()}
                <span className="text-lg font-medium text-green-700 ml-2">officers</span>
              </p>
              <div className="flex items-center space-x-4 text-sm">
                <span className={`px-3 py-1 rounded-full ${
                  totalManpowerRequired === 0 
                    ? 'bg-amber-100 text-amber-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {totalManpowerRequired === 0 ? '⚠️ Need baseline data' : '🤖 AI optimized'}
                </span>
                <span className="text-green-600">
                  {manpowerRecommendations.length} precincts analyzed
                </span>
              </div>
            </div>
          </div>

          {/* Impact Analysis Card */}
          <div className={`rounded-xl p-6 border shadow-lg ${
            Math.abs(overallChange) > 20 
              ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200' 
              : Math.abs(overallChange) > 10
                ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200'
                : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg shadow-lg ${
                  Math.abs(overallChange) > 20 
                    ? 'bg-red-600' 
                    : Math.abs(overallChange) > 10
                      ? 'bg-yellow-600'
                      : 'bg-gray-600'
                }`}>
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className={`text-lg font-semibold ${
                    Math.abs(overallChange) > 20 
                      ? 'text-red-900' 
                      : Math.abs(overallChange) > 10
                        ? 'text-yellow-900'
                        : 'text-gray-900'
                  }`}>Resource Impact</h3>
                  <p className={`text-sm ${
                    Math.abs(overallChange) > 20 
                      ? 'text-red-700' 
                      : Math.abs(overallChange) > 10
                        ? 'text-yellow-700'
                        : 'text-gray-700'
                  }`}>Change from current deployment</p>
                </div>
              </div>
            </div>
            
            <div className="mt-4 space-y-2">
              <div className="flex items-baseline space-x-2">
                <p className={`text-4xl font-bold ${
                  Math.abs(overallChange) > 20 
                    ? 'text-red-900' 
                    : Math.abs(overallChange) > 10
                      ? 'text-yellow-900'
                      : 'text-gray-900'
                }`}>
                  {totalCurrentManpower === 0 ? 'N/A' : `${overallChange > 0 ? '+' : ''}${overallChange.toFixed(1)}%`}
                </p>
                {totalCurrentManpower > 0 && (
                  <span className={`text-lg font-medium ${
                    Math.abs(overallChange) > 20 
                      ? 'text-red-700' 
                      : Math.abs(overallChange) > 10
                        ? 'text-yellow-700'
                        : 'text-gray-700'
                  }`}>
                    ({overallChange > 0 ? '+' : ''}{totalManpowerRequired - totalCurrentManpower} officers)
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-4 text-sm">
                <span className={`px-3 py-1 rounded-full font-medium ${
                  Math.abs(overallChange) > 20 
                    ? 'bg-red-100 text-red-700' 
                    : Math.abs(overallChange) > 10
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-green-100 text-green-700'
                }`}>
                  {Math.abs(overallChange) > 20 
                    ? '🚨 Significant change needed' 
                    : Math.abs(overallChange) > 10
                      ? '⚠️ Moderate adjustment'
                      : '✅ Minor adjustment'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Summary */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-purple-600 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900">Analysis Configuration</h3>
                <p className="text-sm text-gray-600">Current adjustment factors applied</p>
              </div>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-700">Active Adjustments:</span>
                <div className="flex items-center space-x-2">
                  {[
                    { key: 'seasonal', enabled: manpowerSettings.enableSeasonalAdjustment, label: 'Seasonal', icon: '🌤️' },
                    { key: 'monthly', enabled: manpowerSettings.enableMonthlyAdjustment, label: 'Monthly', icon: '📅' },
                    { key: 'yearly', enabled: manpowerSettings.yearlyAdjustments.enableYearlyAdjustment, label: 'Yearly Growth', icon: '📈' }
                  ].map(adjustment => (
                    <span key={adjustment.key} className={`px-3 py-1 rounded-full text-xs font-medium ${
                      adjustment.enabled 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {adjustment.icon} {adjustment.label} {adjustment.enabled ? '✓' : '○'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-3 p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center space-x-4 text-sm text-purple-700">
                <span><strong>Risk Thresholds:</strong></span>
                <span>Low: ≤{(dynamicThresholds.lowMax * 100).toFixed(0)}%</span>
                <span>Medium: ≤{(dynamicThresholds.mediumMax * 100).toFixed(0)}%</span>
                <span>High: ≤{(dynamicThresholds.highMax * 100).toFixed(0)}%</span>
                <span>Critical: &gt;{(dynamicThresholds.highMax * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Manpower Recommendations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <svg className="w-6 h-6 mr-3 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                AI-Powered Manpower Recommendations
              </h3>
              <p className="text-sm text-gray-600 mt-1 ml-9">
                Intelligent staffing suggestions based on crime forecasts and historical patterns
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
                ⚙️ Filter-Responsive
              </span>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                🤖 AI-Optimized
              </span>
            </div>
          </div>
        </div>

        <div className="p-6">
          {manpowerRecommendations.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h.01M9 16h.01M15 11h.01" />
              </svg>
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Recommendations Available</h4>
              <p className="text-gray-500">No forecast data or manpower baseline available for generating recommendations.</p>
              <p className="text-sm text-gray-400 mt-2">Ensure you have both forecast data and current manpower allocations to see AI recommendations.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {manpowerRecommendations.map((rec, index) => {
                const isHighPriority = rec.riskLevel === 'critical' || rec.riskLevel === 'high';
                const isPositiveChange = rec.changeFromBase > 0;
                const isSignificantChange = Math.abs(rec.changeFromBase) > 10;
                
                return (
                  <div key={rec.precinct} className={`rounded-lg border p-6 transition-all hover:shadow-md ${
                    rec.riskLevel === 'critical' ? 'border-red-200 bg-red-50' :
                    rec.riskLevel === 'high' ? 'border-orange-200 bg-orange-50' :
                    rec.riskLevel === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                    'border-green-200 bg-green-50'
                  }`}>
                    {/* Header Section */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className={`p-3 rounded-lg ${
                          rec.riskLevel === 'critical' ? 'bg-red-100' :
                          rec.riskLevel === 'high' ? 'bg-orange-100' :
                          rec.riskLevel === 'medium' ? 'bg-yellow-100' :
                          'bg-green-100'
                        }`}>
                          <svg className={`w-5 h-5 ${
                            rec.riskLevel === 'critical' ? 'text-red-600' :
                            rec.riskLevel === 'high' ? 'text-orange-600' :
                            rec.riskLevel === 'medium' ? 'text-yellow-600' :
                            'text-green-600'
                          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <h4 className="text-xl font-bold text-gray-900">{rec.precinctName}</h4>
                          <div className="flex items-center space-x-3 mt-1">
                            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                              rec.riskLevel === 'critical' ? 'bg-red-100 text-red-800' :
                              rec.riskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                              rec.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {rec.riskLevel === 'critical' ? '🚨' : 
                               rec.riskLevel === 'high' ? '⚠️' : 
                               rec.riskLevel === 'medium' ? '⚡' : '✅'} 
                              {rec.riskLevel.toUpperCase()} RISK
                            </span>
                            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                              📊 {rec.predictedCases} predicted cases
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {isHighPriority && (
                        <div className="text-right">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            rec.riskLevel === 'critical' ? 'bg-red-600 text-white' : 'bg-orange-600 text-white'
                          }`}>
                            ⚡ HIGH PRIORITY
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Metrics Section */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="text-2xl font-bold text-gray-900">{rec.currentAllocation}</div>
                        <div className="text-sm text-gray-600 mt-1">Current Officers</div>
                      </div>
                      <div className="text-center p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className="text-2xl font-bold text-indigo-600">{rec.recommendedAllocation}</div>
                        <div className="text-sm text-gray-600 mt-1">AI Recommended</div>
                      </div>
                      <div className="text-center p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className={`text-2xl font-bold ${
                          isPositiveChange ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {isPositiveChange ? '+' : ''}{(rec.recommendedAllocation - rec.currentAllocation)}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">Net Change</div>
                      </div>
                      <div className="text-center p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div className={`text-2xl font-bold ${
                          rec.changeFromBase > 10 ? 'text-red-600' :
                          rec.changeFromBase < -10 ? 'text-green-600' :
                          'text-gray-600'
                        }`}>
                          {rec.changeFromBase > 0 ? '+' : ''}{rec.changeFromBase.toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-600 mt-1">Percentage Change</div>
                      </div>
                    </div>
                    
                    {/* Analysis & Justification */}
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-start">
                        <div className="p-2 bg-blue-100 rounded-lg mr-3 mt-1">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h5 className="font-semibold text-gray-900 mb-2">AI Analysis & Recommendations</h5>
                          <p className="text-sm text-gray-700 leading-relaxed">{rec.justification}</p>
                          
                          {isSignificantChange && (
                            <div className={`mt-3 p-3 rounded-lg ${
                              isPositiveChange ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
                            }`}>
                              <div className="flex items-center">
                                <svg className={`w-4 h-4 mr-2 ${
                                  isPositiveChange ? 'text-red-600' : 'text-green-600'
                                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.865-.833-2.635 0L4.178 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                <span className={`text-sm font-medium ${
                                  isPositiveChange ? 'text-red-800' : 'text-green-800'
                                }`}>
                                  {isPositiveChange 
                                    ? 'Significant staffing increase recommended - budget impact expected' 
                                    : 'Resource optimization opportunity - potential cost savings'
                                  }
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Strategic Insights & Executive Summary */}
      {manpowerRecommendations.length > 0 && (
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-5 border-b border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-slate-600 rounded-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-bold text-gray-900">Strategic Insights & Executive Summary</h3>
                <p className="text-sm text-gray-600 mt-1">Key findings and actionable recommendations for leadership</p>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Key Metrics */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Key Performance Indicators
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-2xl font-bold text-blue-600">{manpowerRecommendations.length}</div>
                    <div className="text-sm text-gray-600">Precincts Analyzed</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-2xl font-bold text-red-600">
                      {manpowerRecommendations.filter(r => r.riskLevel === 'critical' || r.riskLevel === 'high').length}
                    </div>
                    <div className="text-sm text-gray-600">High-Risk Areas</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className="text-2xl font-bold text-green-600">
                      {manpowerRecommendations.reduce((sum, r) => sum + r.predictedCases, 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Total Predicted Cases</div>
                  </div>
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <div className={`text-2xl font-bold ${
                      Math.abs(overallChange) > 15 ? 'text-red-600' :
                      Math.abs(overallChange) > 5 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {totalCurrentManpower === 0 ? 'N/A' : `${overallChange > 0 ? '+' : ''}${overallChange.toFixed(0)}%`}
                    </div>
                    <div className="text-sm text-gray-600">Resource Adjustment</div>
                  </div>
                </div>
              </div>
              
              {/* Strategic Recommendations */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Strategic Recommendations
                </h4>
                
                <div className="space-y-3">
                  {(() => {
                    const criticalAreas = manpowerRecommendations.filter(r => r.riskLevel === 'critical');
                    const highRiskAreas = manpowerRecommendations.filter(r => r.riskLevel === 'high');
                    const needsIncrease = manpowerRecommendations.filter(r => r.changeFromBase > 10);
                    const canOptimize = manpowerRecommendations.filter(r => r.changeFromBase < -10);
                    
                    const recommendations = [];
                    
                    if (criticalAreas.length > 0) {
                      recommendations.push({
                        icon: '🚨',
                        priority: 'CRITICAL',
                        color: 'red',
                        text: `Immediate attention required for ${criticalAreas.length} critical-risk ${criticalAreas.length === 1 ? 'area' : 'areas'}: ${criticalAreas.map(a => a.precinctName).join(', ')}`
                      });
                    }
                    
                    if (needsIncrease.length > 0) {
                      const totalIncrease = needsIncrease.reduce((sum, r) => sum + (r.recommendedAllocation - r.currentAllocation), 0);
                      recommendations.push({
                        icon: '📈',
                        priority: 'HIGH',
                        color: 'orange',
                        text: `Budget impact: +${totalIncrease} officers needed across ${needsIncrease.length} ${needsIncrease.length === 1 ? 'precinct' : 'precincts'} for optimal coverage`
                      });
                    }
                    
                    if (canOptimize.length > 0) {
                      const totalOptimization = Math.abs(canOptimize.reduce((sum, r) => sum + (r.recommendedAllocation - r.currentAllocation), 0));
                      recommendations.push({
                        icon: '💡',
                        priority: 'OPPORTUNITY',
                        color: 'green',
                        text: `Resource optimization: ${totalOptimization} officers can be reallocated from ${canOptimize.length} lower-risk ${canOptimize.length === 1 ? 'area' : 'areas'}`
                      });
                    }
                    
                    if (totalCurrentManpower > 0 && Math.abs(overallChange) < 5) {
                      recommendations.push({
                        icon: '✅',
                        priority: 'STABLE',
                        color: 'blue',
                        text: 'Current deployment is well-aligned with forecast patterns. Minor adjustments recommended.'
                      });
                    }
                    
                    if (recommendations.length === 0) {
                      recommendations.push({
                        icon: '📋',
                        priority: 'INFO',
                        color: 'gray',
                        text: 'Insufficient baseline data for strategic recommendations. Establish current allocation baselines first.'
                      });
                    }
                    
                    return recommendations.map((rec, index) => (
                      <div key={index} className={`p-4 rounded-lg border ${
                        rec.color === 'red' ? 'bg-red-50 border-red-200' :
                        rec.color === 'orange' ? 'bg-orange-50 border-orange-200' :
                        rec.color === 'green' ? 'bg-green-50 border-green-200' :
                        rec.color === 'blue' ? 'bg-blue-50 border-blue-200' :
                        'bg-gray-50 border-gray-200'
                      }`}>
                        <div className="flex items-start">
                          <span className="text-2xl mr-3 mt-1">{rec.icon}</span>
                          <div>
                            <div className={`text-xs font-bold mb-1 ${
                              rec.color === 'red' ? 'text-red-800' :
                              rec.color === 'orange' ? 'text-orange-800' :
                              rec.color === 'green' ? 'text-green-800' :
                              rec.color === 'blue' ? 'text-blue-800' :
                              'text-gray-800'
                            }`}>
                              {rec.priority}
                            </div>
                            <p className={`text-sm ${
                              rec.color === 'red' ? 'text-red-700' :
                              rec.color === 'orange' ? 'text-orange-700' :
                              rec.color === 'green' ? 'text-green-700' :
                              rec.color === 'blue' ? 'text-blue-700' :
                              'text-gray-700'
                            }`}>
                              {rec.text}
                            </p>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
            
            {/* Executive Action Items */}
            <div className="mt-6 p-4 bg-slate-100 rounded-lg border border-slate-200">
              <h5 className="font-semibold text-slate-900 mb-3 flex items-center">
                <svg className="w-4 h-4 mr-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h.01M9 16h.01M15 11h.01" />
                </svg>
                Next Steps for Leadership
              </h5>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-start">
                  <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-1">1</div>
                  <div>
                    <div className="font-medium text-slate-900">Review High-Priority Areas</div>
                    <div className="text-slate-600">Focus on critical and high-risk precincts requiring immediate resource adjustments</div>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-1">2</div>
                  <div>
                    <div className="font-medium text-slate-900">Budget Planning</div>
                    <div className="text-slate-600">Assess financial impact of recommended staffing changes and plan accordingly</div>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-1">3</div>
                  <div>
                    <div className="font-medium text-slate-900">Implementation Timeline</div>
                    <div className="text-slate-600">Develop phased approach for deployment changes based on urgency and resources</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shift-Based Analysis Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Shift-Based Crime Analysis
              <span className="ml-2 px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                NEW
              </span>
            </h3>
            <button
              onClick={() => setShowShiftAnalysis(!showShiftAnalysis)}
              className="text-sm text-purple-600 hover:text-purple-800 flex items-center"
            >
              {showShiftAnalysis ? 'Hide' : 'Show'} Analysis
              <svg className={`w-4 h-4 ml-1 transform transition-transform ${showShiftAnalysis ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {showShiftAnalysis && (
          <div className="p-6">
            {calculateShiftAnalysis.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No Time-of-Day Data Available</h4>
                <p className="text-gray-500">Shift analysis requires historical data with time-of-day information.</p>
                <p className="text-sm text-gray-400 mt-2">Ensure your crime data includes detailed timestamps for accurate shift-based recommendations.</p>
              </div>
            ) : (
              <>
                {/* Shift Analysis Summary */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Overall Shift Patterns ({calculateShiftAnalysis.length} precincts analyzed)
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    {['Morning', 'Afternoon', 'Night'].map(shift => {
                      const totalCrimes = calculateShiftAnalysis.reduce((sum, p) => 
                        sum + (p.shifts.find(s => s.shift === shift)?.crimeCount || 0), 0
                      );
                      const totalAllCrimes = calculateShiftAnalysis.reduce((sum, p) => sum + p.totalCrimes, 0);
                      const percentage = totalAllCrimes > 0 ? (totalCrimes / totalAllCrimes) * 100 : 0;
                      const totalOfficers = calculateShiftAnalysis.reduce((sum, p) => 
                        sum + (p.shifts.find(s => s.shift === shift)?.recommendedOfficers || 0), 0
                      );
                      
                      return (
                        <div key={shift} className={`p-4 rounded-lg border ${
                          shift === 'Morning' ? 'bg-yellow-50 border-yellow-200' :
                          shift === 'Afternoon' ? 'bg-orange-50 border-orange-200' :
                          'bg-blue-50 border-blue-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-medium text-gray-900">{shift} Shift</h5>
                              <p className="text-sm text-gray-600">
                                {shift === 'Morning' ? '6:00 AM - 2:00 PM' :
                                 shift === 'Afternoon' ? '2:00 PM - 10:00 PM' :
                                 '10:00 PM - 6:00 AM'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">{percentage.toFixed(1)}%</p>
                              <p className="text-xs text-gray-500">{totalCrimes} crimes</p>
                              <p className="text-xs font-medium text-purple-600">{totalOfficers} officers</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Detailed Precinct Shift Analysis */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Detailed Shift Breakdown by Precinct</h4>
                  <div className="space-y-4">
                    {calculateShiftAnalysis.map((precinctData) => (
                      <div key={precinctData.precinct} className="border border-gray-200 rounded-lg">
                        <div 
                          className="p-4 cursor-pointer hover:bg-gray-50"
                          onClick={() => setSelectedPrecinctForShifts(
                            selectedPrecinctForShifts === precinctData.precinct ? null : precinctData.precinct
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <div>
                                <h5 className="font-medium text-gray-900">{precinctData.precinctName}</h5>
                                <p className="text-sm text-gray-600">
                                  {precinctData.totalCrimes} total crimes • Dominant: {precinctData.dominantShift}
                                  {precinctData.coverage24h && (
                                    <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                                      24/7 Coverage Needed
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center">
                              <div className="grid grid-cols-3 gap-2 mr-4">
                                {precinctData.shifts.map(shift => (
                                  <div key={shift.shift} className="text-center">
                                    <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${
                                      shift.riskLevel === 'critical' ? 'bg-red-500' :
                                      shift.riskLevel === 'high' ? 'bg-orange-500' :
                                      shift.riskLevel === 'medium' ? 'bg-yellow-500' :
                                      'bg-green-500'
                                    }`}></div>
                                    <p className="text-xs font-medium">{shift.recommendedOfficers}</p>
                                  </div>
                                ))}
                              </div>
                              <svg className={`w-4 h-4 text-gray-400 transform transition-transform ${
                                selectedPrecinctForShifts === precinctData.precinct ? 'rotate-180' : ''
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        
                        {selectedPrecinctForShifts === precinctData.precinct && (
                          <div className="px-4 pb-4 border-t border-gray-100">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                              {precinctData.shifts.map(shift => (
                                <div key={shift.shift} className="bg-gray-50 p-3 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <h6 className="font-medium text-gray-900">{shift.shift}</h6>
                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                      shift.riskLevel === 'critical' ? 'bg-red-100 text-red-800' :
                                      shift.riskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                                      shift.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-green-100 text-green-800'
                                    }`}>
                                      {shift.riskLevel.toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Crimes:</span>
                                      <span className="font-medium">{shift.crimeCount}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Percentage:</span>
                                      <span className="font-medium">{shift.percentage.toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-600">Officers:</span>
                                      <span className="font-bold text-purple-600">{shift.recommendedOfficers}</span>
                                    </div>
                                  </div>
                                  
                                  {/* Visual bar chart */}
                                  <div className="mt-2">
                                    <div className="bg-gray-200 rounded-full h-2">
                                      <div 
                                        className={`h-2 rounded-full ${
                                          shift.riskLevel === 'critical' ? 'bg-red-500' :
                                          shift.riskLevel === 'high' ? 'bg-orange-500' :
                                          shift.riskLevel === 'medium' ? 'bg-yellow-500' :
                                          'bg-green-500'
                                        }`}
                                        style={{ width: `${Math.min(100, shift.percentage)}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* Shift Recommendations */}
                            <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                              <h6 className="font-medium text-purple-800 mb-2 flex items-center">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Shift Recommendations
                              </h6>
                              <div className="text-sm text-purple-700">
                                <p><strong>Primary Focus:</strong> {precinctData.dominantShift} shift ({precinctData.shifts.find(s => s.shift === precinctData.dominantShift)?.percentage.toFixed(1)}% of crimes)</p>
                                <p><strong>Total Officers Needed:</strong> {precinctData.shifts.reduce((sum, s) => sum + s.recommendedOfficers, 0)} across all shifts</p>
                                {precinctData.coverage24h ? (
                                  <p><strong>Coverage:</strong> 24/7 staffing recommended due to crimes in all time periods</p>
                                ) : (
                                  <p><strong>Coverage:</strong> Focus resources on active periods, minimal overnight staffing</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManpowerAllocation;
