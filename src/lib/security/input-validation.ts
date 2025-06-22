import { z } from 'zod';

// HTML entities that need escaping
const htmlEscapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

// Escape HTML to prevent XSS
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char] || char);
}

// Validate and sanitize URLs
export function sanitizeUrl(url: string): string | null {
  if (!url) return null;
  
  try {
    const parsed = new URL(url);
    
    // Only allow http(s) protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    
    // Don't allow credentials in URL
    if (parsed.username || parsed.password) {
      return null;
    }
    
    // Don't allow localhost or private IPs in production
    if (process.env.NODE_ENV === 'production') {
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')
      ) {
        return null;
      }
    }
    
    return parsed.href;
  } catch {
    return null;
  }
}

// Zod schemas for common inputs
export const schemas = {
  fid: z.string()
    .min(1, 'FID is required')
    .max(10, 'FID too long')
    .regex(/^\d+$/, 'FID must be numeric')
    .refine((val) => {
      const num = parseInt(val, 10);
      return num > 0 && num <= 999999999;
    }, 'Invalid FID range'),
    
  walletAddress: z.string()
    .min(42, 'Invalid wallet address')
    .max(42, 'Invalid wallet address')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address format'),
    
  tokenAddress: z.string()
    .min(42, 'Invalid token address')
    .max(42, 'Invalid token address')
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address format'),
    
  tokenName: z.string()
    .min(1, 'Token name is required')
    .max(100, 'Token name too long')
    .transform(escapeHtml),
    
  tokenSymbol: z.string()
    .min(1, 'Token symbol is required')
    .max(10, 'Token symbol too long')
    .regex(/^[A-Z0-9]+$/, 'Token symbol must be uppercase alphanumeric')
    .transform(escapeHtml),
    
  description: z.string()
    .max(1000, 'Description too long')
    .optional()
    .transform((val) => val ? escapeHtml(val) : undefined),
    
  url: z.string()
    .max(500, 'URL too long')
    .optional()
    .transform((val) => val ? sanitizeUrl(val) : undefined)
    .refine((val) => !val || val !== null, 'Invalid URL format'),
    
  imageBase64: z.string()
    .regex(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/, 'Invalid image format')
    .refine((val) => {
      // Check file size (max 5MB)
      const base64Data = val.split(',')[1];
      const sizeInBytes = (base64Data.length * 3) / 4;
      return sizeInBytes <= 5 * 1024 * 1024;
    }, 'Image too large (max 5MB)'),
};

// Validate request data against schema
export function validateInput<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['Validation failed'] };
  }
}

// Sanitize JSON for safe output
export function sanitizeJson(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return escapeHtml(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeJson);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize the key too
      const safeKey = escapeHtml(key);
      sanitized[safeKey] = sanitizeJson(value);
    }
    return sanitized;
  }
  
  return obj;
}

// Prevent NoSQL injection by validating Redis keys
export function sanitizeRedisKey(key: string): string {
  // Remove any Redis commands or wildcards
  return key
    .replace(/[*?[\]]/g, '') // Remove wildcards
    .replace(/\$/g, '') // Remove $ (used in Redis commands)
    .replace(/\s/g, '_') // Replace spaces with underscores
    .slice(0, 100); // Limit length
}

// File upload validation
export function validateFileUpload(file: File | Blob): {
  valid: boolean;
  error?: string;
} {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
  
  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'File too large (max 10MB)' };
  }
  
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid file type' };
  }
  
  return { valid: true };
}

// SQL injection prevention (for future use if SQL database is added)
export function escapeSql(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x00/g, '\\0')
    .replace(/\x1a/g, '\\Z');
}