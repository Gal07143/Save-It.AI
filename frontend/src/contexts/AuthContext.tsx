import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
  id: number
  email: string
  first_name?: string
  last_name?: string
  role: string
  organization_id: number
  organization_name?: string
  is_active: boolean
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, firstName?: string, lastName?: string, organizationName?: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_BASE = '/api/v1'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        credentials: 'include',  // Include cookies
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Failed to check auth status:', error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'include',  // Include cookies for setting HttpOnly cookie
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Login failed')
    }

    const data = await response.json()

    // Set user from the response
    if (data.user) {
      setUser(data.user)
    } else {
      // Fallback: fetch current user
      await checkAuthStatus()
    }
  }

  const register = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    organizationName?: string
  ) => {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      credentials: 'include',  // Include cookies for setting HttpOnly cookie
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        organization_name: organizationName
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Registration failed')
    }

    const data = await response.json()

    // Set user from the response
    if (data.user) {
      setUser(data.user)
    } else {
      // Fallback: fetch current user
      await checkAuthStatus()
    }
  }

  const logout = async () => {
    try {
      // Call logout endpoint to clear HttpOnly cookie
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Logout request failed:', error)
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
