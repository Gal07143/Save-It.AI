import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { TrendingUp, Clock, Target, Zap, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

const API_BASE = '/api/v1';

export default function Forecasting() {
  const [forecastType, setForecastType] = useState<'load' | 'pv'>('load');
  const [horizonHours, setHorizonHours] = useState(24);

  const forecastMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_BASE}/forecasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: 1,
          forecast_type: forecastType,
          horizon_hours: horizonHours,
        }),
      });
      return response.json();
    },
  });

  const generateMockForecast = () => {
    const data = [];
    const now = new Date();
    for (let i = 0; i < horizonHours; i++) {
      const hour = new Date(now.getTime() + i * 60 * 60 * 1000);
      const hourOfDay = hour.getHours();
      const baseLoad = forecastType === 'load' 
        ? 100 + 50 * Math.sin((hourOfDay - 6) * Math.PI / 12) + Math.random() * 20
        : Math.max(0, 80 * Math.sin((hourOfDay - 6) * Math.PI / 12) + Math.random() * 10);
      
      data.push({
        time: hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        predicted: Math.max(0, baseLoad),
        lower: Math.max(0, baseLoad * 0.85),
        upper: baseLoad * 1.15,
      });
    }
    return data;
  };

  const forecastData = forecastMutation.data?.data?.length 
    ? forecastMutation.data.data.map((p: any) => ({
        time: new Date(p.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        predicted: p.predicted_value,
        lower: p.lower_bound,
        upper: p.upper_bound,
      }))
    : generateMockForecast();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-indigo-600" />
            Load & PV Forecasting
          </h1>
          <p className="text-gray-500 mt-1">Predict future energy consumption and solar production</p>
        </div>
        <button
          onClick={() => forecastMutation.mutate()}
          disabled={forecastMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${forecastMutation.isPending ? 'animate-spin' : ''}`} />
          Generate Forecast
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{Math.round(forecastData.reduce((sum: number, p: any) => sum + p.predicted, 0))} kWh</p>
              <p className="text-sm text-gray-500">Total Predicted</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Zap className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{Math.round(Math.max(...forecastData.map((p: any) => p.predicted)))} kW</p>
              <p className="text-sm text-gray-500">Peak Predicted</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Target className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">85%</p>
              <p className="text-sm text-gray-500">Confidence</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{horizonHours}h</p>
              <p className="text-sm text-gray-500">Horizon</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Forecast Type</label>
              <div className="space-y-2">
                {[
                  { id: 'load', label: 'Load Forecast', desc: 'Predict consumption' },
                  { id: 'pv', label: 'PV Forecast', desc: 'Predict solar production' },
                ].map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setForecastType(type.id as any)}
                    className={`w-full p-3 rounded-lg border text-left ${
                      forecastType === type.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{type.label}</p>
                    <p className="text-xs text-gray-500">{type.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Horizon (hours)</label>
              <select
                value={horizonHours}
                onChange={(e) => setHorizonHours(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
                <option value={72}>72 hours</option>
                <option value={168}>1 week</option>
              </select>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {forecastType === 'load' ? 'Load' : 'PV Production'} Forecast
          </h2>
          
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="transparent"
                  fill="#c7d2fe"
                  fillOpacity={0.3}
                />
                <Area
                  type="monotone"
                  dataKey="lower"
                  stroke="transparent"
                  fill="white"
                />
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 flex items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-indigo-600" />
              <span>Predicted</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-indigo-200 opacity-50 rounded" />
              <span>Confidence Interval</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
