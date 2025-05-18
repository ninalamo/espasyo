'use client';

import React, { useMemo, useState } from 'react';
import { ChartOptions, ChartData } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import 'chart.js/auto';
import { format } from 'date-fns';
import { BarangayDataItem, Cluster } from '../types/analysis/ClusterDto';
import { GetPrecinctsDictionary } from '../constants/consts';

const precinctNames: Record<number, string> = GetPrecinctsDictionary;

const timeSlots = ['Morning', 'Afternoon', 'Evening'] as const;
type TimeSlot = typeof timeSlots[number];

interface Props {
  clusters: Cluster[];
  timeOfDayColors: Record<TimeSlot, string>;
}

export const BarangayMonthlyChart: React.FC<Props> = ({ clusters, timeOfDayColors }) => {

  // Prepare data for BarangayMonthlyChart
  const data = useMemo<BarangayDataItem[]>(() => {
    return clusters.flatMap(cluster =>
      cluster.clusterItems.map(item => ({
        precinct: item.precinct,            // numeric 0–8
        month: item.month,               // 1–12
        year: item.year,                // e.g. 2024
        timeOfDay: item.timeOfDay,           // 'Morning'|'Afternoon'|'Evening'
      }))
    );
  }, [clusters]);
  
  const [selected, setSelected] = useState<number | null>(null);

  const precincts = Array.from(new Set(data.map(d => d.precinct))).sort((a, b) => a - b);
  const months = Array.from(
    new Set(data.map(d => new Date(d.year, d.month - 1, 1).getTime()))
  ).sort().map(ms => ({ ms, label: format(new Date(ms), 'MMM yyyy') }));

  const toRender = selected !== null ? [selected] : precincts;

  const ChartTile: React.FC<{ precinct: number }> = ({ precinct }) => {
    const brgyName = precinctNames[precinct] || `Precinct ${precinct}`;
    const counts: Record<number, Record<TimeSlot, number>> = {};
    months.forEach(m => {
      counts[m.ms] = { Morning: 0, Afternoon: 0, Evening: 0 };
    });

    data.filter(d => d.precinct === precinct).forEach(d => {
      const ms = new Date(d.year, d.month - 1, 1).getTime();
      counts[ms][d.timeOfDay]++;
    });

    const barDatasets = timeSlots.map(slot => ({
      type: 'bar' as const,
      label: slot,
      data: months.map(m => counts[m.ms][slot]),
      backgroundColor: timeOfDayColors[slot],
      stack: 'stack',
    }));

    const chartData: ChartData<'bar'> = {
      labels: months.map(m => m.label),
      datasets: barDatasets,
    };

    const options: ChartOptions<'bar'> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { title: { display: true, text: 'Month' } },
        y: { title: { display: true, text: 'Count' }, beginAtZero: true }
      },
    };

    return (
      <>
        <h3 className="text-center font-medium mb-2">{brgyName}</h3>
        <div style={{ height: 300 }}>
          <Chart
            type="bar"
            data={chartData}
            options={options}
          />
        </div>
      </>
    );
  };

  return (
    <div>
      {selected !== null && (
        <div className="mb-4">
          <button
            onClick={() => setSelected(null)}
            className="px-3 py-1 bg-gray-200 rounded"
          >
            ← Show All Barangays
          </button>
        </div>
      )}

      {selected !== null ? (
        <div
          className="w-full p-4 border-4 border-blue-500 rounded shadow-sm bg-white"
          title="Click to show all barangays"
        >
          <ChartTile precinct={selected} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {toRender.map(pc => (
            <div
              key={pc}
              className="p-4 border rounded shadow-sm bg-white cursor-pointer"
              onClick={() => setSelected(pc)}
              title="Click to focus on this barangay"
            >
              <ChartTile precinct={pc} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
