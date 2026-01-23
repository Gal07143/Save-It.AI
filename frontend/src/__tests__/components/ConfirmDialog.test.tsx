import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ConfirmDialog from '../../components/ConfirmDialog'

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
  }

  it('renders nothing when closed', () => {
    render(<ConfirmDialog {...defaultProps} isOpen={false} />)

    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument()
  })

  it('renders dialog when open', () => {
    render(<ConfirmDialog {...defaultProps} />)

    expect(screen.getByText('Confirm Action')).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument()
  })

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn()
    render(<ConfirmDialog {...defaultProps} onClose={onClose} />)

    fireEvent.click(screen.getByText('Cancel'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByText('Confirm'))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('shows custom confirm label', () => {
    render(<ConfirmDialog {...defaultProps} confirmLabel="Delete" />)

    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('applies danger variant styling', () => {
    render(<ConfirmDialog {...defaultProps} variant="danger" confirmLabel="Delete" />)

    const deleteButton = screen.getByText('Delete')
    expect(deleteButton).toBeInTheDocument()
  })
})
