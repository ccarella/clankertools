/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { POST } from '../route';
import { NotificationService } from '@/services/notification';
import crypto from 'crypto';

jest.mock('@/services/notification');
jest.mock('@/lib/security/auth-middleware', () => ({
  verifyWebhookSignature: jest.fn((payload: string, signature: string, secret: string) => {
    // Simple mock implementation for testing
    return signature === crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }),
  securityHeaders: jest.fn(() => ({}))
}));
jest.mock('@/lib/security/rate-limiter', () => ({
  rateLimiters: {
    webhook: {
      middleware: jest.fn().mockResolvedValue(null)
    }
  }
}));

// Mock NextRequest
class MockNextRequest {
  method: string;
  body: string;
  private _headers: Map<string, string>;
  
  constructor(url: string, init: RequestInit) {
    this.method = init.method || 'GET';
    this.body = init.body as string;
    this._headers = new Map();
    
    if (init.headers) {
      const headers = init.headers as Record<string, string>;
      Object.entries(headers).forEach(([key, value]) => {
        this._headers.set(key.toLowerCase(), value);
      });
    }
  }
  
  get headers() {
    return {
      get: (key: string) => this._headers.get(key.toLowerCase())
    };
  }
  
  async text() {
    return this.body;
  }
}

describe('POST /api/webhook/farcaster', () => {
  let mockNotificationService: jest.Mocked<NotificationService>;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, FARCASTER_WEBHOOK_SECRET: 'test-secret' };
    mockNotificationService = {
      saveNotificationToken: jest.fn(),
      removeNotificationToken: jest.fn(),
    } as any;
    
    (NotificationService as jest.MockedClass<typeof NotificationService>).mockImplementation(() => mockNotificationService);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('webhook signature validation', () => {
    it('should reject requests without signature header', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/webhook/farcaster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ event: 'frame_added' }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Missing webhook signature');
    });

    it('should reject requests with invalid signature', async () => {
      const body = JSON.stringify({ event: 'frame_added', fid: 123 });
      const request = new MockNextRequest('http://localhost:3000/api/webhook/farcaster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': 'invalid-signature',
        },
        body,
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid webhook signature');
    });

    it('should accept requests with valid signature', async () => {
      const webhookSecret = process.env.FARCASTER_WEBHOOK_SECRET || 'test-secret';
      const body = JSON.stringify({ 
        event: 'frame_added', 
        fid: 123,
        notificationDetails: {
          token: 'test-token',
          url: 'https://warpcast.com/notifications'
        }
      });
      
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      const request = new MockNextRequest('http://localhost:3000/api/webhook/farcaster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        body,
      });

      const response = await POST(request as any);

      expect(response.status).toBe(200);
    });
  });

  describe('frame_added event', () => {
    it('should save notification token when user adds the app', async () => {
      const webhookSecret = process.env.FARCASTER_WEBHOOK_SECRET || 'test-secret';
      const body = JSON.stringify({
        event: 'frame_added',
        fid: 123,
        notificationDetails: {
          token: 'notification-token-123',
          url: 'https://warpcast.com/notifications'
        }
      });
      
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      const request = new MockNextRequest('http://localhost:3000/api/webhook/farcaster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        body,
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockNotificationService.saveNotificationToken).toHaveBeenCalledWith(
        123,
        'notification-token-123',
        'https://warpcast.com/notifications'
      );
    });

    it('should handle missing notification details', async () => {
      const webhookSecret = process.env.FARCASTER_WEBHOOK_SECRET || 'test-secret';
      const body = JSON.stringify({
        event: 'frame_added',
        fid: 123
      });
      
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      const request = new MockNextRequest('http://localhost:3000/api/webhook/farcaster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        body,
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing notification details');
      expect(mockNotificationService.saveNotificationToken).not.toHaveBeenCalled();
    });
  });

  describe('frame_removed event', () => {
    it('should remove notification token when user removes the app', async () => {
      const webhookSecret = process.env.FARCASTER_WEBHOOK_SECRET || 'test-secret';
      const body = JSON.stringify({
        event: 'frame_removed',
        fid: 123
      });
      
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      const request = new MockNextRequest('http://localhost:3000/api/webhook/farcaster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        body,
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockNotificationService.removeNotificationToken).toHaveBeenCalledWith(123);
    });
  });

  describe('notifications_disabled event', () => {
    it('should remove notification token when user disables notifications', async () => {
      const webhookSecret = process.env.FARCASTER_WEBHOOK_SECRET || 'test-secret';
      const body = JSON.stringify({
        event: 'notifications_disabled',
        fid: 123
      });
      
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      const request = new MockNextRequest('http://localhost:3000/api/webhook/farcaster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        body,
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockNotificationService.removeNotificationToken).toHaveBeenCalledWith(123);
    });
  });

  describe('notifications_enabled event', () => {
    it('should save notification token when user enables notifications', async () => {
      const webhookSecret = process.env.FARCASTER_WEBHOOK_SECRET || 'test-secret';
      const body = JSON.stringify({
        event: 'notifications_enabled',
        fid: 123,
        notificationDetails: {
          token: 'notification-token-123',
          url: 'https://warpcast.com/notifications'
        }
      });
      
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      const request = new MockNextRequest('http://localhost:3000/api/webhook/farcaster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        body,
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockNotificationService.saveNotificationToken).toHaveBeenCalledWith(
        123,
        'notification-token-123',
        'https://warpcast.com/notifications'
      );
    });
  });

  describe('unknown events', () => {
    it('should handle unknown events gracefully', async () => {
      const webhookSecret = process.env.FARCASTER_WEBHOOK_SECRET || 'test-secret';
      const body = JSON.stringify({
        event: 'unknown_event',
        fid: 123
      });
      
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      const request = new MockNextRequest('http://localhost:3000/api/webhook/farcaster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        body,
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Event not handled: unknown_event');
    });
  });

  describe('error handling', () => {
    it('should handle notification service errors gracefully', async () => {
      mockNotificationService.saveNotificationToken.mockRejectedValueOnce(new Error('Database error'));

      const webhookSecret = process.env.FARCASTER_WEBHOOK_SECRET || 'test-secret';
      const body = JSON.stringify({
        event: 'frame_added',
        fid: 123,
        notificationDetails: {
          token: 'notification-token-123',
          url: 'https://warpcast.com/notifications'
        }
      });
      
      const signature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      const request = new MockNextRequest('http://localhost:3000/api/webhook/farcaster', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        body,
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to process webhook');
    });
  });
});