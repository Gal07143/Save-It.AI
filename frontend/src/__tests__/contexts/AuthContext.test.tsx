import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockApiResponse, mockAuthenticatedUser } from '../setup'

// Mock the api module
vi.mock('../../services/api', () => ({
  api: {
    auth: {
      login: vi.fn(),
      me: vi.fn(),
    },
  },
}))

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.cookie = 'csrf_token=test-csrf-token'
  })

  it('should provide auth state to children', async () => {
    const { api } = await import('../../services/api')
    const mockUser = mockAuthenticatedUser()

    vi.mocked(api.auth.me).mockResolvedValue(mockUser)

    const { AuthProvider, useAuth } = await import('../../contexts/AuthContext')

    function TestComponent() {
      const { user, isLoading } = useAuth()
      if (isLoading) return <div>Loading...</div>
      return <div>{user ? user.email : 'Not logged in'}</div>
    }

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Initially loading
    expect(screen.getByText('Loading...')).toBeInTheDocument()

    // Wait for auth check
    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })
  })

  it('should handle login', async () => {
    const { api } = await import('../../services/api')
    const mockUser = mockAuthenticatedUser()

    vi.mocked(api.auth.me).mockRejectedValueOnce(new Error('Not logged in'))
    vi.mocked(api.auth.login).mockResolvedValue({
      access_token: 'test-token',
      token_type: 'bearer',
      expires_in: 3600,
      user: mockUser,
    })

    const { AuthProvider, useAuth } = await import('../../contexts/AuthContext')

    function TestComponent() {
      const { user, login, isLoading } = useAuth()

      if (isLoading) return <div>Loading...</div>

      return (
        <div>
          <span>{user ? user.email : 'Not logged in'}</span>
          <button onClick={() => login('test@example.com', 'password')}>
            Login
          </button>
        </div>
      )
    }

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Not logged in')).toBeInTheDocument()
    })

    // Click login
    const loginButton = screen.getByRole('button', { name: /login/i })
    await act(async () => {
      await userEvent.click(loginButton)
    })

    await waitFor(() => {
      expect(api.auth.login).toHaveBeenCalledWith('test@example.com', 'password')
    })
  })

  it('should handle logout', async () => {
    const { api } = await import('../../services/api')
    const mockUser = mockAuthenticatedUser()

    vi.mocked(api.auth.me).mockResolvedValue(mockUser)

    const { AuthProvider, useAuth } = await import('../../contexts/AuthContext')

    function TestComponent() {
      const { user, logout, isLoading } = useAuth()

      if (isLoading) return <div>Loading...</div>

      return (
        <div>
          <span>{user ? user.email : 'Not logged in'}</span>
          <button onClick={logout}>Logout</button>
        </div>
      )
    }

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })

    // Click logout
    const logoutButton = screen.getByRole('button', { name: /logout/i })
    await act(async () => {
      await userEvent.click(logoutButton)
    })

    await waitFor(() => {
      expect(screen.getByText('Not logged in')).toBeInTheDocument()
    })
  })
})
