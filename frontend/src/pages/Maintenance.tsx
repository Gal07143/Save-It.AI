import { useQuery } from '@tanstack/react-query';
import { Wrench, AlertTriangle, CheckCircle, Clock, ThermometerSun, Zap } from 'lucide-react';

const API_BASE = '/api/v1';

export default function Maintenance() {
  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['maintenance-alerts'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/maintenance/alerts`);
      return response.json();
    },
  });

  const { data: conditions } = useQuery({
    queryKey: ['asset-conditions'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/maintenance/asset-conditions`);
      return response.json();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Wrench className="w-7 h-7 text-orange-600" />
          Predictive Maintenance
        </h1>
        <p className="text-gray-500 mt-1">Monitor asset health, detect anomalies, and plan maintenance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">85%</p>
              <p className="text-sm text-gray-500">Healthy Assets</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{alerts?.filter((a: any) => a.status === 'open').length || 0}</p>
              <p className="text-sm text-gray-500">Active Alerts</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">3</p>
              <p className="text-sm text-gray-500">Scheduled Maintenance</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <ThermometerSun className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">92.5</p>
              <p className="text-sm text-gray-500">Avg Health Score</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Active Alerts
          </h2>
          
          {alertsLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (alerts?.length || 0) === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p>No active maintenance alerts</p>
              <p className="text-sm">All systems operating normally</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts?.map((alert: any) => (
                <div key={alert.id} className="p-4 bg-gray-50 rounded-lg border-l-4 border-amber-500">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">{alert.title}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                      alert.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{alert.description}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <button className="text-sm text-blue-600 hover:text-blue-800">Acknowledge</button>
                    <button className="text-sm text-green-600 hover:text-green-800">Resolve</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Maintenance Rules</h2>
          <div className="space-y-3">
            {[
              { name: 'Overload Detection', type: 'overload', threshold: '>85% rated capacity', active: true },
              { name: 'Power Factor Degradation', type: 'pf_degradation', threshold: '<0.85 PF trend', active: true },
              { name: 'Temperature Anomaly', type: 'temperature', threshold: '>45°C sustained', active: true },
              { name: 'Power Quality Issues', type: 'power_quality', threshold: 'THD >5%', active: false },
              { name: 'Lifecycle Alert', type: 'lifecycle', threshold: '<20% remaining life', active: true },
            ].map((rule, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{rule.name}</p>
                  <p className="text-xs text-gray-500">{rule.threshold}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  rule.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {rule.active ? 'Active' : 'Disabled'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Asset Health Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {['Excellent', 'Good', 'Fair', 'Poor', 'Critical'].map((condition, idx) => (
            <div key={condition} className="text-center p-4 bg-gray-50 rounded-lg">
              <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${
                condition === 'Excellent' ? 'bg-green-500' :
                condition === 'Good' ? 'bg-blue-500' :
                condition === 'Fair' ? 'bg-amber-500' :
                condition === 'Poor' ? 'bg-orange-500' :
                'bg-red-500'
              }`}>
                <Zap className="w-6 h-6 text-white" />
              </div>
              <p className="font-semibold text-gray-900">{Math.floor(Math.random() * 10 + 1)}</p>
              <p className="text-sm text-gray-500">{condition}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
