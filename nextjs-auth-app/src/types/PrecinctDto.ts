export interface PrecinctDto {
  id: string;
  name: string;
  code: string;
  population?: number;
  areaKm2?: number;
  description?: string;
}

export interface PrecinctSelectOption {
  value: string;
  name: string;
  code: string;
}