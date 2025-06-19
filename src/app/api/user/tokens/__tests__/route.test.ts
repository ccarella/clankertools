/**
 * @jest-environment node
 */
import { GET } from '../route'
import { NextRequest } from 'next/server'
import { getUserTokens } from '@/lib/redis'

// Mock NextRequest
class MockNextRequest {
  method: string;
  headers: Headers;
  nextUrl: URL;
  
  constructor(url: string, init?: RequestInit) {
    this.method = init?.method || 'GET';
    this.headers = new Headers(init?.headers as HeadersInit);
    this.nextUrl = new URL(url);
  }
}

jest.mock('@/lib/redis', () => ({
  getUserTokens: jest.fn(),
  storeUserToken: jest.fn(),
}))

describe('/api/user/tokens', () => {
  const mockUserId = '123456'
  const mockTokens = [
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

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return tokens for authenticated user', async () => {
    const mockRequest = new MockNextRequest('http://localhost:3000/api/user/tokens', {
      headers: {
        'x-farcaster-user-id': mockUserId
      }
    }) as unknown as NextRequest

    ;(getUserTokens as jest.Mock).mockResolvedValue({
      tokens: mockTokens,
      nextCursor: null
    })

    const response = await GET(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.tokens).toHaveLength(2)
    expect(data.tokens[0].address).toBe(mockTokens[0].address)
    expect(data.nextCursor).toBeNull()
    expect(getUserTokens).toHaveBeenCalledWith(mockUserId, undefined, 10)
  })

  it('should handle pagination with cursor', async () => {
    const mockRequest = new MockNextRequest('http://localhost:3000/api/user/tokens?cursor=next123&limit=5', {
      headers: {
        'x-farcaster-user-id': mockUserId
      }
    }) as unknown as NextRequest

    ;(getUserTokens as jest.Mock).mockResolvedValue({
      tokens: [mockTokens[0]],
      nextCursor: 'next456'
    })

    const response = await GET(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.tokens).toHaveLength(1)
    expect(data.nextCursor).toBe('next456')
    expect(getUserTokens).toHaveBeenCalledWith(mockUserId, 'next123', 5)
  })

  it('should return empty array when user has no tokens', async () => {
    const mockRequest = new MockNextRequest('http://localhost:3000/api/user/tokens', {
      headers: {
        'x-farcaster-user-id': mockUserId
      }
    }) as unknown as NextRequest

    ;(getUserTokens as jest.Mock).mockResolvedValue({
      tokens: [],
      nextCursor: null
    })

    const response = await GET(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.tokens).toHaveLength(0)
    expect(data.nextCursor).toBeNull()
  })

  it('should return 401 when not authenticated', async () => {
    const mockRequest = new MockNextRequest('http://localhost:3000/api/user/tokens') as unknown as NextRequest

    const response = await GET(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
    expect(getUserTokens).not.toHaveBeenCalled()
  })

  it('should handle Redis errors gracefully', async () => {
    const mockRequest = new MockNextRequest('http://localhost:3000/api/user/tokens', {
      headers: {
        'x-farcaster-user-id': mockUserId
      }
    }) as unknown as NextRequest

    const mockGetUserTokens = getUserTokens as jest.MockedFunction<typeof getUserTokens>
    mockGetUserTokens.mockRejectedValue(new Error('Redis connection failed'))

    const response = await GET(mockRequest)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch tokens')
  })

  it('should validate limit parameter', async () => {
    const mockRequest = new MockNextRequest('http://localhost:3000/api/user/tokens?limit=invalid', {
      headers: {
        'x-farcaster-user-id': mockUserId
      }
    }) as unknown as NextRequest

    ;(getUserTokens as jest.Mock).mockResolvedValue({
      tokens: mockTokens,
      nextCursor: null
    })

    const response = await GET(mockRequest)
    await response.json()

    expect(response.status).toBe(200)
    expect(getUserTokens).toHaveBeenCalledWith(mockUserId, undefined, 10)
  })

  it('should cap limit at maximum value', async () => {
    const mockRequest = new MockNextRequest('http://localhost:3000/api/user/tokens?limit=200', {
      headers: {
        'x-farcaster-user-id': mockUserId
      }
    }) as unknown as NextRequest

    ;(getUserTokens as jest.Mock).mockResolvedValue({
      tokens: mockTokens,
      nextCursor: null
    })

    const response = await GET(mockRequest)
    await response.json()

    expect(getUserTokens).toHaveBeenCalledWith(mockUserId, undefined, 50)
  })
})