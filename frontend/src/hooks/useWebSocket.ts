import { useState, useEffect, useCallback, useRef } from 'react'

interface WebSocketOptions {
  url: string
  onMessage?: (data: unknown) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (error: Event) => void
  reconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

interface WebSocketState {
  isConnected: boolean
  lastMessage: unknown | null
  error: string | null
  reconnectAttempts: number
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  reconnect = true,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
}: WebSocketOptions) {
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    lastMessage: null,
    error: null,
    reconnectAttempts: 0,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setState(prev => ({
          ...prev,
          isConnected: true,
          error: null,
          reconnectAttempts: 0,
        }))
        onOpen?.()
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setState(prev => ({ ...prev, lastMessage: data }))
          onMessage?.(data)
        } catch {
          // Handle non-JSON messages
          setState(prev => ({ ...prev, lastMessage: event.data }))
          onMessage?.(event.data)
        }
      }

      ws.onclose = () => {
        setState(prev => ({ ...prev, isConnected: false }))
        wsRef.current = null
        onClose?.()

        // Attempt reconnection with exponential backoff
        if (reconnect && state.reconnectAttempts < maxReconnectAttempts) {
          const delay = reconnectInterval * Math.pow(2, state.reconnectAttempts)
          reconnectTimeoutRef.current = window.setTimeout(() => {
            setState(prev => ({
              ...prev,
              reconnectAttempts: prev.reconnectAttempts + 1,
            }))
            connect()
          }, delay)
        }
      }

      ws.onerror = (error) => {
        setState(prev => ({ ...prev, error: 'WebSocket error occurred' }))
        onError?.(error)
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to connect',
      }))
    }
  }, [url, onMessage, onOpen, onClose, onError, reconnect, reconnectInterval, maxReconnectAttempts, state.reconnectAttempts])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setState(prev => ({ ...prev, isConnected: false, reconnectAttempts: 0 }))
  }, [])

  const sendMessage = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data))
      return true
    }
    return false
  }, [])

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, []) // Only run on mount/unmount

  return {
    ...state,
    connect,
    disconnect,
    sendMessage,
  }
}

/**
 * Hook for real-time dashboard updates via WebSocket.
 */
export function useDashboardWebSocket(siteId?: number) {
  const baseUrl = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${baseUrl}//${window.location.host}/ws/dashboard${siteId ? `?site_id=${siteId}` : ''}`

  const [updates, setUpdates] = useState<{
    meterReadings: unknown[]
    alerts: unknown[]
    deviceStatus: unknown[]
  }>({
    meterReadings: [],
    alerts: [],
    deviceStatus: [],
  })

  const handleMessage = useCallback((data: unknown) => {
    if (typeof data === 'object' && data !== null) {
      const message = data as { type: string; payload: unknown }

      switch (message.type) {
        case 'meter_reading':
          setUpdates(prev => ({
            ...prev,
            meterReadings: [...prev.meterReadings.slice(-99), message.payload],
          }))
          break
        case 'alert':
          setUpdates(prev => ({
            ...prev,
            alerts: [...prev.alerts.slice(-49), message.payload],
          }))
          break
        case 'device_status':
          setUpdates(prev => ({
            ...prev,
            deviceStatus: [...prev.deviceStatus.slice(-49), message.payload],
          }))
          break
      }
    }
  }, [])

  const ws = useWebSocket({
    url: wsUrl,
    onMessage: handleMessage,
    reconnect: true,
    maxReconnectAttempts: 10,
  })

  return {
    ...ws,
    updates,
    clearUpdates: () => setUpdates({ meterReadings: [], alerts: [], deviceStatus: [] }),
  }
}

export default useWebSocket
