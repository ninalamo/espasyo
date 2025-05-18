
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
  year: number;
  timeOfDay: string;
  precinct: number;
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