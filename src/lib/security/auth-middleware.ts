import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface AuthConfig {
  requireAuth?: boolean;
  allowedMethods?: string[];
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
}

export interface AuthenticatedRequest extends NextRequest {
  auth?: {
    fid: string;
    verified: boolean;
  };
}

// In-memory rate limiting store (should use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export async function verifyFarcasterAuth(
  request: NextRequest,
  config: AuthConfig = {}
): Promise<NextResponse | null> {
  const { requireAuth = true, allowedMethods = ['GET', 'POST'], rateLimit } = config;

  // Check allowed methods
  if (!allowedMethods.includes(request.method)) {
    return NextResponse.json(
      { error: 'Method not allowed' },
      { status: 405 }
    );
  }

  // Extract FID from various sources
  const fid = await extractFID(request);

  if (requireAuth && !fid) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Validate FID format
  if (fid && !isValidFID(fid)) {
    return NextResponse.json(
      { error: 'Invalid FID format' },
      { status: 400 }
    );
  }

  // Apply rate limiting if configured
  if (rateLimit && fid) {
    const rateLimitResult = checkRateLimit(fid, rateLimit);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter),
            'X-RateLimit-Limit': String(rateLimit.requests),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          }
        }
      );
    }
  }

  // TODO: Implement actual Farcaster signature verification
  // For now, we'll add a warning header to indicate auth is not fully implemented
  if (requireAuth) {
    const response = NextResponse.next();
    response.headers.set('X-Auth-Warning', 'Farcaster signature verification not implemented');
    return response;
  }

  return null; // Continue to route handler
}

async function extractFID(request: NextRequest): Promise<string | null> {
  // Check various sources for FID
  
  // 1. Check form data
  if (request.method === 'POST' && request.headers.get('content-type')?.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      const fid = formData.get('fid');
      if (fid) return String(fid);
    } catch {}
  }

  // 2. Check JSON body
  if (request.method === 'POST' && request.headers.get('content-type')?.includes('application/json')) {
    try {
      const body = await request.json();
      if (body.fid) return String(body.fid);
    } catch {}
  }

  // 3. Check query parameters
  const url = new URL(request.url);
  const fidParam = url.searchParams.get('fid');
  if (fidParam) return fidParam;

  // 4. Check headers
  const headerFid = request.headers.get('x-farcaster-user-id');
  if (headerFid) return headerFid;

  return null;
}

function isValidFID(fid: string): boolean {
  // FID should be a positive integer
  const fidNum = parseInt(fid, 10);
  return !isNaN(fidNum) && fidNum > 0 && fidNum <= 999999999 && String(fidNum) === fid;
}

function checkRateLimit(
  identifier: string,
  config: { requests: number; windowMs: number }
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
} {
  const now = Date.now();
  
  // Clean up old entries
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }

  const current = rateLimitStore.get(identifier);
  
  if (!current || current.resetAt < now) {
    // New window
    const resetAt = now + config.windowMs;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: config.requests - 1,
      resetAt,
    };
  }

  if (current.count >= config.requests) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfter: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  // Increment count
  current.count++;
  return {
    allowed: true,
    remaining: config.requests - current.count,
    resetAt: current.resetAt,
  };
}

// Webhook signature verification
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  
  // Use timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Security headers middleware
export function securityHeaders(): HeadersInit {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:;",
  };
}