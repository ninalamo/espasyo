'use client';

import React, { useMemo, useState } from 'react';
import { Cluster } from '../types/analysis/ClusterDto';
import { GetPrecinctsDictionary } from '../constants/consts';

const precinctNames: Record<number, string> = GetPrecinctsDictionary;

interface Props {
  clusters: Cluster[];
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const ALL_TIMES = ['Morning', 'Afternoon', 'Evening'] as const;

const ClusterDataTable: React.FC<Props> = ({ clusters }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'' | typeof ALL_TIMES[number]>('');
  const [monthFilter, setMonthFilter] = useState<number[]>([]);
  const [yearFilter, setYearFilter] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  const data = useMemo(() => {
    return clusters.flatMap(cluster =>
      cluster.clusterItems.map(item => ({
        precinct: item.precinct,
        clusterId: cluster.clusterId,
        caseId: item.caseId,
        latitude: item.latitude,
        longitude: item.longitude,
        month: item.month,
        year: item.year,
        timeOfDay: item.timeOfDay,
      }))
    );
  }, [clusters]);

  const allMonths = useMemo(() => Array.from(new Set(data.map(d => d.month))).sort((a, b) => a - b), [data]);
  const allYears = useMemo(() => Array.from(new Set(data.map(d => d.year))).sort((a, b) => a - b), [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (timeFilter && item.timeOfDay !== timeFilter) return false;
      if (monthFilter.length && !monthFilter.includes(item.month)) return false;
      if (yearFilter.length && !yearFilter.includes(item.year)) return false;
      const term = searchTerm.toLowerCase();
      if (term) {
        const barangay = precinctNames[item.precinct]?.toLowerCase() || '';
        if (!barangay.includes(term) && !item.caseId.toLowerCase().includes(term)) return false;
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
    const headers = ["Barangay", "Cluster ID", "Case ID", "Latitude", "Longitude", "Month", "Year", "Time Of Day"];
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cluster_data.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleMonth = (m: number) => {
    setMonthFilter(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
    setCurrentPage(1);
  };

  const toggleYear = (y: number) => {
    setYearFilter(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y]);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      <fieldset className="border p-4 rounded shadow-sm bg-white space-y-4">
        <legend className="text-sm font-semibold">Table Filters</legend>

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          {/* Search and Time Filter */}
          <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium mb-1">Search</label>
              <input
                type="text"
                placeholder="Barangay or Case ID"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="border rounded px-3 py-1 w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Time of Day</label>
              <select
                value={timeFilter}
                onChange={e => { setTimeFilter(e.target.value as any); setCurrentPage(1); }}
                className="border rounded px-3 py-1 w-full"
              >
                <option value="">All Times</option>
                {ALL_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Rows per page</label>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="border rounded px-3 py-1"
              >
                {PAGE_SIZE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="self-end">
              <button
                onClick={downloadCsv}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Download CSV
              </button>
            </div>
          </div>
        </div>

        {/* Month and Year Toggles */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <span className="font-medium text-sm">Filter by Month:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {allMonths.map(m => (
                <button
                  key={m}
                  onClick={() => toggleMonth(m)}
                  className={`px-2 py-1 border rounded text-sm ${monthFilter.includes(m) ? 'bg-blue-600 text-white' : ''}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1">
            <span className="font-medium text-sm">Filter by Year:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {allYears.map(y => (
                <button
                  key={y}
                  onClick={() => toggleYear(y)}
                  className={`px-2 py-1 border rounded text-sm ${yearFilter.includes(y) ? 'bg-blue-600 text-white' : ''}`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      {/* Table Display */}
      <div className="overflow-x-auto bg-white border rounded shadow-sm">
        <table className="min-w-full table-auto border-collapse">
          <thead className="bg-gray-100 text-sm">
            <tr>
              {["Barangay", "Cluster ID", "Case ID", "Latitude", "Longitude", "Month", "Year", "Time Of Day"].map(header => (
                <th key={header} className="px-4 py-2 border">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedData.length > 0 ? (
              pagedData.map(item => {
                const barangay = precinctNames[item.precinct] || `Precinct ${item.precinct}`;
                return (
                  <tr key={`${item.clusterId}_${item.caseId}`} className="text-sm">
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
              })
            ) : (
              <tr>
                <td colSpan={8} className="text-center py-4 text-gray-500">No records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-center gap-2 mt-4">
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Prev
        </button>
        <span>Page {currentPage} / {pageCount}</span>
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
