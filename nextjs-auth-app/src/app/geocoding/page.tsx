"use client";

import { useState } from "react";
import GeocodingLookup from "../../components/GeocodingLookup";
import withAuth from "../hoc/withAuth";

function GeocodingPage() {
  const [address, setAddress] = useState("");

  return (
    <main className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <header>
          <h1 className="text-2xl font-semibold">Address Geocoding</h1>
          <p className="mt-2 text-sm text-gray-600">
            Find coordinates for an address and verify the matched point on a map.
          </p>
        </header>

        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div>
            <label htmlFor="geocoding-address" className="mb-1 block text-sm font-medium">
              Address
            </label>
            <textarea
              id="geocoding-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 p-3"
              placeholder="Enter a complete address"
            />
          </div>
          <GeocodingLookup address={address} />
        </section>
      </div>
    </main>
  );
}

export default withAuth(GeocodingPage);
