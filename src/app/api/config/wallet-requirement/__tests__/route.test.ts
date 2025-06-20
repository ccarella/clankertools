/**
 * @jest-environment node
 */
import { GET } from '../route';

describe('GET /api/config/wallet-requirement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    delete process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH;
  });

  afterEach(() => {
    delete process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH;
  });

  it('should return wallet required when environment variable is true', async () => {
    process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH = 'true';

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ required: true });
  });

  it('should return wallet not required when environment variable is false', async () => {
    process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH = 'false';

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ required: false });
  });

  it('should return wallet not required when environment variable is not set', async () => {
    // Environment variable not set

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ required: false });
  });

  it('should return wallet not required for any non-true value', async () => {
    const testValues = ['1', 'yes', 'TRUE', 'True', ' true ', 'required', ''];

    for (const value of testValues) {
      process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH = value;

      const request = new MockNextRequest('http://localhost:3000/api/config/wallet-requirement', {
        method: 'GET',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ required: value === 'true' });
    }
  });

  it('should include cache headers', async () => {
    process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH = 'true';

    const response = await GET();

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600, s-maxage=3600');
  });

  it('should include CORS headers', async () => {
    process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH = 'true';

    const request = new MockNextRequest('http://localhost:3000/api/config/wallet-requirement', {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:3000',
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any;

    const response = await GET(request);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
  });
});