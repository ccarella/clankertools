import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTransactionManager } from '@/lib/transaction/TransactionManager'
import { tokenDeploymentProcessor, TokenDeploymentPayload } from '@/lib/transaction/processors/tokenDeploymentProcessor'

export const runtime = 'edge'

const memeDeploySchema = z.object({
  name: z.string().min(1).max(50),
  symbol: z.string().min(1).max(10),
  fid: z.string(),
  template: z.literal('meme')
})

// Security headers configuration
function getSecurityHeaders(request: NextRequest): Headers {
  const headers = new Headers()
  const origin = request.headers.get('origin')
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*']
  
  // CORS headers
  if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
    headers.set('Access-Control-Allow-Origin', origin)
  } else if (allowedOrigins.includes('*')) {
    headers.set('Access-Control-Allow-Origin', '*')
  }
  
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  headers.set('Access-Control-Max-Age', '86400')
  
  // Security headers
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-XSS-Protection', '1; mode=block')
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  
  return headers
}

// Handle OPTIONS requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getSecurityHeaders(request) })
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    const data = {
      name: formData.get('name') as string,
      symbol: formData.get('symbol') as string,
      fid: formData.get('fid') as string,
      template: formData.get('template') as string
    }
    
    const validatedData = memeDeploySchema.parse(data)
    const imageFile = formData.get('image') as File
    
    if (!imageFile) {
      return NextResponse.json(
        { success: false, error: 'Image is required' },
        { status: 400, headers: getSecurityHeaders(request) }
      )
    }

    if (imageFile.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Image must be less than 5MB' },
        { status: 400, headers: getSecurityHeaders(request) }
      )
    }

    // Prepare meme token deployment payload with special settings
    const deploymentPayload: TokenDeploymentPayload = {
      name: validatedData.name,
      symbol: validatedData.symbol,
      imageFile,
      fid: validatedData.fid,
      metadata: {
        template: 'meme',
        maxSupply: '420690000000',
        burnEnabled: true,
        launchMode: 'quick'
      }
    }

    // Initialize TransactionManager with token deployment processor
    const transactionManager = getTransactionManager({
      processor: tokenDeploymentProcessor,
      maxRetries: 3,
      retryDelay: 5000,
    })

    // Queue the meme token deployment transaction
    const transactionId = await transactionManager.queueTransaction(
      {
        type: 'token_deployment',
        payload: deploymentPayload,
      },
      {
        userId: parseInt(validatedData.fid, 10),
        description: `Meme token deployment: ${validatedData.name} (${validatedData.symbol})`,
      },
      'high' // High priority for meme deployments
    )

    console.log('[Meme Deploy] Transaction queued:', {
      transactionId,
      name: validatedData.name,
      symbol: validatedData.symbol,
      fid: validatedData.fid
    })

    return NextResponse.json({
      success: true,
      transactionId,
      message: 'Meme token deployment queued successfully'
    }, { headers: getSecurityHeaders(request) })
  } catch (error) {
    console.error('Meme deployment error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid input data',
          details: error.errors 
        },
        { status: 400, headers: getSecurityHeaders(request) }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to deploy meme token' 
      },
      { status: 500, headers: getSecurityHeaders(request) }
    )
  }
}