/**
 * @jest-environment node
 */
import { GET } from '../route';

// Mock NextRequest
class MockNextRequest {
  method: string;
  url: string;
  nextUrl: { searchParams: URLSearchParams };
  
  constructor(url: string, init?: RequestInit) {
    this.method = init?.method || 'GET';
    this.url = url;
    const urlObj = new URL(url);
    this.nextUrl = { searchParams: urlObj.searchParams };
  }
}

// Mock Redis at the module level
const mockRedis = {
  get: jest.fn(),
};

jest.mock('@upstash/redis', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Redis: jest.fn(() => mockRedis as any),
}));

describe('GET /api/connectWallet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);

    // Set environment variables
    process.env.KV_REST_API_URL = 'test-url';
    process.env.KV_REST_API_TOKEN = 'test-token';
  });

  afterEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  it('should retrieve wallet information for a valid fid', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/connectWallet?fid=12345');

    const mockWalletData = {
      address: '0x1234567890123456789012345678901234567890',
      enableCreatorRewards: true,
      connectedAt: Date.now(),
    };

    mockRedis.get.mockResolvedValueOnce(mockWalletData);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      data: mockWalletData,
    });
    expect(mockRedis.get).toHaveBeenCalledWith('wallet:12345');
  });

  it('should return 404 when wallet data not found', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/connectWallet?fid=99999');

    mockRedis.get.mockResolvedValueOnce(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({
      success: false,
      error: 'Wallet not found',
    });
    expect(mockRedis.get).toHaveBeenCalledWith('wallet:99999');
  });

  it('should return 400 for missing fid parameter', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/connectWallet');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      success: false,
      error: 'Missing fid parameter',
    });
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('should handle Redis connection errors', async () => {
    const request = new MockNextRequest('http://localhost:3000/api/connectWallet?fid=12345');

    mockRedis.get.mockRejectedValueOnce(new Error('Redis connection failed'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      success: false,
      error: 'Failed to retrieve wallet information',
    });
  });

  it('should return 500 when environment variables are missing', async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;

    const request = new MockNextRequest('http://localhost:3000/api/connectWallet?fid=12345');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      success: false,
      error: 'Server configuration error',
    });
  });
});