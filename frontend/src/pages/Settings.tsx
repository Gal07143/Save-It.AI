import { useState } from 'react'
import { Settings as SettingsIcon, User, Bell, Database, Shield, Palette, Globe, Save, Check } from 'lucide-react'

export default function Settings() {
  const [saved, setSaved] = useState(false)
  const [settings, setSettings] = useState({
    companyName: 'SAVE-IT.AI',
    timezone: 'UTC',
    currency: 'USD',
    dateFormat: 'YYYY-MM-DD',
    emailNotifications: true,
    alertThreshold: 10,
    autoValidateBills: false,
    darkMode: false,
    dataRetentionDays: 365,
    emissionFactor: 0.42,
  })

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const timezones = ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Singapore']
  const currencies = ['USD', 'EUR', 'GBP', 'ILS', 'JPY', 'CNY', 'AUD']
  const dateFormats = ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'DD.MM.YYYY']

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <SettingsIcon size={24} />
            Settings
          </h1>
          <p style={{ color: '#64748b' }}>Configure your platform preferences and defaults</p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={handleSave}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {saved ? <Check size={18} /> : <Save size={18} />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-2" style={{ gap: '1.5rem' }}>
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={18} />
              Organization Settings
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input
                type="text"
                className="form-input"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Default Timezone</label>
              <select
                className="form-input"
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              >
                {timezones.map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <select
                className="form-input"
                value={settings.currency}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              >
                {currencies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Globe size={18} />
              Localization
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Date Format</label>
              <select
                className="form-input"
                value={settings.dateFormat}
                onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })}
              >
                {dateFormats.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Default Emission Factor (kg CO2/kWh)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={settings.emissionFactor}
                onChange={(e) => setSettings({ ...settings, emissionFactor: parseFloat(e.target.value) })}
              />
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                Used for carbon footprint calculations when site-specific factor is not set
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={18} />
              Notifications
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <div>
                <div style={{ fontWeight: '500' }}>Email Notifications</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Receive alerts via email</div>
              </div>
            </label>
            <div className="form-group">
              <label className="form-label">Alert Threshold (%)</label>
              <input
                type="number"
                className="form-input"
                value={settings.alertThreshold}
                onChange={(e) => setSettings({ ...settings, alertThreshold: parseInt(e.target.value) })}
              />
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                Generate alerts when consumption varies by more than this percentage
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={18} />
              Automation
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.autoValidateBills}
                onChange={(e) => setSettings({ ...settings, autoValidateBills: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <div>
                <div style={{ fontWeight: '500' }}>Auto-Validate Bills</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Automatically validate bills against meter readings</div>
              </div>
            </label>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={18} />
              Data Management
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Data Retention (days)</label>
              <input
                type="number"
                className="form-input"
                value={settings.dataRetentionDays}
                onChange={(e) => setSettings({ ...settings, dataRetentionDays: parseInt(e.target.value) })}
              />
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                How long to keep historical meter readings
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Palette size={18} />
              Appearance
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.darkMode}
                onChange={(e) => setSettings({ ...settings, darkMode: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <div>
                <div style={{ fontWeight: '500' }}>Dark Mode</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Use dark theme (coming soon)</div>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
