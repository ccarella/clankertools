import { NeynarService } from '../neynar';

// Mock fetch globally
global.fetch = jest.fn();

describe('NeynarService', () => {
  let neynarService: NeynarService;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NEYNAR_API_KEY: 'test-api-key' };
    neynarService = new NeynarService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getUserByFid', () => {
    it('should fetch user information by FID', async () => {
      const mockUser = {
        fid: 3,
        username: 'dwr.eth',
        display_name: 'Dan Romero',
        pfp_url: 'https://i.imgur.com/mockpfp.png',
        bio: 'Working on Farcaster',
        custody_address: '0x1234567890123456789012345678901234567890',
        follower_count: 100000,
        following_count: 1000,
        verifications: ['0x1234567890123456789012345678901234567890']
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: [mockUser] })
      });

      const user = await neynarService.getUserByFid(3);

      expect(user).toBeDefined();
      expect(user.fid).toBe(3);
      expect(user.username).toBe('dwr.eth');
      expect(user.displayName).toBe('Dan Romero');
      expect(user.pfp?.url).toBe('https://i.imgur.com/mockpfp.png');
      expect(user.custodyAddress).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should throw error for invalid FID', async () => {
      const invalidFid = -1;
      
      await expect(neynarService.getUserByFid(invalidFid)).rejects.toThrow('Invalid FID: must be a positive number');
    });

    it('should handle non-existent FID', async () => {
      const nonExistentFid = 999999999;
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: [] })
      });

      await expect(neynarService.getUserByFid(nonExistentFid)).rejects.toThrow(`User with FID ${nonExistentFid} not found`);
    });
  });

  describe('getUserByUsername', () => {
    it('should fetch user information by username', async () => {
      const mockUser = {
        fid: 3,
        username: 'dwr.eth',
        display_name: 'Dan Romero',
        pfp_url: 'https://i.imgur.com/mockpfp.png'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser })
      });

      const user = await neynarService.getUserByUsername('dwr.eth');

      expect(user).toBeDefined();
      expect(user.username).toBe('dwr.eth');
      expect(user.fid).toBe(3);
      expect(user.displayName).toBe('Dan Romero');
    });

    it('should handle non-existent username', async () => {
      const nonExistentUsername = 'thisisanonexistentusername12345';
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: null })
      });

      await expect(neynarService.getUserByUsername(nonExistentUsername)).rejects.toThrow(`User with username ${nonExistentUsername} not found`);
    });
  });

  describe('getUserWalletAddresses', () => {
    it('should fetch verified wallet addresses for a user', async () => {
      const mockUser = {
        fid: 3,
        verified_addresses: {
          eth_addresses: ['0x1234567890123456789012345678901234567890', '0x2345678901234567890123456789012345678901'],
          sol_addresses: ['SolanaAddress123']
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: [mockUser] })
      });

      const addresses = await neynarService.getUserWalletAddresses(3);

      expect(addresses).toBeDefined();
      expect(Array.isArray(addresses)).toBe(true);
      expect(addresses.length).toBe(3);
      expect(addresses[0].address).toBe('0x1234567890123456789012345678901234567890');
      expect(addresses[0].chainType).toBe('ethereum');
      expect(addresses[2].chainType).toBe('solana');
    });

    it('should return empty array for user with no verified addresses', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: [{ fid: 999999 }] })
      });

      const addresses = await neynarService.getUserWalletAddresses(999999);

      expect(addresses).toEqual([]);
    });
  });

  describe('getUserFollowers', () => {
    it('should fetch followers for a user', async () => {
      const mockFollowers = [
        { fid: 1, username: 'follower1', display_name: 'Follower 1' },
        { fid: 2, username: 'follower2', display_name: 'Follower 2' }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          users: mockFollowers,
          next: { cursor: 'next-cursor' }
        })
      });

      const result = await neynarService.getUserFollowers(3);

      expect(result).toBeDefined();
      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.users.length).toBe(2);
      expect(result.nextCursor).toBe('next-cursor');
    });

    it('should handle pagination with cursor', async () => {
      const mockFirstPage = [
        { fid: 1, username: 'follower1', display_name: 'Follower 1' }
      ];
      const mockSecondPage = [
        { fid: 2, username: 'follower2', display_name: 'Follower 2' }
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ 
            users: mockFirstPage,
            next: { cursor: 'next-cursor' }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ 
            users: mockSecondPage,
            next: null
          })
        });

      const firstPage = await neynarService.getUserFollowers(3, { limit: 1 });
      const secondPage = await neynarService.getUserFollowers(3, { 
        cursor: firstPage.nextCursor || undefined,
        limit: 1 
      });

      expect(firstPage.users[0].fid).toBe(1);
      expect(secondPage.users[0].fid).toBe(2);
      expect(secondPage.nextCursor).toBeNull();
    });
  });

  describe('getUserFollowing', () => {
    it('should fetch users that a user is following', async () => {
      const mockFollowing = [
        { fid: 10, username: 'following1', display_name: 'Following 1' }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          users: mockFollowing,
          next: null
        })
      });

      const result = await neynarService.getUserFollowing(3);

      expect(result).toBeDefined();
      expect(result.users).toBeDefined();
      expect(Array.isArray(result.users)).toBe(true);
      expect(result.users[0].username).toBe('following1');
    });
  });

  describe('getRelevantFollowers', () => {
    it('should fetch relevant followers for a target user from viewer perspective', async () => {
      const mockRelevantFollowers = [
        { fid: 2, username: 'v', display_name: 'Varun' }
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: mockRelevantFollowers })
      });

      const relevantFollowers = await neynarService.getRelevantFollowers(3, 2);

      expect(relevantFollowers).toBeDefined();
      expect(Array.isArray(relevantFollowers)).toBe(true);
      expect(relevantFollowers[0].username).toBe('v');
    });
  });
});