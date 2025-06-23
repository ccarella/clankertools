import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useHaptic } from '@/providers/HapticProvider'

// Components will be imported when implemented
import { TransactionHistory } from '../TransactionHistory'
import { useFarcasterAuth as useFarcaster } from '@/components/providers/FarcasterAuthProvider'

// Mock next/link
jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@/components/providers/FarcasterAuthProvider')
jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: jest.fn(),
}))
// Mock will be uncommented when TransactionStatusCard is implemented
jest.mock('../TransactionStatusCard', () => ({
  TransactionStatusCard: ({ transaction }: { transaction: Transaction }) => (
    <div data-testid={`transaction-${transaction.id}`}>
      <span>{transaction.type}</span>
      <span>{transaction.status}</span>
      <span>{new Date(transaction.timestamp).toLocaleDateString()}</span>
    </div>
  )
}))

// Mock useFarcaster for testing
const mockUseFarcaster = useFarcaster as jest.MockedFunction<typeof useFarcaster>

// TransactionHistory component type definition for tests
type Transaction = {
  id: string
  hash: string
  type: 'token_deployment' | 'token_transfer' | 'add_liquidity' | 'wallet_connect'
  status: 'pending' | 'processing' | 'success' | 'failed'
  timestamp: string
  tokenName?: string
  tokenSymbol?: string
  tokenAddress?: string
  amount?: string
  toAddress?: string
  liquidityAmount?: string
  tokenAmount?: string
  walletAddress?: string
  gasUsed?: string
  networkFee?: string
  error?: string
}

// Note: Props interface would be defined here when component needs props

// Mock component for testing - now using real component

describe('TransactionHistory', () => {
  const mockUser = {
    fid: 12345,
    displayName: 'Test User',
    username: 'testuser',
    pfpUrl: 'https://example.com/avatar.jpg'
  }

  const mockTransactions = [
    {
      id: 'tx-1',
      hash: '0x123',
      type: 'token_deployment' as const,
      status: 'success' as const,
      timestamp: new Date('2024-01-15T10:30:00').toISOString(),
      tokenName: 'Token A',
      tokenSymbol: 'TKA',
      tokenAddress: '0xabc',
      gasUsed: '0.002',
      networkFee: '0.001'
    },
    {
      id: 'tx-2',
      hash: '0x456',
      type: 'token_transfer' as const,
      status: 'success' as const,
      timestamp: new Date('2024-01-14T15:45:00').toISOString(),
      tokenSymbol: 'TKB',
      amount: '100',
      toAddress: '0xdef'
    },
    {
      id: 'tx-3',
      hash: '0x789',
      type: 'add_liquidity' as const,
      status: 'failed' as const,
      timestamp: new Date('2024-01-13T09:20:00').toISOString(),
      liquidityAmount: '5',
      tokenAmount: '1000',
      error: 'Slippage too high'
    },
    {
      id: 'tx-4',
      hash: '0xabc',
      type: 'wallet_connect' as const,
      status: 'success' as const,
      timestamp: new Date('2024-01-10T14:00:00').toISOString(),
      walletAddress: '0x123456'
    }
  ]

  const mockHaptic = {
    trigger: jest.fn(),
    isSupported: true
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseFarcaster.mockReturnValue({
      user: mockUser,
      loading: false,
      signIn: jest.fn(),
      signOut: jest.fn()
    })
    ;(useHaptic as jest.Mock).mockReturnValue(mockHaptic)
  })

  describe('History Display', () => {
    it('renders transaction history with user info', () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      expect(screen.getByText('Transaction History')).toBeInTheDocument()
      expect(screen.getByText('Test User')).toBeInTheDocument()
      expect(screen.getByText('@testuser')).toBeInTheDocument()
    })

    it('groups transactions by date', () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      expect(screen.getByText('January 15, 2024')).toBeInTheDocument()
      expect(screen.getByText('January 14, 2024')).toBeInTheDocument()
      expect(screen.getByText('January 13, 2024')).toBeInTheDocument()
      expect(screen.getByText('January 10, 2024')).toBeInTheDocument()
    })

    it('shows transaction count summary', () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      expect(screen.getByText('4 total transactions')).toBeInTheDocument()
      expect(screen.getByText('3 successful')).toBeInTheDocument()
      expect(screen.getByText('1 failed')).toBeInTheDocument()
    })

    it('displays empty state when no transactions', () => {
      render(<TransactionHistory transactions={[]} />)
      
      expect(screen.getByText('No transactions yet')).toBeInTheDocument()
      expect(screen.getByText('Start by deploying your first token!')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /deploy token/i })).toBeInTheDocument()
    })

    it('shows loading state while fetching history', () => {
      render(<TransactionHistory transactions={[]} isLoading={true} />)
      
      expect(screen.getByTestId('history-skeleton')).toBeInTheDocument()
      expect(screen.getAllByTestId('transaction-skeleton')).toHaveLength(5)
    })
  })

  describe('Filtering and Search', () => {
    it('filters by transaction type', async () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      const typeFilter = screen.getByRole('combobox', { name: /filter by type/i })
      await userEvent.selectOptions(typeFilter, 'token_deployment')
      
      expect(screen.getByTestId('transaction-tx-1')).toBeInTheDocument()
      expect(screen.queryByTestId('transaction-tx-2')).not.toBeInTheDocument()
      expect(screen.queryByTestId('transaction-tx-3')).not.toBeInTheDocument()
      expect(screen.queryByTestId('transaction-tx-4')).not.toBeInTheDocument()
    })

    it('filters by status', async () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      const statusFilter = screen.getByRole('button', { name: /failed/i })
      await userEvent.click(statusFilter)
      
      expect(screen.getByTestId('transaction-tx-3')).toBeInTheDocument()
      expect(screen.queryByTestId('transaction-tx-1')).not.toBeInTheDocument()
    })

    it('filters by date range', async () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      const dateRangeButton = screen.getByRole('button', { name: /date range/i })
      await userEvent.click(dateRangeButton)
      
      const last7Days = screen.getByRole('menuitem', { name: /last 7 days/i })
      await userEvent.click(last7Days)
      
      // Only tx-1 and tx-2 should be visible (within 7 days of Jan 15)
      expect(screen.getByTestId('transaction-tx-1')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-tx-2')).toBeInTheDocument()
      expect(screen.queryByTestId('transaction-tx-3')).not.toBeInTheDocument()
      expect(screen.queryByTestId('transaction-tx-4')).not.toBeInTheDocument()
    })

    it('searches by transaction hash', async () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      const searchInput = screen.getByRole('textbox', { name: /search/i })
      await userEvent.type(searchInput, '0x123')
      
      expect(screen.getByTestId('transaction-tx-1')).toBeInTheDocument()
      expect(screen.queryByTestId('transaction-tx-2')).not.toBeInTheDocument()
    })

    it('searches by token name or symbol', async () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      const searchInput = screen.getByRole('textbox', { name: /search/i })
      await userEvent.type(searchInput, 'TKA')
      
      expect(screen.getByTestId('transaction-tx-1')).toBeInTheDocument()
      expect(screen.queryByTestId('transaction-tx-2')).not.toBeInTheDocument()
    })

    it('shows no results message when search returns empty', async () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      const searchInput = screen.getByRole('textbox', { name: /search/i })
      await userEvent.type(searchInput, 'nonexistent')
      
      expect(screen.getByText('No transactions found')).toBeInTheDocument()
      expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument()
    })
  })

  describe('Mobile Responsiveness', () => {
    it('shows compact date headers on mobile', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
      
      render(<TransactionHistory transactions={mockTransactions} />)
      
      expect(screen.getByText('Jan 15')).toBeInTheDocument()
      expect(screen.queryByText('January 15, 2024')).not.toBeInTheDocument()
    })

    it('shows full date headers on desktop', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 })
      
      render(<TransactionHistory transactions={mockTransactions} />)
      
      expect(screen.getByText('January 15, 2024')).toBeInTheDocument()
    })

    it('collapses filters into dropdown on mobile', async () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
      
      render(<TransactionHistory transactions={mockTransactions} />)
      
      // Filters should be in a dropdown
      const filterButton = screen.getByRole('button', { name: /filters/i })
      expect(filterButton).toBeInTheDocument()
      
      await userEvent.click(filterButton)
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('shows sticky header on mobile scroll', () => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 375 })
      
      render(<TransactionHistory transactions={mockTransactions} />)
      
      const header = screen.getByTestId('history-header')
      expect(header).toHaveClass('sticky', 'top-0')
    })
  })

  describe('Pagination', () => {
    it('paginates long transaction lists', () => {
      const manyTransactions = Array.from({ length: 50 }, (_, i) => ({
        id: `tx-${i}`,
        hash: `0x${i}`,
        type: 'token_transfer' as const,
        status: 'success' as const,
        timestamp: new Date(2024, 0, 15 - Math.floor(i / 10)).toISOString()
      }))
      
      render(<TransactionHistory transactions={manyTransactions} />)
      
      // Should show first page (20 items by default)
      expect(screen.getAllByTestId(/transaction-tx-/)).toHaveLength(20)
      expect(screen.getByRole('button', { name: /next page/i })).toBeEnabled()
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
    })

    it('navigates between pages', async () => {
      const manyTransactions = Array.from({ length: 50 }, (_, i) => ({
        id: `tx-${i}`,
        hash: `0x${i}`,
        type: 'token_transfer' as const,
        status: 'success' as const,
        timestamp: new Date().toISOString()
      }))
      
      render(<TransactionHistory transactions={manyTransactions} />)
      
      const nextButton = screen.getByRole('button', { name: /next page/i })
      await userEvent.click(nextButton)
      
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-tx-20')).toBeInTheDocument()
      expect(screen.queryByTestId('transaction-tx-0')).not.toBeInTheDocument()
    })

    it('allows changing items per page', async () => {
      const manyTransactions = Array.from({ length: 50 }, (_, i) => ({
        id: `tx-${i}`,
        hash: `0x${i}`,
        type: 'token_transfer' as const,
        status: 'success' as const,
        timestamp: new Date().toISOString()
      }))
      
      render(<TransactionHistory transactions={manyTransactions} />)
      
      const perPageSelect = screen.getByRole('combobox', { name: /items per page/i })
      await userEvent.selectOptions(perPageSelect, '50')
      
      expect(screen.getAllByTestId(/transaction-tx-/)).toHaveLength(50)
      expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
    })

    it('maintains pagination state when filtering', async () => {
      const manyTransactions = Array.from({ length: 30 }, (_, i) => ({
        id: `tx-${i}`,
        hash: `0x${i}`,
        type: i % 2 === 0 ? 'token_deployment' as const : 'token_transfer' as const,
        status: 'success' as const,
        timestamp: new Date().toISOString()
      }))
      
      render(<TransactionHistory transactions={manyTransactions} />)
      
      // Go to page 2
      await userEvent.click(screen.getByRole('button', { name: /next page/i }))
      
      // Apply filter
      const typeFilter = screen.getByRole('combobox', { name: /filter by type/i })
      await userEvent.selectOptions(typeFilter, 'token_deployment')
      
      // Should reset to page 1
      expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
      expect(screen.getAllByTestId(/transaction-tx-/)).toHaveLength(15)
    })
  })

  describe('Export and Analytics', () => {
    it('allows exporting transaction history', async () => {
      const onExport = jest.fn()
      render(
        <TransactionHistory 
          transactions={mockTransactions}
          onExport={onExport}
        />
      )
      
      const exportButton = screen.getByRole('button', { name: /export/i })
      await userEvent.click(exportButton)
      
      const csvOption = screen.getByRole('menuitem', { name: /csv/i })
      await userEvent.click(csvOption)
      
      expect(onExport).toHaveBeenCalledWith('csv', mockTransactions)
    })

    it('shows transaction analytics summary', () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      const analyticsButton = screen.getByRole('button', { name: /analytics/i })
      expect(analyticsButton).toBeInTheDocument()
    })

    it('displays analytics modal with charts', async () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      const analyticsButton = screen.getByRole('button', { name: /analytics/i })
      await userEvent.click(analyticsButton)
      
      expect(screen.getByRole('dialog', { name: /transaction analytics/i })).toBeInTheDocument()
      expect(screen.getByText('Transaction Volume')).toBeInTheDocument()
      expect(screen.getByText('Success Rate')).toBeInTheDocument()
      expect(screen.getByText('Gas Spent')).toBeInTheDocument()
    })

    it('calculates total gas spent', () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      expect(screen.getByText('Total Gas: 0.003 ETH')).toBeInTheDocument()
    })
  })

  describe('Transaction Details', () => {
    it('expands transaction for detailed view', async () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      const transaction = screen.getByTestId('transaction-tx-1')
      await userEvent.click(transaction)
      
      expect(screen.getByText('Transaction Details')).toBeInTheDocument()
      expect(screen.getByText('Gas Used: 0.002 ETH')).toBeInTheDocument()
      expect(screen.getByText('Network Fee: 0.001 ETH')).toBeInTheDocument()
      expect(screen.getByText('Token Address: 0xabc')).toBeInTheDocument()
    })

    it('allows viewing transaction on block explorer', async () => {
      const mockOpen = jest.fn()
      global.open = mockOpen
      
      render(<TransactionHistory transactions={mockTransactions} />)
      
      const transaction = screen.getByTestId('transaction-tx-1')
      await userEvent.click(transaction)
      
      const explorerLink = screen.getByRole('link', { name: /view on explorer/i })
      await userEvent.click(explorerLink)
      
      expect(mockOpen).toHaveBeenCalledWith(
        'https://basescan.org/tx/0x123',
        '_blank'
      )
    })

    it('shows receipt download option for successful transactions', async () => {
      const onDownloadReceipt = jest.fn()
      render(
        <TransactionHistory 
          transactions={mockTransactions}
          onDownloadReceipt={onDownloadReceipt}
        />
      )
      
      const transaction = screen.getByTestId('transaction-tx-1')
      await userEvent.click(transaction)
      
      const downloadButton = screen.getByRole('button', { name: /download receipt/i })
      await userEvent.click(downloadButton)
      
      expect(onDownloadReceipt).toHaveBeenCalledWith('tx-1')
    })
  })

  describe('Refresh and Real-time Updates', () => {
    it('allows manual refresh of history', async () => {
      const onRefresh = jest.fn()
      render(
        <TransactionHistory 
          transactions={mockTransactions}
          onRefresh={onRefresh}
        />
      )
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      await userEvent.click(refreshButton)
      
      expect(onRefresh).toHaveBeenCalled()
      expect(mockHaptic.trigger).toHaveBeenCalledWith('impact')
    })

    it('shows last updated timestamp', () => {
      const lastUpdated = new Date('2024-01-15T11:00:00')
      render(
        <TransactionHistory 
          transactions={mockTransactions}
          lastUpdated={lastUpdated}
        />
      )
      
      expect(screen.getByText('Last updated: 11:00 AM')).toBeInTheDocument()
    })

    it('auto-refreshes when enabled', async () => {
      const onRefresh = jest.fn()
      jest.useFakeTimers()
      
      render(
        <TransactionHistory 
          transactions={mockTransactions}
          onRefresh={onRefresh}
          autoRefresh={true}
          refreshInterval={30000} // 30 seconds
        />
      )
      
      expect(screen.getByText('Auto-refresh: ON')).toBeInTheDocument()
      
      jest.advanceTimersByTime(30000)
      
      await waitFor(() => {
        expect(onRefresh).toHaveBeenCalledTimes(1)
      })
      
      jest.useRealTimers()
    })
  })

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      const mainHeading = screen.getByRole('heading', { level: 1 })
      expect(mainHeading).toHaveTextContent('Transaction History')
      
      const dateHeadings = screen.getAllByRole('heading', { level: 2 })
      expect(dateHeadings[0]).toHaveTextContent('January 15, 2024')
    })

    it('announces filter changes to screen readers', async () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      const typeFilter = screen.getByRole('combobox', { name: /filter by type/i })
      await userEvent.selectOptions(typeFilter, 'token_deployment')
      
      expect(screen.getByRole('status')).toHaveTextContent('Showing 1 transaction')
    })

    it('provides keyboard navigation for transaction list', async () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      const firstTransaction = screen.getByTestId('transaction-tx-1')
      firstTransaction.focus()
      
      await userEvent.keyboard('{ArrowDown}')
      expect(screen.getByTestId('transaction-tx-2')).toHaveFocus()
      
      await userEvent.keyboard('{Enter}')
      expect(screen.getByText('Transaction Details')).toBeInTheDocument()
    })

    it('has skip navigation link', () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      const skipLink = screen.getByRole('link', { name: /skip to transactions/i })
      expect(skipLink).toHaveAttribute('href', '#transaction-list')
    })
  })

  describe('Error Handling', () => {
    it('shows error state when loading fails', () => {
      render(
        <TransactionHistory 
          transactions={[]}
          error="Failed to load transaction history"
        />
      )
      
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to load transaction history')
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })

    it('handles network errors gracefully', async () => {
      const onRefresh = jest.fn().mockRejectedValue(new Error('Network error'))
      
      render(
        <TransactionHistory 
          transactions={mockTransactions}
          onRefresh={onRefresh}
        />
      )
      
      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      await userEvent.click(refreshButton)
      
      await waitFor(() => {
        expect(screen.getByText('Failed to refresh')).toBeInTheDocument()
      })
    })
  })

  describe('Performance Optimization', () => {
    it('lazy loads transaction details', async () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      // Details should not be in DOM initially
      expect(screen.queryByText('Gas Used: 0.002 ETH')).not.toBeInTheDocument()
      
      // Click to expand
      const transaction = screen.getByTestId('transaction-tx-1')
      await userEvent.click(transaction)
      
      // Details should load
      await waitFor(() => {
        expect(screen.getByText('Gas Used: 0.002 ETH')).toBeInTheDocument()
      })
    })

    it('uses virtualization for very long lists', () => {
      const manyTransactions = Array.from({ length: 1000 }, (_, i) => ({
        id: `tx-${i}`,
        hash: `0x${i}`,
        type: 'token_transfer' as const,
        status: 'success' as const,
        timestamp: new Date().toISOString()
      }))
      
      render(
        <TransactionHistory 
          transactions={manyTransactions}
          enableVirtualization={true}
        />
      )
      
      const virtualList = screen.getByTestId('virtual-list')
      expect(virtualList).toBeInTheDocument()
      
      // Should only render visible items
      const renderedItems = screen.getAllByTestId(/transaction-tx-/)
      expect(renderedItems.length).toBeLessThan(50)
    })
  })
})