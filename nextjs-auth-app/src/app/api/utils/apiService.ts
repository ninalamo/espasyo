import API_BASE_URL from "./apiConfig";
import { getSession } from "next-auth/react";

/**
 * Handles the response from the fetch call.
 */
async function handleResponse(response: Response, method: string, endpoint: string) {
  if (!response.ok) {
    let errorMessage = `${method} ${endpoint} failed`;
    try {
      const responseBody = await response.text();
      if (responseBody) {
        try {
          const errorBody: unknown = JSON.parse(responseBody);
          if (typeof errorBody === "string") {
            errorMessage = errorBody;
          } else if (typeof errorBody === "object" && errorBody !== null) {
            const details = errorBody as Record<string, unknown>;
            const message = details.message ?? details.detail ?? details.title;
            if (typeof message === "string" && message.length > 0) errorMessage = message;
          } else {
            errorMessage = responseBody;
          }
        } catch {
          errorMessage = responseBody;
        }
      }
    } catch {
      // Keep the method and endpoint in the error if the response body cannot be read.
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
