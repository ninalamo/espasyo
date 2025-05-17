// ScatterPlot.tsx
import React from 'react';
import { Scatter } from 'react-chartjs-2';
import 'chart.js/auto'; // Auto-registers Chart.js components
import 'chartjs-adapter-date-fns'; // Adapter for date handling using date-fns
import { ChartOptions } from 'chart.js';
import { format } from 'date-fns';

interface ScatterPlotProps {
  // Data points must include:
  // - x: a Unix timestamp in seconds
  // - clusterId: for grouping into datasets
  // - caseId: (optional) extra details for tooltips
  data: { 
    clusterId: number; 
    x: number; 
    y?: number; // Not used from input; we calculate y below.
    caseId?: string; 
    [key: string]: any; 
  }[];
  // Maps each clusterId to a color for that group.
  clusterColorsMapping: { [key: number]: string };
}

const ScatterPlot: React.FC<ScatterPlotProps> = ({ data, clusterColorsMapping }) => {
  // Helper: Converts a Date to a time-of-day category.
  const getTimeCategory = (dt: Date): string => {
    const hour = dt.getHours();
    if (hour < 12) return 'Morning';
    return hour < 18 ? 'Afternoon' : 'Evening';
  };

  // Define the fixed order for the y-axis categories.
  const timeCategories = ['Morning', 'Afternoon', 'Evening'];
  const timeCategoryMapping: { [key: string]: number } = {
    'Morning': 0,
    'Afternoon': 1,
    'Evening': 2,
  };

  // Transform the input data:
  // • Convert x (Unix timestamp in seconds) to a Date.
  // • Truncate it to the first day of its month.
  // • Format the month-year for display (e.g., "Jan 2024").
  // • Assign a numeric y value based on the time-of-day (Morning, etc).
  const transformedData = data.map(point => {
    // Convert Unix timestamp (seconds) into a Date.
    // (Ensure that you really are sending seconds; if timestamps are in milliseconds, remove *1000.)
    const incidentDate = new Date(point.x * 1000);
    // Truncate to the beginning of the month.
    const monthStart = new Date(incidentDate.getFullYear(), incidentDate.getMonth(), 1);
    // Format the month-year label.
    const formattedDate = format(monthStart, 'MMM yyyy');
    // Determine the time-of-day category.
    const timeCategory = getTimeCategory(incidentDate);
    const yValue = timeCategoryMapping[timeCategory];
    
    return {
      ...point,
      x: monthStart.getTime(), // Use a millisecond timestamp for the x-axis.
      y: yValue,               // Map the time category to its numeric index.
      formattedDate,           // For displaying in tooltips.
      timeCategory,            // For displaying in tooltips.
    };
  });

  // Log transformed data for debugging.
  console.log("Transformed Data:", transformedData);

  // Compute dynamic range for the x-axis based on the transformed data.
  const allXValues = transformedData.map(pt => pt.x);
  const dynamicXMin = allXValues.length ? Math.min(...allXValues) : new Date().getTime();
  const dynamicXMax = allXValues.length ? Math.max(...allXValues) : new Date().getTime();

  // Create datasets grouped by clusterId.
  const distinctClusters = Array.from(new Set(transformedData.map(pt => pt.clusterId))).sort((a, b) => a - b);
  const datasets = distinctClusters.map(clusterId => ({
    label: `Cluster ${clusterId}`,
    data: transformedData.filter(pt => pt.clusterId === clusterId),
    backgroundColor: clusterColorsMapping[clusterId] || '#D3D3D3',
    pointRadius: 5, // Ensure markers are visible.
  }));

  // Log the chartData for debugging.
  const chartData = { datasets };
  console.log("Chart Data:", chartData);

  // Define Chart.js options with dynamic x-axis.
  const options: ChartOptions<'scatter'> = {
    scales: {
      x: {
        type: 'time', // Time scale for month-year values.
        time: {
          unit: 'month' as const,
          tooltipFormat: 'MMM yyyy',
          displayFormats: {
            month: 'MMM yyyy' as const,
          },
        },
        title: {
          display: true,
          text: 'Month-Year',
        },
        min: dynamicXMin,  // Dynamic minimum based on your data.
        max: dynamicXMax,  // Dynamic maximum based on your data.
      },
      y: {
        type: 'category',
        labels: timeCategories, // The fixed order: Morning, Afternoon, Evening.
        title: {
          display: true,
          text: 'Time of Day',
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: any) => {
            // Customize the tooltip content.
            const point = context.raw;
            let label = `Cluster ${point.clusterId}: (${point.formattedDate}, ${point.timeCategory})`;
            if (point.caseId) {
              label += ` - Case ID: ${point.caseId}`;
            }
            return label;
          },
        },
      },
    },
  };

  return <Scatter data={chartData} options={options} />;
};

export default ScatterPlot;