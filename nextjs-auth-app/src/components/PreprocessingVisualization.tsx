'use client';

import React, { useMemo, useState } from 'react';
import { Cluster } from '../types/analysis/ClusterDto';
import { CrimeTypesDictionary, GetPrecinctsDictionary } from '../constants/consts';
import {
  buildTemporalPreprocessingData,
  MonthlyCrimeCount,
} from '../utils/temporalPreprocessing';

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const ALL_TIMES = ['Morning', 'Afternoon', 'Evening'] as const;

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
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'' | typeof ALL_TIMES[number]>('');
  const [monthFilter, setMonthFilter] = useState<number[]>([]);
  const [yearFilter, setYearFilter] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const data = useMemo(() => buildTemporalPreprocessingData(clusters), [clusters]);

  const allMonths = useMemo(
    () => Array.from(new Set(data.incidents.map(incident => incident.month))).sort((a, b) => a - b),
    [data.incidents]
  );
  const allYears = useMemo(
    () => Array.from(new Set(data.incidents.map(incident => incident.year))).sort((a, b) => a - b),
    [data.incidents]
  );
  const filteredIncidents = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase();
    return data.incidents.filter(incident => {
      if (timeFilter && incident.timeOfDay !== timeFilter) return false;
      if (monthFilter.length > 0 && !monthFilter.includes(incident.month)) return false;
      if (yearFilter.length > 0 && !yearFilter.includes(incident.year)) return false;
      if (!term) return true;

      return incident.caseId.toLocaleLowerCase().includes(term)
        || getPrecinctName(incident.precinct).toLocaleLowerCase().includes(term)
        || getCrimeTypeName(incident.crimeType).toLocaleLowerCase().includes(term);
    });
  }, [data.incidents, monthFilter, searchTerm, timeFilter, yearFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredIncidents.length / pageSize));
  const currentPageRows = useMemo(() => {
    const safePage = Math.min(currentPage, pageCount);
    const start = (safePage - 1) * pageSize;
    return filteredIncidents.slice(start, start + pageSize);
  }, [currentPage, filteredIncidents, pageCount, pageSize]);

  const toggleMonth = (month: number) => {
    setMonthFilter(current => current.includes(month)
      ? current.filter(value => value !== month)
      : [...current, month]);
    setCurrentPage(1);
  };

  const toggleYear = (year: number) => {
    setYearFilter(current => current.includes(year)
      ? current.filter(value => value !== year)
      : [...current, year]);
    setCurrentPage(1);
  };

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

  const exportAnalysisRecords = () => {
    const escapeCsv = (value: string | number) => {
      const text = String(value);
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const headers = ['Case ID', 'Year', 'Month', 'Day', 'Time of Day', 'Precinct', 'Crime Type'];
    const rows = filteredIncidents.map((incident) => [
      incident.caseId,
      incident.year || 'Invalid',
      incident.month || 'Invalid',
      incident.day || '—',
      incident.timeOfDay || '—',
      getPrecinctName(incident.precinct),
      getCrimeTypeName(incident.crimeType),
    ].map(escapeCsv).join(','));
    const blob = new Blob([[headers.join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis-records-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3">
            <p className="text-sm text-gray-500">
              Showing {filteredIncidents.length} of {data.incidents.length} analysis records
            </p>
            <button
              type="button"
              onClick={exportAnalysisRecords}
              disabled={filteredIncidents.length === 0}
              className="rounded-md bg-ubuntu-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-ubuntu-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Export filtered records as CSV
            </button>
          </div>
          <div className="mx-6 mb-4 space-y-4 rounded-md border border-gray-200 p-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex-1">
                <label htmlFor="analysis-record-search" className="mb-1 block text-sm font-medium">Search</label>
                <input
                  id="analysis-record-search"
                  type="search"
                  value={searchTerm}
                  onChange={event => {
                    setSearchTerm(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Case ID, precinct, or crime type"
                  className="w-full rounded border px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:w-56">
                <label htmlFor="analysis-record-time-filter" className="mb-1 block text-sm font-medium">Time of Day</label>
                <select
                  id="analysis-record-time-filter"
                  value={timeFilter}
                  onChange={event => {
                    setTimeFilter(event.target.value as '' | typeof ALL_TIMES[number]);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded border px-3 py-2 text-sm"
                >
                  <option value="">All times</option>
                  {ALL_TIMES.map(time => <option key={time} value={time}>{time}</option>)}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <fieldset>
                <legend className="mb-1 text-sm font-medium">Filter by Month</legend>
                <div className="flex flex-wrap gap-1">
                  {allMonths.map(month => (
                    <button
                      key={month}
                      type="button"
                      aria-pressed={monthFilter.includes(month)}
                      onClick={() => toggleMonth(month)}
                      className={`rounded border px-2 py-1 text-sm ${monthFilter.includes(month) ? 'bg-ubuntu-500 text-white' : 'bg-white'}`}
                    >
                      {month}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-1 text-sm font-medium">Filter by Year</legend>
                <div className="flex flex-wrap gap-1">
                  {allYears.map(year => (
                    <button
                      key={year}
                      type="button"
                      aria-pressed={yearFilter.includes(year)}
                      onClick={() => toggleYear(year)}
                      className={`rounded border px-2 py-1 text-sm ${yearFilter.includes(year) ? 'bg-ubuntu-500 text-white' : 'bg-white'}`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
            {(searchTerm || timeFilter || monthFilter.length > 0 || yearFilter.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setTimeFilter('');
                  setMonthFilter([]);
                  setYearFilter([]);
                  setCurrentPage(1);
                }}
                className="text-sm font-medium text-ubuntu-700 hover:text-ubuntu-900"
              >
                Clear filters
              </button>
            )}
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
                {currentPageRows.length > 0 ? currentPageRows.map((incident, index) => (
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
                      {data.incidents.length === 0
                        ? 'No analysis records available. Run or import an analysis first.'
                        : 'No records match the current search and filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 px-6 py-4">
            <label htmlFor="analysis-record-page-size" className="text-sm">Rows per page</label>
            <select
              id="analysis-record-page-size"
              value={pageSize}
              onChange={event => {
                setPageSize(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="rounded border px-2 py-1 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
              disabled={currentPage <= 1}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm">Page {Math.min(currentPage, pageCount)} of {pageCount}</span>
            <button
              type="button"
              onClick={() => setCurrentPage(page => Math.min(pageCount, page + 1))}
              disabled={currentPage >= pageCount}
              className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
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
