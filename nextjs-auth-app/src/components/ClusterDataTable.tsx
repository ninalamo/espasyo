// components/ClusterDataTable.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { ClustedDataTableRow } from '../types/analysis/ClusterDto';

// precinct → barangay name lookup
const precinctNames: Record<number,string> = {
  0: "Alabang",
  1: "Bayanan",
  2: "Buli",
  3: "Cupang",
  4: "Poblacion",
  5: "Putatan",
  6: "Tunasan",
  7: "Ayala_Alabang",
  8: "Sucat"
};

interface Props {
  data: ClustedDataTableRow[];
}

// you can adjust these or make them props
const PAGE_SIZE_OPTIONS = [10, 25, 50];

const ClusterDataTable: React.FC<Props> = ({ data }) => {
  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'' | 'Morning' | 'Afternoon' | 'Evening'>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

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
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cluster_data.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 1) Filter & search
  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Time filter
      if (timeFilter && item.timeOfDay !== timeFilter) return false;
      // Search across barangay name & caseId
      const barangay = precinctNames[item.precinct]?.toLowerCase() || '';
      const caseId = item.caseId.toLowerCase();
      const term = searchTerm.toLowerCase();
      return barangay.includes(term) || caseId.includes(term);
    });
  }, [data, searchTerm, timeFilter]);

  // 2) Pagination calculations
  const pageCount = Math.ceil(filteredData.length / pageSize) || 1;
  const pagedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Handlers
  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };
  const onTimeFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTimeFilter(e.target.value as any);
    setCurrentPage(1);
  };
  const onPageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };
  const goToPage = (p: number) => setCurrentPage(Math.min(Math.max(1, p), pageCount));

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
        {/* Search */}
        <input
          type="text"
          placeholder="Search barangay or case ID…"
          value={searchTerm}
          onChange={onSearchChange}
          className="border rounded px-3 py-1 flex-1 max-w-sm"
        />

        {/* Time-of-day filter */}
        <select
          value={timeFilter}
          onChange={onTimeFilterChange}
          className="border rounded px-3 py-1"
        >
          <option value="">All Times of Day</option>
          {['Morning','Afternoon','Evening'].map(slot => (
            <option key={slot} value={slot}>{slot}</option>
          ))}
        </select>

        {/* Page size selector */}
        <select
          value={pageSize}
          onChange={onPageSizeChange}
          className="border rounded px-3 py-1"
        >
          {PAGE_SIZE_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt} / page</option>
          ))}
        </select>

        {/* CSV download */}
        <button
          onClick={downloadCsv}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Download CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border-collapse border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 border border-gray-300">Barangay</th>
              <th className="px-4 py-2 border border-gray-300">Cluster ID</th>
              <th className="px-4 py-2 border border-gray-300">Case ID</th>
              <th className="px-4 py-2 border border-gray-300">Latitude</th>
              <th className="px-4 py-2 border border-gray-300">Longitude</th>
              <th className="px-4 py-2 border border-gray-300">Month</th>
              <th className="px-4 py-2 border border-gray-300">Year</th>
              <th className="px-4 py-2 border border-gray-300">Time Of Day</th>
            </tr>
          </thead>
          <tbody>
            {pagedData.map(item => {
              const barangay = precinctNames[item.precinct] || `Precinct ${item.precinct}`;
              return (
                <tr key={`${item.clusterId}_${item.caseId}`}>
                  <td className="px-4 py-2 border border-gray-300">{barangay}</td>
                  <td className="px-4 py-2 border border-gray-300">{item.clusterId}</td>
                  <td className="px-4 py-2 border border-gray-300">{item.caseId}</td>
                  <td className="px-4 py-2 border border-gray-300">{item.latitude}</td>
                  <td className="px-4 py-2 border border-gray-300">{item.longitude}</td>
                  <td className="px-4 py-2 border border-gray-300">{item.month}</td>
                  <td className="px-4 py-2 border border-gray-300">{item.year}</td>
                  <td className="px-4 py-2 border border-gray-300">{item.timeOfDay}</td>
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
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Prev
        </button>
        <span>
          Page{' '}
          <strong>
            {currentPage} / {pageCount}
          </strong>
        </span>
        <button
          onClick={() => goToPage(currentPage + 1)}
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
