import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useHaptic } from '@/providers/HapticProvider'

import { TransactionQueue } from '../TransactionQueue'

console.log('TransactionQueue import:', TransactionQueue)

jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: jest.fn(),
}))

jest.mock('../TransactionStatusCard', () => ({
  TransactionStatusCard: ({ transaction, onCancel, onRetry }: {
    transaction: Transaction;
    onCancel?: (id: string) => void;
    onRetry?: (id: string) => void;
  }) => (
    <div data-testid={`transaction-${transaction.id}`}>
      <span>{transaction.type}</span>
      <span>{transaction.status}</span>
      {onCancel && (
        <button onClick={() => onCancel(transaction.id)}>Cancel</button>
      )}
      {onRetry && (
        <button onClick={() => onRetry(transaction.id)}>Retry</button>
      )}
    </div>
  )
}))


// TransactionQueue component type definition for tests
type Transaction = {
  id: string
  hash: string
  type: 'token_deployment' | 'token_transfer' | 'add_liquidity' | 'wallet_connect'
  status: 'pending' | 'processing' | 'success' | 'failed'
  timestamp: string
  tokenName?: string
  tokenSymbol?: string
  amount?: string
  toAddress?: string
  liquidityAmount?: string
  tokenAmount?: string
  walletAddress?: string
  error?: string
}

// Note: Props interface would be defined here when component needs additional props beyond what's imported


describe('TransactionQueue', () => {
  const mockTransactions = [
    {
      id: 'tx-1',
      hash: '0x123',
      type: 'token_deployment' as const,
      status: 'pending' as const,
      timestamp: new Date('2024-01-15T10:30:00').toISOString(),
      tokenName: 'Token A',
      tokenSymbol: 'TKA'
    },
    {
      id: 'tx-2',
      hash: '0x456',
      type: 'token_transfer' as const,
      status: 'processing' as const,
      timestamp: new Date('2024-01-15T10:31:00').toISOString(),
      tokenSymbol: 'TKB',
      amount: '100'
    },
    {
      id: 'tx-3',
      hash: '0x789',
      type: 'add_liquidity' as const,
      status: 'success' as const,
      timestamp: new Date('2024-01-15T10:32:00').toISOString(),
      liquidityAmount: '5',
      tokenAmount: '1000'
    },
    {
      id: 'tx-4',
      hash: '0xabc',
      type: 'wallet_connect' as const,
      status: 'failed' as const,
      timestamp: new Date('2024-01-15T10:33:00').toISOString(),
      error: 'Connection timeout'
    }
  ]

  const mockHaptic = {
    isEnabled: () => true,
    isSupported: () => true,
    enable: jest.fn(),
    disable: jest.fn(),
    toggle: jest.fn(),
    navigationTap: jest.fn(),
    menuItemSelect: jest.fn(),
    buttonPress: jest.fn(),
    toggleStateChange: jest.fn(),
    dropdownOpen: jest.fn(),
    dropdownItemHover: jest.fn(),
    cardSelect: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Mock window properties that might be used
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 768 })
    
    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: jest.fn().mockResolvedValue(undefined)
      },
      writable: true
    })
    
    // Mock window.open
    global.open = jest.fn()
    
    ;(useHaptic as jest.Mock).mockReturnValue(mockHaptic)
  })

  describe('Queue Display', () => {
    it('renders all transactions in the queue', () => {
      render(<TransactionQueue transactions={mockTransactions} />)
      
      expect(screen.getByTestId('transaction-tx-1')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-tx-2')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-tx-3')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-tx-4')).toBeInTheDocument()
    })

    it('displays transactions in chronological order by default', () => {
      render(<TransactionQueue transactions={mockTransactions} />)
      
      const transactionElements = screen.getAllByTestId(/transaction-tx-/)
      expect(transactionElements[0]).toHaveAttribute('data-testid', 'transaction-tx-1')
      expect(transactionElements[1]).toHaveAttribute('data-testid', 'transaction-tx-2')
      expect(transactionElements[2]).toHaveAttribute('data-testid', 'transaction-tx-3')
      expect(transactionElements[3]).toHaveAttribute('data-testid', 'transaction-tx-4')
    })

    it('shows empty state when no transactions', () => {
      render(<TransactionQueue transactions={[]} />)
      
      expect(screen.getByText('No transactions yet')).toBeInTheDocument()
      expect(screen.getByText('Your transaction history will appear here')).toBeInTheDocument()
    })

    it('displays queue header with transaction count', () => {
      render(<TransactionQueue transactions={mockTransactions} />)
      
      expect(screen.getByText('Transaction Queue')).toBeInTheDocument()
      expect(screen.getByText('4 transactions')).toBeInTheDocument()
    })

    it('shows active transaction count', () => {
      render(<TransactionQueue transactions={mockTransactions} />)
      
      // 2 active transactions (pending + processing)
      expect(screen.getByText('2 active')).toBeInTheDocument()
    })
  })

  describe('Filtering and Sorting', () => {
    it('filters by transaction status', async () => {
      render(<TransactionQueue transactions={mockTransactions} />)
      
      const filterButton = screen.getByRole('button', { name: /filter/i })
      await userEvent.click(filterButton)
      
      const pendingFilter = screen.getByRole('checkbox', { name: /pending/i })
      await userEvent.click(pendingFilter)
      
      expect(screen.getByTestId('transaction-tx-1')).toBeInTheDocument()
      expect(screen.queryByTestId('transaction-tx-2')).not.toBeInTheDocument()
      expect(screen.queryByTestId('transaction-tx-3')).not.toBeInTheDocument()
      expect(screen.queryByTestId('transaction-tx-4')).not.toBeInTheDocument()
    })

    it('filters by transaction type', async () => {
      render(<TransactionQueue transactions={mockTransactions} />)
      
      const filterButton = screen.getByRole('button', { name: /filter/i })
      await userEvent.click(filterButton)
      
      const typeSelect = screen.getByRole('combobox', { name: /type/i })
      await userEvent.selectOptions(typeSelect, 'token_deployment')
      
      expect(screen.getByTestId('transaction-tx-1')).toBeInTheDocument()
      expect(screen.queryByTestId('transaction-tx-2')).not.toBeInTheDocument()
    })

    it('sorts transactions by newest first', async () => {
      render(<TransactionQueue transactions={mockTransactions} />)
      
      const sortButton = screen.getByRole('button', { name: /sort/i })
      await userEvent.click(sortButton)
      
      const newestFirst = screen.getByRole('menuitem', { name: /newest first/i })
      await userEvent.click(newestFirst)
      
      const transactionElements = screen.getAllByTestId(/transaction-tx-/)
      expect(transactionElements[0]).toHaveAttribute('data-testid', 'transaction-tx-4')
      expect(transactionElements[3]).toHaveAttribute('data-testid', 'transaction-tx-1')
    })

    it('sorts by status with active first', async () => {
      render(<TransactionQueue transactions={mockTransactions} />)
      
      const sortButton = screen.getByRole('button', { name: /sort/i })
      await userEvent.click(sortButton)
      
      const statusSort = screen.getByRole('menuitem', { name: /status/i })
      await userEvent.click(statusSort)
      
      const transactionElements = screen.getAllByTestId(/transaction-tx-/)
      // Pending and processing should be first
      expect(transactionElements[0]).toHaveAttribute('data-testid', 'transaction-tx-1')
      expect(transactionElements[1]).toHaveAttribute('data-testid', 'transaction-tx-2')
    })

    it('clears all filters', async () => {
      render(<TransactionQueue transactions={mockTransactions} />)
      
      // Apply filter
      const filterButton = screen.getByRole('button', { name: /filter/i })
      await userEvent.click(filterButton)
      
      const pendingFilter = screen.getByRole('checkbox', { name: /pending/i })
      await userEvent.click(pendingFilter)
      
      // Clear filters
      const clearButton = screen.getByRole('button', { name: /clear.*filter/i })
      await userEvent.click(clearButton)
      
      // All transactions should be visible again
      expect(screen.getByTestId('transaction-tx-1')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-tx-2')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-tx-3')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-tx-4')).toBeInTheDocument()
    })
  })

  describe('Mobile Responsiveness', () => {
    it('shows compact view on mobile', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
      
      render(<TransactionQueue transactions={mockTransactions} />)
      
      expect(screen.getByTestId('queue-container')).toHaveClass('space-y-2')
      expect(screen.queryByText('Transaction Queue')).toBeInTheDocument()
    })

    it('shows expanded view on desktop', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
      
      render(<TransactionQueue transactions={mockTransactions} />)
      
      expect(screen.getByTestId('queue-container')).toHaveClass('space-y-4')
    })

    it('collapses filters into dropdown on mobile', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
      
      render(<TransactionQueue transactions={mockTransactions} />)
      
      // Filters should be in a dropdown
      expect(screen.getByRole('button', { name: /filter/i })).toBeInTheDocument()
      expect(screen.queryByRole('checkbox', { name: /pending/i })).not.toBeInTheDocument()
    })

    it('shows inline filters on desktop', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
      
      render(<TransactionQueue transactions={mockTransactions} />)
      
      // Filters should be visible inline
      expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /active/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /completed/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /failed/i })).toBeInTheDocument()
    })
  })

  describe('Bulk Actions', () => {
    it('allows selecting multiple transactions', async () => {
      render(<TransactionQueue transactions={mockTransactions} />)
      
      const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i })
      await userEvent.click(selectAllCheckbox)
      
      expect(screen.getByText('4 selected')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /bulk actions/i })).toBeEnabled()
    })

    it('enables bulk cancel for pending transactions', async () => {
      const onBulkCancel = jest.fn()
      render(
        <TransactionQueue 
          transactions={mockTransactions} 
          onBulkCancel={onBulkCancel}
        />
      )
      
      // Select pending transaction
      const tx1Checkbox = within(screen.getByTestId('transaction-tx-1'))
        .getByRole('checkbox')
      await userEvent.click(tx1Checkbox)
      
      const bulkActionsButton = screen.getByRole('button', { name: /bulk actions/i })
      await userEvent.click(bulkActionsButton)
      
      const cancelAllButton = screen.getByRole('menuitem', { name: /cancel selected/i })
      await userEvent.click(cancelAllButton)
      
      expect(onBulkCancel).toHaveBeenCalledWith(['tx-1'])
      expect(mockHaptic.trigger).toHaveBeenCalledWith('impact')
    })

    it('enables bulk retry for failed transactions', async () => {
      const onBulkRetry = jest.fn()
      render(
        <TransactionQueue 
          transactions={mockTransactions} 
          onBulkRetry={onBulkRetry}
        />
      )
      
      // Select failed transaction
      const tx4Checkbox = within(screen.getByTestId('transaction-tx-4'))
        .getByRole('checkbox')
      await userEvent.click(tx4Checkbox)
      
      const bulkActionsButton = screen.getByRole('button', { name: /bulk actions/i })
      await userEvent.click(bulkActionsButton)
      
      const retryAllButton = screen.getByRole('menuitem', { name: /retry selected/i })
      await userEvent.click(retryAllButton)
      
      expect(onBulkRetry).toHaveBeenCalledWith(['tx-4'])
    })

    it('disables inappropriate bulk actions', async () => {
      render(<TransactionQueue transactions={mockTransactions} />)
      
      // Select completed transaction
      const tx3Checkbox = within(screen.getByTestId('transaction-tx-3'))
        .getByRole('checkbox')
      await userEvent.click(tx3Checkbox)
      
      const bulkActionsButton = screen.getByRole('button', { name: /bulk actions/i })
      await userEvent.click(bulkActionsButton)
      
      const cancelMenuItem = screen.queryByRole('menuitem', { name: /cancel selected/i })
      const retryMenuItem = screen.queryByRole('menuitem', { name: /retry selected/i })
      
      expect(cancelMenuItem).toHaveAttribute('aria-disabled', 'true')
      expect(retryMenuItem).toHaveAttribute('aria-disabled', 'true')
    })
  })

  describe('Real-time Updates', () => {
    it('shows live update indicator for active transactions', () => {
      render(<TransactionQueue transactions={mockTransactions} />)
      
      expect(screen.getByTestId('live-indicator')).toBeInTheDocument()
      expect(screen.getByText('Live')).toBeInTheDocument()
    })

    it('updates transaction list when new transaction is added', () => {
      const { rerender } = render(
        <TransactionQueue transactions={mockTransactions} />
      )
      
      expect(screen.getAllByTestId(/transaction-tx-/)).toHaveLength(4)
      
      const newTransaction = {
        id: 'tx-5',
        hash: '0xdef',
        type: 'token_deployment' as const,
        status: 'pending' as const,
        timestamp: new Date().toISOString()
      }
      
      rerender(
        <TransactionQueue transactions={[...mockTransactions, newTransaction]} />
      )
      
      expect(screen.getAllByTestId(/transaction-tx-/)).toHaveLength(5)
      expect(screen.getByTestId('transaction-tx-5')).toBeInTheDocument()
    })

    it('removes transaction from queue when completed and auto-dismiss is enabled', async () => {
      const { rerender } = render(
        <TransactionQueue 
          transactions={mockTransactions} 
          autoDismissCompleted={true}
          dismissDelay={1000}
        />
      )
      
      // Update transaction to completed
      const updatedTransactions = mockTransactions.map(tx => 
        tx.id === 'tx-1' ? { ...tx, status: 'success' as const } : tx
      )
      
      rerender(
        <TransactionQueue 
          transactions={updatedTransactions} 
          autoDismissCompleted={true}
          dismissDelay={1000}
        />
      )
      
      // Transaction should still be visible initially
      expect(screen.getByTestId('transaction-tx-1')).toBeInTheDocument()
      
      // Wait for dismiss delay
      await waitFor(() => {
        expect(screen.queryByTestId('transaction-tx-1')).not.toBeInTheDocument()
      }, { timeout: 1500 })
    })

    it('shows notification for completed transactions', () => {
      const { rerender } = render(
        <TransactionQueue transactions={mockTransactions} />
      )
      
      const updatedTransactions = mockTransactions.map(tx => 
        tx.id === 'tx-2' ? { ...tx, status: 'success' as const } : tx
      )
      
      rerender(<TransactionQueue transactions={updatedTransactions} />)
      
      expect(screen.getByRole('alert')).toHaveTextContent('Transaction completed')
      expect(mockHaptic.trigger).toHaveBeenCalledWith('success')
    })
  })

  describe('Queue Management', () => {
    it('allows clearing completed transactions', async () => {
      const onClearCompleted = jest.fn()
      render(
        <TransactionQueue 
          transactions={mockTransactions} 
          onClearCompleted={onClearCompleted}
        />
      )
      
      const clearButton = screen.getByRole('button', { name: /clear completed/i })
      await userEvent.click(clearButton)
      
      expect(onClearCompleted).toHaveBeenCalled()
    })

    it('shows queue statistics', () => {
      render(<TransactionQueue transactions={mockTransactions} />)
      
      expect(screen.getByText('1 pending')).toBeInTheDocument()
      expect(screen.getByText('1 processing')).toBeInTheDocument()
      expect(screen.getByText('1 completed')).toBeInTheDocument()
      expect(screen.getByText('1 failed')).toBeInTheDocument()
    })

    it('allows pausing/resuming queue processing', async () => {
      const onPauseQueue = jest.fn()
      const onResumeQueue = jest.fn()
      
      render(
        <TransactionQueue 
          transactions={mockTransactions}
          onPauseQueue={onPauseQueue}
          onResumeQueue={onResumeQueue}
          isQueuePaused={false}
        />
      )
      
      const pauseButton = screen.getByRole('button', { name: /pause queue/i })
      await userEvent.click(pauseButton)
      
      expect(onPauseQueue).toHaveBeenCalled()
    })

    it('shows paused state indicator', () => {
      render(
        <TransactionQueue 
          transactions={mockTransactions}
          isQueuePaused={true}
        />
      )
      
      expect(screen.getByText('Queue Paused')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /resume queue/i })).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('announces queue updates to screen readers', () => {
      const { rerender } = render(
        <TransactionQueue transactions={mockTransactions} />
      )
      
      const newTransaction = {
        id: 'tx-5',
        hash: '0xdef',
        type: 'token_deployment' as const,
        status: 'pending' as const,
        timestamp: new Date().toISOString()
      }
      
      rerender(
        <TransactionQueue transactions={[...mockTransactions, newTransaction]} />
      )
      
      expect(screen.getByRole('status')).toHaveTextContent('New transaction added to queue')
    })

    it('provides keyboard navigation for queue items', async () => {
      render(<TransactionQueue transactions={mockTransactions} />)
      
      const firstTransaction = screen.getByTestId('transaction-tx-1')
      firstTransaction.focus()
      
      await userEvent.keyboard('{ArrowDown}')
      expect(screen.getByTestId('transaction-tx-2')).toHaveFocus()
      
      await userEvent.keyboard('{ArrowUp}')
      expect(screen.getByTestId('transaction-tx-1')).toHaveFocus()
    })

    it('has proper ARIA labels for queue sections', () => {
      render(<TransactionQueue transactions={mockTransactions} />)
      
      expect(screen.getByRole('region', { name: /transaction queue/i })).toBeInTheDocument()
      expect(screen.getByRole('group', { name: /active transactions/i })).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('virtualizes long transaction lists', () => {
      const manyTransactions = Array.from({ length: 100 }, (_, i) => ({
        id: `tx-${i}`,
        hash: `0x${i}`,
        type: 'token_transfer' as const,
        status: 'success' as const,
        timestamp: new Date().toISOString()
      }))
      
      render(<TransactionQueue transactions={manyTransactions} />)
      
      // Should only render visible items
      const renderedItems = screen.getAllByTestId(/transaction-tx-/)
      expect(renderedItems.length).toBeLessThan(100)
      expect(screen.getByTestId('virtual-scroller')).toBeInTheDocument()
    })

    it('debounces filter updates', async () => {
      const onFilterChange = jest.fn()
      render(
        <TransactionQueue 
          transactions={mockTransactions}
          onFilterChange={onFilterChange}
        />
      )
      
      const searchInput = screen.getByRole('textbox', { name: /search/i })
      
      // Type quickly
      await userEvent.type(searchInput, 'token')
      
      // Should only call once after debounce
      await waitFor(() => {
        expect(onFilterChange).toHaveBeenCalledTimes(1)
        expect(onFilterChange).toHaveBeenCalledWith({ search: 'token' })
      }, { timeout: 500 })
    })
  })
})