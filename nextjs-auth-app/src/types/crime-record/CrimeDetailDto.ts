
// Define CrimeRecord type
export interface CrimeDetailDto {
  id: number;
  caseId: string;
  crimeType: string;
  address: string;
  severity: string;
  datetime: string;
  motive: string;
  status: string;
}
