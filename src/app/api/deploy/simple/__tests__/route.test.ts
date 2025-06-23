/**
 * @jest-environment node
 */
// Mock NextResponse for Edge runtime  
jest.mock('next/server', () => {
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
  
  // Mock NextResponse class
  class MockNextResponse extends Response {
    constructor(body?: BodyInit | null, init?: ResponseInit) {
      super(body, init);
      // Copy headers from init to response
      if (init?.headers) {
        const headers = new Headers(init.headers as HeadersInit);
        headers.forEach((value, key) => {
          this.headers.set(key, value);
        });
      }
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static json(data: any, init?: ResponseInit) {
      const response = new Response(JSON.stringify(data), init);
      // Copy headers from init to response
      if (init?.headers) {
        const headers = new Headers(init.headers as HeadersInit);
        headers.forEach((value, key) => {
          response.headers.set(key, value);
        });
      }
      return response;
    }
  }
  
  return {
    NextRequest: MockNextRequest,
    NextResponse: MockNextResponse
  };
});

import { POST, OPTIONS } from '../route';
import { Clanker } from 'clanker-sdk';
import { uploadToIPFS } from '@/lib/ipfs';
import { trackTransaction } from '@/lib/transaction-tracker';

// Mock NextRequest - for use in tests
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
    address: '0xtest...',
  }),
}));
jest.mock('viem/chains', () => ({
  base: {},
}));

// Mock the Headers class for Edge runtime
global.Headers = class Headers {
  private headers: Map<string, string> = new Map();
  
  constructor(init?: HeadersInit) {
    if (init) {
      if (init instanceof Headers) {
        init.forEach((value, key) => this.headers.set(key, value));
      } else if (Array.isArray(init)) {
        init.forEach(([key, value]) => this.headers.set(key, value));
      } else {
        Object.entries(init).forEach(([key, value]) => this.headers.set(key, value));
      }
    }
  }
  
  get(key: string) {
    return this.headers.get(key) || null;
  }
  
  set(key: string, value: string) {
    this.headers.set(key, value);
  }
  
  forEach(callback: (value: string, key: string) => void) {
    this.headers.forEach((value, key) => callback(value, key));
  }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

describe('POST /api/deploy/simple', () => {
  const mockDeployToken = jest.fn();
  const mockUploadToIPFS = uploadToIPFS as jest.MockedFunction<typeof uploadToIPFS>;
  const mockTrackTransaction = trackTransaction as jest.MockedFunction<typeof trackTransaction>;
  const mockWaitForTransactionReceipt = jest.fn();
  const mockSendTransaction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (Clanker as jest.Mock).mockImplementation(() => ({
      deployToken: mockDeployToken,
    }));
    process.env.DEPLOYER_PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001';
    process.env.INTERFACE_ADMIN = '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace';
    process.env.INTERFACE_REWARD_RECIPIENT = '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,https://example.com';
    process.env.INITIAL_MARKET_CAP = '0.1';
    process.env.CREATOR_REWARD = '80';
    
    // Mock viem clients
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
  });

  afterEach(() => {
    delete process.env.DEPLOYER_PRIVATE_KEY;
    delete process.env.INTERFACE_ADMIN;
    delete process.env.INTERFACE_REWARD_RECIPIENT;
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.INITIAL_MARKET_CAP;
    delete process.env.CREATOR_REWARD;
  });

  it('should deploy a token successfully with real transaction hash', async () => {
    const mockTokenAddress = '0x1234567890123456789012345678901234567890';
    const mockImageUrl = 'ipfs://QmTest123';
    const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const mockTransactionReceipt = { 
      transactionHash: mockTxHash, 
      status: 'success',
      blockNumber: BigInt(12345),
      contractAddress: mockTokenAddress
    };

    mockUploadToIPFS.mockResolvedValue(mockImageUrl);
    mockDeployToken.mockResolvedValue({ 
      address: mockTokenAddress,
      txHash: mockTxHash 
    });
    mockWaitForTransactionReceipt.mockResolvedValue(mockTransactionReceipt);
    mockTrackTransaction.mockResolvedValue(undefined);

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'http://localhost:3000',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      tokenAddress: mockTokenAddress,
      txHash: mockTxHash,
      imageUrl: mockImageUrl,
      network: 'Base Sepolia',
      chainId: 84532,
    });

    // Check CORS headers
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');

    expect(mockUploadToIPFS).toHaveBeenCalledWith(expect.any(Blob));
    expect(mockDeployToken).toHaveBeenCalledWith({
      name: 'Test Token',
      symbol: 'TEST',
      image: mockImageUrl,
      pool: {
        quoteToken: '0x4200000000000000000000000000000000000006',
        initialMarketCap: '0.1',
      },
      rewardsConfig: {
        creatorReward: 80,
        creatorAdmin: '0xtest...',
        creatorRewardRecipient: '0xtest...',
        interfaceAdmin: '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace',
        interfaceRewardRecipient: '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace',
      },
    });
    expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith({ 
      hash: mockTxHash,
      confirmations: 1 
    });
    expect(mockTrackTransaction).toHaveBeenCalledWith(
      mockTxHash,
      {
        type: 'token_deployment',
        tokenAddress: mockTokenAddress,
        name: 'Test Token',
        symbol: 'TEST',
      }
    );
  });

  it('should handle missing required fields', async () => {
    const formData = new FormData();
    formData.append('name', 'Test Token');
    // Missing symbol and image

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'http://localhost:3000',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Missing required fields: symbol, image');
    expect(data.errorDetails).toBeDefined();
    expect(data.errorDetails.type).toBe('VALIDATION_ERROR');
    expect(data.debugInfo).toBeDefined();

    expect(mockUploadToIPFS).not.toHaveBeenCalled();
    expect(mockDeployToken).not.toHaveBeenCalled();
  });

  it('should handle missing environment variables', async () => {
    delete process.env.DEPLOYER_PRIVATE_KEY;

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'http://localhost:3000',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    await response.json();

    expect(response.status).toBe(500);
  });

  it('should handle IPFS upload failure', async () => {
    mockUploadToIPFS.mockRejectedValue(new Error('IPFS upload failed: 500 Internal Server Error'));

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'http://localhost:3000',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Image upload service temporarily unavailable. Please try again.');

    expect(mockDeployToken).not.toHaveBeenCalled();
  });

  it.skip('should handle deployment failure with retry', async () => {
    const mockImageUrl = 'ipfs://QmTest123';
    mockUploadToIPFS.mockResolvedValue(mockImageUrl);
    
    // First attempt fails, second succeeds
    mockDeployToken
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce('0x1234567890123456789012345678901234567890');

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'http://localhost:3000',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    await response.json();

    expect(response.status).toBe(200);
    expect(mockDeployToken).toHaveBeenCalledTimes(2);
  });

  it.skip('should fail after maximum retry attempts', async () => {
    const mockImageUrl = 'ipfs://QmTest123';
    mockUploadToIPFS.mockResolvedValue(mockImageUrl);
    
    // All attempts fail
    mockDeployToken.mockRejectedValue(new Error('Network error'));

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'http://localhost:3000',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      success: false,
      error: 'Token deployment failed after 3 attempts',
    });

    expect(mockDeployToken).toHaveBeenCalledTimes(3);
  });

  it('should validate token name length', async () => {
    const formData = new FormData();
    formData.append('name', 'A'.repeat(33)); // Too long
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'http://localhost:3000',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Token name must be 32 characters or less');
    expect(data.errorDetails).toBeDefined();
    expect(data.errorDetails.type).toBe('VALIDATION_ERROR');
    expect(data.debugInfo).toBeDefined();
    expect(data.debugInfo.nameLength).toBe(33);
  });

  it('should validate symbol length and format', async () => {
    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TOOLONGSYMBOL'); // Too long
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'http://localhost:3000',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Symbol must be between 3 and 8 characters');
    expect(data.errorDetails).toBeDefined();
    expect(data.errorDetails.type).toBe('VALIDATION_ERROR');
    expect(data.debugInfo).toBeDefined();
    expect(data.debugInfo.symbolLength).toBe(13);
  });

  it('should handle non-POST requests', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'GET',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(405);
    expect(data).toEqual({
      success: false,
      error: 'Method not allowed',
    });
  });

  it('should handle OPTIONS request for CORS preflight', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
    expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
  });

  it.skip('should reject CORS requests from unauthorized origins', async () => {
    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'Origin': 'https://malicious.com',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it.skip('should preserve SDK error details', async () => {
    const mockImageUrl = 'ipfs://QmTest123';
    const sdkError = new Error('Insufficient funds for gas * price + value');
    sdkError.name = 'InsufficientFundsError';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sdkError as any).code = 'INSUFFICIENT_FUNDS';
    
    mockUploadToIPFS.mockResolvedValue(mockImageUrl);
    mockDeployToken.mockRejectedValue(sdkError);

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'http://localhost:3000',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      success: false,
      error: 'Token deployment failed: Insufficient funds for gas * price + value',
      errorCode: 'INSUFFICIENT_FUNDS',
      errorType: 'InsufficientFundsError',
    });
  });

  it('should use configurable pool values from environment', async () => {
    // Set custom pool configuration
    process.env.INITIAL_MARKET_CAP = '0.5';
    process.env.CREATOR_REWARD = '90';
    
    const mockTokenAddress = '0x1234567890123456789012345678901234567890';
    const mockImageUrl = 'ipfs://QmTest123';
    const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    mockUploadToIPFS.mockResolvedValue(mockImageUrl);
    mockDeployToken.mockResolvedValue({ 
      address: mockTokenAddress,
      txHash: mockTxHash 
    });
    mockWaitForTransactionReceipt.mockResolvedValue({ 
      transactionHash: mockTxHash, 
      status: 'success' 
    });

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'http://localhost:3000',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    await POST(request);

    expect(mockDeployToken).toHaveBeenCalledWith(
      expect.objectContaining({
        pool: {
          quoteToken: '0x4200000000000000000000000000000000000006',
          initialMarketCap: '0.5', // Custom value
        },
        rewardsConfig: expect.objectContaining({
          creatorReward: 90, // Custom value
        }),
      })
    );
  });

  it.skip('should verify transaction on blockchain before returning success', async () => {
    const mockTokenAddress = '0x1234567890123456789012345678901234567890';
    const mockImageUrl = 'ipfs://QmTest123';
    const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    mockUploadToIPFS.mockResolvedValue(mockImageUrl);
    mockDeployToken.mockResolvedValue({ 
      address: mockTokenAddress,
      txHash: mockTxHash 
    });
    
    // Simulate transaction failure
    mockWaitForTransactionReceipt.mockResolvedValue({ 
      transactionHash: mockTxHash, 
      status: 'reverted' 
    });

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));

    const request = new MockNextRequest('http://localhost:3000/api/deploy/simple', {
      method: 'POST',
      body: formData,
      headers: {
        'origin': 'http://localhost:3000',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      success: false,
      error: 'Transaction failed on blockchain',
      txHash: mockTxHash,
    });
  });
});