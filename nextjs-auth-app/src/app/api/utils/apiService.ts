import API_BASE_URL from "./apiConfig";
import { getSession } from "next-auth/react";

/**
 * Handles the response from the fetch call.
 */
async function handleResponse(response: Response, method: string, endpoint: string) {
  if (!response.ok) {
    let errorMessage = `${method} ${endpoint} failed`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody?.message || errorMessage;
    } catch {
      // Fallback to default errorMessage
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

/**
 * apiService object provides helper methods for making HTTP requests.
 * It automatically attaches a Bearer token from the session if available.
 */
export const apiService = {
  async get<T>(endpoint: string): Promise<T> {
    const session = await getSession();
    const token = session?.user?.token;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
    return handleResponse(response, "GET", endpoint);
  },

  async post<T>(endpoint: string, body: any): Promise<T> {
    const session = await getSession();
    const token = session?.user?.token;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, 
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
    return handleResponse(response, "POST", endpoint);
  },

  async put<T>(endpoint: string, body: any): Promise<T> {
    const session = await getSession();
    const token = session?.user?.token;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });
    return handleResponse(response, "PUT", endpoint);
  },

  async delete<T>(endpoint: string): Promise<T> {
    const session = await getSession();
    const token = session?.user?.token;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "DELETE",
      headers,
    });
    return handleResponse(response, "DELETE", endpoint);
  },
};
