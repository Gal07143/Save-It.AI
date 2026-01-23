import { useState, useCallback, useRef, useEffect } from 'react'
import { 
  Network, Trash2, Save, Undo, Redo, ZoomIn, ZoomOut,
  Zap, Battery, Sun, Building2, Gauge, Box, X, Edit2,
  Grid3X3, Download, Layers, Upload, FileImage, Loader2,
  ChevronRight, ChevronDown, FolderTree
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, PanelAssetExtracted, AssetTreeNode } from '../services/api'

interface AssetNode {
  id: string
  name: string
  type: string
  x: number
  y: number
  parentId: string | null
  children: string[]
  meterId?: number
  ratedCapacity?: number
  ratedVoltage?: number
}

interface Connection {
  from: string
  to: string
}

const ASSET_TYPES = [
  { type: 'main_breaker', icon: Zap, label: 'Main Breaker', color: '#ef4444' },
  { type: 'transformer', icon: Box, label: 'Transformer', color: '#f59e0b' },
  { type: 'sub_panel', icon: Network, label: 'Sub Panel', color: '#3b82f6' },
  { type: 'distribution_board', icon: Building2, label: 'Distribution Board', color: '#8b5cf6' },
  { type: 'consumer', icon: Gauge, label: 'Consumer', color: '#10b981' },
  { type: 'solar_inverter', icon: Sun, label: 'Solar Inverter', color: '#eab308' },
  { type: 'battery_storage', icon: Battery, label: 'Battery Storage', color: '#06b6d4' },
  { type: 'generator', icon: Zap, label: 'Generator', color: '#f97316' },
]

export default function DigitalTwinBuilder({ currentSite }: { currentSite: number | null }) {
  const queryClient = useQueryClient()
  const canvasRef = useRef<HTMLDivElement>(null)
  
  const [nodes, setNodes] = useState<AssetNode[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [draggingNode, setDraggingNode] = useState<string | null>(null)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [editingNode, setEditingNode] = useState<AssetNode | null>(null)
  const [history, setHistory] = useState<{ nodes: AssetNode[], connections: Connection[] }[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showPalette] = useState(true)
  const [gridSnap, setGridSnap] = useState(true)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [showHierarchy, setShowHierarchy] = useState(true)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const GRID_SIZE = 20
  
  const snapToGrid = (value: number) => {
    if (!gridSnap) return value
    return Math.round(value / GRID_SIZE) * GRID_SIZE
  }

  const TEMPLATES = [
    {
      name: 'Commercial Building',
      description: 'Main breaker with distribution boards',
      nodes: [
        { type: 'main_breaker', name: 'Main Breaker', x: 300, y: 50 },
        { type: 'transformer', name: 'Transformer', x: 300, y: 170 },
        { type: 'distribution_board', name: 'DB-1', x: 150, y: 290 },
        { type: 'distribution_board', name: 'DB-2', x: 450, y: 290 },
      ]
    },
    {
      name: 'Solar + Battery',
      description: 'Hybrid renewable system',
      nodes: [
        { type: 'solar_inverter', name: 'Solar Inverter', x: 150, y: 50 },
        { type: 'battery_storage', name: 'Battery Bank', x: 350, y: 50 },
        { type: 'main_breaker', name: 'Main Panel', x: 250, y: 170 },
      ]
    },
    {
      name: 'Industrial Facility',
      description: 'Complex distribution with generators',
      nodes: [
        { type: 'main_breaker', name: 'Main Incomer', x: 300, y: 50 },
        { type: 'generator', name: 'Backup Generator', x: 500, y: 50 },
        { type: 'transformer', name: 'MV Transformer', x: 300, y: 170 },
        { type: 'sub_panel', name: 'MCC-1', x: 150, y: 290 },
        { type: 'sub_panel', name: 'MCC-2', x: 300, y: 290 },
        { type: 'sub_panel', name: 'MCC-3', x: 450, y: 290 },
      ]
    }
  ]
  
  const applyTemplate = (template: typeof TEMPLATES[0]) => {
    saveToHistory()
    const newNodes = template.nodes.map((n, i) => ({
      id: `node-${Date.now()}-${i}`,
      name: n.name,
      type: n.type,
      x: n.x,
      y: n.y,
      parentId: null,
      children: []
    }))
    setNodes([...nodes, ...newNodes])
    setShowTemplates(false)
  }
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadFile(file)
      setAnalysisError(null)
    }
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      setUploadFile(file)
      setAnalysisError(null)
    }
  }
  
  const analyzeDiagram = async () => {
    if (!uploadFile) return
    
    setIsAnalyzing(true)
    setAnalysisError(null)
    
    try {
      const result = await api.analysis.analyzePanelDiagram(uploadFile)
      
      if (result.success && result.assets.length > 0) {
        generateNodesFromAssets(result.assets)
        setShowUploadModal(false)
        setUploadFile(null)
      } else {
        setAnalysisError(result.error || 'No assets detected in the diagram')
      }
    } catch (error) {
      setAnalysisError((error as Error).message)
    } finally {
      setIsAnalyzing(false)
    }
  }
  
  const generateNodesFromAssets = (assets: PanelAssetExtracted[]) => {
    saveToHistory()
    
    const newNodes: AssetNode[] = []
    const newConnections: Connection[] = []
    const nameToId: Record<string, string> = {}
    
    const levelMap: Record<string, number> = {}
    const childrenMap: Record<string, string[]> = {}
    
    assets.forEach(asset => {
      childrenMap[asset.name] = asset.children || []
    })
    
    const calculateLevel = (name: string, visited = new Set<string>()): number => {
      if (visited.has(name)) return 0
      visited.add(name)
      
      const asset = assets.find(a => a.name === name)
      if (!asset || !asset.parent_name) return 0
      return 1 + calculateLevel(asset.parent_name, visited)
    }
    
    assets.forEach(asset => {
      levelMap[asset.name] = calculateLevel(asset.name)
    })
    
    const nodesByLevel: Record<number, PanelAssetExtracted[]> = {}
    assets.forEach(asset => {
      const level = levelMap[asset.name]
      if (!nodesByLevel[level]) nodesByLevel[level] = []
      nodesByLevel[level].push(asset)
    })
    
    const LEVEL_HEIGHT = 140
    const NODE_WIDTH = 140
    const NODE_SPACING = 20
    const CANVAS_CENTER = 500
    
    assets.forEach((asset, index) => {
      const level = levelMap[asset.name]
      const nodesAtLevel = nodesByLevel[level]
      const positionInLevel = nodesAtLevel.indexOf(asset)
      const totalWidth = nodesAtLevel.length * (NODE_WIDTH + NODE_SPACING)
      const startX = CANVAS_CENTER - totalWidth / 2
      
      const id = `node-${Date.now()}-${index}`
      nameToId[asset.name] = id
      
      newNodes.push({
        id,
        name: asset.name,
        type: asset.type || 'consumer',
        x: startX + positionInLevel * (NODE_WIDTH + NODE_SPACING),
        y: 50 + level * LEVEL_HEIGHT,
        parentId: null,
        children: [],
        ratedCapacity: asset.rated_capacity_kw,
        ratedVoltage: asset.rated_voltage
      })
    })
    
    assets.forEach(asset => {
      if (asset.parent_name && nameToId[asset.parent_name]) {
        const fromId = nameToId[asset.parent_name]
        const toId = nameToId[asset.name]
        newConnections.push({ from: fromId, to: toId })
        
        const nodeIndex = newNodes.findIndex(n => n.id === toId)
        if (nodeIndex >= 0) {
          newNodes[nodeIndex].parentId = fromId
        }
      }
    })
    
    setNodes([...nodes, ...newNodes])
    setConnections([...connections, ...newConnections])
    
    const allNodeIds = new Set(newNodes.map(n => n.id))
    setExpandedNodes(allNodeIds)
  }
  
  const toggleNodeExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }
  
  const getHierarchyTree = (): AssetNode[] => {
    const roots = nodes.filter(n => !n.parentId)
    return roots
  }
  
  const getChildren = (nodeId: string): AssetNode[] => {
    return nodes.filter(n => n.parentId === nodeId)
  }
  
  const exportToPNG = async () => {
    if (!canvasRef.current) return
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    canvas.width = 1200
    canvas.height = 800
    
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    ctx.fillStyle = '#f8fafc'
    ctx.font = 'bold 24px system-ui'
    ctx.fillText('Digital Twin - Single Line Diagram', 40, 50)
    ctx.font = '14px system-ui'
    ctx.fillStyle = '#94a3b8'
    ctx.fillText(`Exported: ${new Date().toLocaleString()}`, 40, 75)
    
    connections.forEach(conn => {
      const fromNode = nodes.find(n => n.id === conn.from)
      const toNode = nodes.find(n => n.id === conn.to)
      if (!fromNode || !toNode) return
      
      ctx.beginPath()
      ctx.strokeStyle = '#475569'
      ctx.lineWidth = 2
      ctx.moveTo(fromNode.x + 60, fromNode.y + 100 + 40)
      ctx.lineTo(toNode.x + 60, toNode.y + 100)
      ctx.stroke()
    })
    
    nodes.forEach(node => {
      const assetType = ASSET_TYPES.find(t => t.type === node.type)
      ctx.fillStyle = assetType?.color || '#475569'
      ctx.fillRect(node.x, node.y + 100, 120, 80)
      
      ctx.fillStyle = '#f8fafc'
      ctx.font = 'bold 12px system-ui'
      ctx.fillText(node.name, node.x + 10, node.y + 130)
      ctx.font = '10px system-ui'
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fillText(assetType?.label || node.type, node.x + 10, node.y + 150)
    })
    
    const link = document.createElement('a')
    link.download = 'digital-twin-sld.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const { data: existingAssets } = useQuery({
    queryKey: ['assets', 'tree', currentSite],
    queryFn: () => currentSite ? api.assets.getTree(currentSite) : null,
    enabled: !!currentSite
  })

  useEffect(() => {
    if (existingAssets && existingAssets.length > 0) {
      const loadedNodes: AssetNode[] = []
      const loadedConnections: Connection[] = []
      
      const processAsset = (asset: AssetTreeNode, x: number, y: number, level: number) => {
        const node: AssetNode = {
          id: `asset-${asset.id}`,
          name: asset.name,
          type: asset.asset_type,
          x: x,
          y: y + level * 120,
          parentId: asset.parent_id ? `asset-${asset.parent_id}` : null,
          children: [],
          meterId: asset.meter_id,
          ratedCapacity: asset.rated_capacity_kw,
          ratedVoltage: asset.rated_voltage
        }
        loadedNodes.push(node)
        
        if (asset.parent_id) {
          loadedConnections.push({
            from: `asset-${asset.parent_id}`,
            to: node.id
          })
        }
        
        if (asset.children) {
          asset.children.forEach((child: AssetTreeNode, i: number) => {
            processAsset(child, x + i * 180 - (asset.children.length - 1) * 90, y, level + 1)
          })
        }
      }

      existingAssets.forEach((asset: AssetTreeNode, i: number) => {
        processAsset(asset, 400 + i * 300, 100, 0)
      })
      
      setNodes(loadedNodes)
      setConnections(loadedConnections)
    }
  }, [existingAssets])

  const saveToHistory = useCallback(() => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({ nodes: [...nodes], connections: [...connections] })
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }, [nodes, connections, history, historyIndex])

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      const state = history[historyIndex - 1]
      setNodes(state.nodes)
      setConnections(state.connections)
    }
  }

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      const state = history[historyIndex + 1]
      setNodes(state.nodes)
      setConnections(state.connections)
    }
  }

  const addNode = (type: string) => {
    const newNode: AssetNode = {
      id: `node-${Date.now()}`,
      name: `New ${ASSET_TYPES.find(t => t.type === type)?.label || 'Asset'}`,
      type,
      x: 300 + Math.random() * 200 - pan.x,
      y: 200 + Math.random() * 100 - pan.y,
      parentId: null,
      children: []
    }
    saveToHistory()
    setNodes([...nodes, newNode])
    setSelectedNode(newNode.id)
    setEditingNode(newNode)
  }

  const deleteNode = (nodeId: string) => {
    saveToHistory()
    setNodes(nodes.filter(n => n.id !== nodeId))
    setConnections(connections.filter(c => c.from !== nodeId && c.to !== nodeId))
    setSelectedNode(null)
  }

  const updateNode = (nodeId: string, updates: Partial<AssetNode>) => {
    setNodes(nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n))
  }

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    if (connectingFrom) {
      if (connectingFrom !== nodeId) {
        const exists = connections.some(c => 
          (c.from === connectingFrom && c.to === nodeId) ||
          (c.from === nodeId && c.to === connectingFrom)
        )
        if (!exists) {
          saveToHistory()
          setConnections([...connections, { from: connectingFrom, to: nodeId }])
          updateNode(nodeId, { parentId: connectingFrom })
        }
      }
      setConnectingFrom(null)
    } else {
      setDraggingNode(nodeId)
      setSelectedNode(nodeId)
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNode) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        const rawX = (e.clientX - rect.left) / zoom - pan.x
        const rawY = (e.clientY - rect.top) / zoom - pan.y
        const x = snapToGrid(rawX)
        const y = snapToGrid(rawY)
        updateNode(draggingNode, { x, y })
      }
    } else if (isPanning) {
      const dx = e.clientX - panStart.x
      const dy = e.clientY - panStart.y
      setPan({ x: pan.x + dx / zoom, y: pan.y + dy / zoom })
      setPanStart({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = () => {
    if (draggingNode) {
      saveToHistory()
    }
    setDraggingNode(null)
    setIsPanning(false)
  }

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setSelectedNode(null)
      setConnectingFrom(null)
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentSite) throw new Error('No site selected')
      
      for (const node of nodes) {
        const assetData = {
          site_id: currentSite,
          name: node.name,
          asset_type: node.type,
          parent_id: node.parentId ? parseInt(node.parentId.replace('asset-', '')) : undefined,
          rated_capacity_kw: node.ratedCapacity || undefined,
          rated_voltage: node.ratedVoltage || undefined
        }
        
        if (node.id.startsWith('asset-')) {
          await api.assets.update(parseInt(node.id.replace('asset-', '')), assetData)
        } else {
          await api.assets.create(assetData)
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      alert('Digital twin saved successfully!')
    },
    onError: (error) => {
      alert(`Failed to save: ${error}`)
    }
  })

  const getNodeColor = (type: string) => {
    return ASSET_TYPES.find(t => t.type === type)?.color || '#64748b'
  }

  const getNodeIcon = (type: string) => {
    const NodeIcon = ASSET_TYPES.find(t => t.type === type)?.icon || Box
    return NodeIcon
  }

  return (
    <div style={{ padding: '1.5rem', height: 'calc(100vh - 4rem)' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Network size={28} color="#10b981" />
            Digital Twin Builder
          </h1>
          <p style={{ color: '#64748b', marginTop: '0.25rem' }}>
            Drag and drop to build your site's electrical hierarchy (SLD)
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn btn-outline" 
            onClick={undo}
            disabled={historyIndex <= 0}
            style={{ padding: '0.5rem' }}
          >
            <Undo size={18} />
          </button>
          <button 
            className="btn btn-outline" 
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            style={{ padding: '0.5rem' }}
          >
            <Redo size={18} />
          </button>
          <button 
            className="btn btn-outline" 
            onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}
            style={{ padding: '0.5rem' }}
          >
            <ZoomOut size={18} />
          </button>
          <span style={{ 
            padding: '0.5rem 0.75rem', 
            background: '#334155', 
            borderRadius: '6px',
            fontSize: '0.875rem',
            minWidth: '60px',
            textAlign: 'center'
          }}>
            {Math.round(zoom * 100)}%
          </span>
          <button 
            className="btn btn-outline" 
            onClick={() => setZoom(z => Math.min(2, z + 0.25))}
            style={{ padding: '0.5rem' }}
          >
            <ZoomIn size={18} />
          </button>
          <div style={{ width: '1px', height: '24px', background: '#475569' }}></div>
          <button 
            className={`btn ${gridSnap ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setGridSnap(!gridSnap)}
            style={{ padding: '0.5rem' }}
            title={gridSnap ? 'Grid Snap: ON' : 'Grid Snap: OFF'}
          >
            <Grid3X3 size={18} />
          </button>
          <button 
            className="btn btn-outline"
            onClick={() => setShowTemplates(!showTemplates)}
            style={{ padding: '0.5rem' }}
            title="Load Template"
          >
            <Layers size={18} />
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowUploadModal(true)}
            style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
            title="Upload Panel Diagram"
          >
            <Upload size={18} />
            AI Import
          </button>
          <button 
            className={`btn ${showHierarchy ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setShowHierarchy(!showHierarchy)}
            style={{ padding: '0.5rem' }}
            title="Toggle Hierarchy View"
          >
            <FolderTree size={18} />
          </button>
          <button 
            className="btn btn-outline"
            onClick={exportToPNG}
            disabled={nodes.length === 0}
            style={{ padding: '0.5rem' }}
            title="Export to PNG"
          >
            <Download size={18} />
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !currentSite}
          >
            <Save size={18} />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
      
      {showTemplates && (
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Quick Templates</h3>
            <button className="btn btn-ghost" onClick={() => setShowTemplates(false)}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {TEMPLATES.map((template, i) => (
              <button
                key={i}
                onClick={() => applyTemplate(template)}
                disabled={!currentSite}
                style={{
                  padding: '1rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.5rem',
                  textAlign: 'left',
                  cursor: currentSite ? 'pointer' : 'not-allowed',
                  opacity: currentSite ? 1 : 0.5
                }}
              >
                <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{template.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{template.description}</div>
                <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.5rem' }}>
                  {template.nodes.length} components
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!currentSite && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', marginBottom: '1rem' }}>
          <Building2 size={48} color="#64748b" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: '#94a3b8' }}>Please select a site from the dropdown to build its digital twin</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', height: 'calc(100% - 100px)' }}>
        {showPalette && (
          <div className="card" style={{ width: '200px', padding: '1rem', flexShrink: 0 }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem', color: '#94a3b8' }}>
              Components
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {ASSET_TYPES.map(asset => {
                const Icon = asset.icon
                return (
                  <button
                    key={asset.type}
                    onClick={() => addNode(asset.type)}
                    disabled={!currentSite}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      background: '#1e293b',
                      border: `1px solid ${asset.color}33`,
                      borderRadius: '6px',
                      cursor: currentSite ? 'pointer' : 'not-allowed',
                      color: '#e2e8f0',
                      fontSize: '0.75rem',
                      transition: 'all 0.2s',
                      opacity: currentSite ? 1 : 0.5
                    }}
                  >
                    <Icon size={16} color={asset.color} />
                    {asset.label}
                  </button>
                )
              })}
            </div>
            
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#94a3b8' }}>
                Instructions
              </h3>
              <ul style={{ fontSize: '0.75rem', color: '#64748b', listStyle: 'disc', paddingLeft: '1rem' }}>
                <li>Click component to add</li>
                <li>Drag nodes to position</li>
                <li>Right-click to connect</li>
                <li>Double-click to edit</li>
              </ul>
            </div>
          </div>
        )}

        <div 
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onMouseDown={handleCanvasMouseDown}
          style={{
            flex: 1,
            background: '#0f172a',
            borderRadius: '12px',
            overflow: 'hidden',
            position: 'relative',
            cursor: isPanning ? 'grabbing' : 'grab',
            backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)',
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x * zoom}px ${pan.y * zoom}px`
          }}
        >
          <svg 
            style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%', 
              height: '100%',
              pointerEvents: 'none'
            }}
          >
            {connections.map((conn, i) => {
              const fromNode = nodes.find(n => n.id === conn.from)
              const toNode = nodes.find(n => n.id === conn.to)
              if (!fromNode || !toNode) return null
              
              const x1 = (fromNode.x + pan.x + 60) * zoom
              const y1 = (fromNode.y + pan.y + 40) * zoom
              const x2 = (toNode.x + pan.x + 60) * zoom
              const y2 = (toNode.y + pan.y) * zoom
              
              return (
                <g key={i}>
                  <path
                    d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
                    stroke="#475569"
                    strokeWidth="2"
                    fill="none"
                  />
                  <circle cx={x2} cy={y2} r="4" fill="#10b981" />
                </g>
              )
            })}
          </svg>

          {nodes.map(node => {
            const NodeIcon = getNodeIcon(node.type)
            const color = getNodeColor(node.type)
            
            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onDoubleClick={() => setEditingNode(node)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setConnectingFrom(node.id)
                }}
                style={{
                  position: 'absolute',
                  left: (node.x + pan.x) * zoom,
                  top: (node.y + pan.y) * zoom,
                  width: 120 * zoom,
                  padding: `${8 * zoom}px`,
                  background: selectedNode === node.id ? '#1e3a5f' : '#1e293b',
                  border: `2px solid ${connectingFrom === node.id ? '#10b981' : selectedNode === node.id ? '#3b82f6' : color}`,
                  borderRadius: 8 * zoom,
                  cursor: 'move',
                  userSelect: 'none',
                  transition: 'border-color 0.2s',
                  boxShadow: selectedNode === node.id ? '0 0 20px rgba(59, 130, 246, 0.3)' : 'none'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 6 * zoom,
                  marginBottom: 4 * zoom 
                }}>
                  <NodeIcon size={16 * zoom} color={color} />
                  <span style={{ 
                    fontSize: 11 * zoom, 
                    fontWeight: 500,
                    color: '#e2e8f0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {node.name}
                  </span>
                </div>
                <div style={{ 
                  fontSize: 9 * zoom, 
                  color: '#64748b',
                  textTransform: 'capitalize'
                }}>
                  {node.type.replace('_', ' ')}
                </div>
                
                {selectedNode === node.id && (
                  <div style={{
                    position: 'absolute',
                    top: -30 * zoom,
                    right: 0,
                    display: 'flex',
                    gap: 4 * zoom
                  }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingNode(node); }}
                      style={{
                        padding: 4 * zoom,
                        background: '#3b82f6',
                        border: 'none',
                        borderRadius: 4 * zoom,
                        cursor: 'pointer'
                      }}
                    >
                      <Edit2 size={12 * zoom} color="white" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                      style={{
                        padding: 4 * zoom,
                        background: '#ef4444',
                        border: 'none',
                        borderRadius: 4 * zoom,
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={12 * zoom} color="white" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}

          {connectingFrom && (
            <div style={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#10b981',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.875rem'
            }}>
              Click on another node to connect, or click canvas to cancel
            </div>
          )}
        </div>
      </div>

      {editingNode && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '400px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Edit Asset</h3>
              <button onClick={() => setEditingNode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#94a3b8' }}>Name</label>
                <input
                  type="text"
                  value={editingNode.name}
                  onChange={(e) => {
                    const updated = { ...editingNode, name: e.target.value }
                    setEditingNode(updated)
                    updateNode(editingNode.id, { name: e.target.value })
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#94a3b8' }}>Type</label>
                <select
                  value={editingNode.type}
                  onChange={(e) => {
                    const updated = { ...editingNode, type: e.target.value }
                    setEditingNode(updated)
                    updateNode(editingNode.id, { type: e.target.value })
                  }}
                >
                  {ASSET_TYPES.map(type => (
                    <option key={type.type} value={type.type}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#94a3b8' }}>Rated Capacity (kW)</label>
                <input
                  type="number"
                  value={editingNode.ratedCapacity || ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseFloat(e.target.value) : undefined
                    const updated = { ...editingNode, ratedCapacity: val }
                    setEditingNode(updated)
                    updateNode(editingNode.id, { ratedCapacity: val })
                  }}
                  placeholder="Optional"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', color: '#94a3b8' }}>Rated Voltage (V)</label>
                <input
                  type="number"
                  value={editingNode.ratedVoltage || ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseFloat(e.target.value) : undefined
                    const updated = { ...editingNode, ratedVoltage: val }
                    setEditingNode(updated)
                    updateNode(editingNode.id, { ratedVoltage: val })
                  }}
                  placeholder="Optional"
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setEditingNode(null)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => setEditingNode(null)} style={{ flex: 1 }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showUploadModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '500px', maxWidth: '90vw', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileImage size={24} color="#10b981" />
                  AI Panel Diagram Import
                </h2>
                <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  Upload a panel diagram image or PDF to auto-generate your digital twin
                </p>
              </div>
              <button 
                className="btn btn-ghost" 
                onClick={() => { setShowUploadModal(false); setUploadFile(null); setAnalysisError(null) }}
              >
                <X size={20} />
              </button>
            </div>
            
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*,.pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #475569',
                borderRadius: '12px',
                padding: '2rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: uploadFile ? '#1e3a5f' : '#1e293b',
                transition: 'all 0.2s'
              }}
            >
              {uploadFile ? (
                <div>
                  <FileImage size={48} color="#10b981" style={{ margin: '0 auto 1rem' }} />
                  <p style={{ fontWeight: 600, color: '#f8fafc' }}>{uploadFile.name}</p>
                  <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    {(uploadFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <Upload size={48} color="#64748b" style={{ margin: '0 auto 1rem' }} />
                  <p style={{ fontWeight: 600, color: '#f8fafc' }}>Drop panel diagram here</p>
                  <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    or click to browse (PNG, JPG, PDF)
                  </p>
                </div>
              )}
            </div>
            
            {analysisError && (
              <div style={{ 
                marginTop: '1rem', 
                padding: '0.75rem', 
                background: 'rgba(239, 68, 68, 0.1)', 
                border: '1px solid #ef4444',
                borderRadius: '8px',
                color: '#fca5a5',
                fontSize: '0.875rem'
              }}>
                {analysisError}
              </div>
            )}
            
            <div style={{ 
              marginTop: '1.5rem', 
              padding: '1rem', 
              background: '#0f172a', 
              borderRadius: '8px',
              fontSize: '0.875rem',
              color: '#94a3b8'
            }}>
              <strong style={{ color: '#f8fafc' }}>What AI will extract:</strong>
              <ul style={{ marginTop: '0.5rem', marginLeft: '1.25rem' }}>
                <li>Main panels, sub-panels, distribution boards</li>
                <li>Transformers, breakers, generators</li>
                <li>Individual loads and consumers</li>
                <li>Parent-child connections (hierarchy)</li>
                <li>Rated capacities and voltages</li>
              </ul>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button 
                className="btn btn-outline" 
                onClick={() => { setShowUploadModal(false); setUploadFile(null); setAnalysisError(null) }} 
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={analyzeDiagram}
                disabled={!uploadFile || isAnalyzing}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap size={18} />
                    Generate Digital Twin
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showHierarchy && nodes.length > 0 && (
        <div style={{
          position: 'fixed',
          right: '1.5rem',
          top: '8rem',
          width: '280px',
          maxHeight: 'calc(100vh - 12rem)',
          background: '#1e293b',
          borderRadius: '12px',
          border: '1px solid #334155',
          overflow: 'hidden',
          zIndex: 100
        }}>
          <div style={{ 
            padding: '0.75rem 1rem', 
            borderBottom: '1px solid #334155',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FolderTree size={16} color="#10b981" />
              Hierarchy ({nodes.length} assets)
            </h3>
            <button className="btn btn-ghost" onClick={() => setShowHierarchy(false)} style={{ padding: '0.25rem' }}>
              <X size={14} />
            </button>
          </div>
          <div style={{ padding: '0.5rem', maxHeight: 'calc(100vh - 16rem)', overflowY: 'auto' }}>
            {getHierarchyTree().map(node => (
              <HierarchyNode 
                key={node.id} 
                node={node} 
                level={0}
                expandedNodes={expandedNodes}
                toggleExpand={toggleNodeExpand}
                getChildren={getChildren}
                getNodeColor={getNodeColor}
                selectedNode={selectedNode}
                setSelectedNode={setSelectedNode}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function HierarchyNode({ 
  node, 
  level, 
  expandedNodes, 
  toggleExpand, 
  getChildren, 
  getNodeColor,
  selectedNode,
  setSelectedNode
}: {
  node: AssetNode
  level: number
  expandedNodes: Set<string>
  toggleExpand: (id: string) => void
  getChildren: (id: string) => AssetNode[]
  getNodeColor: (type: string) => string
  selectedNode: string | null
  setSelectedNode: (id: string | null) => void
}) {
  const children = getChildren(node.id)
  const hasChildren = children.length > 0
  const isExpanded = expandedNodes.has(node.id)
  const isSelected = selectedNode === node.id
  
  return (
    <div>
      <div 
        onClick={() => setSelectedNode(node.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.375rem 0.5rem',
          paddingLeft: `${0.5 + level * 1}rem`,
          borderRadius: '6px',
          cursor: 'pointer',
          background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
          fontSize: '0.8125rem'
        }}
      >
        {hasChildren ? (
          <button 
            onClick={(e) => { e.stopPropagation(); toggleExpand(node.id) }}
            style={{ 
              background: 'none', 
              border: 'none', 
              padding: 0, 
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex'
            }}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span style={{ width: '14px' }} />
        )}
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: getNodeColor(node.type),
          flexShrink: 0
        }} />
        <span style={{ 
          color: isSelected ? '#10b981' : '#f8fafc',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {node.name}
        </span>
        {hasChildren && (
          <span style={{ color: '#64748b', fontSize: '0.75rem', marginLeft: 'auto' }}>
            {children.length}
          </span>
        )}
      </div>
      {isExpanded && hasChildren && (
        <div>
          {children.map(child => (
            <HierarchyNode
              key={child.id}
              node={child}
              level={level + 1}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              getChildren={getChildren}
              getNodeColor={getNodeColor}
              selectedNode={selectedNode}
              setSelectedNode={setSelectedNode}
            />
          ))}
        </div>
      )}
    </div>
  )
}
