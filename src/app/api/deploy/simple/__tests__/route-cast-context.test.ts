/**
 * @jest-environment node
 */
import { POST } from '../route';
import { Clanker } from 'clanker-sdk';
import { CastContext } from '@/lib/types/cast-context';
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

jest.mock('@upstash/redis');
jest.mock('clanker-sdk');
jest.mock('@/lib/ipfs');
jest.mock('@/lib/transaction-tracker');
jest.mock('viem', () => ({
  createPublicClient: jest.fn(),
  createWalletClient: jest.fn(),
  http: jest.fn(),
  privateKeyToAccount: jest.fn(() => ({ address: '0xdeployer123' })),
}));
jest.mock('viem/chains', () => ({
  base: { id: 8453, name: 'Base' },
  baseSepolia: { id: 84532, name: 'Base Sepolia' },
}));

// Mock crypto for Node environment
if (!global.crypto) {
  global.crypto = {
    randomUUID: () => Math.random().toString(36).substring(2, 15),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// Mock Request globally
// eslint-disable-next-line @typescript-eslint/no-explicit-any
global.Request = MockNextRequest as any;

// Redis will be automatically mocked
const mockClanker = Clanker as jest.MockedClass<typeof Clanker>;
const mockUploadToIPFS = uploadToIPFS as jest.MockedFunction<typeof uploadToIPFS>;
const mockTrackTransaction = trackTransaction as jest.MockedFunction<typeof trackTransaction>;

describe('Deploy Simple Route - Cast Context Integration', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSdkInstance: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPublicClient: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockWalletClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup environment variables
    process.env.DEPLOYER_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    process.env.INTERFACE_ADMIN = '0x742d35Cc6634C0532925a3b844Bc9e7595f00000';
    process.env.INTERFACE_REWARD_RECIPIENT = '0x742d35Cc6634C0532925a3b844Bc9e7595f00000';
    process.env.CREATOR_ADMIN = '0x742d35Cc6634C0532925a3b844Bc9e7595f00001';
    process.env.KV_REST_API_URL = 'https://redis.test';
    process.env.KV_REST_API_TOKEN = 'test-token';
    
    // Setup viem mocks
    mockPublicClient = {
      getBlock: jest.fn().mockResolvedValue({ number: BigInt(123456) }),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({
        status: 'success',
        contractAddress: '0xabc123',
      }),
    };
    
    mockWalletClient = {};
    
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createPublicClient, createWalletClient } = require('viem');
    createPublicClient.mockReturnValue(mockPublicClient);
    createWalletClient.mockReturnValue(mockWalletClient);
    
    // The Redis mock will be automatically used from __mocks__/@upstash/redis.ts

    mockSdkInstance = {
      deployToken: jest.fn(),
    };
    mockClanker.mockImplementation(() => mockSdkInstance);
    
    // Mock other dependencies
    mockUploadToIPFS.mockResolvedValue('data:image/png;base64,test-base64-data');
    mockTrackTransaction.mockResolvedValue(undefined);
  });

  describe('Cast Context Handling', () => {
    it('should accept and process cast context in deployment', async () => {
      const castContext: CastContext = {
        type: 'cast',
        castId: '0x1234567890abcdef',
        parentCastId: '0x0987654321fedcba',
        author: {
          fid: 123,
          username: 'testuser',
          displayName: 'Test User',
          pfpUrl: 'https://example.com/pfp.png'
        },
        embedUrl: 'https://example.com/frame'
      };

      const formData = new FormData();
      formData.append('name', 'Test Token');
      formData.append('symbol', 'TEST');
      formData.append('image', new Blob(['test-image'], { type: 'image/png' }), 'test.png');
      formData.append('castContext', JSON.stringify(castContext));

      mockSdkInstance.deployToken.mockResolvedValue('0xabc123');

      const request = new MockNextRequest('http://localhost/api/deploy/simple', {
        method: 'POST',
        body: formData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      const response = await POST(request);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockSdkInstance.deployToken).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Token',
          symbol: 'TEST',
          image: expect.stringContaining('data:image/png;base64,'),
          context: {
            interface: 'Clanker Tools',
            platform: 'Farcaster',
            messageId: '0x1234567890abcdef',
            id: '0x0987654321fedcba',
          }
        })
      );
    });

    it('should deploy with cast context and return success', async () => {
      const castContext: CastContext = {
        type: 'cast',
        castId: '0x1234567890abcdef',
        author: {
          fid: 123,
          username: 'testuser',
          displayName: 'Test User'
        }
      };

      const formData = new FormData();
      formData.append('name', 'Test Token');
      formData.append('symbol', 'TEST');
      formData.append('image', new Blob(['test-image'], { type: 'image/png' }), 'test.png');
      formData.append('castContext', JSON.stringify(castContext));

      mockSdkInstance.deployToken.mockResolvedValue('0xabc123');

      const request = new MockNextRequest('http://localhost/api/deploy/simple', {
        method: 'POST',
        body: formData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tokenAddress).toBe('0xabc123');
    });

    it('should handle deployment without cast context', async () => {
      const formData = new FormData();
      formData.append('name', 'Test Token');
      formData.append('symbol', 'TEST');
      formData.append('image', new Blob(['test-image'], { type: 'image/png' }), 'test.png');

      mockSdkInstance.deployToken.mockResolvedValue('0xabc123');

      const request = new MockNextRequest('http://localhost/api/deploy/simple', {
        method: 'POST',
        body: formData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      const response = await POST(request);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockSdkInstance.deployToken).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Token',
          symbol: 'TEST',
          image: expect.stringContaining('data:image/png;base64,'),
          context: undefined
        })
      );
    });

    it('should handle invalid cast context JSON', async () => {
      const formData = new FormData();
      formData.append('name', 'Test Token');
      formData.append('symbol', 'TEST');
      formData.append('image', new Blob(['test-image'], { type: 'image/png' }), 'test.png');
      formData.append('castContext', 'invalid-json');

      const request = new MockNextRequest('http://localhost/api/deploy/simple', {
        method: 'POST',
        body: formData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid cast context');
    });

    it('should validate cast context type', async () => {
      const invalidContext = {
        type: 'invalid',
        someField: 'value'
      };

      const formData = new FormData();
      formData.append('name', 'Test Token');
      formData.append('symbol', 'TEST');
      formData.append('image', new Blob(['test-image'], { type: 'image/png' }), 'test.png');
      formData.append('castContext', JSON.stringify(invalidContext));

      const request = new MockNextRequest('http://localhost/api/deploy/simple', {
        method: 'POST',
        body: formData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid cast context type');
    });

    it('should handle non-cast context types gracefully', async () => {
      const notificationContext = {
        type: 'notification'
      };

      const formData = new FormData();
      formData.append('name', 'Test Token');
      formData.append('symbol', 'TEST');
      formData.append('image', new Blob(['test-image'], { type: 'image/png' }), 'test.png');
      formData.append('castContext', JSON.stringify(notificationContext));

      mockSdkInstance.deployToken.mockResolvedValue('0xabc123');

      const request = new MockNextRequest('http://localhost/api/deploy/simple', {
        method: 'POST',
        body: formData,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      const response = await POST(request);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockSdkInstance.deployToken).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Token',
          symbol: 'TEST',
          image: expect.stringContaining('data:image/png;base64,'),
          context: undefined
        })
      );
    });
  });
});