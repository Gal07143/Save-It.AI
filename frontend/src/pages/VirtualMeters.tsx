import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calculator, Plus, Settings, Zap } from 'lucide-react';

const API_BASE = '/api/v1';

interface VirtualMeter {
  id: number;
  site_id: number;
  name: string;
  description: string | null;
  meter_type: string;
  expression: string | null;
  unit: string;
  is_active: boolean;
}

export default function VirtualMeters() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: virtualMeters, isLoading } = useQuery<VirtualMeter[]>({
    queryKey: ['virtual-meters'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/virtual-meters`);
      return response.json();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calculator className="w-7 h-7 text-purple-600" />
            Virtual Meters & Expression Engine
          </h1>
          <p className="text-gray-500 mt-1">Create calculated, aggregated, and allocated virtual meters</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Virtual Meter
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { type: 'Calculated', icon: Calculator, color: 'blue', desc: 'A + B - C expressions' },
          { type: 'Aggregated', icon: Zap, color: 'green', desc: 'Sum of multiple meters' },
          { type: 'Allocated', icon: Settings, color: 'purple', desc: 'Proportional allocation' },
          { type: 'Differential', icon: Calculator, color: 'orange', desc: 'Main - Sub meters' },
        ].map((item) => (
          <div key={item.type} className={`bg-white rounded-xl shadow-sm p-5 border-l-4 border-${item.color}-500`}>
            <div className="flex items-center gap-3 mb-2">
              <item.icon className={`w-5 h-5 text-${item.color}-600`} />
              <h3 className="font-semibold text-gray-900">{item.type}</h3>
            </div>
            <p className="text-sm text-gray-500">{item.desc}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Virtual Meters</h2>
        
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : (virtualMeters?.length || 0) === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Calculator className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No virtual meters created yet</p>
            <p className="text-sm mt-1">Create virtual meters to calculate derived values</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Your First Virtual Meter
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Expression</th>
                  <th className="pb-3 font-medium">Unit</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {virtualMeters?.map((vm) => (
                  <tr key={vm.id} className="border-b border-gray-50">
                    <td className="py-3 font-medium text-gray-900">{vm.name}</td>
                    <td className="py-3 text-gray-600">{vm.meter_type}</td>
                    <td className="py-3 text-gray-600 font-mono text-xs">{vm.expression || '-'}</td>
                    <td className="py-3 text-gray-600">{vm.unit}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        vm.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {vm.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3">
                      <button className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Expression Examples</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Total Building Load</h3>
            <code className="text-sm bg-gray-200 px-2 py-1 rounded">Meter_A + Meter_B + Meter_C</code>
            <p className="text-xs text-gray-500 mt-2">Sum of all sub-meters</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Unmetered Load</h3>
            <code className="text-sm bg-gray-200 px-2 py-1 rounded">Main_Meter - (Sub1 + Sub2 + Sub3)</code>
            <p className="text-xs text-gray-500 mt-2">Calculate losses or unmetered areas</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Weighted Allocation</h3>
            <code className="text-sm bg-gray-200 px-2 py-1 rounded">Main_Meter * 0.35</code>
            <p className="text-xs text-gray-500 mt-2">35% allocation to tenant</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Net Export</h3>
            <code className="text-sm bg-gray-200 px-2 py-1 rounded">Solar_Production - Building_Load</code>
            <p className="text-xs text-gray-500 mt-2">Track grid export</p>
          </div>
        </div>
      </div>
    </div>
  );
}
