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
  set: jest.fn(),
  expire: jest.fn(),
};

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn(() => mockRedis),
}));

jest.mock('clanker-sdk');
jest.mock('@/lib/ipfs');
jest.mock('@/lib/transaction-tracker');
jest.mock('@/lib/redis', () => ({
  storeUserToken: jest.fn().mockResolvedValue(undefined),
}));
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

describe('POST /api/deploy/simple - Wallet Requirement Feature', () => {
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
    // Wallet requirement NOT set by default
    delete process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH;

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
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.expire.mockResolvedValue(1);
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
    delete process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH;
  });

  describe('When wallet requirement is disabled', () => {
    it('should allow deployment without wallet connection', async () => {
      const fid = '12345';
      
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
      expect(mockDeployToken).toHaveBeenCalled();
    });

    it('should use deployer address when no wallet is connected', async () => {
      const fid = '12345';
      
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

      await POST(request as any);

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

  describe('When wallet requirement is enabled', () => {
    beforeEach(() => {
      process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH = 'true';
    });

    it('should reject deployment when no wallet is connected', async () => {
      const fid = '12345';
      
      // Mock no wallet connected
      mockRedis.get.mockResolvedValueOnce(null);

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

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Wallet connection required for deployment');
      expect(data.errorDetails).toEqual({
        type: 'WALLET_REQUIREMENT_ERROR',
        details: 'No wallet connected to your account',
        userMessage: 'Please connect your wallet before deploying',
      });
      expect(mockDeployToken).not.toHaveBeenCalled();
    });

    it('should reject deployment when wallet is connected but creator rewards disabled', async () => {
      const fid = '12345';
      const userWalletAddress = '0x9876543210987654321098765432109876543210';
      
      // Mock wallet connected but creator rewards disabled
      mockRedis.get.mockResolvedValueOnce({
        address: userWalletAddress,
        enableCreatorRewards: false,
        connectedAt: Date.now(),
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

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Creator rewards must be enabled when wallet is required');
      expect(data.errorDetails).toEqual({
        type: 'WALLET_REQUIREMENT_ERROR',
        details: 'Creator rewards disabled on connected wallet',
        userMessage: 'Please enable creator rewards for your wallet',
      });
      expect(mockDeployToken).not.toHaveBeenCalled();
    });

    it('should allow deployment when wallet is connected with creator rewards enabled', async () => {
      const fid = '12345';
      const userWalletAddress = '0x9876543210987654321098765432109876543210';
      
      // Mock wallet connected with creator rewards enabled
      mockRedis.get.mockResolvedValueOnce({
        address: userWalletAddress,
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

    it('should handle missing fid when wallet is required', async () => {
      // No fid provided
      const formData = new FormData();
      formData.append('name', 'Test Token');
      formData.append('symbol', 'TEST');
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

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Farcaster authentication required');
      expect(data.errorDetails).toEqual({
        type: 'FID_REQUIRED',
        message: 'Please sign in with Farcaster to deploy tokens',
      });
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(mockDeployToken).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      const fid = '12345';
      
      // Mock Redis error
      mockRedis.get.mockRejectedValueOnce(new Error('Redis connection failed'));

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

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to verify wallet connection');
      expect(data.errorDetails).toEqual({
        type: 'WALLET_CHECK_ERROR',
        message: 'Unable to verify wallet connection status',
      });
      expect(mockDeployToken).not.toHaveBeenCalled();
    });
  });

  describe('Environment variable edge cases', () => {
    it('should treat any non-true value as false for wallet requirement', async () => {
      const testValues = ['TRUE', 'True', '1', 'yes', 'required', ' true '];
      
      for (const value of testValues) {
        process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH = value;
        
        // Mock deployment success
        mockDeployToken.mockResolvedValueOnce({
          address: '0x1234567890123456789012345678901234567890',
          txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        });

        const formData = new FormData();
        formData.append('name', 'Test Token');
        formData.append('symbol', 'TEST');
        formData.append('fid', '12345');
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

        // Should allow deployment (wallet not required)
        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        
        jest.clearAllMocks();
      }
    });
  });
});