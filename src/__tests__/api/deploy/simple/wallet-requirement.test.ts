/**
 * @jest-environment node
 */
import { POST } from '@/app/api/deploy/simple/route';
import { Clanker } from 'clanker-sdk';

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn(() => mockRedis),
}));

jest.mock('clanker-sdk');
jest.mock('@/lib/ipfs', () => ({
  uploadToIPFS: jest.fn().mockResolvedValue('ipfs://test-hash'),
}));
jest.mock('@/lib/transaction-tracker', () => ({
  trackTransaction: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/lib/redis', () => ({
  storeUserToken: jest.fn().mockResolvedValue(undefined),
}));

// Mock viem
jest.mock('viem', () => ({
  createPublicClient: jest.fn(() => ({
    waitForTransactionReceipt: jest.fn().mockResolvedValue({
      status: 'success',
      blockNumber: 12345n,
      blockHash: '0xblockhash',
      transactionHash: '0xabc1234567890123456789012345678901234567890123456789012345678901',
    }),
  })),
  createWalletClient: jest.fn(),
  http: jest.fn(),
}));

jest.mock('viem/chains', () => ({
  base: { id: 8453 },
  baseSepolia: { id: 84532 },
}));

jest.mock('viem/accounts', () => ({
  privateKeyToAccount: jest.fn(() => ({
    address: '0xdeployer123456789012345678901234567890'
  })),
}));

jest.mock('@/lib/network-config', () => ({
  getNetworkConfig: jest.fn(() => ({
    isMainnet: false,
    rpcUrl: 'https://test-rpc.com',
    apiKey: 'test-key',
  })),
}));

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  expire: jest.fn()
};

const mockClanker = {
  deployToken: jest.fn()
};

(Clanker as jest.MockedClass<typeof Clanker>).mockImplementation(() => mockClanker as unknown as Clanker);

// Mock NextRequest class
class MockNextRequest {
  method: string;
  body: unknown;
  headers: Headers;
  url: string;
  
  constructor(url: string, init: RequestInit) {
    this.url = url;
    this.method = init.method || 'GET';
    this.body = init.body;
    this.headers = new Headers(init.headers as HeadersInit);
  }
  
  async json() {
    return JSON.parse(this.body as string);
  }
  
  async formData() {
    const data = JSON.parse(this.body as string);
    const formData = {
      get: (key: string) => {
        if (key === 'image' && data[key]) {
          // Return a Blob-like object for image
          return data[key];
        }
        return data[key];
      },
      getAll: (key: string) => [data[key]],
      has: (key: string) => key in data,
      append: jest.fn(),
      delete: jest.fn(),
      set: jest.fn(),
      forEach: jest.fn(),
      entries: jest.fn(),
      keys: jest.fn(),
      values: jest.fn(),
      [Symbol.iterator]: jest.fn()
    };
    return formData;
  }
}

describe('POST /api/deploy/simple - Wallet Requirement', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.CLANKER_API_KEY = 'test-api-key';
    process.env.NEXT_PUBLIC_NETWORK = 'base-sepolia';
    process.env.KV_REST_API_URL = 'https://test-redis.com';
    process.env.KV_REST_API_TOKEN = 'test-token';
    process.env.DEPLOYER_PRIVATE_KEY = '0x1234567890123456789012345678901234567890123456789012345678901234';
    process.env.INTERFACE_ADMIN = '0xadmin123456789012345678901234567890';
    process.env.INTERFACE_REWARD_RECIPIENT = '0xreward123456789012345678901234567890';
    process.env.DEPLOYMENT_MAX_RETRIES = '1';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createRequest = (body: unknown) => {
    // Add default values for required fields
    const formData = {
      name: 'Test Token',
      ticker: 'TEST',
      symbol: 'TEST',
      image: {
        type: 'image/png',
        size: 1000,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        slice: () => new Blob(['test']),
        stream: () => new ReadableStream(),
        text: () => Promise.resolve('test')
      },
      ...body
    };
    
    return new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    }) as Parameters<typeof POST>[0];
  };

  it('should reject deployment when wallet is required but not connected', async () => {
    process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH = 'true';
    mockRedis.get.mockResolvedValue(null);

    const request = createRequest({
      name: 'Test Token',
      ticker: 'TEST',
      fid: '123'
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Wallet connection required for deployment');
    expect(mockClanker.deployToken).not.toHaveBeenCalled();
  });

  it('should reject deployment when wallet is connected but creator rewards disabled', async () => {
    process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH = 'true';
    mockRedis.get.mockResolvedValue({
      address: '0x1234567890123456789012345678901234567890',
      network: 'base-sepolia',
      enableCreatorRewards: false
    });

    const request = createRequest({
      name: 'Test Token',
      ticker: 'TEST',
      fid: '123'
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Creator rewards must be enabled when wallet is required');
    expect(mockClanker.deployToken).not.toHaveBeenCalled();
  });

  it('should require FID when wallet requirement is enabled', async () => {
    process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH = 'true';

    const request = createRequest({
      name: 'Test Token',
      ticker: 'TEST'
      // Missing FID
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Farcaster authentication required');
    expect(mockClanker.deployToken).not.toHaveBeenCalled();
  });

  it('should handle Redis errors gracefully', async () => {
    process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH = 'true';
    mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

    const request = createRequest({
      name: 'Test Token',
      ticker: 'TEST',
      fid: '123'
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to verify wallet connection');
  });

  it('should allow deployment when wallet is properly connected with creator rewards', async () => {
    process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH = 'true';
    const walletAddress = '0x1234567890123456789012345678901234567890';
    
    mockRedis.get.mockResolvedValue({
      address: walletAddress,
      network: 'base-sepolia',
      enableCreatorRewards: true
    });

    mockClanker.deployToken.mockResolvedValue({
      transactionHash: '0xabc1234567890123456789012345678901234567890123456789012345678901',
      tokenAddress: '0xdef456',
      name: 'Test Token',
      symbol: 'TEST',
      decimals: 18,
      totalSupply: '1000000000000000000',
      pool: '0x789abc'
    });

    const request = createRequest({
      name: 'Test Token',
      ticker: 'TEST',
      fid: '123'
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockClanker.deployToken).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Token',
        symbol: 'TEST',
        rewardsConfig: expect.objectContaining({
          creatorAdmin: walletAddress,
          creatorRewardRecipient: walletAddress
        })
      })
    );
  });

  it('should not require wallet when feature is disabled', async () => {
    process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH = 'false';
    mockRedis.get.mockResolvedValue(null);

    mockClanker.deployToken.mockResolvedValue({
      transactionHash: '0xabc1234567890123456789012345678901234567890123456789012345678901',
      tokenAddress: '0xdef456',
      name: 'Test Token',
      symbol: 'TEST',
      decimals: 18,
      totalSupply: '1000000000000000000',
      pool: '0x789abc'
    });

    const request = createRequest({
      name: 'Test Token',
      ticker: 'TEST',
      fid: '123'
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});