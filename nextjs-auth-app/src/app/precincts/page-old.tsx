'use client';

import DashboardLayout from '../../components/DashboardLayout';

export default function PrecinctsPageOld() {
  // This is a backup/old version of the precincts page
  // The main functionality is now in page.tsx
  
  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h1 className="text-xl font-semibold text-yellow-800 mb-2">Legacy Precincts Page</h1>
          <p className="text-yellow-700">
            This is a backup version of the precincts page. The current functionality is available in the main Precincts page.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}