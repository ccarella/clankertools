import { Redis } from '@upstash/redis'
import { sanitizeRedisKey, validateInput, schemas } from '@/lib/security/input-validation'

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

// Export Redis instance for rate limiter and tests
export { redis }

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
  // Validate FID
  const fidValidation = validateInput(fid, schemas.fid)
  if (!fidValidation.success) {
    throw new Error('Invalid FID format')
  }
  
  // Validate token address
  const addressValidation = validateInput(token.address, schemas.tokenAddress)
  if (!addressValidation.success) {
    throw new Error('Invalid token address format')
  }
  
  const client = getRedisClient()
  const key = `user:tokens:${sanitizeRedisKey(fid)}`
  
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
  // Validate FID
  const fidValidation = validateInput(fid, schemas.fid)
  if (!fidValidation.success) {
    throw new Error('Invalid FID format')
  }
  
  // Validate pagination parameters
  if (cursor && (!/^\d+$/.test(cursor) || parseInt(cursor) < 0)) {
    throw new Error('Invalid cursor')
  }
  
  if (limit < 1 || limit > 100) {
    throw new Error('Limit must be between 1 and 100')
  }
  
  const client = getRedisClient()
  const key = `user:tokens:${sanitizeRedisKey(fid)}`
  
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
  // Validate inputs
  const fidValidation = validateInput(fid, schemas.fid)
  if (!fidValidation.success) {
    throw new Error('Invalid FID format')
  }
  
  const addressValidation = validateInput(tokenAddress, schemas.tokenAddress)
  if (!addressValidation.success) {
    throw new Error('Invalid token address format')
  }
  
  const client = getRedisClient()
  const key = `user:tokens:${sanitizeRedisKey(fid)}`
  
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

// Add new secure functions for wallet operations
export async function storeUserWallet(fid: string, walletAddress: string): Promise<void> {
  // Validate inputs
  const fidValidation = validateInput(fid, schemas.fid)
  if (!fidValidation.success) {
    throw new Error('Invalid FID format')
  }
  
  const walletValidation = validateInput(walletAddress, schemas.walletAddress)
  if (!walletValidation.success) {
    throw new Error('Invalid wallet address format')
  }
  
  const client = getRedisClient()
  const key = `user:${sanitizeRedisKey(fid)}:wallet`
  
  // Store wallet with 7 day expiration
  await client.setex(key, 7 * 24 * 60 * 60, walletAddress)
}

export async function getUserWallet(fid: string): Promise<string | null> {
  // Validate FID
  const fidValidation = validateInput(fid, schemas.fid)
  if (!fidValidation.success) {
    throw new Error('Invalid FID format')
  }
  
  const client = getRedisClient()
  const key = `user:${sanitizeRedisKey(fid)}:wallet`
  
  return await client.get<string>(key)
}

export async function storeTokenData(address: string, data: unknown): Promise<void> {
  // Validate address
  const addressValidation = validateInput(address, schemas.tokenAddress)
  if (!addressValidation.success) {
    throw new Error('Invalid token address format')
  }
  
  const client = getRedisClient()
  const key = `token:${sanitizeRedisKey(address)}`
  
  await client.set(key, JSON.stringify(data))
}

export async function getTokenData(address: string): Promise<unknown | null> {
  // Validate address
  const addressValidation = validateInput(address, schemas.tokenAddress)
  if (!addressValidation.success) {
    throw new Error('Invalid token address format')
  }
  
  const client = getRedisClient()
  const key = `token:${sanitizeRedisKey(address)}`
  
  const data = await client.get<string>(key)
  return data ? JSON.parse(data) : null
}