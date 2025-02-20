export interface ClusterDto {
  clusterId: number;
  caseId: string;
  crimeType: number;
  timeStamp: string;
  address: string;
  latitude: number;
  longitude: number;
  severity: number;
  policeDistrict: number;
  weather: number;
  crimeMotive: number;
}

export interface ClusterResponse {
  result: ClusterDto[];
}