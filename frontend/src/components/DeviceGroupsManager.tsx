import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, DeviceGroup } from '../services/api'
import { Layers, Plus, Trash2, Edit2, X } from 'lucide-react'

interface DeviceGroupsManagerProps {
  siteId?: number
  onSelectGroup?: (group: DeviceGroup | null) => void
}

export default function DeviceGroupsManager({ siteId, onSelectGroup }: DeviceGroupsManagerProps) {
  const queryClient = useQueryClient()
  const effectiveSiteId = siteId
  
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [editingGroup, setEditingGroup] = useState<DeviceGroup | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<DeviceGroup | null>(null)
  const [showAddMember, setShowAddMember] = useState(false)
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    group_type: 'zone',
    color: '#10b981',
    icon: ''
  })

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['device-groups', effectiveSiteId],
    queryFn: () => api.deviceGroups.list(effectiveSiteId),
    enabled: !!effectiveSiteId
  })

  const { data: dataSources = [] } = useQuery({
    queryKey: ['data-sources', effectiveSiteId],
    queryFn: () => api.dataSources.list(effectiveSiteId),
    enabled: !!effectiveSiteId
  })

  const { data: groupMembers = [] } = useQuery({
    queryKey: ['device-group-members', selectedGroup?.id],
    queryFn: () => selectedGroup ? api.deviceGroups.listMembers(selectedGroup.id) : Promise.resolve([]),
    enabled: !!selectedGroup
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<DeviceGroup>) => api.deviceGroups.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-groups'] })
      setShowAddGroup(false)
      resetForm()
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DeviceGroup> }) => 
      api.deviceGroups.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-groups'] })
      setEditingGroup(null)
      resetForm()
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deviceGroups.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-groups'] })
      if (selectedGroup?.id === deleteMutation.variables) {
        setSelectedGroup(null)
      }
    }
  })

  const addMemberMutation = useMutation({
    mutationFn: ({ groupId, dataSourceId }: { groupId: number; dataSourceId: number }) => 
      api.deviceGroups.addMember(groupId, dataSourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-group-members'] })
      queryClient.invalidateQueries({ queryKey: ['device-groups'] })
      setShowAddMember(false)
    }
  })

  const removeMemberMutation = useMutation({
    mutationFn: ({ groupId, dataSourceId }: { groupId: number; dataSourceId: number }) => 
      api.deviceGroups.removeMember(groupId, dataSourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-group-members'] })
      queryClient.invalidateQueries({ queryKey: ['device-groups'] })
    }
  })

  const resetForm = () => {
    setNewGroup({
      name: '',
      description: '',
      group_type: 'zone',
      color: '#10b981',
      icon: ''
    })
  }

  const handleSubmit = () => {
    const payload: Partial<DeviceGroup> = {
      site_id: effectiveSiteId!,
      name: newGroup.name,
      description: newGroup.description || undefined,
      group_type: newGroup.group_type,
      color: newGroup.color,
      icon: newGroup.icon || undefined,
      is_active: true
    }

    if (editingGroup) {
      updateMutation.mutate({ id: editingGroup.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const memberDataSourceIds = new Set(groupMembers.map(m => m.data_source_id))
  const availableDevices = dataSources.filter(ds => !memberDataSourceIds.has(ds.id))

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
          <Layers className="h-5 w-5 text-emerald-500" />
          <h3 className="text-lg font-semibold text-white">Device Groups</h3>
          <span className="px-2 py-0.5 bg-slate-700 rounded-full text-xs text-slate-300">
            {groups.length} groups
          </span>
        </div>
        <button
          onClick={() => setShowAddGroup(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Group
        </button>
      </div>

      {(showAddGroup || editingGroup) && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
          <h4 className="text-white font-medium">
            {editingGroup ? 'Edit Device Group' : 'New Device Group'}
          </h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Group Name</label>
              <input
                type="text"
                value={newGroup.name}
                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                placeholder="e.g., Building A - Floor 1"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Group Type</label>
              <select
                value={newGroup.group_type}
                onChange={(e) => setNewGroup({ ...newGroup, group_type: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
              >
                <option value="zone">Zone</option>
                <option value="building">Building</option>
                <option value="floor">Floor</option>
                <option value="department">Department</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Description</label>
            <textarea
              value={newGroup.description}
              onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
              rows={2}
              placeholder="Describe this device group..."
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newGroup.color}
                onChange={(e) => setNewGroup({ ...newGroup, color: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer"
              />
              <span className="text-slate-400 text-sm">{newGroup.color}</span>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowAddGroup(false)
                setEditingGroup(null)
                resetForm()
              }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!newGroup.name || createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {editingGroup ? 'Update Group' : 'Create Group'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-400 uppercase">Groups</h4>
          {groups.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center">
              <Layers className="h-10 w-10 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400">No device groups</p>
              <p className="text-slate-500 text-sm">Create groups to organize devices</p>
            </div>
          ) : (
            groups.map((group) => (
              <div
                key={group.id}
                onClick={() => {
                  setSelectedGroup(group)
                  onSelectGroup?.(group)
                }}
                className={`bg-slate-800 border rounded-lg p-3 cursor-pointer transition-colors ${
                  selectedGroup?.id === group.id 
                    ? 'border-emerald-500 bg-slate-800' 
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: group.color }}
                    />
                    <div>
                      <h5 className="text-white font-medium">{group.name}</h5>
                      <p className="text-sm text-slate-400">
                        {group.group_type} • {group.device_count} devices
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingGroup(group)
                        setNewGroup({
                          name: group.name,
                          description: group.description || '',
                          group_type: group.group_type,
                          color: group.color,
                          icon: group.icon || ''
                        })
                      }}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('Delete this group? Devices will be removed from the group but not deleted.')) {
                          deleteMutation.mutate(group.id)
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {selectedGroup && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-400 uppercase">
                Devices in {selectedGroup.name}
              </h4>
              <button
                onClick={() => setShowAddMember(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Device
              </button>
            </div>

            {showAddMember && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-2">
                <label className="block text-sm text-slate-400">Select Device to Add</label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      addMemberMutation.mutate({
                        groupId: selectedGroup.id,
                        dataSourceId: parseInt(e.target.value)
                      })
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  defaultValue=""
                >
                  <option value="" disabled>Choose a device...</option>
                  {availableDevices.map(ds => (
                    <option key={ds.id} value={ds.id}>{ds.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowAddMember(false)}
                  className="text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            )}

            {groupMembers.length === 0 ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
                <p className="text-slate-400 text-sm">No devices in this group</p>
              </div>
            ) : (
              <div className="space-y-1">
                {groupMembers.map((member) => {
                  const device = dataSources.find(ds => ds.id === member.data_source_id)
                  return (
                    <div
                      key={member.id}
                      className="bg-slate-800 border border-slate-700 rounded-lg p-2 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-white text-sm">{device?.name || `Device #${member.data_source_id}`}</p>
                        <p className="text-xs text-slate-400">{(device as any)?.protocol || 'Unknown protocol'}</p>
                      </div>
                      <button
                        onClick={() => {
                          removeMemberMutation.mutate({
                            groupId: selectedGroup.id,
                            dataSourceId: member.data_source_id
                          })
                        }}
                        className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
