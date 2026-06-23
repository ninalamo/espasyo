'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format, subDays, startOfDay } from 'date-fns';
import withAuth from './hoc/withAuth';
import { apiService } from './api/utils/apiService';
import { IncidentDto } from '../types/crime-record/IncidentDto';

interface PeriodComparison {
  current: number;
  previous: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  isAnomaly: boolean;
}

interface DashboardStats {
  totalIncidents: number;
  recentIncidents: IncidentDto[];
  today: PeriodComparison;
  thisWeek: PeriodComparison;
  thisMonth: PeriodComparison;
  crimeTypeBreakdown: Array<{ type: string; count: number; percentage: number }>;
  severityBreakdown: Array<{ severity: string; count: number; percentage: number }>;
  precinctBreakdown: Array<{ precinct: string; count: number; percentage: number }>;
  isLoading: boolean;
}

function computeComparison(current: number, previous: number): PeriodComparison {
  const changePercent = previous === 0
    ? (current > 0 ? 100 : 0)
    : Math.round(((current - previous) / previous) * 100);
  const trend = changePercent > 5 ? 'up' : changePercent < -5 ? 'down' : 'stable';
  const isAnomaly = previous > 0 && Math.abs(changePercent) > 50;
  return { current, previous, changePercent, trend, isAnomaly };
}

function countInRange(incidents: IncidentDto[], start: Date, end?: Date): number {
  return incidents.filter(i => {
    const d = new Date(i.timeStamp);
    return end ? d >= start && d < end : d >= start;
  }).length;
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') {
    return <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>;
  }
  if (trend === 'down') {
    return <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>;
  }
  return <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" /></svg>;
}

function StatCard({ label, comparison, baselineLabel }: {
  label: string;
  comparison: PeriodComparison;
  baselineLabel: string;
}) {
  const trendColor = comparison.trend === 'stable' ? 'text-gray-500' : comparison.trend === 'up' ? 'text-red-600' : 'text-green-600';
  const changeSign = comparison.changePercent > 0 ? '+' : '';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center relative shadow-sm">
      {comparison.isAnomaly && (
        <span className="absolute top-1 right-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800" title="Unusual spike compared to baseline">
          ANOMALY
        </span>
      )}
      <div className="text-2xl font-bold text-gray-900">{comparison.current}</div>
      <div className={`text-sm ${trendColor} font-medium flex items-center justify-center gap-0.5`}>
        <TrendIcon trend={comparison.trend} />
        <span>{changeSign}{comparison.changePercent}%</span>
      </div>
      <div className="text-xs mt-0.5 text-gray-500">{baselineLabel}</div>
      <div className="text-sm mt-1 text-gray-700 font-medium">{label}</div>
    </div>
  );
}

const Home = () => {
  const { data: session } = useSession();
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalIncidents: 0,
    recentIncidents: [],
    today: { current: 0, previous: 0, changePercent: 0, trend: 'stable', isAnomaly: false },
    thisWeek: { current: 0, previous: 0, changePercent: 0, trend: 'stable', isAnomaly: false },
    thisMonth: { current: 0, previous: 0, changePercent: 0, trend: 'stable', isAnomaly: false },
    crimeTypeBreakdown: [],
    severityBreakdown: [],
    precinctBreakdown: [],
    isLoading: true
  });

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  // Fetch real-time dashboard statistics
  const fetchDashboardStats = async () => {
    try {
      setDashboardStats(prev => ({ ...prev, isLoading: true }));
      
      const response = await apiService.get<{ items: IncidentDto[]; totalCount: number }>(
        '/incident?pageNumber=1&pageSize=500&orderBy=timeStamp&orderDirection=desc'
      );
      
      if (response && response.items) {
        const incidents = response.items;
        const now = new Date();
        const todayStart = startOfDay(now);
        const yesterdayStart = subDays(todayStart, 1);
        const weekAgo = subDays(now, 7);
        const twoWeeksAgo = subDays(now, 14);
        const monthAgo = subDays(now, 30);
        const twoMonthsAgo = subDays(now, 60);
        
        const today = computeComparison(
          countInRange(incidents, todayStart),
          countInRange(incidents, yesterdayStart, todayStart)
        );
        const thisWeek = computeComparison(
          countInRange(incidents, weekAgo),
          countInRange(incidents, twoWeeksAgo, weekAgo)
        );
        const thisMonth = computeComparison(
          countInRange(incidents, monthAgo),
          countInRange(incidents, twoMonthsAgo, monthAgo)
        );
        
        const crimeTypeStats = incidents.reduce((acc: Record<string, number>, incident) => {
          const type = incident.crimeTypeText || 'Unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});
        
        const crimeTypeBreakdown = Object.entries(crimeTypeStats)
          .map(([type, count]) => ({
            type,
            count: count as number,
            percentage: Math.round(((count as number) / incidents.length) * 100)
          }))
          .sort((a, b) => b.count - a.count);
        
        const severityStats = incidents.reduce((acc: Record<string, number>, incident) => {
          const severity = incident.severityText || 'Unknown';
          acc[severity] = (acc[severity] || 0) + 1;
          return acc;
        }, {});
        
        const severityBreakdown = Object.entries(severityStats)
          .map(([severity, count]) => ({
            severity,
            count: count as number,
            percentage: Math.round(((count as number) / incidents.length) * 100)
          }))
          .sort((a, b) => b.count - a.count);
        
        const precinctStats = incidents.reduce((acc: Record<string, number>, incident) => {
          const precinct = incident.policeDistrictText || 'Unknown';
          acc[precinct] = (acc[precinct] || 0) + 1;
          return acc;
        }, {});
        
        const precinctBreakdown = Object.entries(precinctStats)
          .map(([precinct, count]) => ({
            precinct,
            count: count as number,
            percentage: Math.round(((count as number) / incidents.length) * 100)
          }))
          .sort((a, b) => b.count - a.count);
        
        setDashboardStats({
          totalIncidents: response.totalCount || incidents.length,
          recentIncidents: incidents.slice(0, 5),
          today,
          thisWeek,
          thisMonth,
          crimeTypeBreakdown,
          severityBreakdown,
          precinctBreakdown,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setDashboardStats(prev => ({ ...prev, isLoading: false }));
    }
  };

  return (
    <div className="h-full p-6 space-y-6 overflow-auto">
        
        {/* Real-time Statistics */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Crime Statistics Overview</h2>
          </div>
          
          {dashboardStats.isLoading ? (
            <div className="p-6">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
              </div>
            </div>
          ) : (
            <div className="p-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{dashboardStats.totalIncidents.toLocaleString()}</div>
                  <div className="text-sm text-blue-700">Total Incidents</div>
                </div>

                <StatCard
                  label="Today"
                  comparison={dashboardStats.today}
                  baselineLabel="vs yesterday"
                />

                <StatCard
                  label="This Week"
                  comparison={dashboardStats.thisWeek}
                  baselineLabel="vs last week"
                />

                <StatCard
                  label="This Month"
                  comparison={dashboardStats.thisMonth}
                  baselineLabel="vs last month"
                />
              </div>
              
              {/* Breakdown Charts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Crime Type Breakdown */}
                <div>
                  <h4 className="font-medium text-gray-800 mb-3">Crime Types</h4>
                  <div className="space-y-2">
                    {dashboardStats.crimeTypeBreakdown.slice(0, 5).map((item, index) => (
                      <div key={item.type} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                          <span className="text-sm">{item.type}</span>
                        </div>
                        <div className="text-sm font-medium">{item.count} ({item.percentage}%)</div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Severity Breakdown */}
                <div>
                  <h4 className="font-medium text-gray-800 mb-3">Severity Levels</h4>
                  <div className="space-y-2">
                    {dashboardStats.severityBreakdown.map((item, index) => (
                      <div key={item.severity} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-2 ${
                            item.severity === 'High' ? 'bg-red-500' :
                            item.severity === 'Medium' ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}></div>
                          <span className="text-sm">{item.severity}</span>
                        </div>
                        <div className="text-sm font-medium">{item.count} ({item.percentage}%)</div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Recent Incidents */}
                <div>
                  <h4 className="font-medium text-gray-800 mb-3">Recent Incidents</h4>
                  <div className="space-y-2">
                    {dashboardStats.recentIncidents.map((incident) => (
                      <div key={incident.id} className="p-2 bg-gray-50 rounded text-sm">
                        <div className="font-medium">{incident.caseId}</div>
                        <div className="text-gray-600">{incident.crimeTypeText}</div>
                        <div className="text-xs text-gray-500">
                          {format(new Date(incident.timeStamp), 'MMM dd, HH:mm')}
                        </div>
                      </div>
                    ))}
                    {dashboardStats.recentIncidents.length === 0 && (
                      <div className="text-center text-gray-500 py-4">No recent incidents</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
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

        {/* Analysis Link */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-800">Crime Analysis</h2>
            </div>
            <Link
              href="/analysis"
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition text-sm"
            >
              View Analysis Details
              <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

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
  );
};

export default withAuth(Home);
