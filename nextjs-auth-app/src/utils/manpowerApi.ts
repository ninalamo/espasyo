/**
 * API service for manpower operations
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5041/api';

// Shift mapping constants
export const SHIFT_MAPPING = {
  'Morning': 0,
  'Evening': 1,
  'Night': 2
} as const;

export const REVERSE_SHIFT_MAPPING = {
  0: 'Morning',
  1: 'Evening', 
  2: 'Night'
} as const;

export type ShiftName = keyof typeof SHIFT_MAPPING;
export type ShiftNumber = typeof SHIFT_MAPPING[ShiftName];

export interface ManpowerAllocation {
  id: string;
  precinctId: string;
  precinctName?: string;
  headCount: number;
  shift?: string;
  lastUpdated: string;
  efficiency?: number;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  trend?: 'increasing' | 'decreasing' | 'stable';
}

export interface CreateManpowerRequest {
  precinctId: string;
  headCount: number;
  shift?: string;
}

export interface UpdateManpowerRequest {
  precinctId?: string;
  headCount?: number;
  shift?: string;
}

export interface UpsertManpowerRequest {
  precinctId: string;
  shift: number; // 0 = Morning, 1 = Evening, 2 = Night
  headCount: number;
}

export interface UpsertManpowerResponse {
  id: string;
  message: string;
}

class ManpowerApiService {
  private async fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API Error: ${response.status} - ${errorData}`);
    }

    // Handle empty responses
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  /**
   * Get all manpower allocations
   */
  async getAllManpower(): Promise<ManpowerAllocation[]> {
    return this.fetchApi<ManpowerAllocation[]>('/manpower');
  }

  /**
   * Get manpower allocation by ID
   */
  async getManpowerById(id: string): Promise<ManpowerAllocation> {
    return this.fetchApi<ManpowerAllocation>(`/manpower/${id}`);
  }

  /**
   * Update existing manpower allocation
   */
  async updateManpower(id: string, data: UpdateManpowerRequest): Promise<ManpowerAllocation> {
    return this.fetchApi<ManpowerAllocation>(`/manpower/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get all available precincts
   */
  async getPrecincts(): Promise<Array<{ id: string; name: string; code: string }>> {
    return this.fetchApi<Array<{ id: string; name: string; code: string }>>('/manpower/precincts');
  }

  /**
   * Get manpower summary for a specific year
   */
  async getManpowerSummary(year: number): Promise<{
    year: number;
    totalPrecincts: number;
    totalManpower: number;
    averageAllocation: number;
    precinctBreakdown: Array<{
      precinct: string;
      allocation: number;
    }>;
  }> {
    return this.fetchApi(`/manpower/summary/${year}`);
  }

  /**
   * Upsert manpower allocation using the new backend endpoint
   * This method creates or updates based on precinct + shift combination
   */
  async upsertManpower(data: UpsertManpowerRequest): Promise<UpsertManpowerResponse> {
    return this.fetchApi<UpsertManpowerResponse>('/manpower/upsert', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Helper method to convert string shift to number for upsert
   */
  convertShiftToNumber(shiftName: string): number {
    const normalizedShift = shiftName as ShiftName;
    return SHIFT_MAPPING[normalizedShift] ?? 0; // Default to Morning if unknown
  }

  /**
   * Helper method to convert number shift to string for display
   */
  convertShiftToString(shiftNumber: number): string {
    return REVERSE_SHIFT_MAPPING[shiftNumber as ShiftNumber] ?? 'Morning';
  }

  /**
   * Create or update manpower allocation with shift support (using new upsert endpoint)
   */
  async createOrUpdateManpowerWithShift(data: CreateManpowerRequest): Promise<UpsertManpowerResponse> {
    const shiftNumber = this.convertShiftToNumber(data.shift || 'Morning');
    
    const upsertData: UpsertManpowerRequest = {
      precinctId: data.precinctId,
      shift: shiftNumber,
      headCount: data.headCount
    };
    
    return this.upsertManpower(upsertData);
  }

  /**
   * Get all manpower allocations (now properly supports multiple shifts per precinct)
   */
  async getAllManpowerWithShifts(): Promise<ManpowerAllocation[]> {
    const allocations = await this.getAllManpower();
    
    // Convert numeric shifts to string representation for display
    return allocations.map(allocation => {
      // If shift is numeric, convert to string
      if (typeof allocation.shift === 'number') {
        allocation.shift = this.convertShiftToString(allocation.shift);
      }
      return allocation;
    });
  }

  /**
   * Get available shifts from the API
   */
  async getShifts(): Promise<Array<{ id: number; name: string; description: string }>> {
    return this.fetchApi<Array<{ id: number; name: string; description: string }>>('/manpower/shifts');
  }

  /**
   * Get manpower allocations by precinct ID
   */
  async getManpowerByPrecinct(precinctId: string): Promise<ManpowerAllocation[]> {
    return this.fetchApi<ManpowerAllocation[]>(`/manpower/precinct/${precinctId}`);
  }
}

export const manpowerApi = new ManpowerApiService();