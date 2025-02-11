'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import withAuth from '../hoc/withAuth';
import { CrimeListItemDto } from './CrimeListItemDto';
import {apiService} from '../api/utils/apiService'; // Import apiService

const CrimeList = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [crimeRecords, setCrimeRecords] = useState<CrimeListItemDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect to login if the user is not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-screen text-gray-700">Loading...</div>;
  }

  if (!session) {
    return null;
  }

  // Fetch crime records using apiService
  useEffect(() => {
    apiService
      .get<CrimeListItemDto[]>('/crimes')
      .then(setCrimeRecords)
      .catch(() => setError('Failed to load crime records'))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Crime Records</h1>

      {/* Navigation to Add New Crime and Bulk Upload Pages */}
      <div className="mb-4 flex space-x-4">
        <Link href="/crime-record/add">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition">
            Add New Entry
          </button>
        </Link>

        <Link href="/crime-record/bulk-upload">
          <button className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition">
            Bulk Upload
          </button>
        </Link>
      </div>

      {/* Loader & Error Handling */}
      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="text-center text-red-500 mt-6 text-lg">{error}</div>
      ) : crimeRecords.length === 0 ? (
        <div className="text-center text-gray-500 mt-6 text-lg">Nothing to display</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="border p-2">ID</th>
                <th className="border p-2">Case ID</th>
                <th className="border p-2">Crime Type</th>
                <th className="border p-2">Address</th>
                <th className="border p-2">Severity</th>
                <th className="border p-2">Date & Time</th>
                <th className="border p-2">Motive</th>
                <th className="border p-2">Status</th>
                <th className="border p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {crimeRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="border p-2">{record.id}</td>
                  <td className="border p-2">{record.caseId}</td>
                  <td className="border p-2">{record.crimeType}</td>
                  <td className="border p-2">{record.address}</td>
                  <td className="border p-2">{record.severity}</td>
                  <td className="border p-2">{record.datetime}</td>
                  <td className="border p-2">{record.motive}</td>
                  <td className="border p-2">{record.status}</td>
                  <td className="border p-2">
                    <Link href={`/crime-record/${record.id}`}>
                      <button className="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 transition">
                        View
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default withAuth(CrimeList);
