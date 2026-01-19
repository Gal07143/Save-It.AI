import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CopyButtonProps {
  text: string
  label?: string
  size?: number
}

export default function CopyButton({ text, label, size = 16 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '0.25rem',
        color: copied ? '#10b981' : '#64748b',
        transition: 'color 0.2s',
      }}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? <Check size={size} /> : <Copy size={size} />}
      {label && (
        <span style={{ fontSize: '0.75rem' }}>
          {copied ? 'Copied!' : label}
        </span>
      )}
    </button>
  )
}

export function CopyValue({ value, showValue = true }: { value: string; showValue?: boolean }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <span
      onClick={handleCopy}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        cursor: 'pointer',
        padding: '0.125rem 0.375rem',
        background: copied ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)',
        borderRadius: '0.25rem',
        transition: 'background 0.2s',
      }}
      title={copied ? 'Copied!' : 'Click to copy'}
    >
      {showValue && (
        <code style={{ 
          fontSize: '0.75rem', 
          color: copied ? '#10b981' : '#94a3b8',
          fontFamily: 'monospace',
        }}>
          {value}
        </code>
      )}
      {copied ? (
        <Check size={12} color="#10b981" />
      ) : (
        <Copy size={12} color="#64748b" />
      )}
    </span>
  )
}
