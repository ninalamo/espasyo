export interface ValidationErrors {
  [key: string]: string;
}

export const validateIncident = (incident: any, location: string): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!incident.caseId) errors.caseId = "Case ID is required";
  if (!incident.crimeType) errors.crimeType = "Crime type is required";
  if (!location) errors.address = "Street address is required";
  if (!incident.severity) errors.severity = "Severity is required";
  if (!incident.timeStamp) errors.timeStamp = "Timestamp is required";
  if (!incident.motive) errors.motive = "Motive is required";
  if (!incident.weather) errors.weather = "Weather is required";
  if (incident.precinct === -1) errors.precinct = "Precinct is required";

  return errors;
};
