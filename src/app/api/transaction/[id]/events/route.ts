import { NextRequest } from 'next/server';
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
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Cache-Control');
  headers.set('Access-Control-Max-Age', '86400');
  
  // SSE headers
  headers.set('Content-Type', 'text/event-stream');
  headers.set('Cache-Control', 'no-cache');
  headers.set('Connection', 'keep-alive');
  
  // Security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  
  return headers;
}

export async function OPTIONS(request: NextRequest) {
  const headers = getSecurityHeaders(request);
  return new Response(null, { status: 204, headers });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const transactionId = params.id;

  // Validate transaction ID
  if (!transactionId || !transactionId.startsWith('tx_') || transactionId.length < 10) {
    return new Response('Invalid transaction ID', { status: 400 });
  }

  const headers = getSecurityHeaders(request);
  
  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      let unsubscribe: (() => Promise<void>) | null = null;
      let heartbeatInterval: NodeJS.Timeout | null = null;
      let connectionClosed = false;

      const cleanup = async () => {
        if (connectionClosed) return;
        connectionClosed = true;
        
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
        
        if (unsubscribe) {
          try {
            await unsubscribe();
          } catch (error) {
            console.error('Error during cleanup:', error);
          }
        }
        
        controller.close();
      };

      const sendEvent = (event: string, data: unknown) => {
        if (connectionClosed) return;
        
        try {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(message));
        } catch (error) {
          console.error('Error sending SSE event:', error);
          cleanup();
        }
      };

      const initializeConnection = async () => {
        try {
          // Initialize TransactionManager
          const transactionManager = getTransactionManager({
            processor: tokenDeploymentProcessor,
            maxRetries: 3,
            retryDelay: 5000,
          });

          // Get initial transaction status
          const redis = transactionManager['redis'];
          const txDataRaw = await redis.hgetall(`tx:data:${transactionId}`);
          
          if (!txDataRaw || Object.keys(txDataRaw).length === 0) {
            sendEvent('error', { message: 'Transaction not found' });
            cleanup();
            return;
          }

          // Parse and send initial status
          const txData = {
            id: transactionId,
            status: txDataRaw.status as string,
            createdAt: parseInt(txDataRaw.createdAt as string, 10),
            updatedAt: txDataRaw.updatedAt ? parseInt(txDataRaw.updatedAt as string, 10) : undefined,
            completedAt: txDataRaw.completedAt ? parseInt(txDataRaw.completedAt as string, 10) : undefined,
            error: txDataRaw.error as string | undefined,
            retryCount: txDataRaw.retryCount ? parseInt(txDataRaw.retryCount as string, 10) : 0,
          };

          // Calculate progress
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

          sendEvent('status', {
            ...txData,
            progress,
            timestamp: Date.now(),
          });

          // Subscribe to transaction updates
          unsubscribe = await transactionManager.subscribeToTransaction(
            transactionId,
            (update) => {
              if (connectionClosed) return;
              
              // Calculate progress for the update
              let updateProgress = 0;
              switch (update.status) {
                case 'queued':
                  updateProgress = 10;
                  break;
                case 'processing':
                  updateProgress = 50;
                  break;
                case 'completed':
                  updateProgress = 100;
                  break;
                case 'failed':
                case 'cancelled':
                  updateProgress = 0;
                  break;
              }

              sendEvent('status', {
                ...update,
                progress: updateProgress,
                timestamp: update.timestamp || Date.now(),
              });

              // Close connection if transaction is in terminal state
              if (update.status === 'completed' || update.status === 'failed' || update.status === 'cancelled') {
                setTimeout(() => cleanup(), 1000); // Small delay to ensure message is sent
              }
            }
          );

          // Send heartbeat every 30 seconds to keep connection alive
          heartbeatInterval = setInterval(() => {
            if (connectionClosed) return;
            sendEvent('heartbeat', { timestamp: Date.now() });
          }, 30000);

          // Send initial heartbeat
          sendEvent('heartbeat', { timestamp: Date.now() });

        } catch (error) {
          console.error('SSE connection error:', error);
          sendEvent('error', { 
            message: 'Failed to initialize connection',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
          cleanup();
        }
      };

      // Initialize the connection
      initializeConnection();

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        cleanup();
      });
    },
    
    cancel() {
      // This is called when the client closes the connection
    }
  });

  return new Response(stream, { headers });
}