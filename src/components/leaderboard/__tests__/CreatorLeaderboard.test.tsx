import React from 'react'
import { render, screen } from '@testing-library/react'
import { CreatorLeaderboard } from '../CreatorLeaderboard'
import { useCreatorLeaderboard } from '@/hooks/useCreatorLeaderboard'

jest.mock('@/hooks/useCreatorLeaderboard')
jest.mock('@/components/profile', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ProfileBadge: ({ user, variant }: { user: any; variant: any }) => (
    <div data-testid="profile-badge" data-variant={variant}>
      {user?.displayName}
    </div>
  )
}))

const mockUseCreatorLeaderboard = useCreatorLeaderboard as jest.MockedFunction<typeof useCreatorLeaderboard>

const mockLeaderboard = [
  {
    fid: 12345,
    username: 'topcreator1',
    display_name: 'Top Creator 1',
    pfp_url: 'https://example.com/avatar1.jpg',
    follower_count: 50000,
    token_count: 25,
    total_market_cap: 5000000,
    rank: 1
  },
  {
    fid: 12346,
    username: 'topcreator2',
    display_name: 'Top Creator 2',
    pfp_url: 'https://example.com/avatar2.jpg',
    follower_count: 30000,
    token_count: 18,
    total_market_cap: 3500000,
    rank: 2
  },
  {
    fid: 12347,
    username: 'topcreator3',
    display_name: 'Top Creator 3',
    pfp_url: 'https://example.com/avatar3.jpg',
    follower_count: 20000,
    token_count: 12,
    total_market_cap: 2000000,
    rank: 3
  }
]

describe('CreatorLeaderboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders leaderboard title', () => {
    mockUseCreatorLeaderboard.mockReturnValue({
      creators: mockLeaderboard,
      loading: false,
      error: null
    })

    render(<CreatorLeaderboard />)
    expect(screen.getByText('Top Token Creators')).toBeInTheDocument()
  })

  it('displays creator rankings', () => {
    mockUseCreatorLeaderboard.mockReturnValue({
      creators: mockLeaderboard,
      loading: false,
      error: null
    })

    render(<CreatorLeaderboard />)
    
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('#3')).toBeInTheDocument()
  })

  it('shows creator profiles with ProfileBadge', () => {
    mockUseCreatorLeaderboard.mockReturnValue({
      creators: mockLeaderboard,
      loading: false,
      error: null
    })

    render(<CreatorLeaderboard />)
    
    const badges = screen.getAllByTestId('profile-badge')
    expect(badges).toHaveLength(3)
    expect(badges[0]).toHaveTextContent('Top Creator 1')
    expect(badges[1]).toHaveTextContent('Top Creator 2')
    expect(badges[2]).toHaveTextContent('Top Creator 3')
  })

  it('displays token count for each creator', () => {
    mockUseCreatorLeaderboard.mockReturnValue({
      creators: mockLeaderboard,
      loading: false,
      error: null
    })

    render(<CreatorLeaderboard />)
    
    expect(screen.getByText('25 tokens')).toBeInTheDocument()
    expect(screen.getByText('18 tokens')).toBeInTheDocument()
    expect(screen.getByText('12 tokens')).toBeInTheDocument()
  })

  it('displays market cap for each creator', () => {
    mockUseCreatorLeaderboard.mockReturnValue({
      creators: mockLeaderboard,
      loading: false,
      error: null
    })

    render(<CreatorLeaderboard />)
    
    expect(screen.getByText('$5.0M')).toBeInTheDocument()
    expect(screen.getByText('$3.5M')).toBeInTheDocument()
    expect(screen.getByText('$2.0M')).toBeInTheDocument()
  })

  it('shows loading skeleton while fetching data', () => {
    mockUseCreatorLeaderboard.mockReturnValue({
      creators: [],
      loading: true,
      error: null
    })

    render(<CreatorLeaderboard />)
    
    expect(screen.getByTestId('leaderboard-skeleton')).toBeInTheDocument()
  })

  it('displays error message when data fetch fails', () => {
    mockUseCreatorLeaderboard.mockReturnValue({
      creators: [],
      loading: false,
      error: 'Failed to load leaderboard'
    })

    render(<CreatorLeaderboard />)
    
    expect(screen.getByText('Failed to load leaderboard')).toBeInTheDocument()
  })

  it('shows empty state when no creators exist', () => {
    mockUseCreatorLeaderboard.mockReturnValue({
      creators: [],
      loading: false,
      error: null
    })

    render(<CreatorLeaderboard />)
    
    expect(screen.getByText('No creators found')).toBeInTheDocument()
  })

  it('limits display to top 10 creators', () => {
    const manyCreators = Array.from({ length: 15 }, (_, i) => ({
      fid: 12345 + i,
      username: `creator${i + 1}`,
      display_name: `Creator ${i + 1}`,
      pfp_url: `https://example.com/avatar${i + 1}.jpg`,
      follower_count: 10000 - (i * 500),
      token_count: 20 - i,
      total_market_cap: 1000000 - (i * 50000),
      rank: i + 1
    }))

    mockUseCreatorLeaderboard.mockReturnValue({
      creators: manyCreators,
      loading: false,
      error: null
    })

    render(<CreatorLeaderboard />)
    
    const badges = screen.getAllByTestId('profile-badge')
    expect(badges).toHaveLength(10)
  })

  it('handles compact variant display', () => {
    mockUseCreatorLeaderboard.mockReturnValue({
      creators: mockLeaderboard,
      loading: false,
      error: null
    })

    render(<CreatorLeaderboard variant="compact" />)
    
    expect(screen.getByTestId('leaderboard-compact')).toBeInTheDocument()
    const badges = screen.getAllByTestId('profile-badge')
    expect(badges).toHaveLength(3) // Only 3 creators in mockLeaderboard
  })
})