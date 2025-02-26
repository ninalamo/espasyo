import { apiService } from "./apiService";

/**
 * A reusable helper function that encapsulates API fetching and caching.
 *
 * @param key - The localStorage key under which to store the data.
 * @param url - The API endpoint to fetch data from if not cached.
 * @param transform - A function to transform the API response into the desired format.
 * @returns A promise that resolves to the requested data.
 */
export async function fetchCachedData<T>(key: string, url: string, transform: (data: any) => T): Promise<T> {
  const cached = localStorage.getItem(key);
  if (cached) {
    return JSON.parse(cached) as T;
  } else {
    const response = await apiService.get(url);
    const data = transform(response);
    localStorage.setItem(key, JSON.stringify(data));
    return data;
  }
}
