import { useState } from 'react'
import { Settings as SettingsIcon, Building2, Globe, Bell, Zap, Moon, Sun, Mail, Clock, DollarSign, Save, Check } from 'lucide-react'

export default function Settings() {
  const [activeSection, setActiveSection] = useState<'organization' | 'localization' | 'notifications' | 'automation'>('organization')
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [saved, setSaved] = useState(false)

  const [orgSettings, setOrgSettings] = useState({
    companyName: 'Demo Organization',
    industry: 'Commercial Real Estate',
    timezone: 'America/New_York',
    currency: 'USD',
    fiscalYearStart: 'January',
  })

  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    weeklyReports: true,
    monthlyReports: true,
    billReminders: true,
    anomalyAlerts: true,
    maintenanceAlerts: true,
  })

  const [automation, setAutomation] = useState({
    autoImport: true,
    autoValidate: true,
    autoBackup: true,
    scheduledReports: false,
  })

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const sections = [
    { id: 'organization', label: 'Organization', icon: Building2 },
    { id: 'localization', label: 'Localization', icon: Globe },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'automation', label: 'Automation', icon: Zap },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <SettingsIcon size={24} color="#64748b" />
            Settings
          </h1>
          <p style={{ color: '#64748b' }}>Configure application preferences and organization settings</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={handleSave}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {saved ? <Check size={18} /> : <Save size={18} />}
          {saved ? 'Saved!' : 'Save All'}
        </button>
      </div>

      <div className="grid grid-4" style={{ gap: '1.5rem' }}>
        <div className="card" style={{ height: 'fit-content' }}>
          <div className="card-header">
            <h2 className="card-title">Navigation</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as 'organization' | 'localization' | 'notifications' | 'automation')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  background: activeSection === section.id ? '#3b82f620' : 'transparent',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  color: activeSection === section.id ? '#3b82f6' : 'white',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <section.icon size={18} />
                <span style={{ fontWeight: 500 }}>{section.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ gridColumn: 'span 3' }}>
          {activeSection === 'organization' && (
            <>
              <div className="card-header">
                <h2 className="card-title">Organization Settings</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input 
                    type="text" 
                    className="form-input"
                    value={orgSettings.companyName}
                    onChange={(e) => setOrgSettings({ ...orgSettings, companyName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Industry</label>
                  <select 
                    className="form-input"
                    value={orgSettings.industry}
                    onChange={(e) => setOrgSettings({ ...orgSettings, industry: e.target.value })}
                  >
                    <option>Commercial Real Estate</option>
                    <option>Industrial Manufacturing</option>
                    <option>Retail</option>
                    <option>Healthcare</option>
                    <option>Education</option>
                    <option>Hospitality</option>
                    <option>Data Centers</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fiscal Year Start</label>
                  <select 
                    className="form-input"
                    value={orgSettings.fiscalYearStart}
                    onChange={(e) => setOrgSettings({ ...orgSettings, fiscalYearStart: e.target.value })}
                  >
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(month => (
                      <option key={month}>{month}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {activeSection === 'localization' && (
            <>
              <div className="card-header">
                <h2 className="card-title">Localization</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={16} /> Timezone
                  </label>
                  <select 
                    className="form-input"
                    value={orgSettings.timezone}
                    onChange={(e) => setOrgSettings({ ...orgSettings, timezone: e.target.value })}
                  >
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="Europe/London">London (GMT)</option>
                    <option value="Europe/Paris">Paris (CET)</option>
                    <option value="Asia/Singapore">Singapore (SGT)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <DollarSign size={16} /> Currency
                  </label>
                  <select 
                    className="form-input"
                    value={orgSettings.currency}
                    onChange={(e) => setOrgSettings({ ...orgSettings, currency: e.target.value })}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="SGD">SGD (S$)</option>
                    <option value="AUD">AUD (A$)</option>
                  </select>
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '1rem',
                  background: '#1e293b',
                  borderRadius: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {isDarkMode ? <Moon size={20} /> : <Sun size={20} />}
                    <div>
                      <div style={{ fontWeight: 500 }}>Theme</div>
                      <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        {isDarkMode ? 'Dark mode enabled' : 'Light mode enabled'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    style={{
                      width: '48px',
                      height: '24px',
                      borderRadius: '999px',
                      background: isDarkMode ? '#3b82f6' : '#334155',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'white',
                      position: 'absolute',
                      top: '2px',
                      left: isDarkMode ? '26px' : '2px',
                      transition: 'left 0.2s ease',
                    }} />
                  </button>
                </div>
              </div>
            </>
          )}

          {activeSection === 'notifications' && (
            <>
              <div className="card-header">
                <h2 className="card-title">Notification Preferences</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { key: 'emailAlerts', label: 'Email Alerts', desc: 'Receive critical alerts via email', icon: Mail },
                  { key: 'weeklyReports', label: 'Weekly Digest', desc: 'Weekly summary of energy usage', icon: Clock },
                  { key: 'monthlyReports', label: 'Monthly Reports', desc: 'Monthly detailed analysis reports', icon: Bell },
                  { key: 'billReminders', label: 'Bill Reminders', desc: 'Notifications before bill due dates', icon: DollarSign },
                  { key: 'anomalyAlerts', label: 'Anomaly Alerts', desc: 'Alert when unusual patterns detected', icon: Zap },
                  { key: 'maintenanceAlerts', label: 'Maintenance Alerts', desc: 'Equipment maintenance notifications', icon: SettingsIcon },
                ].map((item) => (
                  <div key={item.key} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '1rem',
                    background: '#1e293b',
                    borderRadius: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <item.icon size={20} color="#64748b" />
                      <div>
                        <div style={{ fontWeight: 500 }}>{item.label}</div>
                        <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{item.desc}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key as keyof typeof notifications] })}
                      style={{
                        width: '48px',
                        height: '24px',
                        borderRadius: '999px',
                        background: notifications[item.key as keyof typeof notifications] ? '#10b981' : '#334155',
                        border: 'none',
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                    >
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'white',
                        position: 'absolute',
                        top: '2px',
                        left: notifications[item.key as keyof typeof notifications] ? '26px' : '2px',
                        transition: 'left 0.2s ease',
                      }} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeSection === 'automation' && (
            <>
              <div className="card-header">
                <h2 className="card-title">Automation Settings</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { key: 'autoImport', label: 'Auto Import', desc: 'Automatically import data from connected sources' },
                  { key: 'autoValidate', label: 'Auto Validation', desc: 'Automatically validate new meter readings' },
                  { key: 'autoBackup', label: 'Auto Backup', desc: 'Daily automatic data backups' },
                  { key: 'scheduledReports', label: 'Scheduled Reports', desc: 'Generate and send reports on schedule' },
                ].map((item) => (
                  <div key={item.key} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '1rem',
                    background: '#1e293b',
                    borderRadius: '0.5rem'
                  }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{item.label}</div>
                      <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{item.desc}</div>
                    </div>
                    <button
                      onClick={() => setAutomation({ ...automation, [item.key]: !automation[item.key as keyof typeof automation] })}
                      style={{
                        width: '48px',
                        height: '24px',
                        borderRadius: '999px',
                        background: automation[item.key as keyof typeof automation] ? '#10b981' : '#334155',
                        border: 'none',
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                    >
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: 'white',
                        position: 'absolute',
                        top: '2px',
                        left: automation[item.key as keyof typeof automation] ? '26px' : '2px',
                        transition: 'left 0.2s ease',
                      }} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
