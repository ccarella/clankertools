import { Redis } from '@upstash/redis'

let redis: Redis | null = null

export function getRedisClient() {
  if (!redis) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_URL
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_TOKEN

    if (!url || !token) {
      throw new Error('Redis configuration missing')
    }

    redis = new Redis({
      url,
      token
    })
  }
  return redis
}

export interface UserToken {
  address: string
  name: string
  symbol: string
  createdAt: string
  marketCap?: string
  price?: string
  volume24h?: string
  holders?: number
  feesEarned?: string
}

export async function storeUserToken(fid: string, token: UserToken): Promise<void> {
  const client = getRedisClient()
  const key = `user:tokens:${fid}`
  
  // Get existing tokens
  const existingTokens = await client.get<UserToken[]>(key) || []
  
  // Check if token already exists
  const exists = existingTokens.some(t => t.address.toLowerCase() === token.address.toLowerCase())
  if (!exists) {
    // Add new token to the beginning (newest first)
    existingTokens.unshift(token)
    
    // Store updated array with expiration
    await client.set(key, existingTokens)
    await client.expire(key, 365 * 24 * 60 * 60)
  }
}

export async function getUserTokens(
  fid: string,
  cursor?: string,
  limit: number = 10
): Promise<{ tokens: UserToken[]; nextCursor: string | null }> {
  const client = getRedisClient()
  const key = `user:tokens:${fid}`
  
  // Get all tokens
  const allTokens = await client.get<UserToken[]>(key) || []
  
  // Sort by creation date (newest first)
  const sortedTokens = allTokens.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
  
  // Apply pagination
  const start = cursor ? parseInt(cursor, 10) : 0
  const paginatedTokens = sortedTokens.slice(start, start + limit)
  
  const hasMore = start + limit < sortedTokens.length
  const nextCursor = hasMore ? String(start + limit) : null
  
  return { tokens: paginatedTokens, nextCursor }
}

export async function updateUserTokenMetrics(
  fid: string,
  tokenAddress: string,
  metrics: Partial<UserToken>
): Promise<void> {
  const client = getRedisClient()
  const key = `user:tokens:${fid}`
  
  // Get all tokens
  const tokens = await client.get<UserToken[]>(key) || []
  
  // Find and update the token
  const tokenIndex = tokens.findIndex(t => t.address.toLowerCase() === tokenAddress.toLowerCase())
  if (tokenIndex === -1) return
  
  // Update the token
  tokens[tokenIndex] = { ...tokens[tokenIndex], ...metrics }
  
  // Store updated array with expiration
  await client.set(key, tokens)
  await client.expire(key, 365 * 24 * 60 * 60)
}