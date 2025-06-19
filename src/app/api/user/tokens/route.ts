import { NextRequest, NextResponse } from 'next/server'
import { getUserTokens } from '@/lib/redis'

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-farcaster-user-id')
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const cursor = searchParams.get('cursor') || undefined
    const limitParam = searchParams.get('limit')
    
    let limit = 10
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10)
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, 50)
      }
    }

    const { tokens, nextCursor } = await getUserTokens(userId, cursor, limit)

    return NextResponse.json({
      tokens,
      nextCursor
    })
  } catch (error) {
    console.error('Error fetching user tokens:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tokens' },
      { status: 500 }
    )
  }
}