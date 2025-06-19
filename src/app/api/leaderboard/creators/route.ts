import { NextResponse } from 'next/server'
import { CreatorStats } from '@/hooks/useCreatorLeaderboard'

// Mock data for now - in production this would fetch from a database or aggregation service
const mockLeaderboard: CreatorStats[] = [
  {
    fid: 12345,
    username: 'dwr',
    display_name: 'Dan Romero',
    pfp_url: 'https://i.imgur.com/example1.jpg',
    follower_count: 250000,
    token_count: 35,
    total_market_cap: 15000000,
    rank: 1
  },
  {
    fid: 12346,
    username: 'vitalik',
    display_name: 'Vitalik Buterin',
    pfp_url: 'https://i.imgur.com/example2.jpg',
    follower_count: 180000,
    token_count: 28,
    total_market_cap: 12500000,
    rank: 2
  },
  {
    fid: 12347,
    username: 'jessepollak',
    display_name: 'Jesse Pollak',
    pfp_url: 'https://i.imgur.com/example3.jpg',
    follower_count: 120000,
    token_count: 22,
    total_market_cap: 8000000,
    rank: 3
  }
]

export async function GET() {
  try {
    // In production, this would:
    // 1. Query a database for tokens grouped by creator FID
    // 2. Aggregate market caps and token counts
    // 3. Fetch user data from Neynar for display names and profile pics
    // 4. Sort by total market cap or token count
    
    const creators = mockLeaderboard

    return NextResponse.json({
      creators,
      success: true
    })
  } catch (error) {
    console.error('Error fetching creator leaderboard:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}