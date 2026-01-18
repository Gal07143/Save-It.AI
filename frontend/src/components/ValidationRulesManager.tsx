import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ValidationRule } from '../services/api'
import { Shield, Plus, Trash2, Edit2, CheckCircle, XCircle } from 'lucide-react'

interface ValidationRulesManagerProps {
  siteId?: number
  dataSourceId?: number
}

export default function ValidationRulesManager({ siteId, dataSourceId }: ValidationRulesManagerProps) {
  const queryClient = useQueryClient()
  const effectiveSiteId = siteId
  
  const [showAddRule, setShowAddRule] = useState(false)
  const [editingRule, setEditingRule] = useState<ValidationRule | null>(null)
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    rule_type: 'range' as ValidationRule['rule_type'],
    severity: 'warning' as ValidationRule['severity'],
    min_value: '',
    max_value: '',
    rate_of_change_max: '',
    rate_of_change_period_seconds: '',
    stale_threshold_seconds: '',
    action_on_violation: 'log'
  })

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['validation-rules', effectiveSiteId, dataSourceId],
    queryFn: () => api.validationRules.list(effectiveSiteId, dataSourceId),
    enabled: !!effectiveSiteId
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<ValidationRule>) => api.validationRules.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validation-rules'] })
      setShowAddRule(false)
      resetForm()
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ValidationRule> }) => 
      api.validationRules.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validation-rules'] })
      setEditingRule(null)
      resetForm()
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.validationRules.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['validation-rules'] })
  })

  const resetForm = () => {
    setNewRule({
      name: '',
      description: '',
      rule_type: 'range',
      severity: 'warning',
      min_value: '',
      max_value: '',
      rate_of_change_max: '',
      rate_of_change_period_seconds: '',
      stale_threshold_seconds: '',
      action_on_violation: 'log'
    })
  }

  const handleSubmit = () => {
    const payload: Partial<ValidationRule> = {
      site_id: effectiveSiteId!,
      data_source_id: dataSourceId || undefined,
      name: newRule.name,
      description: newRule.description || undefined,
      rule_type: newRule.rule_type,
      severity: newRule.severity,
      is_active: true,
      action_on_violation: newRule.action_on_violation
    }

    if (newRule.rule_type === 'min_value' || newRule.rule_type === 'range') {
      payload.min_value = newRule.min_value ? parseFloat(newRule.min_value) : undefined
    }
    if (newRule.rule_type === 'max_value' || newRule.rule_type === 'range') {
      payload.max_value = newRule.max_value ? parseFloat(newRule.max_value) : undefined
    }
    if (newRule.rule_type === 'rate_of_change') {
      payload.rate_of_change_max = newRule.rate_of_change_max ? parseFloat(newRule.rate_of_change_max) : undefined
      payload.rate_of_change_period_seconds = newRule.rate_of_change_period_seconds ? parseInt(newRule.rate_of_change_period_seconds) : undefined
    }
    if (newRule.rule_type === 'stale_data') {
      payload.stale_threshold_seconds = newRule.stale_threshold_seconds ? parseInt(newRule.stale_threshold_seconds) : undefined
    }

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-400/20'
      case 'error': return 'text-orange-400 bg-orange-400/20'
      default: return 'text-yellow-400 bg-yellow-400/20'
    }
  }

  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case 'min_value': return 'Minimum Value'
      case 'max_value': return 'Maximum Value'
      case 'rate_of_change': return 'Rate of Change'
      case 'stale_data': return 'Stale Data'
      case 'range': return 'Value Range'
      default: return type
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-500" />
          <h3 className="text-lg font-semibold text-white">Validation Rules</h3>
          <span className="px-2 py-0.5 bg-slate-700 rounded-full text-xs text-slate-300">
            {rules.length} rules
          </span>
        </div>
        <button
          onClick={() => setShowAddRule(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Rule
        </button>
      </div>

      {(showAddRule || editingRule) && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
          <h4 className="text-white font-medium">
            {editingRule ? 'Edit Validation Rule' : 'New Validation Rule'}
          </h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Rule Name</label>
              <input
                type="text"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="e.g., Voltage Range Check"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Rule Type</label>
              <select
                value={newRule.rule_type}
                onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value as ValidationRule['rule_type'] })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="range">Value Range (Min/Max)</option>
                <option value="min_value">Minimum Value</option>
                <option value="max_value">Maximum Value</option>
                <option value="rate_of_change">Rate of Change</option>
                <option value="stale_data">Stale Data Detection</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Description</label>
            <textarea
              value={newRule.description}
              onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
              rows={2}
              placeholder="Describe what this rule checks..."
            />
          </div>

          {(newRule.rule_type === 'min_value' || newRule.rule_type === 'range') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Minimum Value</label>
                <input
                  type="number"
                  value={newRule.min_value}
                  onChange={(e) => setNewRule({ ...newRule, min_value: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="0"
                />
              </div>
              {newRule.rule_type === 'range' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Maximum Value</label>
                  <input
                    type="number"
                    value={newRule.max_value}
                    onChange={(e) => setNewRule({ ...newRule, max_value: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                    placeholder="100"
                  />
                </div>
              )}
            </div>
          )}

          {newRule.rule_type === 'max_value' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Maximum Value</label>
              <input
                type="number"
                value={newRule.max_value}
                onChange={(e) => setNewRule({ ...newRule, max_value: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="100"
              />
            </div>
          )}

          {newRule.rule_type === 'rate_of_change' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Max Rate of Change</label>
                <input
                  type="number"
                  value={newRule.rate_of_change_max}
                  onChange={(e) => setNewRule({ ...newRule, rate_of_change_max: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="10"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Period (seconds)</label>
                <input
                  type="number"
                  value={newRule.rate_of_change_period_seconds}
                  onChange={(e) => setNewRule({ ...newRule, rate_of_change_period_seconds: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="60"
                />
              </div>
            </div>
          )}

          {newRule.rule_type === 'stale_data' && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">Stale Threshold (seconds)</label>
              <input
                type="number"
                value={newRule.stale_threshold_seconds}
                onChange={(e) => setNewRule({ ...newRule, stale_threshold_seconds: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="300"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Severity</label>
              <select
                value={newRule.severity}
                onChange={(e) => setNewRule({ ...newRule, severity: e.target.value as ValidationRule['severity'] })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Action on Violation</label>
              <select
                value={newRule.action_on_violation}
                onChange={(e) => setNewRule({ ...newRule, action_on_violation: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="log">Log Only</option>
                <option value="notify">Send Notification</option>
                <option value="discard">Discard Value</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowAddRule(false)
                setEditingRule(null)
                resetForm()
              }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!newRule.name || createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-8 text-center">
          <Shield className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No validation rules configured</p>
          <p className="text-slate-500 text-sm mt-1">
            Add rules to validate incoming data quality
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="bg-slate-800 border border-slate-700 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${rule.is_active ? 'bg-emerald-500/20' : 'bg-slate-700'}`}>
                  {rule.is_active ? (
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-slate-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-white font-medium">{rule.name}</h4>
                    <span className={`px-2 py-0.5 rounded text-xs ${getSeverityColor(rule.severity)}`}>
                      {rule.severity}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">
                    {getRuleTypeLabel(rule.rule_type)}
                    {rule.min_value !== undefined && rule.min_value !== null && ` • Min: ${rule.min_value}`}
                    {rule.max_value !== undefined && rule.max_value !== null && ` • Max: ${rule.max_value}`}
                    {rule.rate_of_change_max !== undefined && rule.rate_of_change_max !== null && ` • Max change: ${rule.rate_of_change_max}/period`}
                    {rule.stale_threshold_seconds !== undefined && rule.stale_threshold_seconds !== null && ` • Stale after: ${rule.stale_threshold_seconds}s`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingRule(rule)
                    setNewRule({
                      name: rule.name,
                      description: rule.description || '',
                      rule_type: rule.rule_type,
                      severity: rule.severity,
                      min_value: rule.min_value?.toString() || '',
                      max_value: rule.max_value?.toString() || '',
                      rate_of_change_max: rule.rate_of_change_max?.toString() || '',
                      rate_of_change_period_seconds: rule.rate_of_change_period_seconds?.toString() || '',
                      stale_threshold_seconds: rule.stale_threshold_seconds?.toString() || '',
                      action_on_violation: rule.action_on_violation
                    })
                  }}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete this validation rule?')) {
                      deleteMutation.mutate(rule.id)
                    }
                  }}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
