'use client';

import { IncidentDto } from "./IncidentDto";

// Define types for crime record data
export interface CrimeListItemDto {
  items: IncidentDto[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
