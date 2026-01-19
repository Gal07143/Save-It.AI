import { useState } from 'react'
import { Settings as SettingsIcon, User, Globe, Bell, Moon, Sun, Link2, Download, Clock, DollarSign, Save, Check, Mail, Zap } from 'lucide-react'
import TabPanel, { Tab } from '../components/TabPanel'
import { useToast } from '../contexts/ToastContext'

export default function Settings() {
  const { success, info, warning } = useToast()
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [saved, setSaved] = useState(false)

  const [profileSettings, setProfileSettings] = useState({
    companyName: 'Demo Organization',
    industry: 'Commercial Real Estate',
    fiscalYearStart: 'January',
    displayName: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
  })

  const [preferences, setPreferences] = useState({
    language: 'en',
    timezone: 'America/New_York',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    units: 'imperial',
  })

  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    weeklyReports: true,
    monthlyReports: true,
    billReminders: true,
    anomalyAlerts: true,
    maintenanceAlerts: true,
  })

  const [integrations, setIntegrations] = useState({
    googleCalendar: false,
    slack: true,
    microsoftTeams: false,
    zapier: false,
  })

  const handleSave = () => {
    setSaved(true)
    success('Settings Saved', 'Your settings have been saved successfully')
    setTimeout(() => setSaved(false), 2000)
  }

  const tabs: Tab[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'preferences', label: 'Preferences', icon: Globe },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'theme', label: 'Theme', icon: isDarkMode ? Moon : Sun },
    { id: 'integrations', label: 'Integrations', icon: Link2 },
    { id: 'data-export', label: 'Data Export', icon: Download },
  ]

  const renderTabContent = (activeTab: string) => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Profile Settings</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={profileSettings.displayName}
                  onChange={(e) => setProfileSettings({ ...profileSettings, displayName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-input"
                  value={profileSettings.email}
                  onChange={(e) => setProfileSettings({ ...profileSettings, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input 
                  type="tel" 
                  className="form-input"
                  value={profileSettings.phone}
                  onChange={(e) => setProfileSettings({ ...profileSettings, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={profileSettings.companyName}
                  onChange={(e) => setProfileSettings({ ...profileSettings, companyName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Industry</label>
                <select 
                  className="form-input"
                  value={profileSettings.industry}
                  onChange={(e) => setProfileSettings({ ...profileSettings, industry: e.target.value })}
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
                  value={profileSettings.fiscalYearStart}
                  onChange={(e) => setProfileSettings({ ...profileSettings, fiscalYearStart: e.target.value })}
                >
                  {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(month => (
                    <option key={month}>{month}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )

      case 'preferences':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Preferences</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Globe size={16} /> Language
                </label>
                <select 
                  className="form-input"
                  value={preferences.language}
                  onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="zh">Chinese</option>
                  <option value="ja">Japanese</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={16} /> Timezone
                </label>
                <select 
                  className="form-input"
                  value={preferences.timezone}
                  onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
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
                  value={preferences.currency}
                  onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="SGD">SGD (S$)</option>
                  <option value="AUD">AUD (A$)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date Format</label>
                <select 
                  className="form-input"
                  value={preferences.dateFormat}
                  onChange={(e) => setPreferences({ ...preferences, dateFormat: e.target.value })}
                >
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Units</label>
                <select 
                  className="form-input"
                  value={preferences.units}
                  onChange={(e) => setPreferences({ ...preferences, units: e.target.value })}
                >
                  <option value="imperial">Imperial (kWh, BTU)</option>
                  <option value="metric">Metric (kWh, MJ)</option>
                </select>
              </div>
            </div>
          </div>
        )

      case 'notifications':
        return (
          <div className="card">
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
          </div>
        )

      case 'theme':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Theme Settings</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '1.5rem',
                background: '#1e293b',
                borderRadius: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {isDarkMode ? <Moon size={24} /> : <Sun size={24} />}
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '1.1rem' }}>Dark Mode</div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      {isDarkMode ? 'Dark mode is currently enabled' : 'Light mode is currently enabled'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  style={{
                    width: '56px',
                    height: '28px',
                    borderRadius: '999px',
                    background: isDarkMode ? '#3b82f6' : '#334155',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: '2px',
                    left: isDarkMode ? '30px' : '2px',
                    transition: 'left 0.2s ease',
                  }} />
                </button>
              </div>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)', 
                gap: '1rem' 
              }}>
                <div style={{ 
                  padding: '1.5rem', 
                  background: isDarkMode ? '#0f172a' : '#1e293b', 
                  borderRadius: '0.5rem',
                  border: isDarkMode ? '2px solid #3b82f6' : '2px solid transparent',
                  cursor: 'pointer'
                }}
                onClick={() => setIsDarkMode(true)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Moon size={18} />
                    <span style={{ fontWeight: 500 }}>Dark Theme</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    Easier on the eyes in low-light conditions
                  </p>
                </div>
                <div style={{ 
                  padding: '1.5rem', 
                  background: !isDarkMode ? '#0f172a' : '#1e293b', 
                  borderRadius: '0.5rem',
                  border: !isDarkMode ? '2px solid #3b82f6' : '2px solid transparent',
                  cursor: 'pointer'
                }}
                onClick={() => setIsDarkMode(false)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Sun size={18} />
                    <span style={{ fontWeight: 500 }}>Light Theme</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    Better visibility in bright environments
                  </p>
                </div>
              </div>
            </div>
          </div>
        )

      case 'integrations':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Connected Services</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { key: 'googleCalendar', label: 'Google Calendar', desc: 'Sync maintenance schedules with Google Calendar' },
                { key: 'slack', label: 'Slack', desc: 'Receive alerts and notifications in Slack channels' },
                { key: 'microsoftTeams', label: 'Microsoft Teams', desc: 'Integrate with Microsoft Teams for collaboration' },
                { key: 'zapier', label: 'Zapier', desc: 'Automate workflows with 5,000+ apps' },
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
                    <Link2 size={20} color="#64748b" />
                    <div>
                      <div style={{ fontWeight: 500 }}>{item.label}</div>
                      <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{item.desc}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: integrations[item.key as keyof typeof integrations] ? '#10b981' : '#64748b',
                      fontWeight: 500
                    }}>
                      {integrations[item.key as keyof typeof integrations] ? 'Connected' : 'Not connected'}
                    </span>
                    <button
                      onClick={() => setIntegrations({ ...integrations, [item.key]: !integrations[item.key as keyof typeof integrations] })}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '0.375rem',
                        background: integrations[item.key as keyof typeof integrations] ? '#ef4444' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500
                      }}
                    >
                      {integrations[item.key as keyof typeof integrations] ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 'data-export':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Data Export (GDPR)</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ 
                padding: '1.5rem', 
                background: '#1e293b', 
                borderRadius: '0.5rem',
                border: '1px solid #334155'
              }}>
                <h3 style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Download size={18} />
                  Download Your Data
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
                  Request a copy of all your personal data stored in our system. This includes your profile information, 
                  energy usage data, billing history, and all other associated records.
                </p>
                <button 
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  onClick={() => success('Data Export Requested', 'Your data export has been initiated. You will receive an email when it is ready.')}
                >
                  <Download size={16} />
                  Request Data Export
                </button>
              </div>
              
              <div style={{ 
                padding: '1.5rem', 
                background: '#1e293b', 
                borderRadius: '0.5rem',
                border: '1px solid #334155'
              }}>
                <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Export History</h3>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
                  Your previous data export requests:
                </p>
                <div style={{ 
                  padding: '1rem', 
                  background: '#0f172a', 
                  borderRadius: '0.375rem',
                  textAlign: 'center',
                  color: '#64748b'
                }}>
                  No previous exports found
                </div>
              </div>

              <div style={{ 
                padding: '1.5rem', 
                background: 'rgba(239, 68, 68, 0.1)', 
                borderRadius: '0.5rem',
                border: '1px solid rgba(239, 68, 68, 0.3)'
              }}>
                <h3 style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#ef4444' }}>Delete Account</h3>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <button 
                  style={{ 
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    background: 'transparent',
                    color: '#ef4444',
                    border: '1px solid #ef4444',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500
                  }}
                  onClick={() => warning('Account Deletion', 'Please contact support to request account deletion')}
                >
                  Request Account Deletion
                </button>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

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

      <TabPanel tabs={tabs} variant="underline">
        {(activeTab) => renderTabContent(activeTab)}
      </TabPanel>
    </div>
  )
}
