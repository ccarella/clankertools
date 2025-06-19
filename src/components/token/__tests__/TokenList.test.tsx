import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { TokenList } from '../TokenList'
import { UserToken } from '@/lib/redis'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

const mockTokens: UserToken[] = [
  {
    address: '0x1234567890123456789012345678901234567890',
    name: 'Test Token',
    symbol: 'TEST',
    createdAt: new Date().toISOString(),
    marketCap: '1000000',
    price: '0.001',
    volume24h: '50000',
    holders: 100,
    feesEarned: '0.5'
  },
  {
    address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    name: 'Another Token',
    symbol: 'ANOTHER',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    marketCap: '500000',
    price: '0.0005',
    volume24h: '25000',
    holders: 50,
    feesEarned: '0.25'
  }
]

describe('TokenList', () => {
  const mockOnRefresh = jest.fn()
  const mockOnLoadMore = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockClear()
  })

  it('should render tokens correctly', () => {
    render(
      <TokenList
        tokens={mockTokens}
        loading={false}
        onRefresh={mockOnRefresh}
      />
    )

    expect(screen.getByText('Test Token')).toBeInTheDocument()
    expect(screen.getByText('TEST')).toBeInTheDocument()
    expect(screen.getByText('Another Token')).toBeInTheDocument()
    expect(screen.getByText('ANOTHER')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    render(
      <TokenList
        tokens={[]}
        loading={true}
        onRefresh={mockOnRefresh}
      />
    )

    const skeletons = screen.getAllByTestId('token-skeleton')
    expect(skeletons).toHaveLength(3)
  })

  it('should show empty state when no tokens', () => {
    render(
      <TokenList
        tokens={[]}
        loading={false}
        onRefresh={mockOnRefresh}
      />
    )

    expect(screen.getByText('No tokens created yet')).toBeInTheDocument()
    expect(screen.getByText('Create your first token to see it here')).toBeInTheDocument()
  })

  it('should handle pull to refresh', async () => {
    render(
      <TokenList
        tokens={mockTokens}
        loading={false}
        onRefresh={mockOnRefresh}
        refreshing={false}
      />
    )

    const listContainer = screen.getByTestId('token-list-container')
    
    fireEvent.touchStart(listContainer, {
      touches: [{ clientY: 100, identifier: 0 }]
    })
    
    fireEvent.touchMove(listContainer, {
      touches: [{ clientY: 200, identifier: 0 }]
    })
    
    fireEvent.touchEnd(listContainer)

    await waitFor(() => {
      expect(mockOnRefresh).toHaveBeenCalled()
    })
  })

  it('should show refreshing indicator', () => {
    render(
      <TokenList
        tokens={mockTokens}
        loading={false}
        onRefresh={mockOnRefresh}
        refreshing={true}
      />
    )

    expect(screen.getByTestId('refresh-indicator')).toBeInTheDocument()
  })

  it('should handle infinite scroll', () => {
    render(
      <TokenList
        tokens={mockTokens}
        loading={false}
        onRefresh={mockOnRefresh}
        onLoadMore={mockOnLoadMore}
        hasMore={true}
      />
    )

    const listContainer = screen.getByTestId('token-list-container')
    
    // Manually set scroll properties and trigger scroll event
    Object.defineProperty(listContainer, 'scrollTop', { value: 1000, writable: true })
    Object.defineProperty(listContainer, 'scrollHeight', { value: 1200, writable: true })
    Object.defineProperty(listContainer, 'clientHeight', { value: 600, writable: true })
    
    fireEvent.scroll(listContainer)

    expect(mockOnLoadMore).toHaveBeenCalled()
  })

  it('should show load more button when hasMore is true', () => {
    render(
      <TokenList
        tokens={mockTokens}
        loading={false}
        onRefresh={mockOnRefresh}
        hasMore={true}
        onLoadMore={mockOnLoadMore}
      />
    )

    const loadMoreButton = screen.getByText('Load More')
    expect(loadMoreButton).toBeInTheDocument()
    
    fireEvent.click(loadMoreButton)
    expect(mockOnLoadMore).toHaveBeenCalled()
  })

  it('should not show load more button when hasMore is false', () => {
    render(
      <TokenList
        tokens={mockTokens}
        loading={false}
        onRefresh={mockOnRefresh}
        hasMore={false}
      />
    )

    expect(screen.queryByText('Load More')).not.toBeInTheDocument()
  })

  it('should navigate to token detail on click', () => {
    render(
      <TokenList
        tokens={mockTokens}
        loading={false}
        onRefresh={mockOnRefresh}
      />
    )

    const firstToken = screen.getByText('Test Token').closest('div[role="button"]')
    fireEvent.click(firstToken!)

    expect(mockPush).toHaveBeenCalledWith('/token/0x1234567890123456789012345678901234567890')
  })

  it('should show error state', () => {
    render(
      <TokenList
        tokens={[]}
        loading={false}
        onRefresh={mockOnRefresh}
        error="Failed to load tokens"
      />
    )

    expect(screen.getByText('Failed to load tokens')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('should retry on error', () => {
    render(
      <TokenList
        tokens={[]}
        loading={false}
        onRefresh={mockOnRefresh}
        error="Failed to load tokens"
      />
    )

    const retryButton = screen.getByText('Try Again')
    fireEvent.click(retryButton)
    
    expect(mockOnRefresh).toHaveBeenCalled()
  })
})