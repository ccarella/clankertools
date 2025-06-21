import { GET } from '../route';
import { NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';

// Mock Redis
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    setex: jest.fn(),
  })),
}));

// Mock network config
jest.mock('@/lib/network-config', () => ({
  getNetworkConfig: jest.fn().mockReturnValue({
    network: 'testnet',
    chainId: 84532,
    chainIdHex: '0x14A34',
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    isMainnet: false
  }),
}));

// Mock viem
jest.mock('viem', () => ({
  createPublicClient: jest.fn().mockReturnValue({
    readContract: jest.fn(),
  }),
  http: jest.fn(),
  formatUnits: jest.fn().mockImplementation(() => '1000000000'),
}));

jest.mock('viem/chains', () => ({
  base: { id: 8453, name: 'Base' },
  baseSepolia: { id: 84532, name: 'Base Sepolia' },
}));

// Mock console.error to avoid cluttering test output
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('GET /api/token/[address]', () => {
  let mockRedisGet: jest.Mock;
  let mockRedisSetex: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    const MockedRedis = Redis as unknown as jest.Mock;
    const mockRedisInstance = new MockedRedis();
    mockRedisGet = mockRedisInstance.get as jest.Mock;
    mockRedisSetex = mockRedisInstance.setex as jest.Mock;
  });

  it('should validate token address format', async () => {
    const invalidAddresses = [
      'invalid',
      '0x123',
      '0xGHIJKL',
      '',
      null,
    ];

    for (const address of invalidAddresses) {
      const request = new NextRequest(`http://localhost:3000/api/token/${address}`);
      const response = await GET(request, { params: Promise.resolve({ address: address as string }) });
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid token address');
    }
  });

  it('should return cached data if available', async () => {
    const mockTokenData = {
      name: 'Test Token',
      symbol: 'TEST',
      address: '0x1234567890123456789012345678901234567890',
      txHash: '0x' + '0'.repeat(64),
      imageUrl: 'ipfs://test',
      creatorAddress: '0x' + '0'.repeat(40),
      totalSupply: '1000000000',
      marketCap: '1000000',
      holders: 100,
      volume24h: '50000',
      priceChange24h: 10.5,
    };

    mockRedisGet.mockResolvedValueOnce(mockTokenData);

    const request = new NextRequest('http://localhost:3000/api/token/0x1234567890123456789012345678901234567890');
    const response = await GET(request, { 
      params: Promise.resolve({ address: '0x1234567890123456789012345678901234567890' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockTokenData);
    expect(mockRedisGet).toHaveBeenCalledWith('token:0x1234567890123456789012345678901234567890');
    expect(mockRedisSetex).not.toHaveBeenCalled();
  });

  it('should fetch and cache token data if not in cache', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSetex.mockResolvedValueOnce('OK');

    const request = new NextRequest('http://localhost:3000/api/token/0x1234567890123456789012345678901234567890');
    const response = await GET(request, { 
      params: Promise.resolve({ address: '0x1234567890123456789012345678901234567890' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(mockRedisGet).toHaveBeenCalled();
    expect(mockRedisSetex).toHaveBeenCalledWith(
      'token:0x1234567890123456789012345678901234567890',
      300, // 5 minutes
      expect.any(Object)
    );
  });

  it('should handle errors gracefully', async () => {
    mockRedisGet.mockRejectedValueOnce(new Error('Redis error'));

    const request = new NextRequest('http://localhost:3000/api/token/0x1234567890123456789012345678901234567890');
    const response = await GET(request, { 
      params: Promise.resolve({ address: '0x1234567890123456789012345678901234567890' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to fetch token data');
  });

  it('should handle lowercase addresses correctly', async () => {
    const upperAddress = '0x1234567890123456789012345678901234567890';
    const lowerAddress = upperAddress.toLowerCase();

    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSetex.mockResolvedValueOnce('OK');

    const request = new NextRequest(`http://localhost:3000/api/token/${upperAddress}`);
    const response = await GET(request, { 
      params: Promise.resolve({ address: upperAddress }) 
    });
    
    expect(response.status).toBe(200);
    expect(mockRedisGet).toHaveBeenCalledWith(`token:${lowerAddress}`);
    expect(mockRedisSetex).toHaveBeenCalledWith(
      `token:${lowerAddress}`,
      300,
      expect.any(Object)
    );
  });
});