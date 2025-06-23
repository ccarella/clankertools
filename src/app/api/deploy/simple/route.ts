import { NextRequest, NextResponse } from 'next/server';
import { getTransactionManager } from '@/lib/transaction/TransactionManager';
import { tokenDeploymentProcessor, TokenDeploymentPayload } from '@/lib/transaction/processors/tokenDeploymentProcessor';
import { CastContext } from '@/lib/types/cast-context';

export const runtime = 'edge';

// Security headers configuration
function getSecurityHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  const origin = request.headers.get('origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
  
  // CORS headers
  if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.includes('*')) {
    headers.set('Access-Control-Allow-Origin', '*');
  }
  
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  
  // Security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  return headers;
}

// Input sanitization
function sanitizeInput(input: string): string {
  // Remove HTML tags and dangerous characters
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>"'&]/g, '') // Remove dangerous characters
    .trim();
}

// Validate file type and size
function validateImageFile(file: Blob): { valid: boolean; error?: string } {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
  
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'Image file is too large (max 10MB)' };
  }
  
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid image type. Allowed types: PNG, JPEG, GIF, WebP' };
  }
  
  return { valid: true };
}

export async function OPTIONS(request: NextRequest) {
  const headers = getSecurityHeaders(request);
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(request: NextRequest) {
  // Initialize debug context
  const debugContext = {
    timestamp: new Date().toISOString(),
    step: 'initialization',
    network: process.env.NEXT_PUBLIC_NETWORK || 'unknown',
    requestId: crypto.randomUUID?.() || Date.now().toString(),
  };
  
  // Initialize request context at top level
  let requestContext: Record<string, unknown> = {};

  try {
    // Handle OPTIONS for CORS
    if (request.method === 'OPTIONS') {
      return OPTIONS(request);
    }
    
    // Check method
    if (request.method !== 'POST') {
      return NextResponse.json(
        { success: false, error: 'Method not allowed' },
        { status: 405, headers: getSecurityHeaders(request) }
      );
    }

    // Parse form data
    debugContext.step = 'parsing_form_data';
    const formData = await request.formData();
    const rawName = formData.get('name') as string;
    const rawSymbol = formData.get('symbol') as string;
    const imageFile = formData.get('image') as Blob;
    const fid = formData.get('fid') as string;
    const castContextString = formData.get('castContext') as string;
    const creatorFeePercentage = formData.get('creatorFeePercentage') as string;
    
    // Enhanced debug logging for form data
    const formDebugInfo = {
      name: rawName || 'missing',
      symbol: rawSymbol || 'missing', 
      hasImage: !!imageFile,
      imageType: imageFile?.type || 'no image',
      imageSize: imageFile?.size || 0,
      fid: fid || 'not authenticated',
      hasCastContext: !!castContextString,
      timestamp: debugContext.timestamp,
      requestId: debugContext.requestId,
    };
    
    console.log('[Deploy] Form data received:', formDebugInfo);
    
    // Store request context for debug info
    requestContext = {
      fid,
      hasCastContext: !!castContextString,
      hasImage: !!imageFile,
      imageSize: imageFile?.size || 0,
      imageType: imageFile?.type || null,
    };
    
    // Sanitize inputs
    const name = rawName ? sanitizeInput(rawName) : '';
    const symbol = rawSymbol ? sanitizeInput(rawSymbol) : '';

    // Check wallet requirement
    const requireWallet = process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH === 'true';
    
    if (requireWallet) {
      // FID is required when wallet requirement is enabled
      if (!fid) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Farcaster authentication required',
            errorDetails: {
              type: 'FID_REQUIRED',
              message: 'Please sign in with Farcaster to deploy tokens',
            },
            debugInfo: {
              ...debugContext,
              step: 'wallet_requirement_check',
              requireWallet: true,
              hasFid: false,
              requestContext,
            }
          },
          { status: 400, headers: getSecurityHeaders(request) }
        );
      }
    }
    
    // Validate required fields
    debugContext.step = 'validation';
    const validationErrors = [];
    if (!name) validationErrors.push('name');
    if (!symbol) validationErrors.push('symbol');
    if (!imageFile) validationErrors.push('image');
    
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Missing required fields: ${validationErrors.join(', ')}`,
          errorDetails: {
            type: 'VALIDATION_ERROR',
            details: 'Required fields are missing',
            userMessage: 'Please fill in all required fields',
            missingFields: validationErrors,
          },
          debugInfo: {
            ...debugContext,
            step: 'validation',
            validationErrors,
            requestContext,
          }
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    // Validate image file
    const imageValidation = validateImageFile(imageFile);
    if (!imageValidation.valid) {
      return NextResponse.json(
        { 
          success: false, 
          error: imageValidation.error,
          errorDetails: {
            type: 'VALIDATION_ERROR',
            details: imageValidation.error,
            userMessage: imageValidation.error,
          },
          debugInfo: {
            ...debugContext,
            step: 'image_validation',
            fileSize: imageFile.size,
            fileType: imageFile.type,
            requestContext,
          }
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }
    
    // Validate field constraints
    if (name.length > 32) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Token name must be 32 characters or less',
          errorDetails: {
            type: 'VALIDATION_ERROR',
            details: `Name length: ${name.length} characters (max: 32)`,
            userMessage: 'Token name is too long. Please use 32 characters or less.',
          },
          debugInfo: {
            ...debugContext,
            step: 'name_validation',
            nameLength: name.length,
            requestContext,
          }
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    if (symbol.length < 3 || symbol.length > 8) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Symbol must be between 3 and 8 characters',
          errorDetails: {
            type: 'VALIDATION_ERROR',
            details: `Symbol length: ${symbol.length} characters (min: 3, max: 8)`,
            userMessage: 'Token symbol must be between 3 and 8 characters.',
          },
          debugInfo: {
            ...debugContext,
            step: 'symbol_validation',
            symbolLength: symbol.length,
            requestContext,
          }
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    // Parse cast context if provided
    let castContext: CastContext | null = null;
    if (castContextString) {
      try {
        const parsed = JSON.parse(castContextString);
        if (parsed && parsed.type === 'cast') {
          castContext = parsed as CastContext;
        } else if (parsed && parsed.type && !['cast', 'notification', 'share', 'direct'].includes(parsed.type)) {
          return NextResponse.json(
            { success: false, error: 'Invalid cast context type' },
            { status: 400, headers: getSecurityHeaders(request) }
          );
        }
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid cast context JSON' },
          { status: 400, headers: getSecurityHeaders(request) }
        );
      }
    }

    // Prepare token deployment payload
    const deploymentPayload: TokenDeploymentPayload = {
      name,
      symbol,
      imageFile,
      fid,
      castContext: castContext ? {
        type: castContext.type,
        castId: castContext.castId,
        parentCastId: castContext.parentCastId,
        author: {
          fid: castContext.author.fid.toString(),
          username: castContext.author.username,
        },
        embedUrl: castContext.embedUrl,
      } : undefined,
      creatorFeePercentage: creatorFeePercentage ? parseInt(creatorFeePercentage, 10) : undefined,
    };

    // Initialize TransactionManager with token deployment processor
    const transactionManager = getTransactionManager({
      processor: tokenDeploymentProcessor,
      maxRetries: 3,
      retryDelay: 5000,
    });

    // Queue the token deployment transaction
    debugContext.step = 'queueing_transaction';
    try {
      const transactionId = await transactionManager.queueTransaction(
        {
          type: 'token_deployment',
          payload: deploymentPayload,
        },
        {
          userId: fid ? parseInt(fid, 10) : 0,
          description: `Simple token deployment: ${name} (${symbol})`,
        },
        'high' // High priority for token deployments
      );

      // Start processing if not already running
      transactionManager.startAutoProcessing(5000);

      return NextResponse.json({
        success: true,
        transactionId,
        message: 'Token deployment queued successfully',
        statusUrl: `/api/transaction/${transactionId}`,
      }, { headers: getSecurityHeaders(request) });

    } catch (error) {
      console.error('Failed to queue token deployment:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to queue token deployment',
          errorDetails: {
            type: 'QUEUE_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error',
            userMessage: 'Failed to start token deployment. Please try again.',
          },
          debugInfo: {
            ...debugContext,
            step: 'queueing_transaction',
            error: error instanceof Error ? error.message : 'Unknown error',
            requestContext,
          }
        },
        { status: 500, headers: getSecurityHeaders(request) }
      );
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    
    // Extract error details
    let errorMessage = 'An unexpected error occurred';
    const errorDetails: Record<string, unknown> = {
      type: 'UNKNOWN_ERROR',
      details: 'An unexpected error occurred during deployment preparation',
      userMessage: 'Something went wrong. Please try again.',
    };
    const statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails.details = error.message;
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        errorDetails,
        debugInfo: {
          ...debugContext,
          timestamp: new Date().toISOString(),
          requestContext,
        }
      },
      { status: statusCode, headers: getSecurityHeaders(request) }
    );
  }
}