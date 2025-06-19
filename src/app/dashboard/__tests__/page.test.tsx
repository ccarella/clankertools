import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import Dashboard from '../page'
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider'
import { useUserTokens } from '@/hooks/useUserTokens'
import { useRouter } from 'next/navigation'

jest.mock('@/components/providers/FarcasterAuthProvider', () => ({
  useFarcasterAuth: jest.fn()
}))
jest.mock('@/hooks/useUserTokens')
jest.mock('next/navigation', () => ({
  useRouter: jest.fn()
}))

const mockUseFarcasterAuth = useFarcasterAuth as jest.MockedFunction<typeof useFarcasterAuth>
const mockUseUserTokens = useUserTokens as jest.MockedFunction<typeof useUserTokens>
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>

const mockTokens = [
  {
    address: '0x1234567890123456789012345678901234567890',
    name: 'Test Token',
    symbol: 'TEST',
    createdAt: '2025-01-01T00:00:00.000Z',
    marketCap: '1000000',
    price: '0.001',
    volume24h: '50000',
    holders: 100,
    feesEarned: '0.5'
  }
]

describe('Dashboard', () => {
  const mockPush = jest.fn()
  
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue({ push: mockPush } as unknown as ReturnType<typeof useRouter>)
  })

  it('should redirect to home when not authenticated', () => {
    mockUseFarcasterAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      castContext: null,
      isLoading: false,
      error: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      clearError: jest.fn(),
      getQuickAuthToken: jest.fn()
    })

    mockUseUserTokens.mockReturnValue({
      tokens: [],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
      refreshing: false
    })

    render(<Dashboard />)

    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('should show loading state while fetching tokens', () => {
    mockUseFarcasterAuth.mockReturnValue({
      isAuthenticated: true,
      user: { fid: 123456, username: 'testuser', displayName: 'Test User' },
      castContext: null,
      isLoading: false,
      error: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      clearError: jest.fn(),
      getQuickAuthToken: jest.fn()
    })

    mockUseUserTokens.mockReturnValue({
      tokens: [],
      loading: true,
      error: null,
      hasMore: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
      refreshing: false
    })

    render(<Dashboard />)

    expect(screen.getByText('My Tokens')).toBeInTheDocument()
    expect(screen.getAllByTestId('token-skeleton')).toHaveLength(3)
  })

  it('should display user tokens when loaded', () => {
    mockUseFarcasterAuth.mockReturnValue({
      isAuthenticated: true,
      user: { fid: 123456, username: 'testuser', displayName: 'Test User' },
      castContext: null,
      isLoading: false,
      error: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      clearError: jest.fn(),
      getQuickAuthToken: jest.fn()
    })

    mockUseUserTokens.mockReturnValue({
      tokens: mockTokens,
      loading: false,
      error: null,
      hasMore: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
      refreshing: false
    })

    render(<Dashboard />)

    expect(screen.getByText('My Tokens')).toBeInTheDocument()
    expect(screen.getByText('Test Token')).toBeInTheDocument()
    expect(screen.getByText('TEST')).toBeInTheDocument()
  })

  it('should show empty state when user has no tokens', () => {
    mockUseFarcasterAuth.mockReturnValue({
      isAuthenticated: true,
      user: { fid: 123456, username: 'testuser', displayName: 'Test User' },
      castContext: null,
      isLoading: false,
      error: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      clearError: jest.fn(),
      getQuickAuthToken: jest.fn()
    })

    mockUseUserTokens.mockReturnValue({
      tokens: [],
      loading: false,
      error: null,
      hasMore: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
      refreshing: false
    })

    render(<Dashboard />)

    expect(screen.getByText('No tokens created yet')).toBeInTheDocument()
    expect(screen.getByText('Create your first token to see it here')).toBeInTheDocument()
  })

  it('should show error state when fetching fails', () => {
    mockUseFarcasterAuth.mockReturnValue({
      isAuthenticated: true,
      user: { fid: 123456, username: 'testuser', displayName: 'Test User' },
      castContext: null,
      isLoading: false,
      error: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      clearError: jest.fn(),
      getQuickAuthToken: jest.fn()
    })

    const mockRefresh = jest.fn()
    mockUseUserTokens.mockReturnValue({
      tokens: [],
      loading: false,
      error: 'Failed to fetch tokens',
      hasMore: false,
      loadMore: jest.fn(),
      refresh: mockRefresh,
      refreshing: false
    })

    render(<Dashboard />)

    expect(screen.getByText('Failed to fetch tokens')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })


  it('should display user profile information', () => {
    mockUseFarcasterAuth.mockReturnValue({
      isAuthenticated: true,
      user: { 
        fid: 123456, 
        username: 'testuser', 
        displayName: 'Test User',
        pfpUrl: 'https://example.com/avatar.png'
      },
      castContext: null,
      isLoading: false,
      error: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      clearError: jest.fn(),
      getQuickAuthToken: jest.fn()
    })

    mockUseUserTokens.mockReturnValue({
      tokens: mockTokens,
      loading: false,
      error: null,
      hasMore: false,
      loadMore: jest.fn(),
      refresh: jest.fn(),
      refreshing: false
    })

    render(<Dashboard />)

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('@testuser')).toBeInTheDocument()
    expect(screen.getByText('1 token created')).toBeInTheDocument()
  })

  it('should enable polling for real-time updates', () => {
    mockUseFarcasterAuth.mockReturnValue({
      isAuthenticated: true,
      user: { fid: 123456, username: 'testuser', displayName: 'Test User' },
      castContext: null,
      isLoading: false,
      error: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      clearError: jest.fn(),
      getQuickAuthToken: jest.fn()
    })

    render(<Dashboard />)

    expect(mockUseUserTokens).toHaveBeenCalledWith('123456', {
      pollInterval: 30000
    })
  })
})