'use client';

import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { IncidentDto } from '../types/crime-record/IncidentDto';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../constants/consts';

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const ALL_TIMES = ['Morning', 'Afternoon', 'Evening'] as const;

// Mirrors backend Incident.GetTimeOfDay (Incident.cs:79-88):
//   hour 0-11  -> Morning
//   hour 12-17 -> Afternoon
//   hour 18-23 -> Evening
function getTimeOfDay(timestamp: string): 'Morning' | 'Afternoon' | 'Evening' {
  const hour = new Date(timestamp).getHours();
  if (hour >= 0 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 18) return 'Afternoon';
  return 'Evening';
}

interface IncidentDatasetRow {
  caseId: string;
  dateTime: string;
  month: number;
  day: number;
  year: number;
  timeOfDay: 'Morning' | 'Afternoon' | 'Evening';
  precinct: number;
  precinctName: string;
  crimeType: number;
  crimeTypeName: string;
  severity: number;
  address: string;
}

interface Props {
  incidents: IncidentDto[];
  isLoading: boolean;
}

const IncidentDatasetTable: React.FC<Props> = ({ incidents, isLoading }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'' | typeof ALL_TIMES[number]>('');
  const [monthFilter, setMonthFilter] = useState<number[]>([]);
  const [yearFilter, setYearFilter] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  const data = useMemo(() => {
    return incidents.map((incident) => {
      const ts = incident.timeStamp;
      const date = new Date(ts);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear();
      const timeOfDay = getTimeOfDay(ts);
      const precinct = incident.policeDistrict;
      return {
        caseId: incident.caseId ?? 'N/A',
        dateTime: format(date, 'MMM-dd-yyyy hh:mm a'),
        month,
        day,
        year,
        timeOfDay,
        precinct,
        precinctName: GetPrecinctsDictionary[precinct] ?? `Precinct ${precinct}`,
        crimeType: incident.crimeType,
        crimeTypeName: CrimeTypesDictionary[incident.crimeType] ?? `Type ${incident.crimeType}`,
        severity: incident.severity,
        address: incident.address ?? 'N/A',
      } as IncidentDatasetRow;
    });
  }, [incidents]);

  const allMonths = useMemo(
    () => Array.from(new Set(data.map((d) => d.month))).sort((a, b) => a - b),
    [data]
  );
  const allYears = useMemo(
    () => Array.from(new Set(data.map((d) => d.year))).sort((a, b) => a - b),
    [data]
  );

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      if (timeFilter && item.timeOfDay !== timeFilter) return false;
      if (monthFilter.length && !monthFilter.includes(item.month)) return false;
      if (yearFilter.length && !yearFilter.includes(item.year)) return false;
      const term = searchTerm.toLowerCase();
      if (term) {
        const matchesCaseId = item.caseId.toLowerCase().includes(term);
        const matchesPrecinct = item.precinctName.toLowerCase().includes(term);
        const matchesCrimeType = item.crimeTypeName.toLowerCase().includes(term);
        const matchesAddress = item.address.toLowerCase().includes(term);
        if (!matchesCaseId && !matchesPrecinct && !matchesCrimeType && !matchesAddress) return false;
      }
      return true;
    });
  }, [data, timeFilter, monthFilter, yearFilter, searchTerm]);

  const pageCount = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const pagedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const downloadCsv = () => {
    const escapeCsv = (val: unknown): string => {
      const s = val == null ? '' : String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const headers = [
      'Case ID',
      'Date/Time',
      'Month',
      'Day',
      'Year',
      'Time Of Day',
      'Precinct',
      'Crime Type',
      'Severity',
      'Address',
    ];
    const rows = pagedData.map((item) => [
      escapeCsv(item.caseId),
      escapeCsv(item.dateTime),
      escapeCsv(item.month),
      escapeCsv(item.day),
      escapeCsv(item.year),
      escapeCsv(item.timeOfDay),
      escapeCsv(item.precinctName),
      escapeCsv(item.crimeTypeName),
      escapeCsv(item.severity),
      escapeCsv(item.address),
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crime-incident-dataset.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleMonth = (m: number) => {
    setMonthFilter((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
    setCurrentPage(1);
  };

  const toggleYear = (y: number) => {
    setYearFilter((prev) =>
      prev.includes(y) ? prev.filter((x) => x !== y) : [...prev, y]
    );
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="animate-spin inline-block h-8 w-8 border-4 border-ubuntu-500 border-t-transparent rounded-full"></div>
        <p className="mt-4 text-gray-600">Loading incident dataset...</p>
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <p className="text-gray-500">No incident data available. Run analysis to load the dataset.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <fieldset className="border p-4 rounded shadow-sm bg-white space-y-4">
        <legend className="text-sm font-semibold">Dataset Filters</legend>

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium mb-1">Search</label>
              <input
                type="text"
                placeholder="Case ID, precinct, crime type, or address"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="border rounded px-3 py-1 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Time of Day</label>
              <select
                value={timeFilter}
                onChange={(e) => { setTimeFilter(e.target.value as any); setCurrentPage(1); }}
                className="border rounded px-3 py-1 w-full"
              >
                <option value="">All Times</option>
                {ALL_TIMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Rows per page</label>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="border rounded px-3 py-1"
              >
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div className="self-end">
              <button
                onClick={downloadCsv}
                className="bg-ubuntu-500 text-white px-4 py-2 rounded hover:bg-ubuntu-700"
              >
                Download CSV (this page)
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <span className="font-medium text-sm">Filter by Month:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {allMonths.map((m) => (
                <button
                  key={m}
                  onClick={() => toggleMonth(m)}
                  className={`px-2 py-1 border rounded text-sm ${monthFilter.includes(m) ? 'bg-ubuntu-500 text-white' : ''}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1">
            <span className="font-medium text-sm">Filter by Year:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {allYears.map((y) => (
                <button
                  key={y}
                  onClick={() => toggleYear(y)}
                  className={`px-2 py-1 border rounded text-sm ${yearFilter.includes(y) ? 'bg-ubuntu-500 text-white' : ''}`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      <div className="overflow-x-auto bg-white border rounded shadow-sm">
        <table className="min-w-full table-auto border-collapse">
          <thead className="bg-gray-100 text-sm">
            <tr>
              {[
                'Case ID',
                'Date/Time',
                'Month',
                'Day',
                'Year',
                'Time Of Day',
                'Precinct',
                'Crime Type',
                'Severity',
                'Address',
              ].map((header) => (
                <th key={header} className="px-4 py-2 border">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedData.length > 0 ? (
              pagedData.map((item) => (
                <tr key={`${item.caseId}_${item.year}_${item.month}_${item.day}`} className="text-sm">
                  <td className="px-4 py-2 border">{item.caseId}</td>
                  <td className="px-4 py-2 border">{item.dateTime}</td>
                  <td className="px-4 py-2 border">{item.month}</td>
                  <td className="px-4 py-2 border">{item.day}</td>
                  <td className="px-4 py-2 border">{item.year}</td>
                  <td className="px-4 py-2 border">{item.timeOfDay}</td>
                  <td className="px-4 py-2 border">{item.precinctName}</td>
                  <td className="px-4 py-2 border">{item.crimeTypeName}</td>
                  <td className="px-4 py-2 border">{item.severity}</td>
                  <td className="px-4 py-2 border">{item.address}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="text-center py-4 text-gray-500">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-center gap-2 mt-4">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Prev
        </button>
        <span>Page {currentPage} / {pageCount}</span>
        <button
          onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
          disabled={currentPage === pageCount}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default IncidentDatasetTable;
