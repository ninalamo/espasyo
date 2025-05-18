'use client';

import React, { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { ChartOptions } from 'chart.js';
import { format } from 'date-fns';
import { BarangayDataItem } from '../types/analysis/ClusterDto';

interface Props {
  data: BarangayDataItem[];
  timeOfDayColors: Record<'Morning'|'Afternoon'|'Evening', string>;
}

// precinct→barangay name lookup
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

const timeSlots = ['Morning','Afternoon','Evening'] as const;
type TimeSlot = typeof timeSlots[number];

export const BarangayMonthlyChart: React.FC<Props> = ({ data, timeOfDayColors }) => {
  // Which precinct is focused? null means “show all”
  const [selected, setSelected] = useState<number|null>(null);

  // 1) All precinct IDs in the data, sorted
  const precincts = Array.from(new Set(data.map(d => d.precinct))).sort((a,b) => a - b);

  // 2) All months present, as { ms, label }
  const months = Array.from(
    new Set(data.map(d => new Date(d.year, d.month - 1, 1).getTime()))
  )
    .sort()
    .map(ms => ({ ms, label: format(new Date(ms), 'MMM yyyy') }));

  // 3) Decide which precincts to render
  const toRender = selected !== null ? [selected] : precincts;

  // 4) A little helper to render one chart tile
  const ChartTile: React.FC<{ precinct: number }> = ({ precinct }) => {
    const brgyName = precinctNames[precinct] || `Precinct ${precinct}`;

    // initialize counts: month → timeSlot → count
    const counts: Record<number, Record<TimeSlot, number>> = {};
    months.forEach(m => {
      counts[m.ms] = { Morning: 0, Afternoon: 0, Evening: 0 };
    });

    // tally data
    data
      .filter(d => d.precinct === precinct)
      .forEach(d => {
        const ms = new Date(d.year, d.month - 1, 1).getTime();
        counts[ms][d.timeOfDay]++;
      });

    // build Chart.js datasets
    const datasets = timeSlots.map(slot => ({
      label: slot,
      data: months.map(m => counts[m.ms][slot]),
      backgroundColor: timeOfDayColors[slot],
      stack: 'stack',
    }));

    return (
      <>
        <h3 className="text-center font-medium mb-2">{brgyName}</h3>
        <div style={{ height: 300 }}>
          <Bar
            data={{
              labels: months.map(m => m.label),
              datasets
            }}
            options={{
              indexAxis: 'x',
              maintainAspectRatio: false,
              scales: {
                x: { title: { display: true, text: 'Month' } },
                y: { title: { display: true, text: 'Count' }, beginAtZero: true }
              },
              plugins: { legend: { position: 'bottom' } },
            } as ChartOptions<'bar'>}
          />
        </div>
      </>
    );
  };

  return (
    <div>
      {/* “Show all” button when focused */}
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
        // FULL‑WIDTH single chart
        <div
          className="w-full p-4 border-4 border-blue-500 rounded shadow-sm bg-white cursor-pointer"
          onClick={() => setSelected(null)}
          title="Click to show all barangays"
        >
          <ChartTile precinct={selected} />
        </div>
      ) : (
        // GRID of all charts
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
