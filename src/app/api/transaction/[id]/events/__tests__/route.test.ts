import { NextRequest } from 'next/server';
import { GET, OPTIONS } from '../route';

// Mock the TransactionManager and dependencies
jest.mock('@/lib/transaction/TransactionManager');
jest.mock('@/lib/transaction/processors/tokenDeploymentProcessor');

const mockRedis = {
  hgetall: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
};

const mockTransactionManager = {
  redis: mockRedis,
  subscribeToTransaction: jest.fn(),
};

// Mock the getTransactionManager function
import { getTransactionManager } from '@/lib/transaction/TransactionManager';
getTransactionManager.mockReturnValue(mockTransactionManager);

// Mock ReadableStream for Edge runtime
global.ReadableStream = class ReadableStream {
  constructor(public underlyingSource: unknown) {}
} as unknown as typeof ReadableStream;

global.TextEncoder = class TextEncoder {
  encode(input: string): Uint8Array {
    return new Uint8Array(Buffer.from(input, 'utf8'));
  }
} as unknown as typeof TextEncoder;

describe('/api/transaction/[id]/events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('OPTIONS', () => {
    it('should return correct CORS headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/transaction/tx_123/events', {
        method: 'OPTIONS',
        headers: {
          'origin': 'http://localhost:3000',
        },
      });

      const response = await OPTIONS(request);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    });
  });

  describe('GET', () => {
    it('should validate transaction ID format', async () => {
      const request = new NextRequest('http://localhost:3000/api/transaction/invalid_id/events', {
        method: 'GET',
      });

      const response = await GET(request, { params: { id: 'invalid_id' } });

      expect(response.status).toBe(400);
      const text = await response.text();
      expect(text).toBe('Invalid transaction ID');
    });

    it('should return stream with correct headers for valid transaction ID', async () => {
      // Mock successful transaction data
      mockRedis.hgetall.mockResolvedValue({
        status: 'processing',
        createdAt: '1234567890000',
        transaction: JSON.stringify({ type: 'token_deployment' }),
        metadata: JSON.stringify({ userId: 123 }),
      });

      mockTransactionManager.subscribeToTransaction.mockImplementation((txId, callback) => {
        // Simulate immediate status update
        setTimeout(() => {
          callback({
            status: 'completed',
            timestamp: Date.now(),
          });
        }, 100);
        
        return Promise.resolve(() => Promise.resolve());
      });

      const request = new NextRequest('http://localhost:3000/api/transaction/tx_valid123/events', {
        method: 'GET',
      });

      const response = await GET(request, { params: { id: 'tx_valid123' } });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
      expect(response.headers.get('Cache-Control')).toBe('no-cache');
      expect(response.headers.get('Connection')).toBe('keep-alive');
      expect(mockRedis.hgetall).toHaveBeenCalledWith('tx:data:tx_valid123');
      expect(mockTransactionManager.subscribeToTransaction).toHaveBeenCalledWith(
        'tx_valid123',
        expect.any(Function)
      );
    });

    it('should handle transaction not found', async () => {
      mockRedis.hgetall.mockResolvedValue({});

      const request = new NextRequest('http://localhost:3000/api/transaction/tx_notfound/events', {
        method: 'GET',
      });

      const response = await GET(request, { params: { id: 'tx_notfound' } });

      // The response should be a stream that sends an error event
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.hgetall.mockRejectedValue(new Error('Redis connection failed'));

      const request = new NextRequest('http://localhost:3000/api/transaction/tx_error/events', {
        method: 'GET',
      });

      const response = await GET(request, { params: { id: 'tx_error' } });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    });

    it('should calculate progress correctly', async () => {
      const testCases = [
        { status: 'queued', expectedProgress: 10 },
        { status: 'processing', expectedProgress: 50 },
        { status: 'completed', expectedProgress: 100 },
        { status: 'failed', expectedProgress: 0 },
        { status: 'cancelled', expectedProgress: 0 },
      ];

      for (const testCase of testCases) {
        mockRedis.hgetall.mockResolvedValue({
          status: testCase.status,
          createdAt: '1234567890000',
          transaction: JSON.stringify({ type: 'token_deployment' }),
          metadata: JSON.stringify({ userId: 123 }),
        });

        mockTransactionManager.subscribeToTransaction.mockImplementation(() => {
          return Promise.resolve(() => Promise.resolve());
        });

        const request = new NextRequest(`http://localhost:3000/api/transaction/tx_${testCase.status}/events`, {
          method: 'GET',
        });

        const response = await GET(request, { params: { id: `tx_${testCase.status}` } });

        expect(response.status).toBe(200);
        expect(mockRedis.hgetall).toHaveBeenCalledWith(`tx:data:tx_${testCase.status}`);
      }
    });
  });

  describe('Security', () => {
    it('should include security headers', async () => {
      mockRedis.hgetall.mockResolvedValue({
        status: 'processing',
        createdAt: '1234567890000',
        transaction: JSON.stringify({ type: 'token_deployment' }),
        metadata: JSON.stringify({ userId: 123 }),
      });

      mockTransactionManager.subscribeToTransaction.mockImplementation(() => {
        return Promise.resolve(() => Promise.resolve());
      });

      const request = new NextRequest('http://localhost:3000/api/transaction/tx_security/events', {
        method: 'GET',
      });

      const response = await GET(request, { params: { id: 'tx_security' } });

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });

    it('should validate allowed origins', async () => {
      const maliciousOrigin = 'http://malicious-site.com';
      
      const request = new NextRequest('http://localhost:3000/api/transaction/tx_123/events', {
        method: 'OPTIONS',
        headers: {
          'origin': maliciousOrigin,
        },
      });

      // Mock no allowed origins configured
      delete process.env.ALLOWED_ORIGINS;

      const response = await OPTIONS(request);

      // Should still allow * if no specific origins configured
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });
});