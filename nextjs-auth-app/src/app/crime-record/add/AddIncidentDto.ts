
// Define the crime record structure
export interface AddIncidentDto {
  caseId: string;
  crimeType: number;
  address: string;
  severity: number;
  timeStamp: string;
  motive: number;
  weather: number;
  precinct: number;
  additionalInfo: string;
}
