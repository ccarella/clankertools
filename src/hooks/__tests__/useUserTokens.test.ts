import { renderHook, act, waitFor } from '@testing-library/react'
import { useUserTokens } from '../useUserTokens'
import { UserToken } from '@/lib/redis'

const mockFetch = jest.fn()
global.fetch = mockFetch

const mockTokens: UserToken[] = [
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
  },
  {
    address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    name: 'Another Token',
    symbol: 'ANOTHER',
    createdAt: '2025-01-02T00:00:00.000Z',
    marketCap: '500000',
    price: '0.0005',
    volume24h: '25000',
    holders: 50,
    feesEarned: '0.25'
  }
]

describe('useUserTokens', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should fetch tokens on mount', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tokens: mockTokens, nextCursor: null })
    })

    const { result } = renderHook(() => useUserTokens('123456'))

    expect(result.current.loading).toBe(true)
    expect(result.current.tokens).toEqual([])

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.tokens).toEqual(mockTokens)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/user/tokens?limit=10',
      expect.objectContaining({
        headers: {
          'x-farcaster-user-id': '123456'
        }
      })
    )
  })

  it('should handle pagination', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tokens: [mockTokens[0]], nextCursor: 'next123' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tokens: [mockTokens[1]], nextCursor: null })
      })

    const { result } = renderHook(() => useUserTokens('123456'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.tokens).toHaveLength(1)
      expect(result.current.hasMore).toBe(true)
    })

    await act(async () => {
      await result.current.loadMore()
    })

    await waitFor(() => {
      expect(result.current.tokens).toHaveLength(2)
      expect(result.current.hasMore).toBe(false)
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/user/tokens?limit=10&cursor=next123',
      expect.objectContaining({
        headers: {
          'x-farcaster-user-id': '123456'
        }
      })
    )
  })

  it('should handle refresh', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tokens: [mockTokens[0]], nextCursor: null })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tokens: mockTokens, nextCursor: null })
      })

    const { result } = renderHook(() => useUserTokens('123456'))

    await waitFor(() => {
      expect(result.current.tokens).toEqual([mockTokens[0]])
    })

    await act(async () => {
      await result.current.refresh()
    })

    await waitFor(() => {
      expect(result.current.tokens).toEqual(mockTokens)
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('should poll for updates', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tokens: [mockTokens[0]], nextCursor: null })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tokens: mockTokens, nextCursor: null })
      })

    const { result } = renderHook(() => useUserTokens('123456', {
      pollInterval: 5000
    }))

    await waitFor(() => {
      expect(result.current.tokens).toEqual([mockTokens[0]])
    })

    // Fast forward 5 seconds
    act(() => {
      jest.advanceTimersByTime(5000)
    })

    await waitFor(() => {
      expect(result.current.tokens).toEqual(mockTokens)
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('should handle errors', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useUserTokens('123456'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe('Network error')
      expect(result.current.tokens).toEqual([])
    })

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error fetching user tokens:',
      expect.any(Error)
    )

    consoleErrorSpy.mockRestore()
  })

  it('should handle non-ok responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' })
    })

    const { result } = renderHook(() => useUserTokens('123456'))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe('Server error')
      expect(result.current.tokens).toEqual([])
    })
  })

  it('should not fetch if no userId provided', () => {
    const { result } = renderHook(() => useUserTokens(null))

    expect(result.current.loading).toBe(false)
    expect(result.current.tokens).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should cleanup polling on unmount', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ tokens: mockTokens, nextCursor: null })
    })

    const { unmount } = renderHook(() => useUserTokens('123456', {
      pollInterval: 5000
    }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    unmount()

    // Fast forward 10 seconds
    act(() => {
      jest.advanceTimersByTime(10000)
    })

    // Should not make additional calls after unmount
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('should deduplicate tokens on update', async () => {
    // First call returns two tokens
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tokens: mockTokens, nextCursor: 'next123' })
      })
      // Second call returns the same first token (duplicate) and a new one
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          tokens: [
            mockTokens[0], // Duplicate
            {
              address: '0xnewtoken',
              name: 'New Token',
              symbol: 'NEW',
              createdAt: '2025-01-03T00:00:00.000Z',
              marketCap: '750000',
              price: '0.00075',
              volume24h: '35000',
              holders: 75,
              feesEarned: '0.35'
            }
          ], 
          nextCursor: null 
        })
      })

    const { result } = renderHook(() => useUserTokens('123456'))

    await waitFor(() => {
      expect(result.current.tokens).toHaveLength(2)
    })

    await act(async () => {
      await result.current.loadMore()
    })

    await waitFor(() => {
      // Should have 3 unique tokens (no duplicates)
      expect(result.current.tokens).toHaveLength(3)
      expect(result.current.tokens[0]).toEqual(mockTokens[0])
      expect(result.current.tokens[1]).toEqual(mockTokens[1])
      expect(result.current.tokens[2].address).toBe('0xnewtoken')
    })
  })
})