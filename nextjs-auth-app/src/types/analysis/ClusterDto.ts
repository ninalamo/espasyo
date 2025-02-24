
export interface ClusterGroupResponse {
  clusterGroups: Cluster[];
}

export interface Cluster {
  clusterId: number;
  clusterItems: ClusterItem[];
  clusterCount: number;
}

export interface ClusterItem {
  caseId: string;
  latitude: number;
  longitude: number;
}