import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider'
import { useNeynarUser } from '@/hooks/useNeynar'
import ProfilePage from '../page'
import { createMockNeynarUser } from '@/test-utils/mockNeynarUser'

jest.mock('@/components/providers/FarcasterAuthProvider')
jest.mock('@/hooks/useNeynar')
jest.mock('@/components/profile', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ProfileBadge: ({ user, variant }: { user: any; variant: any }) => (
    <div data-testid="profile-badge" data-variant={variant}>
      {user?.displayName}
    </div>
  )
}))

const mockUseFarcasterAuth = useFarcasterAuth as jest.MockedFunction<typeof useFarcasterAuth>
const mockUseNeynarUser = useNeynarUser as jest.MockedFunction<typeof useNeynarUser>

const mockFarcasterUser = {
  fid: 12345,
  username: 'testuser',
  displayName: 'Test User',
  pfpUrl: 'https://example.com/avatar.jpg'
}

const mockNeynarUser = createMockNeynarUser({
  profile: {
    bio: {
      text: 'Test bio text'
    }
  }
})

describe('Enhanced ProfilePage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('displays ProfileBadge with extended user data when authenticated', async () => {
    mockUseFarcasterAuth.mockReturnValue({
      user: mockFarcasterUser,
      isAuthenticated: true,
      isLoading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
      getQuickAuthToken: jest.fn(),
      error: null,
      clearError: jest.fn(),
      castContext: null
    })

    mockUseNeynarUser.mockReturnValue({
      user: mockNeynarUser,
      addresses: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn()
    })

    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByTestId('profile-badge')).toBeInTheDocument()
    })
  })

  it('displays loading state while fetching extended profile', () => {
    mockUseFarcasterAuth.mockReturnValue({
      user: mockFarcasterUser,
      isAuthenticated: true,
      isLoading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
      getQuickAuthToken: jest.fn(),
      error: null,
      clearError: jest.fn(),
      castContext: null
    })

    mockUseNeynarUser.mockReturnValue({
      user: undefined,
      addresses: undefined,
      loading: true,
      error: undefined,
      refetch: jest.fn()
    })

    render(<ProfilePage />)

    expect(screen.getByTestId('profile-badge-skeleton')).toBeInTheDocument()
  })

  it('displays bio text when available', async () => {
    mockUseFarcasterAuth.mockReturnValue({
      user: mockFarcasterUser,
      isAuthenticated: true,
      isLoading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
      getQuickAuthToken: jest.fn(),
      error: null,
      clearError: jest.fn(),
      castContext: null
    })

    mockUseNeynarUser.mockReturnValue({
      user: mockNeynarUser,
      addresses: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn()
    })

    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Bio')).toBeInTheDocument()
      expect(screen.getByText('Test bio text')).toBeInTheDocument()
    })
  })

  it('displays follower and following counts', async () => {
    mockUseFarcasterAuth.mockReturnValue({
      user: mockFarcasterUser,
      isAuthenticated: true,
      isLoading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
      getQuickAuthToken: jest.fn(),
      error: null,
      clearError: jest.fn(),
      castContext: null
    })

    mockUseNeynarUser.mockReturnValue({
      user: mockNeynarUser,
      addresses: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn()
    })

    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('5000')).toBeInTheDocument()
      expect(screen.getByText('followers')).toBeInTheDocument()
      expect(screen.getByText('250')).toBeInTheDocument()
      expect(screen.getByText('following')).toBeInTheDocument()
    })
  })

  it('displays verified addresses section when available', async () => {
    mockUseFarcasterAuth.mockReturnValue({
      user: mockFarcasterUser,
      isAuthenticated: true,
      isLoading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
      getQuickAuthToken: jest.fn(),
      error: null,
      clearError: jest.fn(),
      castContext: null
    })

    mockUseNeynarUser.mockReturnValue({
      user: mockNeynarUser,
      addresses: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn()
    })

    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Verified Addresses')).toBeInTheDocument()
      expect(screen.getByText('0x123...')).toBeInTheDocument()
    })
  })

  it('handles error state when Neynar API fails', () => {
    mockUseFarcasterAuth.mockReturnValue({
      user: mockFarcasterUser,
      isAuthenticated: true,
      isLoading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
      getQuickAuthToken: jest.fn(),
      error: null,
      clearError: jest.fn(),
      castContext: null
    })

    mockUseNeynarUser.mockReturnValue({
      user: undefined,
      addresses: undefined,
      loading: false,
      error: 'Failed to fetch extended profile',
      refetch: jest.fn()
    })

    render(<ProfilePage />)

    expect(screen.getByText('Failed to load extended profile')).toBeInTheDocument()
  })

  it('falls back to basic profile when Neynar data unavailable', () => {
    mockUseFarcasterAuth.mockReturnValue({
      user: mockFarcasterUser,
      isAuthenticated: true,
      isLoading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
      getQuickAuthToken: jest.fn(),
      error: null,
      clearError: jest.fn(),
      castContext: null
    })

    mockUseNeynarUser.mockReturnValue({
      user: undefined,
      addresses: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn()
    })

    render(<ProfilePage />)

    expect(screen.getByText('FID')).toBeInTheDocument()
    expect(screen.getByText('12345')).toBeInTheDocument()
  })

  it('shows sign in prompt when not authenticated', () => {
    mockUseFarcasterAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
      getQuickAuthToken: jest.fn(),
      error: null,
      clearError: jest.fn(),
      castContext: null
    })

    render(<ProfilePage />)

    expect(screen.getByText('Sign in to view your profile')).toBeInTheDocument()
  })
})