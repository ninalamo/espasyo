'use client';

import React, { useMemo, useState } from 'react';
import { IncidentDto } from '../types/crime-record/IncidentDto';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../constants/consts';

interface PreprocessingView {
  type: 'raw' | 'aggregated' | 'ssa-input';
  title: string;
}

interface PreprocessingVisualizationProps {
  incidents: IncidentDto[];
}

const PreprocessingVisualization: React.FC<PreprocessingVisualizationProps> = ({ incidents }) => {
  const [view, setView] = useState<'raw' | 'aggregated' | 'ssa-input'>('raw');

  const processedData = useMemo(() => {
    return incidents.map((incident) => {
      const ts = incident.timeStamp;
      const date = new Date(ts);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear();
      const hour = date.getHours();
      const timeOfDay: 'Morning' | 'Afternoon' | 'Evening' = hour >= 0 && hour < 12
        ? 'Morning'
        : hour >= 12 && hour < 18
          ? 'Afternoon'
          : 'Evening';
      const precinct = GetPrecinctsDictionary[incident.policeDistrict] ?? `Precinct ${incident.policeDistrict}`;
      const crimeType = CrimeTypesDictionary[incident.crimeType] ?? `Type ${incident.crimeType}`;

      return {
        caseId: incident.caseId,
        month,
        day,
        year,
        timeOfDay,
        precinct,
        crimeType,
        severity: incident.severity,
        address: incident.address,
        timestamp: ts,
      };
    });
  }, [incidents]);

  const rawData = useMemo(() => processedData, [processedData]);

  // Aggregate by month
  const aggregatedByMonth = useMemo(() => {
    const counts: Record<number, number> = {};
    processedData.forEach((item) => {
      counts[item.month] = (counts[item.month] || 0) + 1;
    });
    // Sort by month
    const sorted = Object.entries(counts).sort(([a], [b]) => Number(a) - Number(b));
    return sorted.map(([month, count]) => ({ month: Number(month), count }));
  }, [processedData]);

  // Aggregate by time-of-day
  const aggregatedByTimeOfDay = useMemo(() => {
    const counts: Record<string, number> = {};
    processedData.forEach((item) => {
      counts[item.timeOfDay] = (counts[item.timeOfDay] || 0) + 1;
    });
    return Object.entries(counts).map(([timeOfDay, count]) => ({
      timeOfDay,
      count,
    }));
  }, [processedData]);

  // SSA input format (mirrors backend MachineLearningService expectations)
  const ssaInput = useMemo(() => {
    return processedData.map((item) => ({
      caseId: item.caseId,
      month: item.month, // 1-12
      day: item.day,     // 1-31
      year: item.year,   // e.g. 2024
      timeOfDay: item.timeOfDay, // 'Morning' | 'Afternoon' | 'Evening'
      precinct: item.precinct,
      crimeType: item.crimeType, // int mapping from CrimeTypesDictionary
      severity: item.severity,
    }));
  }, [processedData]);

  if (view === 'raw') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Raw Incident Data</h3>
          <span className="text-sm text-gray-500">{rawData.length} incidents</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border-collapse">
            <thead className="bg-gray-100 text-sm">
              <tr>
                <th className="px-4 py-2 border">Case ID</th>
                <th className="px-4 py-2 border">Month</th>
                <th className="px-4 py-2 border">Day</th>
                <th className="px-4 py-2 border">Year</th>
                <th className="px-4 py-2 border">Time of Day</th>
                <th className="px-4 py-2 border">Precinct</th>
                <th className="px-4 py-2 border">Crime Type</th>
                <th className="px-4 py-2 border">Severity</th>
                <th className="px-4 py-2 border">Address</th>
              </tr>
            </thead>
            <tbody>
              {rawData.length > 0 ? (
                rawData.map((item) => (
                  <tr key={item.caseId} className="text-sm">
                    <td className="px-4 py-2 border">{item.caseId}</td>
                    <td className="px-4 py-2 border">{item.month}</td>
                    <td className="px-4 py-2 border">{item.day}</td>
                    <td className="px-4 py-2 border">{item.year}</td>
                    <td className="px-4 py-2 border">{item.timeOfDay}</td>
                    <td className="px-4 py-2 border">{item.precinct}</td>
                    <td className="px-4 py-2 border">{item.crimeType}</td>
                    <td className="px-4 py-2 border">{item.severity}</td>
                    <td className="px-4 py-2 border">{item.address}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-4 text-gray-500">No incident data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (view === 'aggregated') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">Aggregated Data</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setView('raw')}
              className="text-ubuntu-600 hover:text-blue-800 transition text-xs"
            >
              Raw
            </button>
            <button
              onClick={() => setView('ssa-input')}
              className="text-ubuntu-600 hover:text-blue-800 transition text-xs"
            >
              SSA Input
            </button>
            <button
              onClick={() => setView('aggregated')}
              className="text-ubuntu-600 hover:text-blue-800 transition text-xs font-medium"
            >
              Aggregated
            </button>
          </div>
        </div>

        {/* Aggregated by Month */}
        <div className="p-4">
          <h4 className="font-medium text-gray-700 mb-3">By Month</h4>
          <div className="space-y-2">
            {aggregatedByMonth.map((item) => (
              <div key={item.month} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{item.month}:</span>
                <span className="font-medium">{item.count} incidents</span>
              </div>
            ))}
          </div>
        </div>

        {/* Aggregated by Time-of-Day */}
        <div className="p-4">
          <h4 className="font-medium text-gray-700 mb-3">By Time of Day</h4>
          <div className="space-y-2">
            {aggregatedByTimeOfDay.map((item) => (
              <div key={item.timeOfDay} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{item.timeOfDay}:</span>
                <span className="font-medium">{item.count} incidents</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'ssa-input') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">SSA Input Format</h3>
          <span className="text-sm text-gray-500">{ssaInput.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border-collapse">
            <thead className="bg-gray-100 text-sm">
              <tr>
                <th className="px-4 py-2 border">Case ID</th>
                <th className="px-4 py-2 border">Month</th>
                <th className="px-4 py-2 border">Day</th>
                <th className="px-4 py-2 border">Year</th>
                <th className="px-4 py-2 border">Time of Day</th>
                <th className="px-4 py-2 border">Precinct</th>
                <th className="px-4 py-2 border">Crime Type</th>
                <th className="px-4 py-2 border">Severity</th>
              </tr>
            </thead>
            <tbody>
              {ssaInput.length > 0 ? (
                ssaInput.map((item) => (
                  <tr key={item.caseId} className="text-sm">
                    <td className="px-4 py-2 border">{item.caseId}</td>
                    <td className="px-4 py-2 border">{item.month}</td>
                    <td className="px-4 py-2 border">{item.day}</td>
                    <td className="px-4 py-2 border">{item.year}</td>
                    <td className="px-4 py-2 border">{item.timeOfDay}</td>
                    <td className="px-4 py-2 border">{item.precinct}</td>
                    <td className="px-4 py-2 border">{item.crimeType}</td>
                    <td className="px-4 py-2 border">{item.severity}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-gray-500">No SSA input data</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
};

export default PreprocessingVisualization;