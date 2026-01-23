import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { 
  FileCode, Shield, FolderTree, Database, Download, Settings,
  Plus, Edit, Upload, Copy
} from 'lucide-react'
import { api, DeviceTemplate, DataSource } from '../services/api'
import TabPanel, { Tab } from '../components/TabPanel'
import { useToast } from '../contexts/ToastContext'
import ValidationRulesManager from '../components/ValidationRulesManager'
import DeviceGroupsManager from '../components/DeviceGroupsManager'

interface DeviceConfigProps {
  currentSite: number | null
}

export default function DeviceConfig({ currentSite }: DeviceConfigProps) {
  const [activeTab, setActiveTab] = useState('templates')
  const { success, error: showError } = useToast()

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['deviceTemplates'],
    queryFn: api.deviceTemplates.list
  })

  const { data: dataSources } = useQuery({
    queryKey: ['dataSources', currentSite],
    queryFn: () => api.dataSources.list(currentSite || undefined)
  })

  const tabs: Tab[] = [
    { id: 'templates', label: 'Templates', icon: FileCode, badge: templates?.length || 0 },
    { id: 'validation-rules', label: 'Validation Rules', icon: Shield },
    { id: 'device-groups', label: 'Device Groups', icon: FolderTree },
    { id: 'register-browser', label: 'Register Browser', icon: Database },
    { id: 'import-export', label: 'Import/Export', icon: Download },
    { id: 'default-values', label: 'Default Values', icon: Settings }
  ]

  const renderTemplates = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, color: 'white' }}>Device Templates</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={async () => {
              try {
                await api.deviceTemplates.seed()
                success('Standard templates seeded')
              } catch (e: unknown) {
                showError(e instanceof Error ? e.message : 'Failed to seed templates')
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            <Database size={14} />
            Seed Standards
          </button>
          <button
            onClick={() => success('Template creation', 'Template editor coming soon')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            <Plus size={14} />
            Create Template
          </button>
        </div>
      </div>

      {templatesLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading templates...</div>
      ) : !templates?.length ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <FileCode size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>No templates configured yet</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {templates.map((template: DeviceTemplate) => (
            <div key={template.id} className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ color: 'white', margin: '0 0 0.5rem 0' }}>{template.name}</h4>
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
                    {template.manufacturer} • {template.device_type}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button onClick={() => success('Edit template', `Editing ${template.name}`)} style={{ padding: '0.5rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                    <Edit size={14} />
                  </button>
                  <button onClick={() => success('Template copied', `${template.name} has been duplicated`)} style={{ padding: '0.5rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                    <Copy size={14} />
                  </button>
                </div>
              </div>
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(51, 65, 85, 0.5)' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {template.register_count || 0} registers • {template.protocol || 'Modbus'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const renderRegisterBrowser = () => (
    <div>
      <h3 style={{ color: 'white', marginBottom: '1rem' }}>Register Browser</h3>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Browse and inspect Modbus registers for connected devices.
      </p>
      
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
            Select Device
          </label>
          <select
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(51, 65, 85, 0.5)',
              borderRadius: '6px',
              color: 'white'
            }}
          >
            <option value="">Choose a device...</option>
            {dataSources?.map((ds: DataSource) => (
              <option key={ds.id} value={ds.id}>{ds.name}</option>
            ))}
          </select>
        </div>
        
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: '8px',
          color: '#94a3b8'
        }}>
          <Database size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
          <p>Select a device to browse its registers</p>
        </div>
      </div>
    </div>
  )

  const renderImportExport = () => (
    <div>
      <h3 style={{ color: 'white', marginBottom: '1rem' }}>Template Import/Export</h3>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Share device templates between sites or organizations.
      </p>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card" style={{ padding: '1.5rem' }}>
          <h4 style={{ color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Upload size={18} />
            Import Template
          </h4>
          <div style={{
            padding: '2rem',
            border: '2px dashed rgba(51, 65, 85, 0.5)',
            borderRadius: '8px',
            textAlign: 'center',
            color: '#94a3b8'
          }}>
            <Upload size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
            <p style={{ margin: 0 }}>Drop JSON file here or click to upload</p>
          </div>
        </div>
        
        <div className="card" style={{ padding: '1.5rem' }}>
          <h4 style={{ color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={18} />
            Export Template
          </h4>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {templates?.slice(0, 5).map((template: DeviceTemplate) => (
              <div
                key={template.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  background: 'rgba(15, 23, 42, 0.5)',
                  borderRadius: '6px'
                }}
              >
                <span style={{ color: 'white' }}>{template.name}</span>
                <button
                  onClick={() => success('Template exported', `${template.name} exported as JSON`)}
                  style={{
                    padding: '0.25rem 0.75rem',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#10b981',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Export
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const renderDefaultValues = () => (
    <div>
      <h3 style={{ color: 'white', marginBottom: '1rem' }}>Default Values</h3>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Configure fallback values for missing or invalid data points.
      </p>
      
      <div className="card" style={{ padding: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>Data Point</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>Default Value</th>
              <th style={{ padding: '0.75rem', textAlign: 'left', color: '#94a3b8', fontWeight: 500 }}>Condition</th>
              <th style={{ padding: '0.75rem', textAlign: 'center', color: '#94a3b8', fontWeight: 500 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}>
              <td style={{ padding: '0.75rem', color: 'white' }}>Power Factor</td>
              <td style={{ padding: '0.75rem', color: '#10b981' }}>0.95</td>
              <td style={{ padding: '0.75rem', color: '#94a3b8' }}>When null or out of range</td>
              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                <button onClick={() => success('Edit default', 'Editing Power Factor default value')} style={{ padding: '0.25rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                  <Edit size={14} />
                </button>
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.3)' }}>
              <td style={{ padding: '0.75rem', color: 'white' }}>Voltage</td>
              <td style={{ padding: '0.75rem', color: '#10b981' }}>230</td>
              <td style={{ padding: '0.75rem', color: '#94a3b8' }}>When communication fails</td>
              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                <button onClick={() => success('Edit default', 'Editing Voltage default value')} style={{ padding: '0.25rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                  <Edit size={14} />
                </button>
              </td>
            </tr>
            <tr>
              <td style={{ padding: '0.75rem', color: 'white' }}>Frequency</td>
              <td style={{ padding: '0.75rem', color: '#10b981' }}>50</td>
              <td style={{ padding: '0.75rem', color: '#94a3b8' }}>When null</td>
              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                <button onClick={() => success('Edit default', 'Editing Frequency default value')} style={{ padding: '0.25rem', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                  <Edit size={14} />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        
        <button
          onClick={() => success('Add default value', 'Default value editor coming soon')}
          style={{
            marginTop: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'rgba(16, 185, 129, 0.1)',
            color: '#10b981',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          <Plus size={14} />
          Add Default Value
        </button>
      </div>
    </div>
  )

  const renderTabContent = (tab: string) => {
    switch (tab) {
      case 'templates':
        return renderTemplates()
      case 'validation-rules':
        return <ValidationRulesManager siteId={currentSite || undefined} />
      case 'device-groups':
        return <DeviceGroupsManager siteId={currentSite || undefined} />
      case 'register-browser':
        return renderRegisterBrowser()
      case 'import-export':
        return renderImportExport()
      case 'default-values':
        return renderDefaultValues()
      default:
        return null
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white', margin: 0 }}>Device Configuration</h1>
        <p style={{ color: '#94a3b8', marginTop: '0.25rem' }}>Templates, validation rules, and device organization</p>
      </div>

      <TabPanel tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
        {renderTabContent}
      </TabPanel>
    </div>
  )
}
