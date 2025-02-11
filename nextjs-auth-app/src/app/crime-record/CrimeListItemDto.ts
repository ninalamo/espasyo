'use client';
// Define types for crime record data
export interface CrimeListItemDto {
  id: number;
  caseId: string;
  crimeType: string;
  address: string;
  severity: string;
  datetime: string;
  motive: string;
  status: string;
}
