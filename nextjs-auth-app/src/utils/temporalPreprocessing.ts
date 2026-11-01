import type { Cluster, ClusterItem } from '../types/analysis/ClusterDto';

export interface MonthlyCrimeCount {
  precinct: number;
  crimeType: number;
  year: number;
  month: number;
  count: number;
}

export interface TemporalPreprocessingData {
  incidents: ClusterItem[];
  aggregatedMonths: MonthlyCrimeCount[];
  forecastInput: MonthlyCrimeCount[];
  invalidDateCount: number;
}

interface CrimeSeries {
  precinct: number;
  crimeType: number;
  monthlyCounts: Map<number, number>;
}

export function buildTemporalPreprocessingData(clusters: Cluster[]): TemporalPreprocessingData {
  const incidents = clusters.flatMap(cluster => cluster.clusterItems ?? []);
  const seriesByKey = new Map<string, CrimeSeries>();
  let invalidDateCount = 0;

  incidents.forEach(incident => {
    if (
      !Number.isInteger(incident.year) ||
      incident.year < 1 ||
      incident.year > 9999 ||
      !Number.isInteger(incident.month) ||
      incident.month < 1 ||
      incident.month > 12
    ) {
      invalidDateCount += 1;
      return;
    }

    const key = `${incident.precinct}:${incident.crimeType}`;
    let series = seriesByKey.get(key);
    if (!series) {
      series = {
        precinct: incident.precinct,
        crimeType: incident.crimeType,
        monthlyCounts: new Map<number, number>(),
      };
      seriesByKey.set(key, series);
    }

    const monthIndex = incident.year * 12 + incident.month - 1;
    series.monthlyCounts.set(monthIndex, (series.monthlyCounts.get(monthIndex) ?? 0) + 1);
  });

  const sortedSeries = [...seriesByKey.values()].sort(
    (left, right) => left.precinct - right.precinct || left.crimeType - right.crimeType
  );
  const aggregatedMonths: MonthlyCrimeCount[] = [];
  const forecastInput: MonthlyCrimeCount[] = [];

  sortedSeries.forEach(series => {
    const observedMonths = [...series.monthlyCounts.entries()].sort(([left], [right]) => left - right);
    observedMonths.forEach(([monthIndex, count]) => {
      aggregatedMonths.push({
        precinct: series.precinct,
        crimeType: series.crimeType,
        year: Math.floor(monthIndex / 12),
        month: monthIndex % 12 + 1,
        count,
      });
    });

    if (observedMonths.length === 0) return;

    const firstMonth = observedMonths[0][0];
    const lastMonth = observedMonths[observedMonths.length - 1][0];
    for (let monthIndex = firstMonth; monthIndex <= lastMonth; monthIndex += 1) {
      forecastInput.push({
        precinct: series.precinct,
        crimeType: series.crimeType,
        year: Math.floor(monthIndex / 12),
        month: monthIndex % 12 + 1,
        count: series.monthlyCounts.get(monthIndex) ?? 0,
      });
    }
  });

  return { incidents, aggregatedMonths, forecastInput, invalidDateCount };
}
