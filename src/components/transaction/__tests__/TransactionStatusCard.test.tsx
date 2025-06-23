import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useHaptic } from '@/providers/HapticProvider'

import { TransactionStatusCard } from '../TransactionStatusCard'

jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: jest.fn(),
}))

describe('TransactionStatusCard', () => {
  const mockTransaction = {
    id: 'tx-123',
    hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    type: 'token_deployment' as const,
    status: 'pending' as const,
    timestamp: new Date('2024-01-15T10:30:00').toISOString(),
    tokenAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
    tokenName: 'Test Token',
    tokenSymbol: 'TEST',
    amount: '1000000',
    gasEstimate: '0.002',
    networkFee: '0.001',
    error: null
  }

  const mockHaptic = {
    trigger: jest.fn(),
    isSupported: true
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useHaptic as jest.Mock).mockReturnValue(mockHaptic)
  })

  describe('Basic Rendering', () => {
    it('renders transaction details correctly', () => {
      render(<TransactionStatusCard transaction={mockTransaction} />)
      
      expect(screen.getByText('Token Deployment')).toBeInTheDocument()
      expect(screen.getByText('Test Token (TEST)')).toBeInTheDocument()
      expect(screen.getByText('0x1234...cdef')).toBeInTheDocument()
    })

    it('displays pending status with loading spinner', () => {
      render(<TransactionStatusCard transaction={mockTransaction} />)
      
      expect(screen.getByText('Pending')).toBeInTheDocument()
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.getByTestId('status-icon')).toHaveClass('text-yellow-500')
    })

    it('displays processing status with progress bar', () => {
      const processingTx = { ...mockTransaction, status: 'processing' as const }
      render(<TransactionStatusCard transaction={processingTx} />)
      
      expect(screen.getByText('Processing')).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
      expect(screen.getByTestId('status-icon')).toHaveClass('text-blue-500')
    })

    it('displays success status with checkmark', () => {
      const successTx = { ...mockTransaction, status: 'success' as const }
      render(<TransactionStatusCard transaction={successTx} />)
      
      expect(screen.getByText('Success')).toBeInTheDocument()
      expect(screen.getByTestId('success-icon')).toBeInTheDocument()
      expect(screen.getByTestId('status-icon')).toHaveClass('text-green-500')
    })

    it('displays failed status with error message', () => {
      const failedTx = { 
        ...mockTransaction, 
        status: 'failed' as const,
        error: 'Insufficient funds for gas'
      }
      render(<TransactionStatusCard transaction={failedTx} />)
      
      expect(screen.getByText('Failed')).toBeInTheDocument()
      expect(screen.getByText('Insufficient funds for gas')).toBeInTheDocument()
      expect(screen.getByTestId('error-icon')).toBeInTheDocument()
      expect(screen.getByTestId('status-icon')).toHaveClass('text-red-500')
    })
  })

  describe('Transaction Types', () => {
    it('renders token deployment type correctly', () => {
      render(<TransactionStatusCard transaction={mockTransaction} />)
      expect(screen.getByText('Token Deployment')).toBeInTheDocument()
    })

    it('renders token transfer type correctly', () => {
      const transferTx = { 
        ...mockTransaction, 
        type: 'token_transfer' as const,
        toAddress: '0x9876543210fedcba9876543210fedcba98765432',
        amount: '100'
      }
      render(<TransactionStatusCard transaction={transferTx} />)
      
      expect(screen.getByText('Token Transfer')).toBeInTheDocument()
      expect(screen.getByText('100 TEST')).toBeInTheDocument()
      expect(screen.getByText('To: 0x9876...5432')).toBeInTheDocument()
    })

    it('renders liquidity addition type correctly', () => {
      const liquidityTx = { 
        ...mockTransaction, 
        type: 'add_liquidity' as const,
        liquidityAmount: '5',
        tokenAmount: '10000'
      }
      render(<TransactionStatusCard transaction={liquidityTx} />)
      
      expect(screen.getByText('Add Liquidity')).toBeInTheDocument()
      expect(screen.getByText('5 ETH + 10000 TEST')).toBeInTheDocument()
    })

    it('renders wallet connection type correctly', () => {
      const walletTx = { 
        ...mockTransaction, 
        type: 'wallet_connect' as const,
        walletAddress: '0xfedcba9876543210fedcba9876543210fedcba98'
      }
      render(<TransactionStatusCard transaction={walletTx} />)
      
      expect(screen.getByText('Wallet Connection')).toBeInTheDocument()
      expect(screen.getByText('0xfedc...ba98')).toBeInTheDocument()
    })
  })

  describe('Mobile Responsiveness', () => {
    it('renders compact view on mobile screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
      
      render(<TransactionStatusCard transaction={mockTransaction} />)
      
      expect(screen.getByTestId('transaction-card')).toHaveClass('p-3')
      expect(screen.getByTestId('transaction-details')).toHaveClass('text-sm')
    })

    it('renders full view on desktop screens', () => {
      // Mock desktop viewport
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
      
      render(<TransactionStatusCard transaction={mockTransaction} />)
      
      expect(screen.getByTestId('transaction-card')).toHaveClass('p-4')
      expect(screen.getByTestId('transaction-details')).toHaveClass('text-base')
    })

    it('has proper touch targets on mobile', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
      
      render(<TransactionStatusCard transaction={mockTransaction} />)
      
      const actionButtons = screen.getAllByRole('button')
      actionButtons.forEach(button => {
        const styles = window.getComputedStyle(button)
        const height = parseInt(styles.height)
        expect(height).toBeGreaterThanOrEqual(44) // Minimum touch target size
      })
    })
  })

  describe('User Interactions', () => {
    it('allows cancellation of pending transactions', async () => {
      const onCancel = jest.fn()
      render(
        <TransactionStatusCard 
          transaction={mockTransaction} 
          onCancel={onCancel}
        />
      )
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      expect(cancelButton).toBeEnabled()
      
      await userEvent.click(cancelButton)
      
      expect(onCancel).toHaveBeenCalledWith('tx-123')
      expect(mockHaptic.trigger).toHaveBeenCalledWith('impact')
    })

    it('disables cancel button for non-pending transactions', () => {
      const onCancel = jest.fn()
      const successTx = { ...mockTransaction, status: 'success' as const }
      
      render(
        <TransactionStatusCard 
          transaction={successTx} 
          onCancel={onCancel}
        />
      )
      
      expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument()
    })

    it('allows retry for failed transactions', async () => {
      const onRetry = jest.fn()
      const failedTx = { 
        ...mockTransaction, 
        status: 'failed' as const,
        error: 'Network error'
      }
      
      render(
        <TransactionStatusCard 
          transaction={failedTx} 
          onRetry={onRetry}
        />
      )
      
      const retryButton = screen.getByRole('button', { name: /retry/i })
      await userEvent.click(retryButton)
      
      expect(onRetry).toHaveBeenCalledWith('tx-123')
      expect(mockHaptic.trigger).toHaveBeenCalledWith('impact')
    })

    it('copies transaction hash to clipboard', async () => {
      const mockWriteText = jest.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true
      })
      
      render(<TransactionStatusCard transaction={mockTransaction} />)
      
      const copyButton = screen.getByRole('button', { name: /copy/i })
      await userEvent.click(copyButton)
      
      expect(mockWriteText).toHaveBeenCalledWith(mockTransaction.hash)
      expect(screen.getByText('Copied!')).toBeInTheDocument()
      
      await waitFor(() => {
        expect(screen.queryByText('Copied!')).not.toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('opens transaction in explorer', async () => {
      const mockOpen = jest.fn()
      global.open = mockOpen
      
      render(<TransactionStatusCard transaction={mockTransaction} />)
      
      const explorerButton = screen.getByRole('button', { name: /view.*explorer/i })
      await userEvent.click(explorerButton)
      
      expect(mockOpen).toHaveBeenCalledWith(
        `https://basescan.org/tx/${mockTransaction.hash}`,
        '_blank'
      )
    })
  })

  describe('Real-time Updates', () => {
    it('shows animated progress for processing transactions', () => {
      const processingTx = { 
        ...mockTransaction, 
        status: 'processing' as const,
        progress: 45
      }
      
      render(<TransactionStatusCard transaction={processingTx} />)
      
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '45')
      expect(screen.getByText('45%')).toBeInTheDocument()
    })

    it('updates status when transaction prop changes', () => {
      const { rerender } = render(
        <TransactionStatusCard transaction={mockTransaction} />
      )
      
      expect(screen.getByText('Pending')).toBeInTheDocument()
      
      const updatedTx = { ...mockTransaction, status: 'success' as const }
      rerender(<TransactionStatusCard transaction={updatedTx} />)
      
      expect(screen.getByText('Success')).toBeInTheDocument()
      expect(screen.getByTestId('success-icon')).toBeInTheDocument()
    })

    it('triggers haptic feedback on status change', () => {
      const { rerender } = render(
        <TransactionStatusCard transaction={mockTransaction} />
      )
      
      const successTx = { ...mockTransaction, status: 'success' as const }
      rerender(<TransactionStatusCard transaction={successTx} />)
      
      expect(mockHaptic.trigger).toHaveBeenCalledWith('success')
    })
  })

  describe('Loading and Error States', () => {
    it('shows estimated time for pending transactions', () => {
      const pendingTx = {
        ...mockTransaction,
        estimatedTime: 30 // seconds
      }
      
      render(<TransactionStatusCard transaction={pendingTx} />)
      
      expect(screen.getByText('Est. 30s remaining')).toBeInTheDocument()
    })

    it('shows gas estimate and network fee', () => {
      render(<TransactionStatusCard transaction={mockTransaction} />)
      
      expect(screen.getByText('Gas: 0.002 ETH')).toBeInTheDocument()
      expect(screen.getByText('Network Fee: 0.001 ETH')).toBeInTheDocument()
    })

    it('handles missing optional fields gracefully', () => {
      const minimalTx = {
        id: 'tx-456',
        hash: '0xabcd',
        type: 'token_deployment' as const,
        status: 'pending' as const,
        timestamp: new Date().toISOString()
      }
      
      render(<TransactionStatusCard transaction={minimalTx} />)
      
      expect(screen.getByText('Token Deployment')).toBeInTheDocument()
      expect(screen.queryByText('Gas:')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for status', () => {
      render(<TransactionStatusCard transaction={mockTransaction} />)
      
      expect(screen.getByRole('article')).toHaveAttribute(
        'aria-label',
        'Token Deployment transaction pending'
      )
    })

    it('announces status changes to screen readers', () => {
      const { rerender } = render(
        <TransactionStatusCard transaction={mockTransaction} />
      )
      
      const successTx = { ...mockTransaction, status: 'success' as const }
      rerender(<TransactionStatusCard transaction={successTx} />)
      
      expect(screen.getByRole('status')).toHaveTextContent('Transaction completed successfully')
    })

    it('has keyboard accessible actions', async () => {
      const onCancel = jest.fn()
      render(
        <TransactionStatusCard 
          transaction={mockTransaction} 
          onCancel={onCancel}
        />
      )
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      cancelButton.focus()
      
      await userEvent.keyboard('{Enter}')
      expect(onCancel).toHaveBeenCalled()
    })

    it('provides descriptive error messages for screen readers', () => {
      const failedTx = {
        ...mockTransaction,
        status: 'failed' as const,
        error: 'Insufficient balance'
      }
      
      render(<TransactionStatusCard transaction={failedTx} />)
      
      const errorRegion = screen.getByRole('alert')
      expect(errorRegion).toHaveTextContent('Insufficient balance')
    })
  })

  describe('Timestamp Display', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date('2024-01-15T10:35:00'))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('shows relative time for recent transactions', () => {
      render(<TransactionStatusCard transaction={mockTransaction} />)
      
      expect(screen.getByText('5 minutes ago')).toBeInTheDocument()
    })

    it('shows absolute time for older transactions', () => {
      jest.setSystemTime(new Date('2024-01-16T10:35:00'))
      
      render(<TransactionStatusCard transaction={mockTransaction} />)
      
      expect(screen.getByText('Jan 15, 10:30 AM')).toBeInTheDocument()
    })
  })
})