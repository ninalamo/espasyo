'use client';

import React, { useMemo, useState } from 'react';
import { Cluster } from '../types/analysis/ClusterDto';
import { CrimeTypesDictionary, GetPrecinctsDictionary } from '../constants/consts';
import {
  buildTemporalPreprocessingData,
  MonthlyCrimeCount,
} from '../utils/temporalPreprocessing';

interface PreprocessingVisualizationProps {
  clusters: Cluster[];
}

type PreprocessingView = 'raw' | 'aggregated' | 'forecast-input';

const formatMonth = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, '0')}`;

const getPrecinctName = (precinct: number) =>
  GetPrecinctsDictionary[precinct] ?? `Precinct ${precinct}`;

const getCrimeTypeName = (crimeType: number) =>
  CrimeTypesDictionary[crimeType] ?? `Type ${crimeType}`;

const MonthlyCountsTable: React.FC<{
  rows: MonthlyCrimeCount[];
  emptyMessage: string;
}> = ({ rows, emptyMessage }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full table-auto border-collapse">
      <thead className="bg-gray-100 text-sm">
        <tr>
          <th className="px-4 py-2 border text-left">Precinct</th>
          <th className="px-4 py-2 border text-left">Crime Type</th>
          <th className="px-4 py-2 border text-left">Month</th>
          <th className="px-4 py-2 border text-right">Incident Count</th>
        </tr>
      </thead>
      <tbody>
        {rows.length > 0 ? rows.map((row) => (
          <tr
            key={`${row.precinct}-${row.crimeType}-${row.year}-${row.month}`}
            className="text-sm"
          >
            <td className="px-4 py-2 border">{getPrecinctName(row.precinct)}</td>
            <td className="px-4 py-2 border">{getCrimeTypeName(row.crimeType)}</td>
            <td className="px-4 py-2 border">{formatMonth(row.year, row.month)}</td>
            <td className="px-4 py-2 border text-right">{row.count}</td>
          </tr>
        )) : (
          <tr>
            <td colSpan={4} className="text-center py-4 text-gray-500">{emptyMessage}</td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const PreprocessingVisualization: React.FC<PreprocessingVisualizationProps> = ({ clusters }) => {
  const [view, setView] = useState<PreprocessingView>('raw');
  const data = useMemo(() => buildTemporalPreprocessingData(clusters), [clusters]);

  const timeOfDayCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    data.incidents.forEach((incident) => {
      if (incident.timeOfDay) {
        counts[incident.timeOfDay] = (counts[incident.timeOfDay] ?? 0) + 1;
      }
    });
    return Object.entries(counts).sort(([left], [right]) => left.localeCompare(right));
  }, [data.incidents]);

  const views: { id: PreprocessingView; label: string }[] = [
    { id: 'raw', label: 'Analysis Records' },
    { id: 'aggregated', label: 'Monthly Aggregation' },
    { id: 'forecast-input', label: 'Monthly Forecast Input' },
  ];

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Temporal Preprocessing</h3>
        <p className="mt-1 text-sm text-gray-600">
          The records below come from the current analysis result and match the cluster data sent
          when generating a forecast. The separately loaded full incident dataset is not used for
          this forecast preview.
        </p>
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Preprocessing views">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={view === item.id}
              onClick={() => setView(item.id)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                view === item.id
                  ? 'bg-ubuntu-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {data.invalidDateCount > 0 && (
        <p role="status" className="mx-6 mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {data.invalidDateCount} record{data.invalidDateCount === 1 ? '' : 's'} with an invalid
          year or month {data.invalidDateCount === 1 ? 'is' : 'are'} omitted from this monthly
          preview. The records remain in the analysis input and may cause the backend forecast to
          fail until corrected.
        </p>
      )}

      {view === 'raw' && (
        <>
          <div className="px-6 py-3 text-sm text-gray-500">
            {data.incidents.length} records in the current analysis clusters
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-collapse">
              <thead className="bg-gray-100 text-sm">
                <tr>
                  <th className="px-4 py-2 border text-left">Case ID</th>
                  <th className="px-4 py-2 border text-left">Year</th>
                  <th className="px-4 py-2 border text-left">Month</th>
                  <th className="px-4 py-2 border text-left">Day</th>
                  <th className="px-4 py-2 border text-left">Time of Day</th>
                  <th className="px-4 py-2 border text-left">Precinct</th>
                  <th className="px-4 py-2 border text-left">Crime Type</th>
                </tr>
              </thead>
              <tbody>
                {data.incidents.length > 0 ? data.incidents.map((incident, index) => (
                  <tr key={`${incident.caseId}-${index}`} className="text-sm">
                    <td className="px-4 py-2 border">{incident.caseId}</td>
                    <td className="px-4 py-2 border">{incident.year || 'Invalid'}</td>
                    <td className="px-4 py-2 border">{incident.month || 'Invalid'}</td>
                    <td className="px-4 py-2 border">{incident.day || '—'}</td>
                    <td className="px-4 py-2 border">{incident.timeOfDay || '—'}</td>
                    <td className="px-4 py-2 border">{getPrecinctName(incident.precinct)}</td>
                    <td className="px-4 py-2 border">{getCrimeTypeName(incident.crimeType)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-gray-500">
                      No analysis records available. Run or import an analysis first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'aggregated' && (
        <div className="p-6 space-y-6">
          <div>
            <h4 className="font-medium text-gray-800">Observed monthly counts</h4>
            <p className="mt-1 mb-3 text-sm text-gray-600">
              One incident contributes one count, grouped by calendar year-month, precinct, and
              crime type. Rows are ordered chronologically within each series.
            </p>
            <MonthlyCountsTable
              rows={data.aggregatedMonths}
              emptyMessage="No valid dated analysis records to aggregate."
            />
          </div>

          <div>
            <h4 className="font-medium text-gray-800">Supplemental time-of-day breakdown</h4>
            <p className="mt-1 mb-3 text-sm text-gray-600">
              Descriptive counts from the same analysis records; this is separate from the
              backend&apos;s monthly count series.
            </p>
            {timeOfDayCounts.length > 0 ? (
              <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 px-4">
                {timeOfDayCounts.map(([timeOfDay, count]) => (
                  <li key={timeOfDay} className="flex justify-between py-2 text-sm">
                    <span className="text-gray-600">{timeOfDay}</span>
                    <span className="font-medium">{count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No time-of-day values available.</p>
            )}
          </div>
        </div>
      )}

      {view === 'forecast-input' && (
        <>
          <div className="px-6 py-4">
            <h4 className="font-medium text-gray-800">Monthly Forecast Input Preview</h4>
            <p className="mt-1 text-sm text-gray-600">
              This model-neutral preview mirrors the backend preprocessing: monthly incident
              counts grouped by precinct and crime type, sorted by year-month, with missing months
              between each series&apos; first and last incident filled with zero. The backend,
              not this view, runs the selected forecasting model.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              {data.forecastInput.length} monthly values across {data.aggregatedMonths.length > 0
                ? new Set(data.aggregatedMonths.map(row => `${row.precinct}-${row.crimeType}`)).size
                : 0} precinct/crime-type series
            </p>
          </div>
          <MonthlyCountsTable
            rows={data.forecastInput}
            emptyMessage="No valid dated analysis records are available for the monthly forecast preview."
          />
        </>
      )}
    </section>
  );
};

export default PreprocessingVisualization;
