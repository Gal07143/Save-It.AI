import { useEffect, useCallback } from 'react'

interface Shortcut {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  handler: () => void
  description?: string
}

export default function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const target = event.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      if (event.key !== 'Escape') {
        return
      }
    }

    for (const shortcut of shortcuts) {
      const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase()
      const ctrlMatches = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : true
      const shiftMatches = shortcut.shift ? event.shiftKey : !event.shiftKey
      const altMatches = shortcut.alt ? event.altKey : !event.altKey

      if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
        event.preventDefault()
        shortcut.handler()
        return
      }
    }
  }, [shortcuts])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

export const commonShortcuts = {
  search: { key: 'k', ctrl: true, description: 'Open search' },
  escape: { key: 'Escape', description: 'Close modal/dialog' },
  save: { key: 's', ctrl: true, description: 'Save changes' },
  new: { key: 'n', ctrl: true, description: 'Create new item' },
  refresh: { key: 'r', ctrl: true, shift: true, description: 'Refresh data' },
}
