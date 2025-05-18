// components/ClusterDataTable.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { ClustedDataTableRow } from '../types/analysis/ClusterDto';
import { GetPrecinctsDictionary } from '../constants/consts';

// precinct → barangay name lookup
const precinctNames: Record<number,string> = GetPrecinctsDictionary;

interface Props {
  data: ClustedDataTableRow[];
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const ALL_TIMES = ['Morning','Afternoon','Evening'] as const;

const ClusterDataTable: React.FC<Props> = ({ data }) => {
  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'' | typeof ALL_TIMES[number]>('');
  const [monthFilter, setMonthFilter] = useState<number[]>([]);
  const [yearFilter, setYearFilter] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  // derive unique months/years
  const allMonths = useMemo(() => Array.from(new Set(data.map(d=>d.month))).sort((a,b)=>a-b), [data]);
  const allYears  = useMemo(() => Array.from(new Set(data.map(d=>d.year))).sort((a,b)=>a-b),  [data]);

  // 1) Filter & search
  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (timeFilter && item.timeOfDay !== timeFilter) return false;
      if (monthFilter.length && !monthFilter.includes(item.month)) return false;
      if (yearFilter.length && !yearFilter.includes(item.year)) return false;
      const term = searchTerm.toLowerCase();
      if (term) {
        const barangay = precinctNames[item.precinct]?.toLowerCase() || '';
        if (!barangay.includes(term) && !item.caseId.toLowerCase().includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [data, timeFilter, monthFilter, yearFilter, searchTerm]);

  // 2) Pagination
  const pageCount = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const pagedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // CSV export
  const downloadCsv = () => {
    const headers = ["Barangay","Cluster ID","Case ID","Latitude","Longitude","Month","Year","Time Of Day"];
    const rows = filteredData.map(item => {
      const barangay = precinctNames[item.precinct] || `Precinct ${item.precinct}`;
      return [
        barangay,
        item.clusterId,
        item.caseId,
        item.latitude,
        item.longitude,
        item.month,
        item.year,
        item.timeOfDay
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cluster_data.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Helpers for toggles
  const toggleMonth = (m: number) => {
    setMonthFilter(prev => prev.includes(m) ? prev.filter(x=>x!==m) : [...prev,m]);
    setCurrentPage(1);
  };
  const toggleYear = (y: number) => {
    setYearFilter(prev => prev.includes(y) ? prev.filter(x=>x!==y) : [...prev,y]);
    setCurrentPage(1);
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-start justify-between mb-4 gap-4">
        {/* Search */}
        <div className="flex-1 max-w-sm">
          <label htmlFor="search" className="block text-sm font-medium mb-1">Search</label>
          <input
            id="search"
            type="text"
            placeholder="Barangay or Case ID"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full border rounded px-3 py-1"
          />
        </div>

        {/* Time of Day */}
        <div>
          <label htmlFor="timeFilter" className="block text-sm font-medium mb-1">Time of Day</label>
          <select
            id="timeFilter"
            value={timeFilter}
            onChange={e => { setTimeFilter(e.target.value as any); setCurrentPage(1); }}
            className="border rounded px-3 py-1"
          >
            <option value="">All Times</option>
            {ALL_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Month Filter */}
        <fieldset className="border p-2 rounded">
          <legend className="text-sm font-medium mb-1">Filter by Month</legend>
          <div className="flex gap-1 overflow-x-auto">
            {allMonths.map(m => (
              <button
                key={m}
                onClick={() => toggleMonth(m)}
                className={`px-2 py-1 border rounded ${
                  monthFilter.includes(m) ? 'bg-blue-600 text-white' : ''
                }`}
              >{m}</button>
            ))}
          </div>
        </fieldset>

        {/* Year Filter */}
        <fieldset className="border p-2 rounded">
          <legend className="text-sm font-medium mb-1">Filter by Year</legend>
          <div className="flex gap-1 overflow-x-auto">
            {allYears.map(y => (
              <button
                key={y}
                onClick={() => toggleYear(y)}
                className={`px-2 py-1 border rounded ${
                  yearFilter.includes(y) ? 'bg-blue-600 text-white' : ''
                }`}
              >{y}</button>
            ))}
          </div>
        </fieldset>

        {/* Page Size */}
        <div>
          <label htmlFor="pageSize" className="block text-sm font-medium mb-1">Rows per page</label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            className="border rounded px-3 py-1"
          >
            {PAGE_SIZE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* Download CSV */}
        <div className="self-end">
          <button
            onClick={downloadCsv}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Download CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border-collapse border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 border">Barangay</th>
              <th className="px-4 py-2 border">Cluster ID</th>
              <th className="px-4 py-2 border">Case ID</th>
              <th className="px-4 py-2 border">Latitude</th>
              <th className="px-4 py-2 border">Longitude</th>
              <th className="px-4 py-2 border">Month</th>
              <th className="px-4 py-2 border">Year</th>
              <th className="px-4 py-2 border">Time Of Day</th>
            </tr>
          </thead>
          <tbody>
            {pagedData.map(item => {
              const barangay = precinctNames[item.precinct] || `Precinct ${item.precinct}`;
              return (
                <tr key={`${item.clusterId}_${item.caseId}`}>
                  <td className="px-4 py-2 border">{barangay}</td>
                  <td className="px-4 py-2 border">{item.clusterId}</td>
                  <td className="px-4 py-2 border">{item.caseId}</td>
                  <td className="px-4 py-2 border">{item.latitude}</td>
                  <td className="px-4 py-2 border">{item.longitude}</td>
                  <td className="px-4 py-2 border">{item.month}</td>
                  <td className="px-4 py-2 border">{item.year}</td>
                  <td className="px-4 py-2 border">{item.timeOfDay}</td>
                </tr>
              );
            })}
            {pagedData.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-gray-500">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center space-x-2 mt-4">
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Prev
        </button>
        <span>
          Page {currentPage} / {pageCount}
        </span>
        <button
          onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))}
          disabled={currentPage === pageCount}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default ClusterDataTable;
