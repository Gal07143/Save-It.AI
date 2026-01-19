import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Check, X, Edit2 } from 'lucide-react'

interface InlineEditProps {
  value: string
  onSave: (value: string) => Promise<void> | void
  placeholder?: string
  type?: 'text' | 'number'
  validate?: (value: string) => string | null
  disabled?: boolean
}

export default function InlineEdit({
  value,
  onSave,
  placeholder = 'Click to edit',
  type = 'text',
  validate,
  disabled = false,
}: InlineEditProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  useEffect(() => {
    setEditValue(value)
  }, [value])

  const handleEdit = () => {
    if (!disabled) {
      setIsEditing(true)
      setError(null)
    }
  }

  const handleCancel = () => {
    setEditValue(value)
    setIsEditing(false)
    setError(null)
  }

  const handleSave = async () => {
    if (validate) {
      const validationError = validate(editValue)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    if (editValue === value) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      await onSave(editValue)
      setIsEditing(false)
    } catch (err) {
      setError('Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (isEditing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(handleSave, 100)}
          disabled={isSaving}
          style={{
            padding: '0.25rem 0.5rem',
            background: '#0f172a',
            border: error ? '1px solid #ef4444' : '1px solid #10b981',
            borderRadius: '0.375rem',
            color: '#f1f5f9',
            fontSize: 'inherit',
            width: '100%',
            minWidth: '100px',
          }}
        />
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            background: '#10b981',
            border: 'none',
            borderRadius: '0.25rem',
            padding: '0.25rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={14} color="white" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          style={{
            background: 'transparent',
            border: '1px solid #475569',
            borderRadius: '0.25rem',
            padding: '0.25rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={14} color="#94a3b8" />
        </button>
      </div>
    )
  }

  return (
    <span
      onClick={handleEdit}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        cursor: disabled ? 'default' : 'pointer',
        padding: '0.125rem 0.25rem',
        borderRadius: '0.25rem',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)')}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {value || <span style={{ color: '#64748b', fontStyle: 'italic' }}>{placeholder}</span>}
      {!disabled && <Edit2 size={12} color="#64748b" />}
    </span>
  )
}

export function InlineSelect({
  value,
  options,
  onSave,
  disabled = false,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onSave: (value: string) => Promise<void> | void
  disabled?: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleChange = async (newValue: string) => {
    if (newValue === value) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      await onSave(newValue)
      setIsEditing(false)
    } catch {
      console.error('Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  if (isEditing) {
    return (
      <select
        value={value}
        onChange={e => handleChange(e.target.value)}
        onBlur={() => setIsEditing(false)}
        disabled={isSaving}
        autoFocus
        style={{
          padding: '0.25rem 0.5rem',
          background: '#0f172a',
          border: '1px solid #10b981',
          borderRadius: '0.375rem',
          color: '#f1f5f9',
          fontSize: 'inherit',
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    )
  }

  const selectedOption = options.find(o => o.value === value)

  return (
    <span
      onClick={() => !disabled && setIsEditing(true)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        cursor: disabled ? 'default' : 'pointer',
        padding: '0.125rem 0.25rem',
        borderRadius: '0.25rem',
      }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)')}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {selectedOption?.label || value}
      {!disabled && <Edit2 size={12} color="#64748b" />}
    </span>
  )
}
