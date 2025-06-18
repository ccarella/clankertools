/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { POST } from '../route';

// Mock NextRequest
class MockNextRequest {
  method: string;
  body: any;
  headers: Headers;
  
  constructor(url: string, init: RequestInit) {
    this.method = init.method || 'GET';
    this.body = init.body;
    this.headers = new Headers(init.headers as HeadersInit);
  }
  
  async json() {
    return JSON.parse(this.body);
  }
}

// Mock Redis at the module level
const mockRedis = {
  set: jest.fn(),
  get: jest.fn(),
  expire: jest.fn(),
};

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn(() => mockRedis),
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
        walletAddress: '0x1234567890123456789012345678901234567890',
        enableCreatorRewards: true,
        connectedAt: expect.any(Number),
      })
    );
    expect(mockRedis.expire).toHaveBeenCalledWith('wallet:12345', 86400 * 7); // 7 days
  });

  it('should return 400 for missing fid', async () => {
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
    expect(data.error).toBe('Missing required fields');
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it('should return 400 for missing wallet address', async () => {
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
    expect(data.error).toBe('Missing required fields');
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it('should return 400 for invalid wallet address format', async () => {
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
    expect(data.error).toBe('Invalid wallet address format');
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