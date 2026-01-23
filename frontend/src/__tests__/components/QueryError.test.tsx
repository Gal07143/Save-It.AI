import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import QueryError from '../../components/QueryError'

describe('QueryError', () => {
  it('renders default error message', () => {
    render(<QueryError />)

    expect(screen.getByText('Error Loading Data')).toBeInTheDocument()
    expect(screen.getByText('Failed to load data')).toBeInTheDocument()
  })

  it('renders custom error message', () => {
    render(<QueryError message="Custom error message" />)

    expect(screen.getByText('Custom error message')).toBeInTheDocument()
  })

  it('shows retry button when onRetry is provided', () => {
    const onRetry = vi.fn()
    render(<QueryError onRetry={onRetry} />)

    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('hides retry button when onRetry is not provided', () => {
    render(<QueryError />)

    expect(screen.queryByText('Retry')).not.toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn()
    render(<QueryError onRetry={onRetry} />)

    fireEvent.click(screen.getByText('Retry'))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
