// ScatterPlot.tsx
import React from 'react';
import { Bubble } from 'react-chartjs-2';
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

  // Use fixed order for the y-axis categories.
  const timeCategories = ['Morning', 'Afternoon', 'Evening'];
  const timeCategoryMapping: { [key: string]: number } = {
    'Morning': 0,
    'Afternoon': 1,
    'Evening': 2,
  };

  // Transform input data:
  // • Convert x (Unix timestamp in seconds) to a Date.
  // • Truncate to the first day of its month.
  // • Format the month-year (e.g., "Jan 2024") for display.
  // • Determine the time-of-day category and assign a numeric y value.
  const transformedData = data.map(point => {
    const incidentDate = new Date(point.x * 1000);
    const monthStart = new Date(incidentDate.getFullYear(), incidentDate.getMonth(), 1);
    const formattedDate = format(monthStart, 'MMM yyyy');
    const timeCategory = getTimeCategory(incidentDate);
    const yValue = timeCategoryMapping[timeCategory];

    return {
      ...point,
      x: monthStart.getTime(), // Millisecond timestamp for x-axis
      y: yValue,               // Numeric value for y-axis (0 = Morning, etc.)
      formattedDate,           // For tooltip display
      timeCategory,            // For tooltip display
    };
  });

  console.log("Transformed Data:", transformedData);

  // Aggregate overlapping data points (group by same cluster, same x and same y).
  const aggregatedMap: {
    [key: string]: {
      clusterId: number;
      x: number;
      y: number;
      count: number;
      formattedDate: string;
      timeCategory: string;
    }
  } = {};

  transformedData.forEach(pt => {
    const key = `${pt.clusterId}_${pt.x}_${pt.y}`;
    if (aggregatedMap[key]) {
      aggregatedMap[key].count += 1;
    } else {
      aggregatedMap[key] = {
        clusterId: pt.clusterId,
        x: pt.x,
        y: pt.y as number,
        count: 1,
        formattedDate: pt.formattedDate,
        timeCategory: pt.timeCategory,
      };
    }
  });

  // Convert the aggregated object into an array.
  const aggregatedData = Object.values(aggregatedMap);
  console.log("Aggregated Data:", aggregatedData);

  // Group aggregated data by cluster.
  const distinctClusters = Array.from(new Set(aggregatedData.map(pt => pt.clusterId))).sort((a, b) => a - b);
  const datasets = distinctClusters.map(clusterId => {
    const clusterPoints = aggregatedData.filter(pt => pt.clusterId === clusterId);
    // Map each aggregated point to bubble chart data.
    const dataPoints = clusterPoints.map(pt => ({
      x: pt.x,
      y: pt.y,
      // Set bubble radius proportional to the square root of the count.
      r: Math.sqrt(pt.count) * 5,
      count: pt.count, // optional - can be used in tooltips
      clusterId: pt.clusterId,
      formattedDate: pt.formattedDate,
      timeCategory: pt.timeCategory,
    }));
    return {
      label: `Cluster ${clusterId}`,
      data: dataPoints,
      backgroundColor: clusterColorsMapping[clusterId] || '#D3D3D3',
    };
  });

  // Compute dynamic x-axis range based on aggregated data.
  const allXValues = aggregatedData.map(pt => pt.x);
  const dynamicXMin = allXValues.length ? Math.min(...allXValues) : new Date().getTime();
  const dynamicXMax = allXValues.length ? Math.max(...allXValues) : new Date().getTime();

  // Configure Chart.js options with enhanced x-axis ticks.
  const options: ChartOptions<'bubble'> = {
    scales: {
      x: {
        type: 'time',
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
        // Dynamic range from your data.
        min: dynamicXMin,
        max: dynamicXMax,
        ticks: {
          // Let Chart.js auto-skip labels to avoid clutter.
          autoSkip: true,
          maxTicksLimit: 10,
          // Optionally, use a callback to ensure proper formatting.
          callback: function (value) {
            return format(new Date(value as number), 'MMM yyyy');
          }
        },
      },
      y: {
        type: 'category',
        labels: timeCategories,
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
            const point = context.raw;
            let label = `Cluster ${point.clusterId}: (${format(new Date(point.x), 'MMM yyyy')}, ${timeCategories[point.y]})`;
            label += ` - Count: ${point.count}`;
            return label;
          },
        },
      },
    },
  };

  const chartData = { datasets };
  console.log("Chart Data:", chartData);

  return <Bubble data={chartData} options={options} />;
};

export default ScatterPlot;