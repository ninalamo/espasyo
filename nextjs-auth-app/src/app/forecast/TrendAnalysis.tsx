'use client';

import { useMemo, useState } from 'react';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../../constants/consts';
import InfoBadge from '../../components/InfoBadge';
import TrendAnalysisMethodologyModal from './modals/TrendAnalysisMethodologyModal';
import type { HistoricalData, ForecastData } from '../../types/forecast/ForecastBaseTypes';

interface Props {
  historicalData: HistoricalData[];
  forecastData: ForecastData[];
}

const TrendAnalysis: React.FC<Props> = ({ historicalData, forecastData }) => {
  const [isMethodologyModalOpen, setIsMethodologyModalOpen] = useState(false);
  
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
          criticalRisk: 0
        };
      }
      
      acc[key][item.trend]++;
      acc[key].totalPredicted += item.predictedCount;
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
          count: 0
        };
      }
      
      acc[key][item.trend]++;
      acc[key].totalPredicted += item.predictedCount;
      acc[key].confidenceSum += item.confidence;
      acc[key].count++;
      acc[key].avgConfidence = acc[key].confidenceSum / acc[key].count;
      
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

    // Identify most concerning trends
    const concerningPrecincts = Object.entries(precinctTrends)
      .map(([id, data]) => ({ id: parseInt(id), ...data }))
      .filter(p => p.increasing > p.decreasing + p.stable)
      .sort((a, b) => (b.criticalRisk + b.highRisk) - (a.criticalRisk + a.highRisk))
      .slice(0, 5);

    const emergingThreats = Object.entries(crimeTypeTrends)
      .map(([id, data]) => ({ id: parseInt(id), ...data }))
      .filter(c => c.increasing > c.decreasing && c.totalPredicted > 10)
      .sort((a, b) => b.increasing - a.increasing)
      .slice(0, 5);

    // Calculate overall statistics
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
      } : null
    };

    return {
      precinctTrends: Object.entries(precinctTrends).map(([id, data]) => ({ 
        id: parseInt(id), 
        ...data 
      })),
      crimeTypeTrends: Object.entries(crimeTypeTrends).map(([id, data]) => ({ 
        id: parseInt(id), 
        ...data 
      })),
      seasonalPattern,
      concerningPrecincts,
      emergingThreats,
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

  const getTrendIcon = (increasing: number, decreasing: number, stable: number) => {
    const total = increasing + decreasing + stable;
    const upPercent = (increasing / total) * 100;
    const downPercent = (decreasing / total) * 100;

    if (upPercent > 50) {
      return <span className="text-red-500">📈</span>;
    } else if (downPercent > 50) {
      return <span className="text-green-500">📉</span>;
    } else {
      return <span className="text-yellow-500">📊</span>;
    }
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
                  <div key={precinct.id} className="bg-white p-3 rounded border">
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
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {precinct.increasing} increasing trends, {precinct.totalPredicted} total predicted cases
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Precinct Trends */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Precinct Trend Analysis
          </h3>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {analysis.precinctTrends
              .sort((a, b) => b.totalPredicted - a.totalPredicted)
              .map(precinct => (
                <div key={precinct.id} className={`p-3 rounded-lg border ${getTrendColor(precinct.increasing, precinct.decreasing, precinct.stable)}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center">
                        {getTrendIcon(precinct.increasing, precinct.decreasing, precinct.stable)}
                        <span className="font-medium ml-2">{precinct.name}</span>
                      </div>
                      <div className="text-sm mt-1">
                        <span className="text-red-600">↗ {precinct.increasing}</span>
                        <span className="text-gray-500 mx-2">•</span>
                        <span className="text-yellow-600">→ {precinct.stable}</span>
                        <span className="text-gray-500 mx-2">•</span>
                        <span className="text-green-600">↘ {precinct.decreasing}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{precinct.totalPredicted}</div>
                      <div className="text-xs text-gray-600">predicted cases</div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Crime Type Trends */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Crime Type Trends
          </h3>
          
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {analysis.crimeTypeTrends
              .sort((a, b) => b.totalPredicted - a.totalPredicted)
              .map(crime => (
                <div key={crime.id} className={`p-3 rounded-lg border ${getTrendColor(crime.increasing, crime.decreasing, crime.stable)}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center">
                        {getTrendIcon(crime.increasing, crime.decreasing, crime.stable)}
                        <span className="font-medium ml-2">{crime.name}</span>
                      </div>
                      <div className="text-sm mt-1">
                        <span className="text-red-600">↗ {crime.increasing}</span>
                        <span className="text-gray-500 mx-2">•</span>
                        <span className="text-yellow-600">→ {crime.stable}</span>
                        <span className="text-gray-500 mx-2">•</span>
                        <span className="text-green-600">↘ {crime.decreasing}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{crime.totalPredicted}</div>
                      <div className="text-xs text-gray-600">
                        {(crime.avgConfidence * 100).toFixed(0)}% confidence
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
                  <div className="mb-1">{threat.increasing} increasing trends</div>
                  <div className="mb-1">{threat.totalPredicted} predicted cases</div>
                  <div className="text-xs">{(threat.avgConfidence * 100).toFixed(0)}% confidence</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Methodology and Data Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <div>
              <h4 className="font-medium text-blue-800">Understanding the Analysis</h4>
              <p className="text-sm text-blue-600 mt-1">
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
