import '@testing-library/jest-dom'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Mock fetch globally
global.fetch = vi.fn()

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock document.cookie for CSRF tests
let cookieStore: Record<string, string> = {}
Object.defineProperty(document, 'cookie', {
  get: () => Object.entries(cookieStore).map(([k, v]) => `${k}=${v}`).join('; '),
  set: (value: string) => {
    const [name, val] = value.split('=')
    if (val) {
      cookieStore[name] = val.split(';')[0]
    }
  },
})

beforeEach(() => {
  cookieStore = {}
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Helper to create mock API responses
export function mockApiResponse<T>(data: T, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response)
}

// Helper to mock authenticated state
export function mockAuthenticatedUser() {
  cookieStore['csrf_token'] = 'test-csrf-token'
  return {
    id: 1,
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    role: 'org_admin',
    organization_id: 1,
    is_active: true,
  }
}
