/**
 * @jest-environment node
 */
import { GET } from '@/app/api/config/wallet-requirement/route';

// Mock NextRequest class
class MockNextRequest {
  method: string;
  body: unknown;
  headers: Headers;
  url: string;
  
  constructor(url: string, init?: RequestInit) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.body = init?.body;
    this.headers = new Headers(init?.headers as HeadersInit);
  }
  
  async json() {
    return JSON.parse(this.body as string);
  }
}

describe('GET /api/config/wallet-requirement', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return wallet requirement status based on environment variable', async () => {
    process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH = 'true';
    
    // No request needed for GET endpoint
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ required: true });
  });

  it('should default to not required when env var is not set', async () => {
    delete process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH;
    
    // No request needed for GET endpoint
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ required: false });
  });

  it('should handle false value in env var', async () => {
    process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH = 'false';
    
    // No request needed for GET endpoint
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ required: false });
  });

  it('should handle non-boolean string values', async () => {
    process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH = 'yes';
    
    // No request needed for GET endpoint
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ required: false });
  });

  it('should include proper cache headers', async () => {
    // No request needed for GET endpoint
    const response = await GET();

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600, s-maxage=3600');
  });

  it('should include CORS headers', async () => {
    // No request needed for GET endpoint
    const response = await GET();

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
  });
});