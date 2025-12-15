import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, AssetTreeNode } from '../services/api'
import { ChevronRight, ChevronDown, Network, Gauge, AlertCircle } from 'lucide-react'

const assetTypeIcons: Record<string, string> = {
  main_breaker: '🔌',
  sub_panel: '📦',
  distribution_board: '🗄️',
  consumer: '💡',
  transformer: '⚡',
  generator: '🔋',
  solar_inverter: '☀️',
  battery_storage: '🔋',
}

function TreeNode({ node, depth = 0 }: { node: AssetTreeNode; depth?: number }) {
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
          cursor: hasChildren ? 'pointer' : 'default',
          background: node.is_critical ? '#fef3c7' : 'transparent',
        }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
        ) : (
          <span style={{ width: '16px' }} />
        )}
        <span style={{ fontSize: '1.25rem' }}>{assetTypeIcons[node.asset_type] || '📍'}</span>
        <span style={{ fontWeight: node.is_critical ? 600 : 400 }}>{node.name}</span>
        {node.rated_capacity_kw && (
          <span className="badge badge-info" style={{ marginLeft: '0.5rem' }}>
            {node.rated_capacity_kw} kW
          </span>
        )}
        {node.meter ? (
          <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>
            <Gauge size={12} style={{ marginRight: '0.25rem' }} />
            Metered
          </span>
        ) : node.requires_metering ? (
          <span className="badge badge-warning" style={{ marginLeft: '0.5rem' }}>
            <AlertCircle size={12} style={{ marginRight: '0.25rem' }} />
            No Meter
          </span>
        ) : null}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Assets() {
  const [selectedSite, setSelectedSite] = useState<number | null>(null)
  
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: api.sites.list })
  const { data: tree, isLoading: treeLoading } = useQuery({
    queryKey: ['assets-tree', selectedSite],
    queryFn: () => selectedSite ? api.assets.tree(selectedSite) : Promise.resolve([]),
    enabled: !!selectedSite,
  })

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Digital Twin - Asset Tree</h1>
        <p style={{ color: '#64748b' }}>View and manage your electrical Single Line Diagram (SLD)</p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-group" style={{ maxWidth: '300px', marginBottom: 0 }}>
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
      </div>

      {selectedSite ? (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <Network size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
              Asset Hierarchy
            </h2>
          </div>
          
          {treeLoading ? (
            <p>Loading asset tree...</p>
          ) : tree && tree.length > 0 ? (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.5rem' }}>
              {tree.map((node) => (
                <TreeNode key={node.id} node={node} />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <Network size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>No assets found for this site.</p>
              <p style={{ fontSize: '0.875rem' }}>Add assets via the API or import from CSV.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Network size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Select a Site</h3>
          <p style={{ color: '#64748b' }}>Choose a site to view its asset hierarchy</p>
        </div>
      )}
    </div>
  )
}
