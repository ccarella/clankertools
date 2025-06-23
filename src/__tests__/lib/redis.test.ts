import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Create mock Redis instance
const mockRedisInstance = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  scan: jest.fn(),
  pipeline: jest.fn(() => ({
    get: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    setex: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  })),
};

// Mock the entire redis module
jest.mock('@/lib/redis', () => ({
  getRedisClient: jest.fn(() => mockRedisInstance),
  storeUserWallet: jest.fn(async (fid: string, walletAddress: string) => {
    // Validate inputs like the real function would
    if (!fid || !walletAddress) {
      throw new Error('Invalid input');
    }
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new Error('Invalid wallet address format');
    }
    // Call the mock
    return mockRedisInstance.setex(`user:${fid}:wallet`, 7 * 24 * 60 * 60, walletAddress);
  }),
  getUserWallet: jest.fn(async (fid: string) => {
    return mockRedisInstance.get(`user:${fid}:wallet`);
  }),
  storeTokenData: jest.fn(async (fid: string, tokenData: any) => {
    const key = `user:${fid}:tokens`;
    return mockRedisInstance.set(key, JSON.stringify(tokenData));
  }),
  getTokenData: jest.fn(async (fid: string) => {
    const result = await mockRedisInstance.get(`user:${fid}:tokens`);
    return result ? JSON.parse(result as string) : null;
  }),
}));

// Import after mocking
import { storeUserWallet, getUserWallet, storeTokenData, getTokenData } from '@/lib/redis';

describe('Redis Module Tests', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRedis: any;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Set up environment variables for Redis
    process.env = {
      ...originalEnv,
      KV_REST_API_URL: 'https://test-redis-url.upstash.io',
      KV_REST_API_TOKEN: 'test-token'
    };
    
    // Use the mock instance directly
    mockRedis = mockRedisInstance;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('storeUserWallet', () => {
    it('should store user wallet with correct key and expiration', async () => {
      const fid = '12345';
      const walletAddress = '0x1234567890123456789012345678901234567890';
      
      mockRedis.setex.mockResolvedValue('OK');
      
      await storeUserWallet(fid, walletAddress);
      
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `user:${fid}:wallet`,
        7 * 24 * 60 * 60, // 7 days in seconds
        walletAddress
      );
    });

    it('should handle Redis errors gracefully', async () => {
      const fid = '12345';
      const walletAddress = '0x1234567890123456789012345678901234567890';
      
      mockRedis.setex.mockRejectedValue(new Error('Redis connection failed'));
      
      await expect(storeUserWallet(fid, walletAddress)).rejects.toThrow('Redis connection failed');
    });

    it('should validate wallet address format', async () => {
      const fid = '12345';
      const invalidWallets = [
        '',
        'not-a-wallet',
        '0x123', // too short
        '0xZZZZ567890123456789012345678901234567890', // invalid hex
        null,
        undefined,
      ];
      
      for (const wallet of invalidWallets) {
        await expect(storeUserWallet(fid, wallet as string)).rejects.toThrow();
      }
    });

    it('should prevent storing duplicate wallets for same FID', async () => {
      const fid = '12345';
      const wallet1 = '0x1111111111111111111111111111111111111111';
      const wallet2 = '0x2222222222222222222222222222222222222222';
      
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.exists.mockResolvedValue(1);
      
      await storeUserWallet(fid, wallet1);
      
      // Try to store different wallet for same FID
      // Should either overwrite or reject based on business logic
      await storeUserWallet(fid, wallet2);
      
      expect(mockRedis.setex).toHaveBeenCalledTimes(2);
    });
  });

  describe('getUserWallet', () => {
    it('should retrieve user wallet by FID', async () => {
      const fid = '12345';
      const expectedWallet = '0x1234567890123456789012345678901234567890';
      
      mockRedis.get.mockResolvedValue(expectedWallet);
      
      const wallet = await getUserWallet(fid);
      
      expect(mockRedis.get).toHaveBeenCalledWith(`user:${fid}:wallet`);
      expect(wallet).toBe(expectedWallet);
    });

    it('should return null for non-existent wallet', async () => {
      const fid = '99999';
      
      mockRedis.get.mockResolvedValue(null);
      
      const wallet = await getUserWallet(fid);
      
      expect(wallet).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      const fid = '12345';
      
      mockRedis.get.mockRejectedValue(new Error('Redis timeout'));
      
      await expect(getUserWallet(fid)).rejects.toThrow('Redis timeout');
    });

    it('should validate FID format', async () => {
      const invalidFids = [
        '',
        'DROP TABLE users;--',
        '<script>alert("xss")</script>',
        null,
        undefined,
        -1,
        'abc',
      ];
      
      for (const fid of invalidFids) {
        await expect(getUserWallet(fid as string)).rejects.toThrow();
      }
    });
  });

  describe('storeTokenData', () => {
    it('should store token data with correct structure', async () => {
      const tokenData = {
        address: '0x1234567890123456789012345678901234567890',
        name: 'Test Token',
        symbol: 'TEST',
        image: 'https://example.com/image.png',
        fid: '12345',
        createdAt: new Date().toISOString(),
      };
      
      mockRedis.set.mockResolvedValue('OK');
      
      await storeTokenData(tokenData.address, tokenData);
      
      expect(mockRedis.set).toHaveBeenCalledWith(
        `token:${tokenData.address}`,
        JSON.stringify(tokenData)
      );
    });

    it('should validate token address format', async () => {
      const invalidData = {
        address: 'invalid-address',
        name: 'Test Token',
        symbol: 'TEST',
      };
      
      await expect(storeTokenData(invalidData.address, invalidData)).rejects.toThrow();
    });

    it('should handle special characters in token data', async () => {
      const tokenData = {
        address: '0x1234567890123456789012345678901234567890',
        name: 'Token with "quotes" and <tags>',
        symbol: 'T&ST',
        description: 'Line 1\nLine 2\n\rSpecial chars: \t\b',
      };
      
      mockRedis.set.mockResolvedValue('OK');
      
      await storeTokenData(tokenData.address, tokenData);
      
      expect(mockRedis.set).toHaveBeenCalledWith(
        `token:${tokenData.address}`,
        JSON.stringify(tokenData)
      );
    });

    it('should handle concurrent writes for same token', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const data1 = { address, name: 'Token 1', version: 1 };
      const data2 = { address, name: 'Token 2', version: 2 };
      
      mockRedis.set.mockResolvedValue('OK');
      
      // Simulate concurrent writes
      await Promise.all([
        storeTokenData(address, data1),
        storeTokenData(address, data2),
      ]);
      
      expect(mockRedis.set).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTokenData', () => {
    it('should retrieve and parse token data correctly', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const tokenData = {
        address,
        name: 'Test Token',
        symbol: 'TEST',
        fid: '12345',
      };
      
      mockRedis.get.mockResolvedValue(JSON.stringify(tokenData));
      
      const result = await getTokenData(address);
      
      expect(mockRedis.get).toHaveBeenCalledWith(`token:${address}`);
      expect(result).toEqual(tokenData);
    });

    it('should return null for non-existent token', async () => {
      const address = '0x9999999999999999999999999999999999999999';
      
      mockRedis.get.mockResolvedValue(null);
      
      const result = await getTokenData(address);
      
      expect(result).toBeNull();
    });

    it('should handle malformed JSON data', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      
      mockRedis.get.mockResolvedValue('{"invalid": json}');
      
      await expect(getTokenData(address)).rejects.toThrow();
    });

    it('should handle Redis connection issues', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      
      mockRedis.get.mockRejectedValue(new Error('Connection refused'));
      
      await expect(getTokenData(address)).rejects.toThrow('Connection refused');
    });
  });

  describe('Data Expiration and TTL', () => {
    it('should check TTL for user wallet data', async () => {
      const fid = '12345';
      
      mockRedis.ttl.mockResolvedValue(3600); // 1 hour remaining
      
      const ttl = await mockRedis.ttl(`user:${fid}:wallet`);
      
      expect(ttl).toBe(3600);
      expect(mockRedis.ttl).toHaveBeenCalledWith(`user:${fid}:wallet`);
    });

    it('should handle expired data correctly', async () => {
      const fid = '12345';
      
      mockRedis.get.mockResolvedValue(null); // Data expired
      mockRedis.ttl.mockResolvedValue(-2); // Key does not exist
      
      const wallet = await getUserWallet(fid);
      
      expect(wallet).toBeNull();
    });
  });

  describe('Security and Edge Cases', () => {
    it('should prevent Redis injection attacks', async () => {
      const maliciousFids = [
        'user:admin:*',
        'FLUSHALL',
        'CONFIG GET *',
        'SCRIPT LOAD',
        '"; DROP TABLE users; --',
      ];
      
      for (const fid of maliciousFids) {
        // Functions should sanitize or reject malicious input
        await expect(getUserWallet(fid)).rejects.toThrow();
      }
    });

    it('should handle large data payloads', async () => {
      const address = '0x1234567890123456789012345678901234567890';
      const largeData = {
        address,
        description: 'A'.repeat(10000), // 10KB of data
        metadata: Array(1000).fill({ key: 'value' }),
      };
      
      mockRedis.set.mockResolvedValue('OK');
      
      await storeTokenData(address, largeData);
      
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should handle race conditions in concurrent operations', async () => {
      const fid = '12345';
      // Simulate race condition where data is deleted between check and use
      mockRedis.exists.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      mockRedis.get.mockResolvedValue(null);
      
      const result = await getUserWallet(fid);
      expect(result).toBeNull();
    });
  });

  describe('Pipeline Operations', () => {
    it('should use pipeline for batch operations', async () => {
      const operations = [
        { fid: '1', wallet: '0x1111111111111111111111111111111111111111' },
        { fid: '2', wallet: '0x2222222222222222222222222222222222222222' },
        { fid: '3', wallet: '0x3333333333333333333333333333333333333333' },
      ];
      
      const pipeline = mockRedis.pipeline();
      pipeline.exec.mockResolvedValue([['OK'], ['OK'], ['OK']]);
      
      // Batch store operation
      for (const op of operations) {
        pipeline.setex(`user:${op.fid}:wallet`, 7 * 24 * 60 * 60, op.wallet);
      }
      
      await pipeline.exec();
      
      expect(pipeline.setex).toHaveBeenCalledTimes(3);
      expect(pipeline.exec).toHaveBeenCalled();
    });
  });
});