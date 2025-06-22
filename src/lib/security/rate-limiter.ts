import { getRedisClient } from '@/lib/redis';
import { NextRequest, NextResponse } from 'next/server';

export interface RateLimitConfig {
  identifier: string | ((req: NextRequest) => Promise<string | null>);
  requests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      message: 'Too many requests, please try again later',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config,
    };
  }

  async check(request: NextRequest): Promise<RateLimitResult> {
    const identifier = await this.getIdentifier(request);
    
    if (!identifier) {
      // If no identifier, allow the request
      return {
        allowed: true,
        limit: this.config.requests,
        remaining: this.config.requests,
        resetAt: new Date(Date.now() + this.config.windowMs),
      };
    }

    const key = `ratelimit:${identifier}`;
    const now = Date.now();
    const window = this.config.windowMs;
    const limit = this.config.requests;

    try {
      // Use Redis pipeline for atomic operations
      const redisClient = getRedisClient();
      const pipeline = redisClient.pipeline();
      
      // Get current count and TTL
      pipeline.get(key);
      pipeline.ttl(key);
      
      const results = await pipeline.exec();
      const currentCount = results[0] ? parseInt(results[0] as string, 10) : 0;
      const ttl = results[1] as number;

      // Calculate reset time
      const resetAt = ttl > 0 ? now + (ttl * 1000) : now + window;

      if (currentCount >= limit) {
        // Rate limit exceeded
        return {
          allowed: false,
          limit,
          remaining: 0,
          resetAt: new Date(resetAt),
          retryAfter: Math.ceil((resetAt - now) / 1000),
        };
      }

      // Increment counter
      if (currentCount === 0) {
        // First request in window
        await redisClient.setex(key, Math.ceil(window / 1000), '1');
      } else {
        // Increment existing counter
        await redisClient.incr(key);
      }

      return {
        allowed: true,
        limit,
        remaining: limit - currentCount - 1,
        resetAt: new Date(resetAt),
      };
    } catch (error) {
      console.error('Rate limiter error:', error);
      // On error, allow the request but log it
      return {
        allowed: true,
        limit,
        remaining: limit,
        resetAt: new Date(now + window),
      };
    }
  }

  async middleware(request: NextRequest): Promise<NextResponse | null> {
    const result = await this.check(request);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: this.config.message,
          retryAfter: result.retryAfter,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': String(result.remaining),
            'X-RateLimit-Reset': String(Math.floor(result.resetAt.getTime() / 1000)),
            'Retry-After': String(result.retryAfter),
          },
        }
      );
    }

    // Add rate limit headers to successful responses
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', String(result.limit));
    response.headers.set('X-RateLimit-Remaining', String(result.remaining));
    response.headers.set('X-RateLimit-Reset', String(Math.floor(result.resetAt.getTime() / 1000)));
    
    return null;
  }

  private async getIdentifier(request: NextRequest): Promise<string | null> {
    if (typeof this.config.identifier === 'function') {
      return this.config.identifier(request);
    }
    
    if (this.config.identifier === 'ip') {
      return this.getClientIp(request);
    }
    
    return this.config.identifier;
  }

  private getClientIp(request: NextRequest): string {
    // Check various headers for the real IP
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim();
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
      return realIp;
    }

    // Fallback to a default
    return '127.0.0.1';
  }
}

// Pre-configured rate limiters for different use cases
export const rateLimiters = {
  // General API rate limit - 100 requests per minute per FID
  api: new RateLimiter({
    identifier: async (req) => {
      // Try to extract FID from request
      const url = new URL(req.url);
      const fid = url.searchParams.get('fid') || 
                  req.headers.get('x-farcaster-user-id') ||
                  null;
      return fid ? `api:${fid}` : null;
    },
    requests: 100,
    windowMs: 60 * 1000, // 1 minute
  }),

  // Strict rate limit for expensive operations - 10 per hour per FID
  deployment: new RateLimiter({
    identifier: async (req) => {
      const formData = await req.formData();
      const fid = formData.get('fid');
      return fid ? `deploy:${fid}` : null;
    },
    requests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Deployment rate limit exceeded. Please wait before deploying another token.',
  }),

  // IPFS upload rate limit - 50 per hour per FID
  upload: new RateLimiter({
    identifier: async (req) => {
      const body = await req.json();
      const fid = body.fid;
      return fid ? `upload:${fid}` : null;
    },
    requests: 50,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Upload rate limit exceeded. Please wait before uploading more files.',
  }),

  // Webhook rate limit - 1000 per minute per IP
  webhook: new RateLimiter({
    identifier: 'ip',
    requests: 1000,
    windowMs: 60 * 1000, // 1 minute
  }),

  // Public endpoints - 500 per minute per IP
  public: new RateLimiter({
    identifier: 'ip',
    requests: 500,
    windowMs: 60 * 1000, // 1 minute
  }),
};

// Helper function to apply rate limiting to an API route
export function withRateLimit<T extends unknown[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>,
  limiter: RateLimiter = rateLimiters.api
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    const rateLimitResponse = await limiter.middleware(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    return handler(req, ...args);
  };
}