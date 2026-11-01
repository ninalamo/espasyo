"use client";

import { useState } from "react";
import { geocodeAddress } from "../app/api/utils/geocodingApi";
import { GeocodingResult } from "../types/geocoding/GeocodingResult";

interface GeocodingLookupProps {
  address: string;
  onResultChange?: (result: GeocodingResult | null, address: string) => void;
}

export default function GeocodingLookup({
  address,
  onResultChange,
}: GeocodingLookupProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [lookupAddress, setLookupAddress] = useState("");
  const [result, setResult] = useState<GeocodingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLookup = async () => {
    const requestedAddress = address.trim();
    if (!requestedAddress) {
      setError("Enter an address before looking up coordinates.");
      setResult(null);
      setLookupAddress("");
      onResultChange?.(null, address);
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setLookupAddress(requestedAddress);
    onResultChange?.(null, requestedAddress);

    try {
      const geocodedResult = await geocodeAddress(requestedAddress);
      setResult(geocodedResult);
      onResultChange?.(geocodedResult, requestedAddress);
    } catch (lookupError) {
      const message =
        lookupError instanceof Error ? lookupError.message : "The geocoding request failed.";
      setError(
        message.toLowerCase().includes("no coordinates found")
          ? "No coordinates were found for this address. Check the address and try again."
          : `Could not look up this address: ${message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resultIsCurrent = result !== null && lookupAddress === address.trim();
  const errorIsCurrent = error !== null && (lookupAddress === "" || lookupAddress === address.trim());
  const mapUrl = resultIsCurrent
    ? `https://www.openstreetmap.org/?mlat=${result.latitude}&mlon=${result.longitude}#map=17/${result.latitude}/${result.longitude}`
    : null;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleLookup}
        disabled={isLoading}
        className="rounded-md bg-ubuntu-500 px-4 py-2 text-sm font-medium text-white hover:bg-ubuntu-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "Looking up address..." : "Look up coordinates"}
      </button>

      <div aria-live="polite">
        {errorIsCurrent && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        {resultIsCurrent && result && mapUrl && (
          <section className="rounded-md border border-green-200 bg-green-50 p-4 text-sm">
            <h3 className="font-semibold text-green-900">Coordinates found</h3>
            <p className="mt-2 text-gray-800">
              <span className="font-medium">Matched address:</span> {result.formattedAddress}
            </p>
            <dl className="mt-2 grid grid-cols-1 gap-1 text-gray-800 sm:grid-cols-2">
              <div>
                <dt className="inline font-medium">Latitude: </dt>
                <dd className="inline">{result.latitude}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Longitude: </dt>
                <dd className="inline">{result.longitude}</dd>
              </div>
            </dl>
            <a
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block font-medium text-blue-700 underline"
            >
              Verify this point on OpenStreetMap
            </a>
          </section>
        )}
      </div>
    </div>
  );
}
