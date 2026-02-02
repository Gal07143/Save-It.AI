import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Asset, AssetTreeNode } from '../services/api'
import {
  ChevronRight, ChevronDown, Network, Gauge, AlertCircle, Plus, Search, Filter,
  Edit2, Trash2, X, AlertTriangle, List, GitBranch, Zap, Building2
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

interface AssetsProps {
  currentSite?: number | null
}

const assetTypeIcons: Record<string, string> = {
  main_breaker: '🔌',
  sub_panel: '📦',
  distribution_board: '🗄️',
  consumer: '💡',
  transformer: '⚡',
  generator: '🔋',
  solar_inverter: '☀️',
  battery_storage: '🔋',
  hvac: '❄️',
  lighting: '💡',
  motor: '⚙️',
  pump: '🔄',
  compressor: '🌀',
  other: '📍',
}

const assetTypes = [
  { value: 'main_breaker', label: 'Main Breaker' },
  { value: 'sub_panel', label: 'Sub Panel' },
  { value: 'distribution_board', label: 'Distribution Board' },
  { value: 'consumer', label: 'Consumer/Load' },
  { value: 'transformer', label: 'Transformer' },
  { value: 'generator', label: 'Generator' },
  { value: 'solar_inverter', label: 'Solar Inverter' },
  { value: 'battery_storage', label: 'Battery Storage' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'motor', label: 'Motor' },
  { value: 'pump', label: 'Pump' },
  { value: 'compressor', label: 'Compressor' },
  { value: 'other', label: 'Other' },
]

interface AssetFormData {
  site_id: number
  parent_id: number | null
  name: string
  asset_type: string
  description: string
  rated_capacity_kw: number | null
  rated_voltage: number | null
  rated_current: number | null
  is_critical: boolean
  requires_metering: boolean
}

function TreeNode({
  node,
  depth = 0,
  onEdit,
  onDelete
}: {
  node: AssetTreeNode
  depth?: number
  onEdit: (asset: AssetTreeNode) => void
  onDelete: (asset: AssetTreeNode) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem',
          paddingLeft: `${depth * 1.5 + 0.5}rem`,
          borderRadius: '0.375rem',
          background: node.is_critical ? 'rgba(251, 191, 36, 0.1)' : 'transparent',
          borderLeft: node.is_critical ? '3px solid #f59e0b' : '3px solid transparent',
        }}
      >
        <span
          style={{ cursor: hasChildren ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}
          onClick={() => hasChildren && setExpanded(!expanded)}
        >
          {hasChildren ? (
            expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
          ) : (
            <span style={{ width: '16px' }} />
          )}
        </span>
        <span style={{ fontSize: '1.25rem' }}>{assetTypeIcons[node.asset_type] || '📍'}</span>
        <span style={{ fontWeight: node.is_critical ? 600 : 400, flex: 1 }}>{node.name}</span>
        {node.rated_capacity_kw && (
          <span className="badge badge-info">
            {node.rated_capacity_kw} kW
          </span>
        )}
        {node.meter ? (
          <span className="badge badge-success">
            <Gauge size={12} style={{ marginRight: '0.25rem' }} />
            Metered
          </span>
        ) : node.requires_metering ? (
          <span className="badge badge-warning">
            <AlertCircle size={12} style={{ marginRight: '0.25rem' }} />
            No Meter
          </span>
        ) : null}
        <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '0.25rem' }}
            onClick={(e) => { e.stopPropagation(); onEdit(node); }}
            title="Edit asset"
          >
            <Edit2 size={14} />
          </button>
          <button
            className="btn btn-ghost"
            style={{ padding: '0.25rem', color: '#ef4444' }}
            onClick={(e) => { e.stopPropagation(); onDelete(node); }}
            title="Delete asset"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Assets({ currentSite }: AssetsProps) {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const [selectedSite, setSelectedSite] = useState<number | null>(currentSite || null)
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree')
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | 'all'>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<Asset | AssetTreeNode | null>(null)

  const defaultFormData: AssetFormData = {
    site_id: selectedSite || 1,
    parent_id: null,
    name: '',
    asset_type: 'consumer',
    description: '',
    rated_capacity_kw: null,
    rated_voltage: null,
    rated_current: null,
    is_critical: false,
    requires_metering: false,
  }

  const [formData, setFormData] = useState<AssetFormData>(defaultFormData)
  const [editFormData, setEditFormData] = useState<AssetFormData>(defaultFormData)

  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })
  const { data: tree, isLoading: treeLoading } = useQuery({
    queryKey: ['assets-tree', selectedSite],
    queryFn: () => selectedSite ? api.assets.tree(selectedSite) : Promise.resolve([]),
    enabled: !!selectedSite,
  })
  const { data: assetsList, isLoading: listLoading } = useQuery({
    queryKey: ['assets-list', selectedSite],
    queryFn: () => selectedSite ? api.assets.list(selectedSite) : Promise.resolve([]),
    enabled: !!selectedSite,
  })

  // Filter assets list
  const filteredAssets = useMemo(() => {
    if (!assetsList) return []
    return assetsList.filter(asset => {
      const matchesType = typeFilter === 'all' || asset.asset_type === typeFilter
      const matchesSearch = !searchQuery ||
        asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.description?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesType && matchesSearch
    })
  }, [assetsList, typeFilter, searchQuery])

  // Calculate statistics
  const stats = useMemo(() => {
    if (!assetsList) return { total: 0, critical: 0, metered: 0, unmetered: 0, totalCapacity: 0 }
    return {
      total: assetsList.length,
      critical: assetsList.filter(a => a.is_critical).length,
      metered: assetsList.filter(a => !a.requires_metering || (tree && findAssetInTree(tree, a.id)?.meter)).length,
      unmetered: assetsList.filter(a => a.requires_metering).length,
      totalCapacity: assetsList.reduce((sum, a) => sum + (a.rated_capacity_kw || 0), 0),
    }
  }, [assetsList, tree])

  function findAssetInTree(nodes: AssetTreeNode[], id: number): AssetTreeNode | null {
    for (const node of nodes) {
      if (node.id === id) return node
      if (node.children) {
        const found = findAssetInTree(node.children, id)
        if (found) return found
      }
    }
    return null
  }

  const createMutation = useMutation({
    mutationFn: (data: Partial<Asset>) => api.assets.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets-tree'] })
      queryClient.invalidateQueries({ queryKey: ['assets-list'] })
      setShowAddModal(false)
      setFormData({ ...defaultFormData, site_id: selectedSite || 1 })
      success('Asset Created', 'Asset has been added successfully')
    },
    onError: (err: any) => {
      error('Error', err.message || 'Failed to create asset')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Asset> }) => api.assets.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets-tree'] })
      queryClient.invalidateQueries({ queryKey: ['assets-list'] })
      setShowEditModal(false)
      setSelectedAsset(null)
      success('Asset Updated', 'Asset has been updated successfully')
    },
    onError: (err: any) => {
      error('Error', err.message || 'Failed to update asset')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.assets.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets-tree'] })
      queryClient.invalidateQueries({ queryKey: ['assets-list'] })
      setShowDeleteConfirm(false)
      setSelectedAsset(null)
      success('Asset Deleted', 'Asset has been deleted successfully')
    },
    onError: (err: any) => {
      error('Error', err.message || 'Failed to delete asset')
    }
  })

  const handleEdit = (asset: Asset | AssetTreeNode) => {
    setSelectedAsset(asset)
    setEditFormData({
      site_id: asset.site_id,
      parent_id: asset.parent_id || null,
      name: asset.name || '',
      asset_type: asset.asset_type || 'consumer',
      description: asset.description || '',
      rated_capacity_kw: asset.rated_capacity_kw || null,
      rated_voltage: (asset as AssetTreeNode).rated_voltage || null,
      rated_current: null,
      is_critical: asset.is_critical || false,
      requires_metering: asset.requires_metering || false,
    })
    setShowEditModal(true)
  }

  const handleDelete = (asset: Asset | AssetTreeNode) => {
    setSelectedAsset(asset)
    setShowDeleteConfirm(true)
  }

  const renderAssetForm = (isEdit: boolean = false) => {
    const data = isEdit ? editFormData : formData
    const setData = isEdit ? setEditFormData : setFormData

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label>Asset Name *</label>
            <input
              type="text"
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              placeholder="e.g., Main Distribution Panel"
              required
            />
          </div>
          <div className="form-group">
            <label>Asset Type *</label>
            <select
              value={data.asset_type}
              onChange={(e) => setData({ ...data, asset_type: e.target.value })}
            >
              {assetTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Parent Asset</label>
            <select
              value={data.parent_id || ''}
              onChange={(e) => setData({ ...data, parent_id: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">None (Root Level)</option>
              {assetsList?.filter(a => a.id !== selectedAsset?.id).map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <div className="form-group">
            <label>Rated Capacity (kW)</label>
            <input
              type="number"
              step="0.1"
              value={data.rated_capacity_kw || ''}
              onChange={(e) => setData({ ...data, rated_capacity_kw: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="e.g., 100"
            />
          </div>
          <div className="form-group">
            <label>Rated Voltage (V)</label>
            <input
              type="number"
              value={data.rated_voltage || ''}
              onChange={(e) => setData({ ...data, rated_voltage: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="e.g., 400"
            />
          </div>
          <div className="form-group">
            <label>Rated Current (A)</label>
            <input
              type="number"
              value={data.rated_current || ''}
              onChange={(e) => setData({ ...data, rated_current: e.target.value ? parseFloat(e.target.value) : null })}
              placeholder="e.g., 250"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={data.description}
            onChange={(e) => setData({ ...data, description: e.target.value })}
            rows={2}
            placeholder="Optional description..."
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={data.is_critical}
              onChange={(e) => setData({ ...data, is_critical: e.target.checked })}
            />
            <span>Critical Asset</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={data.requires_metering}
              onChange={(e) => setData({ ...data, requires_metering: e.target.checked })}
            />
            <span>Requires Metering</span>
          </label>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Asset Management</h1>
        <p style={{ color: '#64748b' }}>View and manage your electrical Single Line Diagram (SLD)</p>
      </div>

      {/* Site Selection & Controls */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
            <label className="form-label">Select Site</label>
            <select
              value={selectedSite || ''}
              onChange={(e) => setSelectedSite(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Choose a site...</option>
              {sites?.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>

          {selectedSite && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', border: '1px solid #334155', borderRadius: '0.5rem', overflow: 'hidden' }}>
                <button
                  className={`btn ${viewMode === 'tree' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ borderRadius: 0, padding: '0.5rem 0.75rem' }}
                  onClick={() => setViewMode('tree')}
                >
                  <GitBranch size={16} />
                  Tree
                </button>
                <button
                  className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ borderRadius: 0, padding: '0.5rem 0.75rem' }}
                  onClick={() => setViewMode('list')}
                >
                  <List size={16} />
                  List
                </button>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setFormData({ ...defaultFormData, site_id: selectedSite })
                  setShowAddModal(true)
                }}
              >
                <Plus size={18} />
                Add Asset
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedSite ? (
        <>
          {/* Statistics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Assets</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.total}</div>
            </div>
            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Critical</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>{stats.critical}</div>
            </div>
            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Requires Metering</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444' }}>{stats.unmetered}</div>
            </div>
            <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Total Capacity</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>{stats.totalCapacity.toLocaleString()} kW</div>
            </div>
          </div>

          {viewMode === 'list' && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#f1f5f9',
                    fontSize: '0.875rem',
                    minWidth: '200px'
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Filter size={16} color="#64748b" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#f1f5f9',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="all">All Types</option>
                  {assetTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">
                {viewMode === 'tree' ? (
                  <>
                    <Network size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
                    Asset Hierarchy
                  </>
                ) : (
                  <>
                    <List size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
                    Asset List
                  </>
                )}
              </h2>
              <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                {viewMode === 'list' ? filteredAssets.length : assetsList?.length || 0} asset{(viewMode === 'list' ? filteredAssets.length : assetsList?.length || 0) !== 1 ? 's' : ''}
              </span>
            </div>

            {viewMode === 'tree' ? (
              treeLoading ? (
                <p style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading asset tree...</p>
              ) : tree && tree.length > 0 ? (
                <div style={{ border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.5rem' }}>
                  {tree.map((node) => (
                    <TreeNode key={node.id} node={node} onEdit={handleEdit} onDelete={handleDelete} />
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  <Network size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p>No assets found for this site.</p>
                  <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowAddModal(true)}>
                    <Plus size={16} style={{ marginRight: '0.5rem' }} />
                    Add First Asset
                  </button>
                </div>
              )
            ) : (
              listLoading ? (
                <p style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading assets...</p>
              ) : filteredAssets.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Capacity</th>
                        <th>Critical</th>
                        <th>Metering</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssets.map((asset) => (
                        <tr key={asset.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontSize: '1.25rem' }}>{assetTypeIcons[asset.asset_type] || '📍'}</span>
                              <div>
                                <div style={{ fontWeight: 500 }}>{asset.name}</div>
                                {asset.description && (
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{asset.description}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="badge badge-info">
                              {assetTypes.find(t => t.value === asset.asset_type)?.label || asset.asset_type}
                            </span>
                          </td>
                          <td>
                            {asset.rated_capacity_kw ? (
                              <span style={{ fontWeight: 500 }}>{asset.rated_capacity_kw} kW</span>
                            ) : (
                              <span style={{ color: '#64748b' }}>--</span>
                            )}
                          </td>
                          <td>
                            {asset.is_critical ? (
                              <span className="badge badge-warning">Critical</span>
                            ) : (
                              <span style={{ color: '#64748b' }}>No</span>
                            )}
                          </td>
                          <td>
                            {asset.requires_metering ? (
                              <span className="badge badge-error">Required</span>
                            ) : (
                              <span style={{ color: '#64748b' }}>No</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button
                                className="btn btn-outline"
                                style={{ padding: '0.25rem 0.5rem' }}
                                onClick={() => handleEdit(asset)}
                                title="Edit asset"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                className="btn btn-outline"
                                style={{ padding: '0.25rem 0.5rem', color: '#ef4444', borderColor: '#ef4444' }}
                                onClick={() => handleDelete(asset)}
                                title="Delete asset"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  <Zap size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                  <p>{searchQuery || typeFilter !== 'all' ? 'No assets match your filters' : 'No assets found'}</p>
                </div>
              )
            )}
          </div>
        </>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Building2 size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Select a Site</h3>
          <p style={{ color: '#64748b' }}>Choose a site to view and manage its assets</p>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Asset</h2>
              <button className="btn btn-ghost" onClick={() => setShowAddModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {renderAssetForm(false)}
              <button
                className="btn btn-primary"
                onClick={() => createMutation.mutate(formData as any)}
                disabled={createMutation.isPending || !formData.name}
                style={{ width: '100%', marginTop: '1.5rem' }}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Asset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedAsset && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Asset</h2>
              <button className="btn btn-ghost" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {renderAssetForm(true)}
              <button
                className="btn btn-primary"
                onClick={() => updateMutation.mutate({ id: selectedAsset.id, data: editFormData as any })}
                disabled={updateMutation.isPending}
                style={{ width: '100%', marginTop: '1.5rem' }}
              >
                {updateMutation.isPending ? 'Updating...' : 'Update Asset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && selectedAsset && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Asset</h2>
              <button className="btn btn-ghost" onClick={() => setShowDeleteConfirm(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <AlertTriangle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
              <p style={{ marginBottom: '0.5rem' }}>Are you sure you want to delete this asset?</p>
              <p style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: '1rem' }}>{selectedAsset.name}</p>
              <p style={{ color: '#f59e0b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                This will also delete all child assets in the hierarchy.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-outline" onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button
                  className="btn"
                  style={{ flex: 1, background: '#ef4444', borderColor: '#ef4444' }}
                  onClick={() => deleteMutation.mutate(selectedAsset.id)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .modal {
          background: #1e293b;
          border-radius: 0.75rem;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #334155;
        }
        .modal-header h2 {
          font-size: 1.25rem;
          font-weight: 600;
        }
        .modal-body {
          padding: 1.5rem;
        }
        .form-group {
          margin-bottom: 0.75rem;
        }
        .form-group label {
          display: block;
          font-size: 0.875rem;
          color: #94a3b8;
          margin-bottom: 0.25rem;
        }
        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: #0f172a;
          border: 1px solid #374151;
          border-radius: 0.375rem;
          color: #f8fafc;
        }
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #10b981;
        }
        .form-group input[type="checkbox"] {
          width: auto;
        }
      `}</style>
    </div>
  )
}
