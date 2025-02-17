"use client"

export interface IncidentDto {
  id: string;
  caseId: string;
  address: string;
  severity: number;
  severityText: string;
  crimeType: number;
  crimeTypeText: string;
  motive: number;
  motiveText: string;
  policeDistrict: number;
  policeDistrictText: string;
  otherMotive: string;
  weather: number;
  weatherText: string;
  timeStamp: string;
}