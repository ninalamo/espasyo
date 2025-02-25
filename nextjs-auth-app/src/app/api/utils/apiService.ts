import API_BASE_URL from "./apiConfig";

async function handleResponse(response: Response, method: string, endpoint: string) {
  if (!response.ok) {
    let errorMessage = `${method} ${endpoint} failed`;

    try {
      const errorBody = await response.json();
      errorMessage = errorBody?.message || errorMessage; // Extract "message" if available
    } catch {
      // If JSON parsing fails, fallback to default errorMessage
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

export const apiService = {
  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    return handleResponse(response, "GET", endpoint);
  },

  async post<T>(endpoint: string, body: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return handleResponse(response, "POST", endpoint);
  },

  async put<T>(endpoint: string, body: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return handleResponse(response, "PUT", endpoint);
  },

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "DELETE",
    });

    return handleResponse(response, "DELETE", endpoint);
  },
};