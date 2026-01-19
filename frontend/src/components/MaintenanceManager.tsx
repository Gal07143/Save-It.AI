import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Plus, Check, Clock, AlertTriangle, X, Wrench } from 'lucide-react'
import { api, MaintenanceScheduleItem } from '../services/api'

interface MaintenanceManagerProps {
  siteId?: number | null
  dataSources: any[]
}

export default function MaintenanceManager({ siteId, dataSources }: MaintenanceManagerProps) {
  const queryClient = useQueryClient()
  const [showAddModal, setShowAddModal] = useState(false)
  const [newSchedule, setNewSchedule] = useState({
    data_source_id: '',
    title: '',
    scheduled_date: '',
    description: '',
    maintenance_type: 'routine',
    priority: 'medium',
    assigned_to: ''
  })

  const { data: schedules, isLoading } = useQuery({
    queryKey: ['maintenance', siteId],
    queryFn: () => api.maintenance.list(siteId || undefined)
  })

  const createMutation = useMutation({
    mutationFn: api.maintenance.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance', siteId] })
      setShowAddModal(false)
      setNewSchedule({
        data_source_id: '',
        title: '',
        scheduled_date: '',
        description: '',
        maintenance_type: 'routine',
        priority: 'medium',
        assigned_to: ''
      })
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status?: string; notes?: string } }) => 
      api.maintenance.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maintenance', siteId] })
  })

  const deleteMutation = useMutation({
    mutationFn: api.maintenance.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maintenance', siteId] })
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="badge badge-success"><Check size={12} /> Completed</span>
      case 'in_progress':
        return <span className="badge badge-warning"><Clock size={12} /> In Progress</span>
      case 'overdue':
        return <span className="badge badge-error"><AlertTriangle size={12} /> Overdue</span>
      default:
        return <span className="badge"><Calendar size={12} /> Scheduled</span>
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444'
      case 'low': return '#64748b'
      default: return '#f59e0b'
    }
  }

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="card-title">
          <Wrench size={20} style={{ marginRight: '0.5rem' }} />
          Maintenance Schedules
        </h2>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> Schedule Maintenance
        </button>
      </div>

      {isLoading ? (
        <p>Loading schedules...</p>
      ) : schedules && schedules.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Device</th>
              <th>Title</th>
              <th>Type</th>
              <th>Priority</th>
              <th>Scheduled</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule: MaintenanceScheduleItem) => (
              <tr key={schedule.id}>
                <td style={{ fontWeight: 500 }}>{schedule.device_name}</td>
                <td>{schedule.title}</td>
                <td style={{ textTransform: 'capitalize' }}>{schedule.maintenance_type}</td>
                <td>
                  <span style={{ color: getPriorityColor(schedule.priority), textTransform: 'capitalize' }}>
                    {schedule.priority}
                  </span>
                </td>
                <td>
                  {schedule.scheduled_date 
                    ? new Date(schedule.scheduled_date).toLocaleDateString()
                    : '-'}
                </td>
                <td>{getStatusBadge(schedule.status)}</td>
                <td>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {schedule.status !== 'completed' && (
                      <button
                        className="btn btn-sm"
                        onClick={() => updateMutation.mutate({ id: schedule.id, data: { status: 'completed' } })}
                        title="Mark Complete"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        if (confirm('Delete this maintenance schedule?')) {
                          deleteMutation.mutate(schedule.id)
                        }
                      }}
                      title="Delete"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Wrench size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No Maintenance Scheduled</h3>
          <p style={{ color: '#64748b' }}>Schedule maintenance tasks for your devices</p>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Schedule Maintenance</h3>
              <button className="btn btn-sm" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Device</label>
                <select
                  className="form-input"
                  value={newSchedule.data_source_id}
                  onChange={e => setNewSchedule({ ...newSchedule, data_source_id: e.target.value })}
                >
                  <option value="">Select device...</option>
                  {dataSources.map((ds: any) => (
                    <option key={ds.id} value={ds.id}>{ds.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  type="text"
                  className="form-input"
                  value={newSchedule.title}
                  onChange={e => setNewSchedule({ ...newSchedule, title: e.target.value })}
                  placeholder="e.g., Annual calibration"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Scheduled Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={newSchedule.scheduled_date}
                  onChange={e => setNewSchedule({ ...newSchedule, scheduled_date: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select
                    className="form-input"
                    value={newSchedule.maintenance_type}
                    onChange={e => setNewSchedule({ ...newSchedule, maintenance_type: e.target.value })}
                  >
                    <option value="routine">Routine</option>
                    <option value="preventive">Preventive</option>
                    <option value="corrective">Corrective</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-input"
                    value={newSchedule.priority}
                    onChange={e => setNewSchedule({ ...newSchedule, priority: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Assigned To</label>
                <input
                  type="text"
                  className="form-input"
                  value={newSchedule.assigned_to}
                  onChange={e => setNewSchedule({ ...newSchedule, assigned_to: e.target.value })}
                  placeholder="Technician name"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  value={newSchedule.description}
                  onChange={e => setNewSchedule({ ...newSchedule, description: e.target.value })}
                  placeholder="Additional details..."
                  rows={3}
                />
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => createMutation.mutate({
                  data_source_id: Number(newSchedule.data_source_id),
                  title: newSchedule.title,
                  scheduled_date: newSchedule.scheduled_date,
                  description: newSchedule.description || undefined,
                  maintenance_type: newSchedule.maintenance_type,
                  priority: newSchedule.priority,
                  assigned_to: newSchedule.assigned_to || undefined
                })}
                disabled={!newSchedule.data_source_id || !newSchedule.title || !newSchedule.scheduled_date}
              >
                Schedule Maintenance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
