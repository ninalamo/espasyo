'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CrimeDetailDto } from '../../../types/crime-record/CrimeDetailDto';
import {apiService} from '../../api/utils/apiService';
import withAuth from '../../../components/hoc/withAuth';

const CrimeDetailsPage = () => {
  const { id } = useParams(); // Get crime ID from the URL
  const [crimeRecord, setCrimeRecord] = useState<CrimeDetailDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      apiService
        .get<CrimeDetailDto>(`/crimes/${id}`)
        .then(setCrimeRecord)
        .catch(() => setError("Failed to load crime record"))
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-gray-700">
        <h1 className="text-xl font-semibold mb-4">Loading Crime Record...</h1>
      </div>
    );
  }

  if (error || !crimeRecord) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-gray-700">
        <h1 className="text-xl font-semibold mb-4">Crime Record Not Found</h1>
        <Link href="/crime-record">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
            Back to List
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Crime Details</h1>

      <div className="bg-white shadow-md rounded-lg p-6 border border-gray-300">
        <p className="text-lg">
          <strong>ID:</strong> {crimeRecord.id}
        </p>
        <p className="text-lg">
          <strong>Case ID:</strong> {crimeRecord.caseId}
        </p>
        <p className="text-lg">
          <strong>Crime Type:</strong> {crimeRecord.crimeType}
        </p>
        <p className="text-lg">
          <strong>Address:</strong> {crimeRecord.address}
        </p>
        <p className="text-lg">
          <strong>Severity:</strong> {crimeRecord.severity}
        </p>
        <p className="text-lg">
          <strong>Date & Time:</strong> {crimeRecord.datetime}
        </p>
        <p className="text-lg">
          <strong>Motive:</strong> {crimeRecord.motive}
        </p>
        <p className="text-lg">
          <strong>Status:</strong> {crimeRecord.status}
        </p>
      </div>

      <div className="mt-6">
        <Link href="/crime-record">
          <button className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition">
            Back to List
          </button>
        </Link>
      </div>
    </div>
  );
};

export default withAuth(CrimeDetailsPage);
