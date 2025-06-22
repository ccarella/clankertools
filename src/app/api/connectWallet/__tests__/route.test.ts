/**
 * @jest-environment node
 */
import { POST } from '../route';

// Mock NextRequest
class MockNextRequest {
  method: string;
  url: string;
  nextUrl: { searchParams: URLSearchParams };
  headers: Headers;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  
  constructor(url: string, init?: RequestInit) {
    this.method = init?.method || 'GET';
    this.url = url;
    const urlObj = new URL(url);
    this.nextUrl = { searchParams: urlObj.searchParams };
    this.headers = new Headers(init?.headers || {});
    this.body = init?.body;
  }
  
  async json() {
    return JSON.parse(this.body);
  }
}

// Mock Redis at the module level
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  incr: jest.fn(),
  ttl: jest.fn(),
  expire: jest.fn(),
  pipeline: jest.fn(() => ({
    get: jest.fn().mockReturnThis(),
    ttl: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([null, -1]),
  })),
};

jest.mock('@upstash/redis', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Redis: jest.fn(() => mockRedis as any),
}));

// Mock authentication
jest.mock('@/lib/security/auth-middleware', () => ({
  verifyFarcasterAuth: jest.fn().mockResolvedValue(null), // null means auth passed
  securityHeaders: jest.fn(() => new Headers()),
}));

// Mock rate limiter
jest.mock('@/lib/security/rate-limiter', () => ({
  rateLimiters: {
    api: {
      middleware: jest.fn().mockResolvedValue(null), // null means rate limit passed
    },
  },
}));

// Mock input validation
jest.mock('@/lib/security/input-validation', () => ({
  validateInput: jest.fn((data: any, schema: any) => ({
    success: true,
    data: {
      fid: data.fid || '12345',
      walletAddress: data.walletAddress || '0x1234567890123456789012345678901234567890',
      enableCreatorRewards: data.enableCreatorRewards ?? true,
    },
  })),
  schemas: {
    fid: {},
    walletAddress: {},
  },
}));

describe('POST /api/connectWallet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(null);
    mockRedis.expire.mockResolvedValue(1);

    // Set environment variables
    process.env.KV_REST_API_URL = 'test-url';
    process.env.KV_REST_API_TOKEN = 'test-token';
  });

  afterEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('should successfully store wallet address for a user', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/connectWallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fid: '12345',
        walletAddress: '0x1234567890123456789012345678901234567890',
        enableCreatorRewards: true,
      }),
    });

    mockRedis.set.mockResolvedValueOnce('OK');
    mockRedis.expire.mockResolvedValueOnce(1);

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Wallet connected successfully');
    
    // Verify Redis calls
    expect(mockRedis.set).toHaveBeenCalledWith(
      'wallet:12345',
      expect.objectContaining({
        address: '0x1234567890123456789012345678901234567890',
        enableCreatorRewards: true,
        connectedAt: expect.any(Number),
      })
    );
    expect(mockRedis.expire).toHaveBeenCalledWith('wallet:12345', 86400 * 7); // 7 days
  });

  it('should return 400 for missing fid', async () => {
    // Mock validation to fail for missing fid
    const { validateInput } = require('@/lib/security/input-validation');
    validateInput.mockReturnValueOnce({
      success: false,
      errors: ['Missing required fields'],
    });

    const request = new MockNextRequest('http://localhost:3000/api/connectWallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress: '0x1234567890123456789012345678901234567890',
      }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it('should return 400 for missing wallet address', async () => {
    // Mock validation to fail for missing wallet address
    const { validateInput } = require('@/lib/security/input-validation');
    validateInput.mockReturnValueOnce({
      success: false,
      errors: ['Missing required fields'],
    });

    const request = new MockNextRequest('http://localhost:3000/api/connectWallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fid: '12345',
      }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid wallet address format', async () => {
    // Mock validation to fail for invalid wallet address
    const { validateInput } = require('@/lib/security/input-validation');
    validateInput.mockReturnValueOnce({
      success: false,
      errors: ['Invalid wallet address format'],
    });

    const request = new MockNextRequest('http://localhost:3000/api/connectWallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fid: '12345',
        walletAddress: 'invalid-address',
      }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it('should handle enableCreatorRewards as false', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/connectWallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fid: '12345',
        walletAddress: '0x1234567890123456789012345678901234567890',
        enableCreatorRewards: false,
      }),
    });

    mockRedis.set.mockResolvedValueOnce('OK');
    mockRedis.expire.mockResolvedValueOnce(1);

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockRedis.set).toHaveBeenCalledWith(
      'wallet:12345',
      expect.objectContaining({
        enableCreatorRewards: false,
      })
    );
  });

  it('should handle Redis connection errors', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/connectWallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fid: '12345',
        walletAddress: '0x1234567890123456789012345678901234567890',
      }),
    });

    mockRedis.set.mockRejectedValueOnce(new Error('Redis connection failed'));

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to connect wallet');
  });

  it('should return 500 when environment variables are missing', async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;

    const request = new MockNextRequest('http://localhost:3000/api/connectWallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fid: '12345',
        walletAddress: '0x1234567890123456789012345678901234567890',
      }),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Server configuration error');
  });
});