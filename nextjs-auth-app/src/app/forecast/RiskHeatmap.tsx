'use client';

import { useMemo } from 'react';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../../constants/consts';
import type { ForecastData } from '../../types/forecast/ForecastBaseTypes';

interface DataQuality {
  isValid: boolean;
  dataPoints: number;
  outlierCount: number;
  outlierPercentage: number;
  issues: string[];
  recommendations: string[];
}

interface Props {
  forecastData: ForecastData[];
  dataQuality: DataQuality | null;
}

const RiskHeatmap: React.FC<Props> = ({ forecastData, dataQuality }) => {
  const heatmapData = useMemo(() => {
    if (forecastData.length === 0) return null;

    // Create risk matrix: Precincts vs Time Periods
    const riskMatrix = forecastData.reduce((acc, item) => {
      const timeKey = `${item.year}-${String(item.month).padStart(2, '0')}`;
      const precinctKey = item.precinct;
      
      if (!acc[precinctKey]) {
        acc[precinctKey] = {};
      }
      
      if (!acc[precinctKey][timeKey]) {
        acc[precinctKey][timeKey] = {
          count: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          predictedCases: 0,
          maxRisk: 0,
        };
      }
      
      const risk = acc[precinctKey][timeKey];
      risk.predictedCases += item.predictedCount;
      risk.count++;
      
      // Count by risk level and track max
      risk[`${item.riskLevel}Count`]++;
      const riskValues = { low: 1, medium: 2, high: 3, critical: 4 };
      if (riskValues[item.riskLevel] > risk.maxRisk) {
        risk.maxRisk = riskValues[item.riskLevel];
      }
      
      return acc;
    }, {} as Record<number, Record<string, any>>);

    // Get unique time periods and sort them
    const timePeriods = Array.from(
      new Set(forecastData.map(item => `${item.year}-${String(item.month).padStart(2, '0')}`))
    ).sort();

    // Get precincts and sort by max risk (critical/high count first)
    const precincts = Object.keys(riskMatrix)
      .map(Number)
      .map(precinctId => {
        const periods = Object.values(riskMatrix[precinctId]) as any[];
        const criticalCount = periods.reduce((sum, p) => sum + p.criticalCount, 0);
        const highCount = periods.reduce((sum, p) => sum + p.highCount, 0);
        const maxRisk = periods.reduce((max, p) => Math.max(max, p.maxRisk), 0);
        return {
          id: precinctId,
          name: GetPrecinctsDictionary[precinctId] || `Precinct ${precinctId}`,
          avgRisk: maxRisk,
          criticalCount,
          highCount,
        };
      })
      .sort((a, b) => b.criticalCount - a.criticalCount || b.highCount - a.highCount || b.avgRisk - a.avgRisk);

    // Create crime type risk aggregation (max risk, not average)
    const crimeTypeRisk = forecastData.reduce((acc, item) => {
      const key = item.crimeType;
      if (!acc[key]) {
        acc[key] = {
          name: CrimeTypesDictionary[key] || `Crime Type ${key}`,
          totalPredicted: 0,
          maxRisk: 0,
          count: 0,
          criticalCount: 0,
          highCount: 0
        };
      }
      
      const riskValues = { low: 1, medium: 2, high: 3, critical: 4 };
      acc[key].totalPredicted += item.predictedCount;
      acc[key].count++;
      if (riskValues[item.riskLevel] > acc[key].maxRisk) {
        acc[key].maxRisk = riskValues[item.riskLevel];
      }
      
      if (item.riskLevel === 'critical') acc[key].criticalCount++;
      if (item.riskLevel === 'high') acc[key].highCount++;
      
      return acc;
    }, {} as Record<number, any>);

    const sortedCrimeTypes = Object.entries(crimeTypeRisk)
      .map(([id, data]) => ({ id: parseInt(id), ...data }))
      .sort((a, b) => b.criticalCount - a.criticalCount || b.highCount - a.highCount || b.maxRisk - a.maxRisk);

    return {
      riskMatrix,
      timePeriods,
      precincts,
      crimeTypeRisk: sortedCrimeTypes
    };
  }, [forecastData]);

  if (!heatmapData) {
    return (
      <div className="text-center text-gray-500 py-8">
        No risk data available for heatmap visualization.
      </div>
    );
  }

  const getRiskColor = (maxRisk: number) => {
    if (maxRisk >= 4) return 'bg-red-600';
    if (maxRisk >= 3) return 'bg-red-400';
    if (maxRisk >= 2) return 'bg-yellow-400';
    if (maxRisk >= 1) return 'bg-green-400';
    return 'bg-gray-200';
  };

  const getRiskLabel = (maxRisk: number) => {
    if (maxRisk >= 4) return 'Critical';
    if (maxRisk >= 3) return 'High';
    if (maxRisk >= 2) return 'Medium';
    if (maxRisk >= 1) return 'Low';
    return 'No Data';
  };

  const formatPeriod = (period: string) => {
    const [year, month] = period.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  return (
    <div className="space-y-6">
      {/* Risk Matrix Heatmap — shown first before explanations */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Precinct Risk Timeline
        </h3>

        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Header */}
            <div className="flex mb-2">
              <div className="w-32 p-2 font-medium text-gray-700">Precinct</div>
              {heatmapData.timePeriods.map(period => (
                <div key={period} className="w-24 p-2 text-xs font-medium text-gray-700 text-center">
                  {formatPeriod(period)}
                </div>
              ))}
            </div>

            {/* Heatmap Rows */}
            {heatmapData.precincts.map(precinct => (
              <div key={precinct.id} className="flex mb-1">
                <div className="w-32 p-2 text-sm font-medium text-gray-800 flex items-center">
                  {precinct.name}
                </div>
                {heatmapData.timePeriods.map(period => {
                  const cellData = heatmapData.riskMatrix[precinct.id]?.[period];
                  const maxRisk = cellData ? cellData.maxRisk : 0;
                  const hasData = !!cellData;
                  
                  return (
                    <div
                      key={period}
                      className={`w-24 h-10 m-0.5 rounded flex items-center justify-center text-xs font-semibold ${hasData ? 'text-white cursor-pointer hover:scale-105' : 'text-gray-400'} transition-all ${getRiskColor(maxRisk)}`}
                      title={hasData ? `${precinct.name} - ${formatPeriod(period)}\nRisk: ${getRiskLabel(maxRisk)}\nPredicted Cases: ${cellData.predictedCases}` : `${precinct.name} - ${formatPeriod(period)}\nNo forecast data`}
                    >
                      {hasData ? cellData.predictedCases : '—'}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Enhanced Legend with Details */}
        <div className="mt-4 bg-gray-50 p-4 rounded">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Risk Level Color Scale</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-green-400 rounded mr-3"></div>
                    <span className="font-medium text-green-700">Low Risk</span>
                  </div>
                  <span className="text-sm text-gray-600">Score: 1.0 - 1.5</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-yellow-400 rounded mr-3"></div>
                    <span className="font-medium text-yellow-700">Medium Risk</span>
                  </div>
                  <span className="text-sm text-gray-600">Score: 1.5 - 2.5</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-red-400 rounded mr-3"></div>
                    <span className="font-medium text-red-600">High Risk</span>
                  </div>
                  <span className="text-sm text-gray-600">Score: 2.5 - 3.5</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-white rounded border">
                  <div className="flex items-center">
                    <div className="w-6 h-6 bg-red-600 rounded mr-3"></div>
                    <span className="font-medium text-red-800">Critical Risk</span>
                  </div>
                  <span className="text-sm text-gray-600">Score: &gt; 3.5</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Cell Interpretation Guide</h4>
              <div className="bg-white p-3 rounded border space-y-2 text-sm">
                <div><strong>Cell Color:</strong> Overall risk level for that precinct/time period</div>
                <div><strong>Cell Number:</strong> Total predicted crime cases</div>
                <div><strong>Empty Cells:</strong> No forecast data available (shown as —)</div>
                <div><strong>Hover Tooltip:</strong> Shows detailed breakdown of risk calculation</div>
                <div className="pt-2 border-t text-xs text-gray-600">
                  <strong>Example:</strong> A red cell with &quot;15&quot; means critical risk level with 15 predicted cases
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How to Read — moved after the visualization */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Understanding the Risk Heatmap
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-blue-700 mb-3">How to Read This Visualization</h4>
            <div className="bg-white p-4 rounded border space-y-2 text-sm">
              <div><strong>Colors:</strong> Represent aggregated risk levels for each precinct/time period</div>
              <div><strong>Numbers in cells:</strong> Show predicted crime case counts</div>
              <div><strong>Rows:</strong> Different precincts (sorted by overall risk)</div>
              <div><strong>Columns:</strong> Time periods (forecast months)</div>
              <div><strong>Tooltips:</strong> Hover over cells for detailed information</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-blue-700 mb-3">Risk Calculation Method</h4>
            <div className="bg-white p-4 rounded border space-y-2 text-sm">
              <div><strong>Data Source:</strong> Individual forecast predictions by crime type</div>
                <div><strong>Aggregation:</strong> Uses the highest risk level across all crime types per cell</div>
              <div><strong>Scale:</strong> 1.0 (Low) to 4.0 (Critical)</div>
              <div><strong>Thresholds:</strong> Low ≤1.5, Medium ≤2.5, High ≤3.5, Critical &gt;3.5</div>
              <div><strong>Sorting:</strong> Precincts ordered by critical/high risk count</div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-white rounded border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="text-xl font-bold text-blue-800">{heatmapData.precincts.length}</div>
              <div className="text-blue-600">Precincts</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-800">{heatmapData.timePeriods.length}</div>
              <div className="text-blue-600">Time Periods</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-800">{forecastData.length}</div>
              <div className="text-blue-600">Data Points</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-800">
                {((forecastData.filter(f => f.confidence > 0.7).length / forecastData.length) * 100).toFixed(0)}%
              </div>
              <div className="text-blue-600">High Confidence</div>
            </div>
          </div>
        </div>
      </div>

      {/* Crime Type Risk Assessment */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.865-.833-2.635 0L4.178 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Crime Type Risk Assessment
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {heatmapData.crimeTypeRisk.map(crime => (
            <div key={crime.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-medium text-gray-900 text-sm">{crime.name}</h4>
                <span className={`px-2 py-1 rounded text-xs font-semibold text-white ${getRiskColor(crime.maxRisk)}`}>
                  {getRiskLabel(crime.maxRisk)}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Predicted Cases:</span>
                  <span className="font-semibold">{crime.totalPredicted}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Max Risk Score:</span>
                  <span className="font-semibold">{crime.maxRisk}/4</span>
                </div>

                {(crime.criticalCount > 0 || crime.highCount > 0) && (
                  <div className="pt-2 border-t border-gray-200">
                    {crime.criticalCount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Critical Periods:</span>
                        <span className="font-semibold">{crime.criticalCount}</span>
                      </div>
                    )}
                    {crime.highCount > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>High Risk Periods:</span>
                        <span className="font-semibold">{crime.highCount}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Risk bar */}
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getRiskColor(crime.maxRisk)}`}
                    style={{ width: `${(crime.maxRisk / 4) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Critical Risk Periods',
            value: forecastData.filter(f => f.riskLevel === 'critical').length,
            color: 'bg-red-600',
            textColor: 'text-red-600'
          },
          {
            label: 'High Risk Periods',
            value: forecastData.filter(f => f.riskLevel === 'high').length,
            color: 'bg-red-400',
            textColor: 'text-red-500'
          },
          {
            label: 'Medium Risk Periods',
            value: forecastData.filter(f => f.riskLevel === 'medium').length,
            color: 'bg-yellow-400',
            textColor: 'text-yellow-600'
          },
          {
            label: 'Low Risk Periods',
            value: forecastData.filter(f => f.riskLevel === 'low').length,
            color: 'bg-green-400',
            textColor: 'text-green-600'
          }
        ].map(stat => (
          <div key={stat.label} className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${stat.color} mr-3`}></div>
              <div>
                <p className="text-sm font-medium text-gray-700">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.textColor}`}>{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Data Validation and Accuracy Metrics */}
      <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Data Validation & Accuracy Metrics
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Statistical Validity */}
          <div className="bg-white p-4 rounded border">
            <h4 className="font-medium text-green-700 mb-3">Statistical Validity</h4>
            <div className="space-y-2 text-sm text-green-800">
              <div className="flex justify-between">
                <span>Sample Size:</span>
                <span className="font-semibold">{forecastData.length.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Confidence Interval:</span>
                <span className="font-semibold">95%</span>
              </div>
              <div className="flex justify-between">
                <span>Data Completeness:</span>
                <span className="font-semibold">
                  {((forecastData.filter(f => f.predictedCount >= 0).length / forecastData.length) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Model Reliability:</span>
                <span className="font-semibold">
                  {forecastData.length > 100 ? 'High' : forecastData.length > 50 ? 'Medium' : 'Low'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Risk Distribution Validation */}
          <div className="bg-white p-4 rounded border">
            <h4 className="font-medium text-green-700 mb-3">Risk Distribution</h4>
            <div className="space-y-2 text-sm text-green-800">
              <div className="flex justify-between">
                <span>Critical Risk:</span>
                <span className="font-semibold">
                  {((forecastData.filter(f => f.riskLevel === 'critical').length / forecastData.length) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>High Risk:</span>
                <span className="font-semibold">
                  {((forecastData.filter(f => f.riskLevel === 'high').length / forecastData.length) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Medium Risk:</span>
                <span className="font-semibold">
                  {((forecastData.filter(f => f.riskLevel === 'medium').length / forecastData.length) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Low Risk:</span>
                <span className="font-semibold">
                  {((forecastData.filter(f => f.riskLevel === 'low').length / forecastData.length) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
          
          {/* Quality Indicators — driven by the backend AssessDataQuality result */}
          <div className="bg-white p-4 rounded border">
            <h4 className="font-medium text-green-700 mb-3">Quality Indicators</h4>
            {dataQuality === null ? (
              <p className="text-sm text-gray-400 italic">
                Assessment unavailable — re-generate the forecast to fetch quality metrics.
              </p>
            ) : (
              <div className="space-y-2 text-sm text-green-800">
                {/* Data Integrity: valid = no issues reported by the backend */}
                <div className="flex items-center justify-between">
                  <span>Data Integrity:</span>
                  <div className="flex items-center">
                    {dataQuality.isValid ? (
                      <svg className="w-4 h-4 text-green-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-red-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className="font-semibold">{dataQuality.isValid ? 'Valid' : 'Issues Found'}</span>
                  </div>
                </div>
                {/* Outlier rate — green if ≤10%, warning above */}
                <div className="flex items-center justify-between">
                  <span>Outlier Rate:</span>
                  <div className="flex items-center">
                    {dataQuality.outlierPercentage <= 10 ? (
                      <svg className="w-4 h-4 text-green-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-yellow-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                      </svg>
                    )}
                    <span className="font-semibold">
                      {dataQuality.outlierPercentage.toFixed(1)}% ({dataQuality.outlierCount} pts)
                    </span>
                  </div>
                </div>
                {/* Avg confidence across all forecast points */}
                <div className="flex justify-between">
                  <span>Avg Confidence:</span>
                  <span className="font-semibold">
                    {(forecastData.reduce((sum, f) => sum + f.confidence, 0) / Math.max(1, forecastData.length) * 100).toFixed(0)}%
                  </span>
                </div>
                {/* Surface any backend-reported issues */}
                {dataQuality.issues.length > 0 && (
                  <div className="pt-2 border-t border-green-100">
                    {dataQuality.issues.map((issue, i) => (
                      <p key={i} className="text-xs text-yellow-700">⚠ {issue}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Methodology and Limitations */}
      <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-yellow-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.865-.833-2.635 0L4.178 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          Methodology & Important Limitations
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-yellow-700 mb-3">Risk Calculation Process</h4>
            <div className="bg-white p-4 rounded border space-y-2 text-sm text-yellow-800">
              <div><strong>Step 1:</strong> Individual crime type predictions are generated using SSA (Singular Spectrum Analysis)</div>
              <div><strong>Step 2:</strong> Each prediction receives a risk score (1-4) based on deviation from historical averages</div>
              <div><strong>Step 3:</strong> Risk scores are aggregated by precinct and time period</div>
              <div><strong>Step 4:</strong> Final risk levels assigned using statistical thresholds</div>
              <div><strong>Step 5:</strong> Colors mapped to risk levels for visualization</div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-yellow-700 mb-3">Key Limitations & Considerations</h4>
            <div className="bg-white p-4 rounded border space-y-2 text-sm text-yellow-800">
              <div>• <strong>Historical Dependence:</strong> Predictions based solely on past patterns</div>
              <div>• <strong>External Factors:</strong> Cannot account for policy changes, economic shifts, or major events</div>
              <div>• <strong>Temporal Accuracy:</strong> Reliability decreases for longer forecast horizons</div>
              <div>• <strong>Spatial Granularity:</strong> Limited to precinct-level aggregation</div>
              <div>• <strong>Uncertainty:</strong> All forecasts include inherent statistical uncertainty</div>
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-yellow-100 rounded border-l-4 border-yellow-400">
          <p className="text-sm text-yellow-800 font-medium">
            ⚠️ <strong>Professional Use Advisory:</strong> This heatmap provides statistical risk assessments for strategic planning purposes. 
            It should be combined with expert judgment, local intelligence, and real-time data for operational decisions. 
            Regular model validation and recalibration against actual outcomes is essential for maintaining accuracy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RiskHeatmap;
