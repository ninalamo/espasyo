'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';
import type { ForecastData } from '../../types/forecast/ForecastBaseTypes';
import {
  SingleModelRun,
  EnsembleSummary,
  ModelName,
  MODEL_LABELS,
  MODEL_COLORS
} from '../../types/forecast/EnsembleTypes';

interface EnsembleViewProps {
  modelRuns: SingleModelRun[];
  ensembleSummary: EnsembleSummary;
}

const ModelBadge: React.FC<{ name: ModelName; rate: number; color: string }> = ({ name, rate, color }) => {
  const pct = (rate * 100).toFixed(0);
  return (
    <div className="flex items-center justify-between p-2 bg-white rounded border text-sm">
      <div className="flex items-center">
        <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: color }} />
        <span className="font-medium">{MODEL_LABELS[name]}</span>
      </div>
      <span className="text-xs font-semibold" style={{ color }}>
        {pct}% agreement
      </span>
    </div>
  );
};

const formatMonth = (year: number, month: number): string => {
  return format(new Date(year, month - 1), 'MMM yyyy');
};

const EnsembleView: React.FC<EnsembleViewProps> = ({ modelRuns, ensembleSummary }) => {
  const { months, modelAgreementRates, overallAgreement, modelRunLabels } = ensembleSummary;

  const modelNames = useMemo(() => {
    return modelRuns.map(r => r.modelName);
  }, [modelRuns]);

  const monthAggregates = useMemo(() => {
    return months.map(m => {
      const modelTotals: Record<string, number> = {};
      m.modelResults.forEach(r => {
        modelTotals[r.modelName] = r.predictedCount;
      });
      return {
        ...m,
        modelTotals,
      };
    });
  }, [months]);

  const overallMin = useMemo(() => {
    if (monthAggregates.length === 0) return 0;
    return Math.min(...monthAggregates.map(m => m.ensembleMin));
  }, [monthAggregates]);

  const overallMax = useMemo(() => {
    if (monthAggregates.length === 0) return 1;
    return Math.max(...monthAggregates.map(m => m.ensembleMax));
  }, [monthAggregates]);

  const getDeviationColor = (value: number, avg: number) => {
    if (avg === 0) return 'bg-gray-100 text-gray-600';
    const ratio = value / avg;
    if (ratio > 1.2) return 'bg-red-100 text-red-800';
    if (ratio > 1.05) return 'bg-orange-100 text-orange-800';
    if (ratio < 0.8) return 'bg-blue-100 text-blue-800';
    if (ratio < 0.95) return 'bg-teal-100 text-teal-800';
    return 'bg-green-100 text-green-800';
  };

  const getAgreementColor = (score: number) => {
    if (score >= 0.75) return 'text-green-600';
    if (score >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRiskBadge = (risk: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800',
    };
    return colors[risk] || 'bg-gray-100 text-gray-800';
  };

  if (modelRuns.length === 0 || months.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No ensemble data available. Generate a forecast first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <div>
            <h3 className="font-semibold text-indigo-800">Ensemble Forecast View</h3>
            <p className="text-sm text-indigo-600">
              All 4 models run simultaneously. Colors show how each model deviates from the consensus average.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50">
                Month
              </th>
              {modelNames.map(name => (
                <th key={name} className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: MODEL_COLORS[name] }}>
                  <div className="flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: MODEL_COLORS[name] }} />
                    {MODEL_LABELS[name].split(' ')[0]}
                  </div>
                  <div className="text-[10px] font-normal text-gray-500 mt-0.5">
                    {modelRunLabels[name]?.split(' ').slice(1).join(' ')}
                  </div>
                </th>
              ))}
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider bg-indigo-50">
                Ensemble Avg
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider bg-blue-50">
                Range
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider bg-purple-50">
                Agreement
              </th>
              <th className="px-3 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider bg-gray-100">
                Cons. Trend
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {monthAggregates.map(m => (
              <tr key={`${m.year}-${m.month}`} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap sticky left-0 bg-white">
                  {formatMonth(m.year, m.month)}
                </td>
                {modelNames.map(name => {
                  const value = m.modelTotals[name] || 0;
                  return (
                    <td key={name} className={`px-3 py-3 text-center font-mono text-xs ${getDeviationColor(value, m.ensembleAvg)}`}>
                      {value.toLocaleString()}
                    </td>
                  );
                })}
                <td className="px-3 py-3 text-center font-mono text-xs font-bold text-indigo-800 bg-indigo-50">
                  {Math.round(m.ensembleAvg).toLocaleString()}
                </td>
                <td className="px-3 py-3 text-center font-mono text-xs text-gray-600 bg-blue-50">
                  {Math.round(m.ensembleMin).toLocaleString()} – {Math.round(m.ensembleMax).toLocaleString()}
                </td>
                <td className={`px-3 py-3 text-center font-mono text-xs font-semibold bg-purple-50 ${getAgreementColor(m.agreementScore)}`}>
                  {(m.agreementScore * 100).toFixed(0)}%
                </td>
                <td className="px-3 py-3 text-center bg-gray-100">
                  <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${m.dominantTrend === 'increasing' ? 'bg-red-100 text-red-700' : m.dominantTrend === 'decreasing' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {m.dominantTrend === 'increasing' ? '↗' : m.dominantTrend === 'decreasing' ? '↘' : '→'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="font-medium text-gray-800 mb-3 flex items-center">
            <svg className="w-4 h-4 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Model Agreement Rates
          </h4>
          <div className="space-y-2">
            {modelNames.map(name => (
              <ModelBadge
                key={name}
                name={name}
                rate={modelAgreementRates[name] || 0}
                color={MODEL_COLORS[name]}
              />
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">Overall Model Agreement:</span>
              <span className={`font-bold text-lg ${getAgreementColor(overallAgreement)}`}>
                {(overallAgreement * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="font-medium text-gray-800 mb-3 flex items-center">
            <svg className="w-4 h-4 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How to Read the Heat Grid
          </h4>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded mr-2" />
              <span>Within 5% of ensemble average (high consensus)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-orange-100 border border-orange-300 rounded mr-2" />
              <span>5–20% above ensemble average (model predicts higher)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-100 border border-red-300 rounded mr-2" />
              <span>20%+ above ensemble average (model outlier)</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-teal-100 border border-teal-300 rounded mr-2" />
              <span>Below ensemble average (model predicts lower)</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-200 text-sm text-gray-600">
            <p><strong>Agreement score</strong> measures how many models agree on the trend direction (increasing/decreasing/stable) for each month. Higher = more reliable.</p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.865-.833-2.635 0L4.178 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="font-medium text-yellow-800 mb-1">Interpretation Guide</p>
            <p className="text-sm text-yellow-700">
              <strong>High agreement (75%+)</strong> = all models converge on the same trend direction, increasing confidence in the forecast.
              <strong> Low agreement (&lt;50%)</strong> = models disagree, suggesting uncertainty. Use the range column to understand the spread.
              The ensemble average is most reliable when agreement is high.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnsembleView;
