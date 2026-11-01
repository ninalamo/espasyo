import { apiService } from "./apiService";
import { GeocodingResult } from "../../../types/geocoding/GeocodingResult";

export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  const result = await apiService.get<GeocodingResult>(
    `/Geocoding?address=${encodeURIComponent(address)}`
  );

  if (
    !result ||
    typeof result !== "object" ||
    !Number.isFinite(result.latitude) ||
    result.latitude < -90 ||
    result.latitude > 90 ||
    !Number.isFinite(result.longitude) ||
    result.longitude < -180 ||
    result.longitude > 180 ||
    typeof result.formattedAddress !== "string" ||
    result.formattedAddress.trim().length === 0
  ) {
    throw new Error("The geocoding service returned an invalid result.");
  }

  return result;
}
