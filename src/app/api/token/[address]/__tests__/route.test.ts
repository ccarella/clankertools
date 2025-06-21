/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock NextRequest
class MockNextRequest {
  url: string;
  method: string;
  headers: Headers;
  
  constructor(url: string, init?: RequestInit) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.headers = new Headers(init?.headers as HeadersInit);
  }
}

// Mock Redis - must be done before imports
jest.mock('@upstash/redis', () => {
  const mockGet = jest.fn();
  const mockSetex = jest.fn();
  
  return {
    Redis: jest.fn(() => ({
      get: mockGet,
      setex: mockSetex,
    })),
    __mockGet: mockGet,
    __mockSetex: mockSetex,
  };
});

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
const mockReadContract = jest.fn();
jest.mock('viem', () => ({
  createPublicClient: jest.fn(() => ({
    readContract: mockReadContract,
  })),
  http: jest.fn(),
  formatUnits: jest.fn().mockImplementation(() => '1000000000'),
}));

jest.mock('viem/chains', () => ({
  base: { id: 8453, name: 'Base' },
  baseSepolia: { id: 84532, name: 'Base Sepolia' },
}));

// Now import after all mocks are set up
import { GET } from '../route';

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
    
    // Get the mock functions from the module
    const upstashMocks = jest.requireMock('@upstash/redis');
    mockRedisGet = upstashMocks.__mockGet;
    mockRedisSetex = upstashMocks.__mockSetex;
    
    // Setup default viem mock responses
    mockReadContract
      .mockResolvedValueOnce('Test Token') // name
      .mockResolvedValueOnce('TEST') // symbol
      .mockResolvedValueOnce(18) // decimals
      .mockResolvedValueOnce(BigInt('1000000000000000000000000000')); // totalSupply
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
      const request = new MockNextRequest(`http://localhost:3000/api/token/${address}`) as any;
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

    const request = new MockNextRequest('http://localhost:3000/api/token/0x1234567890123456789012345678901234567890') as any;
    const response = await GET(request, { 
      params: Promise.resolve({ address: '0x1234567890123456789012345678901234567890' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockTokenData);
    expect(mockRedisGet).toHaveBeenCalledWith('token:testnet:0x1234567890123456789012345678901234567890');
    expect(mockRedisSetex).not.toHaveBeenCalled();
  });

  it('should fetch and cache token data if not in cache', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSetex.mockResolvedValueOnce('OK');

    const request = new MockNextRequest('http://localhost:3000/api/token/0x1234567890123456789012345678901234567890') as any;
    const response = await GET(request, { 
      params: Promise.resolve({ address: '0x1234567890123456789012345678901234567890' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(mockRedisGet).toHaveBeenCalled();
    expect(mockRedisSetex).toHaveBeenCalledWith(
      'token:testnet:0x1234567890123456789012345678901234567890',
      300, // 5 minutes
      expect.any(Object)
    );
  });

  it('should handle errors gracefully', async () => {
    mockRedisGet.mockRejectedValueOnce(new Error('Redis error'));

    const request = new MockNextRequest('http://localhost:3000/api/token/0x1234567890123456789012345678901234567890') as any;
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

    const request = new MockNextRequest(`http://localhost:3000/api/token/${upperAddress}`) as any;
    const response = await GET(request, { 
      params: Promise.resolve({ address: upperAddress }) 
    });
    
    expect(response.status).toBe(200);
    expect(mockRedisGet).toHaveBeenCalledWith(`token:testnet:${lowerAddress}`);
    expect(mockRedisSetex).toHaveBeenCalledWith(
      `token:testnet:${lowerAddress}`,
      300,
      expect.any(Object)
    );
  });
});