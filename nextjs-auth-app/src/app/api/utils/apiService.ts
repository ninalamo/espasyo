import API_BASE_URL from "./apiConfig";

/**
 * Handles the response from the fetch call.
 *
 * Checks if the response is OK (status in the range 200-299). If not, it attempts
 * to extract an error message from the response body. If extraction fails, it uses
 * a default error message based on the HTTP method and endpoint.
 *
 * @param {Response} response - The Response object from fetch.
 * @param {string} method - The HTTP method used (e.g., "GET", "POST").
 * @param {string} endpoint - The API endpoint that was called.
 * @returns {Promise<any>} - A promise that resolves with the parsed JSON data.
 * @throws {Error} - Throws an error with a descriptive message if the response is not ok.
 */
async function handleResponse(response: Response, method: string, endpoint: string) {
  if (!response.ok) {
    let errorMessage = `${method} ${endpoint} failed`;

    try {
      // Attempt to extract error message from response body
      const errorBody = await response.json();
      errorMessage = errorBody?.message || errorMessage;
    } catch {
      // If JSON parsing fails, fallback to default errorMessage
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * apiService object provides helper methods for making HTTP requests.
 *
 * Each method constructs a URL based on the API_BASE_URL and the provided endpoint,
 * makes a fetch call with the appropriate options, and then handles the response.
 *
 * The methods are generic to allow type-safe returns.
 */
export const apiService = {
  /**
   * Sends a GET request to the specified endpoint.
   *
   * @template T
   * @param {string} endpoint - The API endpoint to send the GET request to.
   * @returns {Promise<T>} - A promise that resolves with the response data.
   */
  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    return handleResponse(response, "GET", endpoint);
  },

  /**
   * Sends a POST request to the specified endpoint with a JSON body.
   *
   * @template T
   * @param {string} endpoint - The API endpoint to send the POST request to.
   * @param {any} body - The payload to be sent in the request body.
   * @returns {Promise<T>} - A promise that resolves with the response data.
   */
  async post<T>(endpoint: string, body: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return handleResponse(response, "POST", endpoint);
  },

  /**
   * Sends a PUT request to the specified endpoint with a JSON body.
   *
   * @template T
   * @param {string} endpoint - The API endpoint to send the PUT request to.
   * @param {any} body - The payload to be sent in the request body.
   * @returns {Promise<T>} - A promise that resolves with the response data.
   */
  async put<T>(endpoint: string, body: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    return handleResponse(response, "PUT", endpoint);
  },

  /**
   * Sends a DELETE request to the specified endpoint.
   *
   * @template T
   * @param {string} endpoint - The API endpoint to send the DELETE request to.
   * @returns {Promise<T>} - A promise that resolves with the response data.
   */
  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "DELETE",
    });

    return handleResponse(response, "DELETE", endpoint);
  },
};
