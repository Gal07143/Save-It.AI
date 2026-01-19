import { useState, useEffect } from 'react'
import { Settings, Globe, Clock, Ruler, Save } from 'lucide-react'

interface Preferences {
  language: string
  timezone: string
  units: 'metric' | 'imperial'
  dateFormat: string
  numberFormat: string
  theme: 'dark' | 'light' | 'system'
}

const PREFERENCES_KEY = 'saveit_preferences'

const defaultPreferences: Preferences = {
  language: 'en',
  timezone: 'auto',
  units: 'metric',
  dateFormat: 'MMM DD, YYYY',
  numberFormat: 'en-US',
  theme: 'dark',
}

export function getPreferences(): Preferences {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY)
    return stored ? { ...defaultPreferences, ...JSON.parse(stored) } : defaultPreferences
  } catch {
    return defaultPreferences
  }
}

export function savePreferences(prefs: Preferences): void {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs))
}

export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(getPreferences)

  const updatePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    const updated = { ...preferences, [key]: value }
    setPreferences(updated)
    savePreferences(updated)
  }

  return { preferences, updatePreference }
}

const languages = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
]

const timezones = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Australia/Sydney', label: 'Sydney' },
]

const dateFormats = [
  { value: 'MMM DD, YYYY', label: 'Jan 15, 2024' },
  { value: 'DD MMM YYYY', label: '15 Jan 2024' },
  { value: 'MM/DD/YYYY', label: '01/15/2024' },
  { value: 'DD/MM/YYYY', label: '15/01/2024' },
  { value: 'YYYY-MM-DD', label: '2024-01-15' },
]

export default function UserPreferencesPanel() {
  const { preferences, updatePreference } = usePreferences()
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    savePreferences(preferences)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="card">
      <h3 style={{
        margin: 0,
        marginBottom: '1.5rem',
        fontSize: '1.125rem',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <Settings size={20} color="#10b981" />
        User Preferences
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#f1f5f9',
          }}>
            <Globe size={16} color="#64748b" />
            Language
          </label>
          <select
            value={preferences.language}
            onChange={e => updatePreference('language', e.target.value)}
            className="form-control"
          >
            {languages.map(lang => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#f1f5f9',
          }}>
            <Clock size={16} color="#64748b" />
            Timezone
          </label>
          <select
            value={preferences.timezone}
            onChange={e => updatePreference('timezone', e.target.value)}
            className="form-control"
          >
            {timezones.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#f1f5f9',
          }}>
            <Ruler size={16} color="#64748b" />
            Units
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => updatePreference('units', 'metric')}
              style={{
                flex: 1,
                padding: '0.625rem',
                background: preferences.units === 'metric' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                border: preferences.units === 'metric' ? '1px solid #10b981' : '1px solid #334155',
                borderRadius: '0.5rem',
                color: preferences.units === 'metric' ? '#10b981' : '#94a3b8',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Metric (kWh, °C)
            </button>
            <button
              onClick={() => updatePreference('units', 'imperial')}
              style={{
                flex: 1,
                padding: '0.625rem',
                background: preferences.units === 'imperial' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                border: preferences.units === 'imperial' ? '1px solid #10b981' : '1px solid #334155',
                borderRadius: '0.5rem',
                color: preferences.units === 'imperial' ? '#10b981' : '#94a3b8',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Imperial (BTU, °F)
            </button>
          </div>
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#f1f5f9',
          }}>
            Date Format
          </label>
          <select
            value={preferences.dateFormat}
            onChange={e => updatePreference('dateFormat', e.target.value)}
            className="form-control"
          >
            {dateFormats.map(fmt => (
              <option key={fmt.value} value={fmt.value}>{fmt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#f1f5f9',
          }}>
            Theme
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(['dark', 'light', 'system'] as const).map(theme => (
              <button
                key={theme}
                onClick={() => updatePreference('theme', theme)}
                style={{
                  flex: 1,
                  padding: '0.625rem',
                  background: preferences.theme === theme ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                  border: preferences.theme === theme ? '1px solid #10b981' : '1px solid #334155',
                  borderRadius: '0.5rem',
                  color: preferences.theme === theme ? '#10b981' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  textTransform: 'capitalize',
                }}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        className="btn btn-primary"
        style={{
          marginTop: '1.5rem',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
        }}
      >
        <Save size={16} />
        {saved ? 'Saved!' : 'Save Preferences'}
      </button>
    </div>
  )
}
