
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
}