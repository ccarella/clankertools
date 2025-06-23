import { NextRequest, NextResponse } from 'next/server';
import { getTransactionManager } from '@/lib/transaction/TransactionManager';
import { tokenDeploymentProcessor } from '@/lib/transaction/processors/tokenDeploymentProcessor';

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
  
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  
  // Security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  return headers;
}

export async function OPTIONS(request: NextRequest) {
  const headers = getSecurityHeaders(request);
  return new NextResponse(null, { status: 204, headers });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transactionId = params.id;

    if (!transactionId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Transaction ID is required' 
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    // Validate transaction ID format
    if (!transactionId.startsWith('tx_') || transactionId.length < 10) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid transaction ID format' 
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    // Initialize TransactionManager with token deployment processor
    const transactionManager = getTransactionManager({
      processor: tokenDeploymentProcessor,
      maxRetries: 3,
      retryDelay: 5000,
    });

    // Get transaction data from Redis
    const redis = transactionManager['redis']; // Access private redis instance
    const txDataRaw = await redis.hgetall(`tx:data:${transactionId}`);

    if (!txDataRaw || Object.keys(txDataRaw).length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Transaction not found' 
        },
        { status: 404, headers: getSecurityHeaders(request) }
      );
    }

    // Parse transaction data
    const txData = {
      id: transactionId,
      transaction: JSON.parse(txDataRaw.transaction as string),
      metadata: JSON.parse(txDataRaw.metadata as string),
      status: txDataRaw.status as string,
      priority: txDataRaw.priority as string,
      createdAt: parseInt(txDataRaw.createdAt as string, 10),
      updatedAt: txDataRaw.updatedAt ? parseInt(txDataRaw.updatedAt as string, 10) : undefined,
      completedAt: txDataRaw.completedAt ? parseInt(txDataRaw.completedAt as string, 10) : undefined,
      cancelledAt: txDataRaw.cancelledAt ? parseInt(txDataRaw.cancelledAt as string, 10) : undefined,
      result: txDataRaw.result ? JSON.parse(txDataRaw.result as string) : undefined,
      error: txDataRaw.error as string | undefined,
      lastError: txDataRaw.lastError as string | undefined,
      retryCount: txDataRaw.retryCount ? parseInt(txDataRaw.retryCount as string, 10) : 0,
      lastRetryAt: txDataRaw.lastRetryAt ? parseInt(txDataRaw.lastRetryAt as string, 10) : undefined,
      nextRetryAt: txDataRaw.nextRetryAt ? parseInt(txDataRaw.nextRetryAt as string, 10) : undefined,
    };

    // Calculate progress percentage based on status
    let progress = 0;
    switch (txData.status) {
      case 'queued':
        progress = 10;
        break;
      case 'processing':
        progress = 50;
        break;
      case 'completed':
        progress = 100;
        break;
      case 'failed':
      case 'cancelled':
        progress = 0;
        break;
    }

    // Prepare response
    const response = {
      success: true,
      transaction: {
        id: txData.id,
        status: txData.status,
        type: txData.transaction.type,
        progress,
        createdAt: txData.createdAt,
        updatedAt: txData.updatedAt,
        completedAt: txData.completedAt,
        cancelledAt: txData.cancelledAt,
        retryCount: txData.retryCount,
        nextRetryAt: txData.nextRetryAt,
        error: txData.error,
        lastError: txData.lastError,
        result: txData.result,
        metadata: {
          description: txData.metadata.description,
          userId: txData.metadata.userId,
        },
      },
    };

    return NextResponse.json(response, { 
      headers: getSecurityHeaders(request) 
    });

  } catch (error) {
    console.error('Transaction status API error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve transaction status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers: getSecurityHeaders(request) }
    );
  }
}

// Helper endpoint to cancel a transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transactionId = params.id;

    if (!transactionId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Transaction ID is required' 
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    // Initialize TransactionManager
    const transactionManager = getTransactionManager({
      processor: tokenDeploymentProcessor,
      maxRetries: 3,
      retryDelay: 5000,
    });

    // Attempt to cancel the transaction
    const cancelled = await transactionManager.cancelTransaction(transactionId);

    if (cancelled) {
      return NextResponse.json(
        { 
          success: true, 
          message: 'Transaction cancelled successfully' 
        },
        { headers: getSecurityHeaders(request) }
      );
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Transaction cannot be cancelled (may already be processing or completed)' 
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

  } catch (error) {
    console.error('Transaction cancellation error:', error);
    
    let errorMessage = 'Failed to cancel transaction';
    let statusCode = 500;

    if (error instanceof Error && error.message === 'Transaction not found') {
      errorMessage = 'Transaction not found';
      statusCode = 404;
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: statusCode, headers: getSecurityHeaders(request) }
    );
  }
}