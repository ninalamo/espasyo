
export interface ClusterGroupResponse {
  clusterGroups: Cluster[];
}

export interface Cluster {
  clusterId: number;
  centroids: number[];
  clusterItems: ClusterItem[];
  clusterCount: number;
}

export interface ClusterItem {
  caseId: string;
  latitude: number;
  longitude: number;
  month: number;
  day: number;
  year: number;
  // Time-of-day bucket from the backend API.
  // Backend uses DateTimeExtensions.GetTimeOfDay (3 categories):
  //   Morning (<12h), Afternoon (<18h), Evening (>=18h).
  // Hours 00:00-05:59 are reported as "Morning", NOT "Night".
  // (MachineLearningService.GetTimeOfDay(long) has a 4th "Night" category
  // but its result is overwritten by GetGroupedClustersQueryHandler.)
  timeOfDay: 'Morning' | 'Afternoon' | 'Evening';
  precinct: number;
  crimeType: number;
  severity?: number;
  motive?: number;
  weather?: number;
}

export interface BarangayDataItem {
  precinct: number;
  month: number;    // 1–12
  year: number;     // e.g. 2024
  timeOfDay: string;//'Morning' | 'Afternoon' | 'Evening';
}

export interface ClustedDataTableRow {
  precinct: number;                      // numeric code
  clusterId: number;
  caseId: string;
  latitude: number;
  longitude: number;
  month: number;
  year: number;
  timeOfDay: 'Morning' | 'Afternoon' | 'Evening';
}