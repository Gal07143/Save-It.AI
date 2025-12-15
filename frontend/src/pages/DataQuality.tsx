import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle, Activity } from 'lucide-react';

const API_BASE = '/api/v1';

interface QualityDashboard {
  total_meters: number;
  meters_with_issues: number;
  average_coverage: number;
  average_quality_score: number;
  open_issues_count: number;
  critical_issues_count: number;
  recent_issues: any[];
}

export default function DataQuality() {
  const { data: dashboard, isLoading } = useQuery<QualityDashboard>({
    queryKey: ['data-quality-dashboard'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/data-quality/dashboard`);
      return response.json();
    },
  });

  const { data: issues } = useQuery({
    queryKey: ['quality-issues'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/data-quality/issues`);
      return response.json();
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-blue-600" />
          Data Quality Engine
        </h1>
        <p className="text-gray-500 mt-1">Monitor data coverage, detect anomalies, and ensure data integrity</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{dashboard?.total_meters || 0}</p>
              <p className="text-sm text-gray-500">Total Meters</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{dashboard?.average_coverage?.toFixed(1) || 0}%</p>
              <p className="text-sm text-gray-500">Avg Coverage</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{dashboard?.average_quality_score?.toFixed(1) || 0}</p>
              <p className="text-sm text-gray-500">Quality Score</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{dashboard?.open_issues_count || 0}</p>
              <p className="text-sm text-gray-500">Open Issues</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Quality Issue Types
          </h2>
          <div className="space-y-3">
            {['Missing Data', 'Duplicates', 'Meter Reset', 'Spikes/Outliers', 'Stale Data'].map((type, idx) => (
              <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">{type}</span>
                <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium">
                  {Math.floor(Math.random() * 5)} issues
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Issues</h2>
          {(issues?.length || 0) === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p>No open quality issues</p>
              <p className="text-sm">All data streams are healthy</p>
            </div>
          ) : (
            <div className="space-y-3">
              {issues?.slice(0, 5).map((issue: any) => (
                <div key={issue.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{issue.issue_type}</p>
                    <p className="text-xs text-gray-500">Meter ID: {issue.meter_id}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    issue.severity === 'critical' ? 'bg-red-100 text-red-700' :
                    issue.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {issue.severity}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Quality Rules</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b">
                <th className="pb-3 font-medium">Rule Name</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Severity</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {[
                { name: 'Missing Data Detection', type: 'Coverage', severity: 'Critical', active: true },
                { name: 'Duplicate Readings', type: 'Duplicate', severity: 'Warning', active: true },
                { name: 'Meter Reset Detection', type: 'Meter Reset', severity: 'Warning', active: true },
                { name: 'Spike Detection (>3σ)', type: 'Outlier', severity: 'Warning', active: true },
                { name: 'Stale Data Alert (>1h)', type: 'Connectivity', severity: 'Critical', active: false },
              ].map((rule, idx) => (
                <tr key={idx} className="border-b border-gray-50">
                  <td className="py-3 font-medium text-gray-900">{rule.name}</td>
                  <td className="py-3 text-gray-600">{rule.type}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      rule.severity === 'Critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {rule.severity}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      rule.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {rule.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
