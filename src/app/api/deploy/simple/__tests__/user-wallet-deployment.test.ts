/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { POST } from '../route';
import { Clanker } from 'clanker-sdk';
import { uploadToIPFS } from '@/lib/ipfs';
import { trackTransaction } from '@/lib/transaction-tracker';

// Mock NextRequest
class MockNextRequest {
  method: string;
  body: FormData;
  headers: Headers;
  
  constructor(url: string, init: RequestInit) {
    this.method = init.method || 'GET';
    this.body = init.body as FormData;
    this.headers = new Headers(init.headers as HeadersInit);
  }
  
  async formData() {
    return this.body;
  }
}

// Mock Redis at the module level
const mockRedis = {
  get: jest.fn(),
};

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn(() => mockRedis),
}));

jest.mock('clanker-sdk');
jest.mock('@/lib/ipfs');
jest.mock('@/lib/transaction-tracker');
jest.mock('viem', () => ({
  createPublicClient: jest.fn(),
  createWalletClient: jest.fn(),
  http: jest.fn(),
}));
jest.mock('viem/accounts', () => ({
  privateKeyToAccount: jest.fn().mockReturnValue({
    address: '0x1234567890123456789012345678901234567890',
  }),
}));
jest.mock('viem/chains', () => ({
  base: {},
  baseSepolia: {},
}));

describe('POST /api/deploy/simple - User Wallet Deployment', () => {
  const mockDeployToken = jest.fn();
  const mockUploadToIPFS = uploadToIPFS as jest.MockedFunction<typeof uploadToIPFS>;
  const mockTrackTransaction = trackTransaction as jest.MockedFunction<typeof trackTransaction>;
  const mockWaitForTransactionReceipt = jest.fn();
  const mockSendTransaction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Clanker instance
    (Clanker as jest.MockedClass<typeof Clanker>).mockImplementation(() => ({
      deployToken: mockDeployToken,
    } as any));

    // Mock environment variables
    process.env.DEPLOYER_PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001';
    process.env.INTERFACE_ADMIN = '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace';
    process.env.INTERFACE_REWARD_RECIPIENT = '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace';
    process.env.CREATOR_REWARD = '80';
    process.env.INITIAL_MARKET_CAP = '0.1';
    process.env.KV_REST_API_URL = 'test-url';
    process.env.KV_REST_API_TOKEN = 'test-token';
    process.env.CHAIN = 'base';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,https://example.com';

    // Mock IPFS upload
    mockUploadToIPFS.mockResolvedValue('ipfs://QmTestHash');

    // Mock transaction tracking
    mockTrackTransaction.mockResolvedValue(undefined);

    // Mock viem clients
    mockWaitForTransactionReceipt.mockResolvedValue({
      transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      status: 'success',
      blockNumber: BigInt(12345),
      contractAddress: '0x1234567890123456789012345678901234567890'
    });
    mockSendTransaction.mockResolvedValue('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
    
    const mockPublicClient = {
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    };
    const mockWalletClient = {
      sendTransaction: mockSendTransaction,
    };
    
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const viem = require('viem');
    viem.createPublicClient.mockReturnValue(mockPublicClient);
    viem.createWalletClient.mockReturnValue(mockWalletClient);

    // Mock Redis (wallet not connected by default)
    mockRedis.get.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.DEPLOYER_PRIVATE_KEY;
    delete process.env.INTERFACE_ADMIN;
    delete process.env.INTERFACE_REWARD_RECIPIENT;
    delete process.env.CREATOR_REWARD;
    delete process.env.INITIAL_MARKET_CAP;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.CHAIN;
  });

  it('should deploy token with user wallet address when connected', async () => {
    const userWalletAddress = '0x1234567890123456789012345678901234567890';
    const fid = '12345';
    
    // Mock wallet data in Redis
    mockRedis.get.mockResolvedValueOnce({
      walletAddress: userWalletAddress,
      enableCreatorRewards: true,
      connectedAt: Date.now(),
    });

    // Mock deployment success
    mockDeployToken.mockResolvedValueOnce({
      address: '0x1234567890123456789012345678901234567890',
      txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    });

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('fid', fid);
    formData.append('image', new Blob(['test'], { type: 'image/png' }), 'test.png');

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'Origin': 'http://localhost:3000',
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    
    // Verify Redis was called to get wallet data
    expect(mockRedis.get).toHaveBeenCalledWith(`wallet:${fid}`);
    
    // Verify deployment was called with user's wallet address
    expect(mockDeployToken).toHaveBeenCalledWith(
      expect.objectContaining({
        rewardsConfig: expect.objectContaining({
          creatorAdmin: userWalletAddress,
          creatorRewardRecipient: userWalletAddress,
        }),
      })
    );
  });

  it('should use deployer address when user has not connected wallet', async () => {
    const fid = '12345';
    
    // Mock wallet data not found in Redis
    mockRedis.get.mockResolvedValueOnce(null);

    // Mock deployment success
    mockDeployToken.mockResolvedValueOnce({
      address: '0x1234567890123456789012345678901234567890',
      txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    });

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('fid', fid);
    formData.append('image', new Blob(['test'], { type: 'image/png' }), 'test.png');

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'Origin': 'http://localhost:3000',
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    
    // Verify Redis was called to get wallet data
    expect(mockRedis.get).toHaveBeenCalledWith(`wallet:${fid}`);
    
    // Verify deployment was called with deployer's address
    expect(mockDeployToken).toHaveBeenCalledWith(
      expect.objectContaining({
        rewardsConfig: expect.objectContaining({
          creatorAdmin: '0x1234567890123456789012345678901234567890',
          creatorRewardRecipient: '0x1234567890123456789012345678901234567890',
        }),
      })
    );
  });

  it('should respect enableCreatorRewards preference when false', async () => {
    const userWalletAddress = '0x1234567890123456789012345678901234567890';
    const fid = '12345';
    
    // Mock wallet data with enableCreatorRewards = false
    mockRedis.get.mockResolvedValueOnce({
      address: userWalletAddress,
      enableCreatorRewards: false,
      connectedAt: Date.now(),
    });

    // Mock deployment success
    mockDeployToken.mockResolvedValueOnce({
      address: '0x1234567890123456789012345678901234567890',
      txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    });

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('fid', fid);
    formData.append('image', new Blob(['test'], { type: 'image/png' }), 'test.png');

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'Origin': 'http://localhost:3000',
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    
    // Verify deployment was called with deployer's address (not user's)
    expect(mockDeployToken).toHaveBeenCalledWith(
      expect.objectContaining({
        rewardsConfig: expect.objectContaining({
          creatorAdmin: '0x1234567890123456789012345678901234567890',
          creatorRewardRecipient: '0x1234567890123456789012345678901234567890',
        }),
      })
    );
  });

  it('should handle missing fid gracefully', async () => {
    // Mock deployment success
    mockDeployToken.mockResolvedValueOnce({
      address: '0x1234567890123456789012345678901234567890',
      txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    });

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    // No fid provided
    formData.append('image', new Blob(['test'], { type: 'image/png' }), 'test.png');

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'Origin': 'http://localhost:3000',
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    
    // Verify Redis was not called
    expect(mockRedis.get).not.toHaveBeenCalled();
    
    // Verify deployment was called with deployer's address
    expect(mockDeployToken).toHaveBeenCalledWith(
      expect.objectContaining({
        rewardsConfig: expect.objectContaining({
          creatorAdmin: '0x1234567890123456789012345678901234567890',
          creatorRewardRecipient: '0x1234567890123456789012345678901234567890',
        }),
      })
    );
  });

  it('should handle Redis errors gracefully', async () => {
    const fid = '12345';
    
    // Mock Redis error
    mockRedis.get.mockRejectedValueOnce(new Error('Redis connection failed'));

    // Mock deployment success
    mockDeployToken.mockResolvedValueOnce({
      address: '0x1234567890123456789012345678901234567890',
      txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    });

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('fid', fid);
    formData.append('image', new Blob(['test'], { type: 'image/png' }), 'test.png');

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'Origin': 'http://localhost:3000',
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    
    // Verify deployment proceeded with deployer's address
    expect(mockDeployToken).toHaveBeenCalledWith(
      expect.objectContaining({
        rewardsConfig: expect.objectContaining({
          creatorAdmin: '0x1234567890123456789012345678901234567890',
          creatorRewardRecipient: '0x1234567890123456789012345678901234567890',
        }),
      })
    );
  });
});