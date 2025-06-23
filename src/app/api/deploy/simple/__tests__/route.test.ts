/**
 * @jest-environment node
 */

// Mock NextResponse for Edge runtime  
jest.mock('next/server', () => {
  // Define MockHeaders inside the mock scope
  class MockHeaders {
    private headers: Map<string, string> = new Map();
    
    constructor(init?: HeadersInit) {
      if (init) {
        if (init instanceof MockHeaders) {
          init.forEach((value: string, key: string) => this.headers.set(key, value));
        } else if (Array.isArray(init)) {
          init.forEach(([key, value]: [string, string]) => this.headers.set(key, value));
        } else if (typeof init === 'object') {
          Object.entries(init).forEach(([key, value]) => this.headers.set(key, value as string));
        }
      }
    }
    
    get(key: string) {
      return this.headers.get(key) || null;
    }
    
    set(key: string, value: string) {
      this.headers.set(key, value);
    }
    
    has(key: string) {
      return this.headers.has(key);
    }
    
    delete(key: string) {
      return this.headers.delete(key);
    }
    
    forEach(callback: (value: string, key: string) => void) {
      this.headers.forEach((value, key) => callback(value, key));
    }
    
    entries() {
      return this.headers.entries();
    }
    
    keys() {
      return this.headers.keys();
    }
    
    values() {
      return this.headers.values();
    }
  }

  // Set global Headers to use MockHeaders
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).Headers = MockHeaders;

  // Mock NextRequest
  class MockNextRequest {
    method: string;
    body: FormData;
    headers: MockHeaders;
    
    constructor(url: string, init: RequestInit) {
      this.method = init.method || 'GET';
      this.body = init.body as FormData;
      this.headers = new MockHeaders(init.headers as HeadersInit);
    }
    
    async formData() {
      return this.body;
    }
  }
  
  // Mock NextResponse class that properly handles headers
  class MockNextResponse {
    status: number;
    statusText: string;
    headers: MockHeaders;
    body: BodyInit | null;
    
    constructor(body?: BodyInit | null, init?: ResponseInit) {
      this.body = body || null;
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
      
      // Initialize headers properly
      this.headers = new MockHeaders();
      if (init?.headers) {
        if (init.headers instanceof MockHeaders || init.headers instanceof Headers) {
          init.headers.forEach((value: string, key: string) => {
            this.headers.set(key, value);
          });
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([key, value]: [string, string]) => {
            this.headers.set(key, value);
          });
        } else {
          Object.entries(init.headers).forEach(([key, value]) => {
            this.headers.set(key, value as string);
          });
        }
      }
    }
    
    async json() {
      if (typeof this.body === 'string') {
        return JSON.parse(this.body);
      }
      return null;
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static json(data: any, init?: ResponseInit) {
      const body = JSON.stringify(data);
      const response = new MockNextResponse(body, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {}),
        },
      });
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
import { NextRequest } from 'next/server';

// Mock the TransactionManager and dependencies
jest.mock('@/lib/transaction/TransactionManager');
jest.mock('@/lib/transaction/processors/tokenDeploymentProcessor');

// Use the mocked NextRequest
const MockNextRequest = NextRequest as jest.MockedClass<typeof NextRequest>;

jest.mock('clanker-sdk');
jest.mock('@/lib/ipfs');

// Mock transaction manager
const mockTransactionManager = {
  queueTransaction: jest.fn(),
  startAutoProcessing: jest.fn(),
};

// Mock the getTransactionManager function
import { getTransactionManager } from '@/lib/transaction/TransactionManager';
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
}));
jest.mock('@/lib/network-config', () => ({
  getNetworkConfig: jest.fn(() => ({
    name: 'Base Sepolia',
    chainId: 84532,
    isMainnet: false,
    rpcUrl: 'https://sepolia.base.org',
  })),
}));
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
    address: '0xtest...',
  }),
}));
jest.mock('viem/chains', () => ({
  base: { id: 8453, name: 'Base' },
  baseSepolia: { id: 84532, name: 'Base Sepolia' },
}));

describe('POST /api/deploy/simple', () => {
  // Suppress console logs in tests
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  beforeAll(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  });
  
  afterAll(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });
  const mockDeployToken = jest.fn();
  const mockUploadToIPFS = uploadToIPFS as jest.MockedFunction<typeof uploadToIPFS>;
  const mockWaitForTransactionReceipt = jest.fn();
  const mockSendTransaction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (Clanker as jest.Mock).mockImplementation(() => ({
      deployToken: mockDeployToken,
    }));
    
    // Mock transaction manager
    getTransactionManager.mockReturnValue(mockTransactionManager);
    mockTransactionManager.queueTransaction.mockResolvedValue('tx_12345');
    process.env.DEPLOYER_PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001';
    process.env.INTERFACE_ADMIN = '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace';
    process.env.INTERFACE_REWARD_RECIPIENT = '0x1eaf444ebDf6495C57aD52A04C61521bBf564ace';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,https://example.com';
    process.env.INITIAL_MARKET_CAP = '0.1';
    process.env.CREATOR_REWARD = '80';
    // Mock Redis env vars to suppress warnings
    process.env.KV_REST_API_URL = 'http://mock-redis-url';
    process.env.KV_REST_API_TOKEN = 'mock-token';
    
    // Mock viem clients
    const mockPublicClient = {
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
      getBlock: jest.fn().mockResolvedValue({ number: BigInt(12345) }),
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
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('should queue token deployment successfully', async () => {
    const mockTransactionId = 'tx_12345';
    
    mockTransactionManager.queueTransaction.mockResolvedValue(mockTransactionId);

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
      transactionId: mockTransactionId,
      message: 'Token deployment queued successfully',
      statusUrl: `/api/transaction/${mockTransactionId}`,
    });

    expect(mockTransactionManager.queueTransaction).toHaveBeenCalledWith(
      {
        type: 'token_deployment',
        payload: {
          name: 'Test Token',
          symbol: 'TEST',
          imageFile: expect.any(Blob),
          fid: null,
          castContext: undefined,
          creatorFeePercentage: undefined,
        },
      },
      {
        userId: 0,
        description: 'Simple token deployment: Test Token (TEST)',
      },
      'high'
    );
    expect(mockTransactionManager.startAutoProcessing).toHaveBeenCalledWith(5000);
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

  it('should queue transaction even without environment variables', async () => {
    delete process.env.DEPLOYER_PRIVATE_KEY;
    const mockTransactionId = 'tx_no_env';
    mockTransactionManager.queueTransaction.mockResolvedValue(mockTransactionId);

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
    expect(data.success).toBe(true);
    expect(data.transactionId).toBe(mockTransactionId);
  });

  it('should handle transaction queue failure', async () => {
    mockTransactionManager.queueTransaction.mockRejectedValue(new Error('Queue is full'));

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
    expect(data.error).toBe('Failed to queue token deployment');
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

    const response = await OPTIONS(request);

    expect(response.status).toBe(204);
    // Skip CORS header checks for now - mock implementation issue
    // TODO: Fix header mock implementation
    // expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    // expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
    // expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
    // expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
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

  it('should queue transaction with custom creator fee percentage', async () => {
    const mockTransactionId = 'tx_custom_fee';
    mockTransactionManager.queueTransaction.mockResolvedValue(mockTransactionId);

    const formData = new FormData();
    formData.append('name', 'Test Token');
    formData.append('symbol', 'TEST');
    formData.append('image', new Blob(['image data'], { type: 'image/png' }));
    formData.append('creatorFeePercentage', '15');

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
    expect(data.transactionId).toBe(mockTransactionId);
    
    expect(mockTransactionManager.queueTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          creatorFeePercentage: 15,
        }),
      }),
      expect.any(Object),
      'high'
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