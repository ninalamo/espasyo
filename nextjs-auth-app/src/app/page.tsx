'use client';

import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import withAuth from './hoc/withAuth';
import { Cluster } from '../types/analysis/ClusterDto';
import { GetPrecinctsDictionary, CrimeTypesDictionary } from '../constants/consts';

interface DashboardData {
  lastAnalysisClusters: Cluster[] | null;
  lastAnalysisParams: any | null;
  lastAnalysisTimestamp: string | null;
  analysisLoaded: boolean;
}

const Home = () => {
  const { data: session } = useSession();
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    lastAnalysisClusters: null,
    lastAnalysisParams: null,
    lastAnalysisTimestamp: null,
    analysisLoaded: false
  });

  // Load dashboard data from localStorage
  useEffect(() => {
    const loadDashboardData = () => {
      try {
        const clusters = localStorage.getItem('lastAnalysisClusters');
        const params = localStorage.getItem('lastAnalysisParams');
        const timestamp = localStorage.getItem('lastAnalysisTimestamp');
        
        setDashboardData({
          lastAnalysisClusters: clusters ? JSON.parse(clusters) : null,
          lastAnalysisParams: params ? JSON.parse(params) : null,
          lastAnalysisTimestamp: timestamp,
          analysisLoaded: !!(clusters && params)
        });
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      }
    };

    loadDashboardData();
  }, []);

  // Calculate analysis summary statistics
  const analysisSummary = dashboardData.lastAnalysisClusters ? {
    totalCases: dashboardData.lastAnalysisClusters.reduce((sum: number, c: Cluster) => sum + (c.clusterCount || 0), 0),
    totalClusters: dashboardData.lastAnalysisClusters.length,
    precincts: new Set(dashboardData.lastAnalysisClusters.flatMap((c: Cluster) => c.clusterItems.map(i => i.precinct))),
    crimeTypes: new Set(dashboardData.lastAnalysisClusters.flatMap((c: Cluster) => c.clusterItems.map(i => i.crimeType))),
    timeRange: dashboardData.lastAnalysisClusters.flatMap((c: Cluster) => c.clusterItems.map(i => new Date(i.year, i.month - 1)))
      .reduce((acc: {min: Date | null, max: Date | null}, date: Date) => ({
        min: !acc.min || date < acc.min ? date : acc.min,
        max: !acc.max || date > acc.max ? date : acc.max
      }), { min: null, max: null }),
    analysisDate: dashboardData.lastAnalysisTimestamp ? new Date(dashboardData.lastAnalysisTimestamp).toLocaleString() : 'Unknown'
  } : null;

  // Get top crime types and precincts
  const topInsights = dashboardData.lastAnalysisClusters ? {
    topCrimeTypes: Object.entries(
      dashboardData.lastAnalysisClusters.flatMap((c: Cluster) => c.clusterItems)
        .reduce((acc: Record<number, number>, item) => {
          acc[item.crimeType] = (acc[item.crimeType] || 0) + 1;
          return acc;
        }, {})
    ).sort(([,a], [,b]) => (b as number) - (a as number)).slice(0, 5),
    
    topPrecincts: Object.entries(
      dashboardData.lastAnalysisClusters.flatMap((c: Cluster) => c.clusterItems)
        .reduce((acc: Record<number, number>, item) => {
          acc[item.precinct] = (acc[item.precinct] || 0) + 1;
          return acc;
        }, {})
    ).sort(([,a], [,b]) => (b as number) - (a as number)).slice(0, 5)
  } : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Crime Analytics Dashboard</h1>
              <p className="text-gray-600">Welcome back, {session?.user?.name || session?.user?.email}</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Last updated: {new Date().toLocaleString()}
              </div>
              <button
                onClick={() => signOut()}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-8">
        
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/crime-record" className="block">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition group">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900 group-hover:text-blue-600 transition">Manage Records</h3>
                  <p className="text-sm text-gray-500">Add, view, and manage crime records</p>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/analysis" className="block">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition group">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900 group-hover:text-purple-600 transition">Run Analysis</h3>
                  <p className="text-sm text-gray-500">Analyze crime patterns and clusters</p>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/forecast" className="block">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition group">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900 group-hover:text-green-600 transition">Generate Forecast</h3>
                  <p className="text-sm text-gray-500">Predict future crime trends</p>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Analysis Status */}
        {analysisSummary ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Latest Analysis Results
                </h2>
                <div className="text-sm text-gray-500">
                  {analysisSummary.analysisDate}
                </div>
              </div>
            </div>
            
            <div className="p-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{analysisSummary.totalCases.toLocaleString()}</div>
                  <div className="text-sm text-gray-600">Total Cases</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{analysisSummary.totalClusters}</div>
                  <div className="text-sm text-gray-600">Crime Clusters</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{analysisSummary.precincts.size}</div>
                  <div className="text-sm text-gray-600">Barangays</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{analysisSummary.crimeTypes.size}</div>
                  <div className="text-sm text-gray-600">Crime Types</div>
                </div>
              </div>

              {/* Time Range */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="text-sm font-medium text-gray-700 mb-2">Analysis Period</div>
                <div className="text-lg">
                  {analysisSummary.timeRange.min && analysisSummary.timeRange.max ? 
                    `${format(analysisSummary.timeRange.min, 'MMM yyyy')} - ${format(analysisSummary.timeRange.max, 'MMM yyyy')}` : 
                    'Date range not available'
                  }
                </div>
              </div>

              {/* Top Insights */}
              {topInsights && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-800 mb-3">Top Crime Types</h4>
                    <div className="space-y-2">
                      {topInsights.topCrimeTypes.map(([crimeType, count], index) => {
                        const crimeTypeName = CrimeTypesDictionary[parseInt(crimeType)] || `Crime Type ${crimeType}`;
                        return (
                          <div key={crimeType} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                            <div className="flex items-center">
                              <span className="text-sm font-medium text-gray-600 mr-2">#{index + 1}</span>
                              <span className="text-sm">{crimeTypeName}</span>
                            </div>
                            <span className="text-sm font-bold text-blue-600">{count as number}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-800 mb-3">Top Affected Barangays</h4>
                    <div className="space-y-2">
                      {topInsights.topPrecincts.map(([precinct, count], index) => {
                        const precinctName = GetPrecinctsDictionary[parseInt(precinct)] || `Precinct ${precinct}`;
                        return (
                          <div key={precinct} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                            <div className="flex items-center">
                              <span className="text-sm font-medium text-gray-600 mr-2">#{index + 1}</span>
                              <span className="text-sm">{precinctName}</span>
                            </div>
                            <span className="text-sm font-bold text-purple-600">{count as number}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-start">
              <svg className="w-6 h-6 text-yellow-600 mr-3 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.865-.833-2.635 0L4.178 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 className="font-medium text-yellow-800 mb-2">No Analysis Data Available</h3>
                <p className="text-sm text-yellow-700 mb-4">
                  You haven't run any crime analysis yet. Start by analyzing your crime data to see patterns and generate insights.
                </p>
                <Link
                  href="/analysis"
                  className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition text-sm"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Run Your First Analysis
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* System Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              System Information
            </h2>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-800 mb-3">Available Features</h4>
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Crime Record Management
                  </div>
                  <div className="flex items-center text-sm">
                    <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    K-Means Clustering Analysis
                  </div>
                  <div className="flex items-center text-sm">
                    <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Interactive Maps & Visualizations
                  </div>
                  <div className="flex items-center text-sm">
                    <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Statistical Forecasting
                  </div>
                  <div className="flex items-center text-sm">
                    <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Data Export & Reporting
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-800 mb-3">Coverage Area</h4>
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-lg font-medium text-blue-800">Muntinlupa City</div>
                  <div className="text-sm text-blue-600 mt-1">9 Barangays Covered:</div>
                  <div className="text-xs text-blue-600 mt-2">
                    Alabang, Ayala Alabang, Bayanan, Buli, Cupang, Poblacion, Putatan, Sucat, Tunasan
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default withAuth(Home);
