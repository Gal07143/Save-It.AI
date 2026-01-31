import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockApiResponse } from '../setup'

// We need to test the api module
// Since it's complex, we'll test the core fetch behavior

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set CSRF token cookie
    document.cookie = 'csrf_token=test-csrf-token'
  })

  describe('fetchApi', () => {
    it('should include credentials in requests', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockApiResponse({ data: 'test' }))
      global.fetch = mockFetch

      // Import and call the module
      const { api } = await import('../../services/api')
      await api.sites.list()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'include',
        })
      )
    })

    it('should include Content-Type header for JSON requests', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockApiResponse({ data: 'test' }))
      global.fetch = mockFetch

      const { api } = await import('../../services/api')
      await api.sites.list()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })

    it('should include CSRF token for POST requests', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        mockApiResponse({ access_token: 'token', user: {} })
      )
      global.fetch = mockFetch

      const { api } = await import('../../services/api')
      await api.auth.login('test@example.com', 'password')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-CSRF-Token': 'test-csrf-token',
          }),
        })
      )
    })

    it('should redirect to login on 401 response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ detail: 'Unauthorized' }),
      })
      global.fetch = mockFetch

      // Mock window.location
      const originalLocation = window.location
      delete (window as any).location
      window.location = { ...originalLocation, href: '' } as any

      const { api } = await import('../../services/api')

      await expect(api.sites.list()).rejects.toThrow('Session expired')
      expect(window.location.href).toBe('/login')

      // Restore
      window.location = originalLocation
    })

    it('should throw error with detail message on failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: 'Invalid request' }),
      })
      global.fetch = mockFetch

      const { api } = await import('../../services/api')

      await expect(api.sites.create({ name: '' })).rejects.toThrow('Invalid request')
    })
  })

  describe('API endpoints', () => {
    it('should call correct endpoint for sites.list', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockApiResponse([]))
      global.fetch = mockFetch

      const { api } = await import('../../services/api')
      await api.sites.list()

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/sites',
        expect.any(Object)
      )
    })

    it('should call correct endpoint for sites.get with id', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockApiResponse({ id: 1 }))
      global.fetch = mockFetch

      const { api } = await import('../../services/api')
      await api.sites.get(1)

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/sites/1',
        expect.any(Object)
      )
    })

    it('should include site_id filter in assets.list', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockApiResponse([]))
      global.fetch = mockFetch

      const { api } = await import('../../services/api')
      await api.assets.list(5)

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/assets?site_id=5',
        expect.any(Object)
      )
    })
  })
})
