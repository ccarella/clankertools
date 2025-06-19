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
  
  await client.zadd(key, {
    score: new Date(token.createdAt).getTime(),
    member: JSON.stringify(token)
  })
  
  await client.expire(key, 365 * 24 * 60 * 60)
}

export async function getUserTokens(
  fid: string,
  cursor?: string,
  limit: number = 10
): Promise<{ tokens: UserToken[]; nextCursor: string | null }> {
  const client = getRedisClient()
  const key = `user:tokens:${fid}`
  
  const start = cursor ? parseInt(cursor, 10) : 0
  const end = start + limit - 1
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = await (client as any).zrevrange(key, start, end + 1)
  
  const tokens = results.slice(0, limit).map((item: string) => {
    try {
      return JSON.parse(item) as UserToken
    } catch {
      return null
    }
  }).filter(Boolean) as UserToken[]
  
  const hasMore = results.length > limit
  const nextCursor = hasMore ? String(start + limit) : null
  
  return { tokens, nextCursor }
}

export async function updateUserTokenMetrics(
  fid: string,
  tokenAddress: string,
  metrics: Partial<UserToken>
): Promise<void> {
  const { tokens } = await getUserTokens(fid, undefined, 100)
  const token = tokens.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase())
  
  if (!token) return
  
  const updatedToken = { ...token, ...metrics }
  const client = getRedisClient()
  const key = `user:tokens:${fid}`
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client as any).zrem(key, JSON.stringify(token))
  await client.zadd(key, {
    score: new Date(token.createdAt).getTime(),
    member: JSON.stringify(updatedToken)
  })
}