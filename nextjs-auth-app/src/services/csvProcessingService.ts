import { AddIncidentDto } from '../types/crime-record/AddIncidentDto';
import { apiService } from '../app/api/utils/apiService';

export interface CsvRow {
  address: string;
  severity: number;
  crimeType: number;
  motive: number;
  precinctId: string;
  weather: number;
  timeStamp: string;
  additionalInfo: string;
}

export interface ProcessingResult {
  success: boolean;
  data?: AddIncidentDto[];
  errors: string[];
  processedCount: number;
  skippedCount: number;
}

export interface BulkUploadResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  results: Array<{
    success: boolean;
    caseId?: string;
    errors?: string[];
  }>;
}

/**
 * Generate a unique case ID in the format CASE-XXXX
 */
export const generateCaseId = (): string => {
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CASE-${randomNum}`;
};

/**
 * Parse CSV text into rows
 */
export const parseCsvText = (csvText: string): string[][] => {
  const lines = csvText.trim().split('\n');
  const rows: string[][] = [];
  
  for (const line of lines) {
    if (line.trim()) {
      // Simple CSV parsing - handles quoted values
      const row: string[] = [];
      let currentValue = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(currentValue.trim().replace(/^"|"$/g, ''));
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      
      // Add the last value
      row.push(currentValue.trim().replace(/^"|"$/g, ''));
      rows.push(row);
    }
  }
  
  return rows;
};

/**
 * Validate a CSV row and convert to AddIncidentDto
 */
export const validateAndConvertRow = (
  row: string[],
  headers: string[],
  rowIndex: number
): { data?: AddIncidentDto; error?: string } => {
  try {
    // Map row values to object based on headers
    const csvRow: any = {};
    headers.forEach((header, index) => {
      csvRow[header.trim()] = row[index]?.trim() || '';
    });
    
    // Validate required fields
    const errors: string[] = [];
    
    if (!csvRow.address) {
      errors.push(`Row ${rowIndex + 1}: Address is required`);
    }
    
    if (!csvRow.timeStamp) {
      errors.push(`Row ${rowIndex + 1}: timeStamp is required`);
    }
    
    const severity = parseInt(csvRow.severity);
    if (isNaN(severity) || severity < 1 || severity > 3) {
      errors.push(`Row ${rowIndex + 1}: severity must be 1, 2, or 3`);
    }
    
    const crimeType = parseInt(csvRow.crimeType);
    if (isNaN(crimeType) || crimeType < 1 || crimeType > 3) {
      errors.push(`Row ${rowIndex + 1}: crimeType must be 1, 2, or 3`);
    }
    
    const motive = parseInt(csvRow.motive);
    if (isNaN(motive) || motive < 1 || motive > 3) {
      errors.push(`Row ${rowIndex + 1}: motive must be 1, 2, or 3`);
    }
    
    const weather = parseInt(csvRow.weather);
    if (isNaN(weather) || weather < 1 || weather > 3) {
      errors.push(`Row ${rowIndex + 1}: weather must be 1, 2, or 3`);
    }
    
    // Validate policeDistrict - should be 1, 2, or 3
    const policeDistrict = parseInt(csvRow.policeDistrict);
    if (isNaN(policeDistrict) || policeDistrict < 1 || policeDistrict > 3) {
      errors.push(`Row ${rowIndex + 1}: policeDistrict must be 1, 2, or 3`);
    }
    
    if (errors.length > 0) {
      return { error: errors.join('; ') };
    }
    
    // Map policeDistrict to precinctId (assuming 1:1 mapping for now)
    const precinctMap: { [key: number]: string } = {
      1: '1', // Bayanan
      2: '2', // Buli  
      3: '3', // Cupang
    };
    
    const precinctId = precinctMap[policeDistrict] || '1';
    
    const incidentDto: AddIncidentDto = {
      caseId: generateCaseId(),
      crimeType: crimeType,
      address: csvRow.address,
      severity: severity,
      timeStamp: csvRow.timeStamp,
      motive: motive,
      weather: weather,
      precinctId: precinctId,
      additionalInfo: csvRow.additionalInfo || ''
    };
    
    return { data: incidentDto };
    
  } catch (error) {
    return { error: `Row ${rowIndex + 1}: Error processing row - ${error}` };
  }
};

/**
 * Process CSV file and convert to AddIncidentDto array
 */
export const processCsvFile = async (csvText: string): Promise<ProcessingResult> => {
  const result: ProcessingResult = {
    success: false,
    data: [],
    errors: [],
    processedCount: 0,
    skippedCount: 0
  };
  
  try {
    const rows = parseCsvText(csvText);
    
    if (rows.length < 2) {
      result.errors.push('CSV file must contain at least a header row and one data row');
      return result;
    }
    
    const headers = rows[0];
    const dataRows = rows.slice(1);
    
    // Validate headers
    const requiredHeaders = ['address', 'severity', 'crimeType', 'motive', 'policeDistrict', 'weather', 'timeStamp'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      result.errors.push(`Missing required headers: ${missingHeaders.join(', ')}`);
      return result;
    }
    
    // Process each row
    const validData: AddIncidentDto[] = [];
    const usedCaseIds = new Set<string>();
    
    for (let i = 0; i < dataRows.length; i++) {
      const rowResult = validateAndConvertRow(dataRows[i], headers, i + 1);
      
      if (rowResult.error) {
        result.errors.push(rowResult.error);
        result.skippedCount++;
      } else if (rowResult.data) {
        // Ensure unique case IDs within the batch
        let caseId = rowResult.data.caseId;
        while (usedCaseIds.has(caseId)) {
          caseId = generateCaseId();
        }
        usedCaseIds.add(caseId);
        rowResult.data.caseId = caseId;
        
        validData.push(rowResult.data);
        result.processedCount++;
      }
    }
    
    result.data = validData;
    result.success = validData.length > 0;
    
    return result;
    
  } catch (error) {
    result.errors.push(`Failed to process CSV file: ${error}`);
    return result;
  }
};

/**
 * Upload incidents to the backend using the bulk API
 */
export const uploadIncidents = async (incidents: AddIncidentDto[]): Promise<BulkUploadResult> => {
  try {
    // Split into batches of 100 (as per backend limitation)
    const batches = [];
    for (let i = 0; i < incidents.length; i += 100) {
      batches.push(incidents.slice(i, i + 100));
    }
    
    let totalSuccessCount = 0;
    let totalFailureCount = 0;
    const allResults: Array<{
      success: boolean;
      caseId?: string;
      errors?: string[];
    }> = [];
    
    // Process each batch
    for (const batch of batches) {
      try {
        const response = await apiService.post<{
          results: Array<{
            success: boolean;
            incident?: { caseId?: string };
            errors?: string[];
          }>;
        }>('/incident/bulk', batch);
        
        if (response?.results) {
          for (const result of response.results) {
            if (result.success) {
              totalSuccessCount++;
              allResults.push({
                success: true,
                caseId: result.incident?.caseId || 'Unknown'
              });
            } else {
              totalFailureCount++;
              allResults.push({
                success: false,
                errors: result.errors || ['Unknown error']
              });
            }
          }
        } else {
          // If no detailed results, assume all failed
          totalFailureCount += batch.length;
          batch.forEach(() => {
            allResults.push({
              success: false,
              errors: ['Bulk upload failed - no detailed response']
            });
          });
        }
      } catch (batchError) {
        // If entire batch fails
        totalFailureCount += batch.length;
        batch.forEach(() => {
          allResults.push({
            success: false,
            errors: [`Batch upload failed: ${batchError}`]
          });
        });
      }
    }
    
    return {
      success: totalSuccessCount > 0,
      successCount: totalSuccessCount,
      failureCount: totalFailureCount,
      results: allResults
    };
    
  } catch (error) {
    return {
      success: false,
      successCount: 0,
      failureCount: incidents.length,
      results: incidents.map(() => ({
        success: false,
        errors: [`Upload failed: ${error}`]
      }))
    };
  }
};