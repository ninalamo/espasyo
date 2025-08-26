'use client';

import { useMemo } from 'react';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../../constants/consts';

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
  forecastData: ForecastData[];
}

const RiskHeatmap: React.FC<Props> = ({ forecastData }) => {
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
          totalRisk: 0,
          count: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          predictedCases: 0
        };
      }
      
      const risk = acc[precinctKey][timeKey];
      risk.predictedCases += item.predictedCount;
      risk.count++;
      
      // Convert risk level to numeric value
      const riskValues = { low: 1, medium: 2, high: 3, critical: 4 };
      risk.totalRisk += riskValues[item.riskLevel];
      
      // Count by risk level
      risk[`${item.riskLevel}Count`]++;
      
      return acc;
    }, {} as Record<number, Record<string, any>>);

    // Get unique time periods and sort them
    const timePeriods = Array.from(
      new Set(forecastData.map(item => `${item.year}-${String(item.month).padStart(2, '0')}`))
    ).sort();

    // Get precincts and sort by total risk
    const precincts = Object.keys(riskMatrix)
      .map(Number)
      .map(precinctId => {
        const totalRisk = Object.values(riskMatrix[precinctId])
          .reduce((sum: number, period: any) => sum + (period.totalRisk / period.count), 0);
        return {
          id: precinctId,
          name: GetPrecinctsDictionary[precinctId] || `Precinct ${precinctId}`,
          avgRisk: totalRisk / timePeriods.length
        };
      })
      .sort((a, b) => b.avgRisk - a.avgRisk);

    // Create crime type risk aggregation
    const crimeTypeRisk = forecastData.reduce((acc, item) => {
      const key = item.crimeType;
      if (!acc[key]) {
        acc[key] = {
          name: CrimeTypesDictionary[key] || `Crime Type ${key}`,
          totalPredicted: 0,
          avgRisk: 0,
          riskSum: 0,
          count: 0,
          criticalCount: 0,
          highCount: 0
        };
      }
      
      const riskValues = { low: 1, medium: 2, high: 3, critical: 4 };
      acc[key].totalPredicted += item.predictedCount;
      acc[key].riskSum += riskValues[item.riskLevel];
      acc[key].count++;
      acc[key].avgRisk = acc[key].riskSum / acc[key].count;
      
      if (item.riskLevel === 'critical') acc[key].criticalCount++;
      if (item.riskLevel === 'high') acc[key].highCount++;
      
      return acc;
    }, {} as Record<number, any>);

    const sortedCrimeTypes = Object.entries(crimeTypeRisk)
      .map(([id, data]) => ({ id: parseInt(id), ...data }))
      .sort((a, b) => b.avgRisk - a.avgRisk);

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

  const getRiskColor = (avgRisk: number) => {
    if (avgRisk >= 3.5) return 'bg-red-600';
    if (avgRisk >= 2.5) return 'bg-red-400';
    if (avgRisk >= 1.5) return 'bg-yellow-400';
    return 'bg-green-400';
  };

  const getRiskLabel = (avgRisk: number) => {
    if (avgRisk >= 3.5) return 'Critical';
    if (avgRisk >= 2.5) return 'High';
    if (avgRisk >= 1.5) return 'Medium';
    return 'Low';
  };

  const formatPeriod = (period: string) => {
    const [year, month] = period.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-800 mb-2">Risk Assessment Heatmap</h3>
        <p className="text-sm text-gray-600">
          This visualization shows predicted risk levels across precincts and time periods. 
          Darker colors indicate higher predicted risk levels.
        </p>
      </div>

      {/* Risk Matrix Heatmap */}
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
                  const avgRisk = cellData ? cellData.totalRisk / cellData.count : 0;
                  
                  return (
                    <div
                      key={period}
                      className={`w-24 h-10 m-0.5 rounded flex items-center justify-center text-xs font-semibold text-white cursor-pointer transition-all hover:scale-105 ${getRiskColor(avgRisk)}`}
                      title={`${precinct.name} - ${formatPeriod(period)}\nRisk: ${getRiskLabel(avgRisk)}\nPredicted Cases: ${cellData?.predictedCases || 0}`}
                    >
                      {cellData?.predictedCases || 0}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Risk Level:</span>
            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-400 rounded mr-1"></div>
                <span className="text-xs">Low</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-yellow-400 rounded mr-1"></div>
                <span className="text-xs">Medium</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-red-400 rounded mr-1"></div>
                <span className="text-xs">High</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-red-600 rounded mr-1"></div>
                <span className="text-xs">Critical</span>
              </div>
            </div>
          </div>
          <span className="text-xs text-gray-500">Numbers show predicted case count</span>
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
                <span className={`px-2 py-1 rounded text-xs font-semibold text-white ${getRiskColor(crime.avgRisk)}`}>
                  {getRiskLabel(crime.avgRisk)}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Predicted Cases:</span>
                  <span className="font-semibold">{crime.totalPredicted}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Risk Score:</span>
                  <span className="font-semibold">{crime.avgRisk.toFixed(1)}/4.0</span>
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
                    className={`h-2 rounded-full ${getRiskColor(crime.avgRisk)}`}
                    style={{ width: `${(crime.avgRisk / 4) * 100}%` }}
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

      {/* Warning Message */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.865-.833-2.635 0L4.178 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="font-medium text-yellow-800 mb-1">Risk Assessment Disclaimer</p>
            <p className="text-sm text-yellow-700">
              These risk assessments are based on predictive modeling and should be used as guidance for resource planning and prevention strategies. 
              Actual crime patterns may vary due to external factors not captured in the model. 
              Regular reassessment and validation against actual outcomes is recommended.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskHeatmap;
