import React from 'react'
import { render, screen } from '@testing-library/react'
import { TokenCard } from '../TokenCard'
import { useNeynarUser } from '@/hooks/useNeynar'
import type { NeynarUser } from '@/services/neynar'

jest.mock('@/hooks/useNeynar')
jest.mock('@/components/profile', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ProfileBadge: ({ user, variant }: { user: any; variant: any }) => (
    <div data-testid="profile-badge" data-variant={variant}>
      {user?.displayName}
    </div>
  )
}))

const mockUseNeynarUser = useNeynarUser as jest.MockedFunction<typeof useNeynarUser>

const mockToken = {
  address: '0x123...',
  name: 'Test Token',
  symbol: 'TEST',
  imageUrl: 'https://example.com/token.jpg',
  creatorFid: 12345,
  marketCap: 150000,
  holders: 250,
  volume24h: 25000,
  priceChange24h: 15.5,
  launchedAt: new Date('2024-01-01').toISOString()
}

const mockCreator: NeynarUser = {
  fid: 12345,
  username: 'testcreator',
  displayName: 'Test Creator',
  pfp: {
    url: 'https://example.com/avatar.jpg'
  },
  profile: {
    bio: { text: 'Token creator' }
  },
  followerCount: 5000,
  followingCount: 250,
  verifications: ['0x123...'],
  custodyAddress: '0xabc...'
}

describe('TokenCard with Social Proof', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders token basic information', () => {
    mockUseNeynarUser.mockReturnValue({
      user: mockCreator,
      addresses: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn()
    })

    render(<TokenCard token={mockToken} />)
    
    expect(screen.getByText('Test Token')).toBeInTheDocument()
    expect(screen.getByText('TEST')).toBeInTheDocument()
  })

  it('displays creator profile badge', () => {
    mockUseNeynarUser.mockReturnValue({
      user: mockCreator,
      addresses: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn()
    })

    render(<TokenCard token={mockToken} />)
    
    expect(screen.getByTestId('profile-badge')).toBeInTheDocument()
    expect(screen.getByText('Test Creator')).toBeInTheDocument()
  })

  it('shows creator follower count as social proof', () => {
    mockUseNeynarUser.mockReturnValue({
      user: mockCreator,
      addresses: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn()
    })

    render(<TokenCard token={mockToken} />)
    
    expect(screen.getByText('5K followers')).toBeInTheDocument()
  })

  it('displays market cap', () => {
    mockUseNeynarUser.mockReturnValue({
      user: mockCreator,
      addresses: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn()
    })

    render(<TokenCard token={mockToken} />)
    
    expect(screen.getByText('$150K')).toBeInTheDocument()
  })

  it('shows holder count', () => {
    mockUseNeynarUser.mockReturnValue({
      user: mockCreator,
      addresses: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn()
    })

    render(<TokenCard token={mockToken} />)
    
    expect(screen.getByText('250')).toBeInTheDocument()
    expect(screen.getByText('holders')).toBeInTheDocument()
  })

  it('displays 24h volume', () => {
    mockUseNeynarUser.mockReturnValue({
      user: mockCreator,
      addresses: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn()
    })

    render(<TokenCard token={mockToken} />)
    
    expect(screen.getByText('$25K')).toBeInTheDocument()
  })

  it('shows positive price change', () => {
    mockUseNeynarUser.mockReturnValue({
      user: mockCreator,
      addresses: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn()
    })

    render(<TokenCard token={mockToken} />)
    
    expect(screen.getByText('+15.5%')).toBeInTheDocument()
    expect(screen.getByText('+15.5%')).toHaveClass('text-green-600')
  })

  it('shows negative price change', () => {
    mockUseNeynarUser.mockReturnValue({
      user: mockCreator,
      addresses: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn()
    })

    const tokenWithNegativeChange = { ...mockToken, priceChange24h: -8.3 }
    render(<TokenCard token={tokenWithNegativeChange} />)
    
    expect(screen.getByText('-8.3%')).toBeInTheDocument()
    expect(screen.getByText('-8.3%')).toHaveClass('text-red-600')
  })

  it('shows verification badge for verified creators', () => {
    mockUseNeynarUser.mockReturnValue({
      user: mockCreator,
      addresses: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn()
    })

    render(<TokenCard token={mockToken} />)
    
    expect(screen.getByTestId('creator-verified')).toBeInTheDocument()
  })

  it('does not show verification badge for unverified creators', () => {
    const unverifiedCreator: NeynarUser = {
      ...mockCreator,
      verifications: []
    }

    mockUseNeynarUser.mockReturnValue({
      user: unverifiedCreator,
      addresses: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn()
    })

    render(<TokenCard token={mockToken} />)
    
    expect(screen.queryByTestId('creator-verified')).not.toBeInTheDocument()
  })

  it('shows loading state for creator info', () => {
    mockUseNeynarUser.mockReturnValue({
      user: undefined,
      addresses: undefined,
      loading: true,
      error: undefined,
      refetch: jest.fn()
    })

    render(<TokenCard token={mockToken} />)
    
    expect(screen.getByTestId('creator-loading')).toBeInTheDocument()
  })

  it('handles error state for creator info', () => {
    mockUseNeynarUser.mockReturnValue({
      user: undefined,
      addresses: undefined,
      loading: false,
      error: 'Failed to load creator',
      refetch: jest.fn()
    })

    render(<TokenCard token={mockToken} />)
    
    expect(screen.getByText('Creator unavailable')).toBeInTheDocument()
  })

  it('displays time since launch', () => {
    mockUseNeynarUser.mockReturnValue({
      user: mockCreator,
      addresses: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn()
    })

    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-02'))

    render(<TokenCard token={mockToken} />)
    
    expect(screen.getByText('Launched 1 day ago')).toBeInTheDocument()

    jest.useRealTimers()
  })

  it('renders token image', () => {
    mockUseNeynarUser.mockReturnValue({
      user: mockCreator,
      addresses: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn()
    })

    render(<TokenCard token={mockToken} />)
    
    const image = screen.getByAltText('Test Token')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('alt', 'Test Token')
  })

  it('handles compact variant', () => {
    mockUseNeynarUser.mockReturnValue({
      user: mockCreator,
      addresses: undefined,
      loading: false,
      error: undefined,
      refetch: jest.fn()
    })

    render(<TokenCard token={mockToken} variant="compact" />)
    
    expect(screen.getByTestId('token-card-compact')).toBeInTheDocument()
  })
})