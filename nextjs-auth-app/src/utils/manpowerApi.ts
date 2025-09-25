/**
 * API service for manpower operations
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5041/api';

export interface ManpowerAllocation {
  id: string;
  precinct: string;
  precinctName: string;
  officerCount: number;
  shift?: string;
  allocatedCount: number;
  mildThreshold: number;
  moderateThreshold: number;
  criticalThreshold: number;
  createdAt: string;
  updatedAt: string;
  // Calculated fields for display
  efficiency?: number;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  trend?: 'increasing' | 'decreasing' | 'stable';
}

export interface CreateManpowerRequest {
  precinct: string;
  officerCount: number;
  shift?: string;
}

export interface UpdateManpowerRequest {
  precinct?: string;
  officerCount?: number;
  shift?: string;
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
   * Create new manpower allocation
   */
  async createManpower(data: CreateManpowerRequest): Promise<ManpowerAllocation> {
    return this.fetchApi<ManpowerAllocation>('/manpower', {
      method: 'POST',
      body: JSON.stringify(data),
    });
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
  async getPrecincts(): Promise<Array<{ value: number; name: string }>> {
    return this.fetchApi<Array<{ value: number; name: string }>>('/manpower/precincts');
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
}

export const manpowerApi = new ManpowerApiService();