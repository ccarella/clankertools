import { renderHook, waitFor } from '@testing-library/react';
import { useNeynar, useNeynarUser, useNeynarFollowers } from '../useNeynar';

// Mock the entire neynar service module
jest.mock('@/services/neynar', () => {
  return {
    NeynarService: jest.fn().mockImplementation(() => {
      return {
        getUserByFid: jest.fn(),
        getUserByUsername: jest.fn(),
        getUserWalletAddresses: jest.fn(),
        getUserFollowers: jest.fn(),
        getUserFollowing: jest.fn(),
        getRelevantFollowers: jest.fn(),
      };
    }),
  };
});

describe('useNeynar hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the NEYNAR_API_KEY for tests
    process.env.NEYNAR_API_KEY = 'test-api-key';
  });

  describe('useNeynar', () => {
    it('should return a NeynarService instance', () => {
      const { result } = renderHook(() => useNeynar());
      expect(result.current).toBeDefined();
      expect(result.current!.getUserByFid).toBeDefined();
      expect(result.current!.getUserByUsername).toBeDefined();
    });

    it('should return the same instance on re-renders', () => {
      const { result, rerender } = renderHook(() => useNeynar());
      const firstInstance = result.current;
      
      rerender();
      expect(result.current).toBe(firstInstance);
    });
  });

  describe('useNeynarUser', () => {
    const mockUser = {
      fid: 3,
      username: 'dwr.eth',
      displayName: 'Dan Romero',
      pfp: { url: 'https://example.com/pfp.png' },
      profile: { bio: { text: 'Building Farcaster' } },
      custodyAddress: '0x123',
      followerCount: 100000,
      followingCount: 1000
    };

    it('should fetch user by FID', async () => {
      // Mock the service method
      const { result } = renderHook(() => {
        const service = useNeynar();
        service!.getUserByFid = jest.fn().mockResolvedValue(mockUser);
        return useNeynarUser({ fid: 3 });
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });
    });

    it('should not fetch if neither fid nor username provided', () => {
      const { result } = renderHook(() => useNeynarUser({}));

      expect(result.current.loading).toBe(false);
      expect(result.current.user).toBeUndefined();
      expect(result.current.error).toBeUndefined();
    });
  });

  describe('useNeynarFollowers', () => {
    it('should not fetch if fid is not provided', () => {
      const { result } = renderHook(() => useNeynarFollowers(undefined));

      expect(result.current.loading).toBe(false);
      expect(result.current.followers).toEqual([]);
    });
  });
});