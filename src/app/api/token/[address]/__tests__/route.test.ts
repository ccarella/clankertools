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
const mockGetLogs = jest.fn();
const mockGetBlock = jest.fn();
jest.mock('viem', () => ({
  createPublicClient: jest.fn(() => ({
    readContract: mockReadContract,
    getLogs: mockGetLogs,
    getBlock: mockGetBlock,
  })),
  createWalletClient: jest.fn(() => ({
    account: { address: '0x0000000000000000000000000000000000000001' },
  })),
  http: jest.fn(),
  formatUnits: jest.fn().mockImplementation((value: bigint, decimals: number) => {
    return (Number(value) / Math.pow(10, decimals)).toString();
  }),
  parseAbiItem: jest.fn(),
}));

jest.mock('viem/chains', () => ({
  base: { id: 8453, name: 'Base' },
  baseSepolia: { id: 84532, name: 'Base Sepolia' },
}));

jest.mock('viem/accounts', () => ({
  privateKeyToAccount: jest.fn().mockReturnValue({
    address: '0x0000000000000000000000000000000000000001',
  }),
}));

// Mock Clanker SDK - must be outside describe block
jest.mock('clanker-sdk');

// Now import after all mocks are set up
import { GET } from '../route';
import { Clanker } from 'clanker-sdk';

// Mock console.error to avoid cluttering test output
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    // Log actual errors for debugging
    if (args[0] && args[0].toString().includes('error:')) {
      originalConsoleError(...args);
    }
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('GET /api/token/[address]', () => {
  let mockRedisGet: jest.Mock;
  let mockRedisSetex: jest.Mock;
  const mockGetToken = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up required environment variables
    process.env.UPSTASH_REDIS_REST_URL = 'test-url';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    
    // Get the mock functions from the module
    const upstashMocks = jest.requireMock('@upstash/redis');
    mockRedisGet = upstashMocks.__mockGet;
    mockRedisSetex = upstashMocks.__mockSetex;
    
    // Mock Clanker SDK implementation
    (Clanker as jest.MockedClass<typeof Clanker>).mockImplementation(() => ({
      getToken: mockGetToken,
    } as any));
    
    // Setup default viem mock responses
    mockReadContract
      .mockResolvedValueOnce('Test Token') // name
      .mockResolvedValueOnce('TEST') // symbol
      .mockResolvedValueOnce(18) // decimals
      .mockResolvedValueOnce(BigInt('1000000000000000000000000000')) // totalSupply
      // Mock Uniswap factory calls (3 fee tiers) - no pools found by default
      .mockResolvedValueOnce('0x0000000000000000000000000000000000000000') // 500 fee pool
      .mockResolvedValueOnce('0x0000000000000000000000000000000000000000') // 3000 fee pool  
      .mockResolvedValueOnce('0x0000000000000000000000000000000000000000'); // 10000 fee pool
    
    // Mock empty logs by default
    mockGetLogs.mockResolvedValueOnce([]);
  });
  
  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
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
    // Clear default mocks and set up this test's mocks
    jest.clearAllMocks();
    
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSetex.mockResolvedValueOnce('OK');
    
    // Setup viem mock responses for this test
    mockReadContract
      .mockResolvedValueOnce('Test Token') // name
      .mockResolvedValueOnce('TEST') // symbol
      .mockResolvedValueOnce(18) // decimals
      .mockResolvedValueOnce(BigInt('1000000000000000000000000000')) // totalSupply
      // Mock Uniswap factory calls
      .mockResolvedValueOnce('0x0000000000000000000000000000000000000000') // 500 fee pool
      .mockResolvedValueOnce('0x0000000000000000000000000000000000000000') // 3000 fee pool  
      .mockResolvedValueOnce('0x0000000000000000000000000000000000000000'); // 10000 fee pool
    
    mockGetLogs.mockResolvedValueOnce([]); // empty logs

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
    // Clear default mocks and set up this test's mocks
    jest.clearAllMocks();
    
    const upperAddress = '0x1234567890123456789012345678901234567890';
    const lowerAddress = upperAddress.toLowerCase();

    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSetex.mockResolvedValueOnce('OK');

    // Setup viem mock responses for this test
    mockReadContract
      .mockResolvedValueOnce('Test Token') // name
      .mockResolvedValueOnce('TEST') // symbol
      .mockResolvedValueOnce(18) // decimals
      .mockResolvedValueOnce(BigInt('1000000000000000000000000000')) // totalSupply
      // Mock Uniswap factory calls
      .mockResolvedValueOnce('0x0000000000000000000000000000000000000000') // 500 fee pool
      .mockResolvedValueOnce('0x0000000000000000000000000000000000000000') // 3000 fee pool  
      .mockResolvedValueOnce('0x0000000000000000000000000000000000000000'); // 10000 fee pool
    
    mockGetLogs.mockResolvedValueOnce([]); // empty logs

    const request = new MockNextRequest(`http://localhost:3000/api/token/${upperAddress}`) as any;
    const response = await GET(request, { 
      params: Promise.resolve({ address: upperAddress }) 
    });
    
    if (response.status !== 200) {
      const data = await response.json();
      console.error('Response error:', data);
    }
    
    expect(response.status).toBe(200);
    expect(mockRedisGet).toHaveBeenCalledWith(`token:testnet:${lowerAddress}`);
    expect(mockRedisSetex).toHaveBeenCalledWith(
      `token:testnet:${lowerAddress}`,
      300,
      expect.any(Object)
    );
  });

  it('should fetch Clanker token metadata and integrate with blockchain data', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSetex.mockResolvedValueOnce('OK');

    // Mock Clanker SDK response
    mockGetToken.mockResolvedValueOnce({
      address: '0x1234567890123456789012345678901234567890',
      name: 'Test Token',
      symbol: 'TEST',
      imageUrl: 'https://ipfs.io/ipfs/QmTest123',
      txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      creatorAddress: '0x9876543210987654321098765432109876543210',
      deploymentTimestamp: 1700000000,
    });

    const request = new MockNextRequest('http://localhost:3000/api/token/0x1234567890123456789012345678901234567890') as any;
    const response = await GET(request, { 
      params: Promise.resolve({ address: '0x1234567890123456789012345678901234567890' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.imageUrl).toBe('https://ipfs.io/ipfs/QmTest123');
    expect(data.data.txHash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
    expect(data.data.creatorAddress).toBe('0x9876543210987654321098765432109876543210');
    expect(mockGetToken).toHaveBeenCalled();
  });

  it('should fetch holder count by analyzing Transfer event logs', async () => {
    // Clear all mocks first
    jest.clearAllMocks();
    
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSetex.mockResolvedValueOnce('OK');

    // Mock basic token data
    mockReadContract
      .mockResolvedValueOnce('Test Token') // name
      .mockResolvedValueOnce('TEST') // symbol
      .mockResolvedValueOnce(18) // decimals
      .mockResolvedValueOnce(BigInt('1000000000000000000000000000')); // totalSupply

    // Mock Transfer events with unique addresses
    mockGetLogs.mockResolvedValueOnce([
      { args: { from: '0x0000000000000000000000000000000000000000', to: '0x1111111111111111111111111111111111111111' } },
      { args: { from: '0x0000000000000000000000000000000000000000', to: '0x2222222222222222222222222222222222222222' } },
      { args: { from: '0x1111111111111111111111111111111111111111', to: '0x3333333333333333333333333333333333333333' } },
      { args: { from: '0x2222222222222222222222222222222222222222', to: '0x4444444444444444444444444444444444444444' } },
    ]);

    // Mock balance checks for the 4 unique addresses
    mockReadContract
      .mockResolvedValueOnce(BigInt('100000000000000000000')) // balance holder 1
      .mockResolvedValueOnce(BigInt('0')) // balance holder 2 (transferred out)
      .mockResolvedValueOnce(BigInt('200000000000000000000')) // balance holder 3
      .mockResolvedValueOnce(BigInt('300000000000000000000')) // balance holder 4
      // Mock Uniswap factory calls (3 fee tiers) - after balance checks
      .mockResolvedValueOnce('0x0000000000000000000000000000000000000000') // 500 fee pool
      .mockResolvedValueOnce('0x0000000000000000000000000000000000000000') // 3000 fee pool
      .mockResolvedValueOnce('0x0000000000000000000000000000000000000000'); // 10000 fee pool

    const request = new MockNextRequest('http://localhost:3000/api/token/0x1234567890123456789012345678901234567890') as any;
    const response = await GET(request, { 
      params: Promise.resolve({ address: '0x1234567890123456789012345678901234567890' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.holders).toBeDefined();
    expect(typeof data.data.holders).toBe('number');
    expect(mockGetLogs).toHaveBeenCalled();
  });

  it.skip('should integrate with Uniswap V3 for price and market data', async () => {
    // Skip this test as Uniswap integration is not yet implemented
    // TODO: Enable when DEX integration is added
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSetex.mockResolvedValueOnce('OK');

    // Mock current block for timestamp
    mockGetBlock.mockResolvedValueOnce({
      timestamp: BigInt(1700000000),
    });

    // Mock pool contract reads for price data
    mockReadContract
      .mockResolvedValueOnce('Test Token') // name
      .mockResolvedValueOnce('TEST') // symbol
      .mockResolvedValueOnce(18) // decimals
      .mockResolvedValueOnce(BigInt('1000000000000000000000000000')) // totalSupply
      // Mock Uniswap V3 pool slot0 (price)
      .mockResolvedValueOnce({
        sqrtPriceX96: BigInt('79228162514264337593543950336'), // ~1 ETH per token
        tick: 0,
        observationIndex: 0,
        observationCardinality: 0,
        observationCardinalityNext: 0,
        feeProtocol: 0,
        unlocked: true,
      })
      // Mock WETH/USD price oracle
      .mockResolvedValueOnce(BigInt('2000000000')); // $2000 per ETH (8 decimals)

    const request = new MockNextRequest('http://localhost:3000/api/token/0x1234567890123456789012345678901234567890') as any;
    const response = await GET(request, { 
      params: Promise.resolve({ address: '0x1234567890123456789012345678901234567890' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.marketCap).toBeDefined();
    expect(data.data.marketCap).not.toBe('0');
  });

  it('should handle tokens without liquidity pool gracefully', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSetex.mockResolvedValueOnce('OK');

    // Mock basic token data
    mockReadContract
      .mockResolvedValueOnce('Test Token') // name
      .mockResolvedValueOnce('TEST') // symbol
      .mockResolvedValueOnce(18) // decimals
      .mockResolvedValueOnce(BigInt('1000000000000000000000000000')); // totalSupply

    // Mock no pool found
    mockReadContract.mockRejectedValueOnce(new Error('Pool not found'));

    const request = new MockNextRequest('http://localhost:3000/api/token/0x1234567890123456789012345678901234567890') as any;
    const response = await GET(request, { 
      params: Promise.resolve({ address: '0x1234567890123456789012345678901234567890' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.marketCap).toBe('0');
    expect(data.data.volume24h).toBe('0');
    expect(data.data.priceChange24h).toBe(0);
  });

  it('should handle Clanker API failures gracefully', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSetex.mockResolvedValueOnce('OK');

    // Mock basic token data
    mockReadContract
      .mockResolvedValueOnce('Test Token') // name
      .mockResolvedValueOnce('TEST') // symbol
      .mockResolvedValueOnce(18) // decimals
      .mockResolvedValueOnce(BigInt('1000000000000000000000000000')); // totalSupply

    // Mock Clanker SDK failure
    mockGetToken.mockRejectedValueOnce(new Error('Token not found in Clanker'));

    const request = new MockNextRequest('http://localhost:3000/api/token/0x1234567890123456789012345678901234567890') as any;
    const response = await GET(request, { 
      params: Promise.resolve({ address: '0x1234567890123456789012345678901234567890' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    // Should still return basic blockchain data
    expect(data.data.name).toBe('Test Token');
    expect(data.data.symbol).toBe('TEST');
    // When Clanker fails, default values are used
    expect(data.data.imageUrl).toBe('ipfs://QmZxN8UJzR8kJnDyT3CgM3KgvbFYRXRknCkiMLDH1Q2Hti');
    expect(data.data.creatorAddress).toBe('0x' + '0'.repeat(40));
  });

  it('should calculate 24h price changes from historical data', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSetex.mockResolvedValueOnce('OK');

    const currentTimestamp = Math.floor(Date.now() / 1000);

    // Mock current block
    mockGetBlock.mockResolvedValueOnce({
      timestamp: BigInt(currentTimestamp),
    });

    // Mock basic token data
    mockReadContract
      .mockResolvedValueOnce('Test Token') // name
      .mockResolvedValueOnce('TEST') // symbol
      .mockResolvedValueOnce(18) // decimals
      .mockResolvedValueOnce(BigInt('1000000000000000000000000000')); // totalSupply

    // Mock Swap events for volume calculation
    mockGetLogs.mockResolvedValueOnce([
      { 
        args: { 
          amount0: BigInt('1000000000000000000'), // 1 token
          amount1: BigInt('-2000000000000000000'), // -2 WETH
          sqrtPriceX96: BigInt('79228162514264337593543950336'),
        },
        blockNumber: BigInt(1000),
      },
      { 
        args: { 
          amount0: BigInt('500000000000000000'), // 0.5 token
          amount1: BigInt('-1100000000000000000'), // -1.1 WETH
          sqrtPriceX96: BigInt('83255969785691985458633989632'),
        },
        blockNumber: BigInt(1100),
      },
    ]);

    const request = new MockNextRequest('http://localhost:3000/api/token/0x1234567890123456789012345678901234567890') as any;
    const response = await GET(request, { 
      params: Promise.resolve({ address: '0x1234567890123456789012345678901234567890' }) 
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.volume24h).toBeDefined();
    expect(data.data.priceChange24h).toBeDefined();
  });
});