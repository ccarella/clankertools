import { NextRequest, NextResponse } from 'next/server';
import { getTransactionManager } from '@/lib/transaction/TransactionManager';
import { tokenDeploymentProcessor, TokenDeploymentPayload } from '@/lib/transaction/processors/tokenDeploymentProcessor';

export const runtime = 'edge';

// Interface for team member data
interface TeamMember {
  address: string;
  percentage: number;
  role: string;
  vestingMonths: number;
  cliffMonths?: number;
}

// Interface for treasury allocation
interface TreasuryAllocation {
  percentage: number;
  address: string;
  vestingMonths?: number;
}

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

// Validate Ethereum address
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Validate team member data
function validateTeamMember(member: TeamMember, index: number): string | null {
  if (!isValidAddress(member.address)) {
    return `Invalid team member address at index ${index}`;
  }

  if (member.percentage < 0.1) {
    return 'Minimum allocation is 0.1%';
  }

  if (member.percentage > 100) {
    return 'Percentage cannot exceed 100%';
  }

  if (!member.role || member.role.length === 0) {
    return 'Role is required';
  }

  if (member.role.length > 50) {
    return 'Role must be 50 characters or less';
  }

  if (member.vestingMonths < 0) {
    return 'Invalid vesting period';
  }

  if (member.vestingMonths > 60) {
    return 'Maximum vesting period is 60 months';
  }

  if (member.cliffMonths !== undefined) {
    if (member.cliffMonths < 0) {
      return 'Invalid cliff period';
    }
    if (member.cliffMonths > member.vestingMonths) {
      return 'Cliff period cannot exceed vesting period';
    }
  }

  return null;
}

export async function OPTIONS(request: NextRequest) {
  const headers = getSecurityHeaders(request);
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const rawName = formData.get('name') as string;
    const rawSymbol = formData.get('symbol') as string;
    const imageFile = formData.get('image') as Blob;
    const fid = formData.get('fid') as string;
    const teamMembersString = formData.get('teamMembers') as string;
    const treasuryPercentageString = formData.get('treasuryPercentage') as string;
    const treasuryAddress = formData.get('treasuryAddress') as string;
    const treasuryVestingMonthsString = formData.get('treasuryVestingMonths') as string;

    // Check authentication - require fid
    if (!fid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Authentication required'
        },
        { status: 401, headers: getSecurityHeaders(request) }
      );
    }

    // Sanitize inputs
    const name = rawName ? sanitizeInput(rawName) : '';
    const symbol = rawSymbol ? sanitizeInput(rawSymbol) : '';

    // Validate required fields
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
          }
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    // Parse team members
    let teamMembers: TeamMember[] = [];
    if (teamMembersString) {
      try {
        teamMembers = JSON.parse(teamMembersString);
        if (!Array.isArray(teamMembers)) {
          throw new Error('Team members must be an array');
        }
      } catch {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid team members data',
            errorDetails: {
              type: 'VALIDATION_ERROR',
              details: 'Team members JSON is invalid',
              userMessage: 'Invalid team members data format',
            }
          },
          { status: 400, headers: getSecurityHeaders(request) }
        );
      }
    }

    // Validate team member count
    if (teamMembers.length > 10) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Maximum 10 team members allowed',
          errorDetails: {
            type: 'VALIDATION_ERROR',
            details: `Team member count: ${teamMembers.length}`,
            userMessage: 'You can have a maximum of 10 team members',
            teamMemberCount: teamMembers.length,
          }
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    // Validate each team member
    const memberAddresses = new Set<string>();
    for (let i = 0; i < teamMembers.length; i++) {
      const member = teamMembers[i];
      
      // Check for required fields
      if (!member.address || member.percentage === undefined || !member.role || member.vestingMonths === undefined) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid team member data',
            errorDetails: {
              type: 'VALIDATION_ERROR',
              details: `Missing required fields for team member at index ${i}`,
              userMessage: 'All team members must have address, percentage, role, and vesting months',
            }
          },
          { status: 400, headers: getSecurityHeaders(request) }
        );
      }

      // Validate member data
      const validationError = validateTeamMember(member, i);
      if (validationError) {
        return NextResponse.json(
          { 
            success: false, 
            error: validationError,
            errorDetails: {
              type: 'VALIDATION_ERROR',
              details: validationError,
              userMessage: validationError,
            }
          },
          { status: 400, headers: getSecurityHeaders(request) }
        );
      }

      // Check for duplicate addresses
      const normalizedAddress = member.address.toLowerCase();
      if (memberAddresses.has(normalizedAddress)) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Duplicate team member address',
            errorDetails: {
              type: 'VALIDATION_ERROR',
              details: `Duplicate address: ${member.address}`,
              userMessage: 'Each team member must have a unique address',
            }
          },
          { status: 400, headers: getSecurityHeaders(request) }
        );
      }
      memberAddresses.add(normalizedAddress);
    }

    // Parse treasury allocation
    let treasuryAllocation: TreasuryAllocation | null = null;
    const treasuryPercentage = treasuryPercentageString ? parseFloat(treasuryPercentageString) : 0;
    
    if (treasuryPercentage > 0) {
      if (!treasuryAddress || !isValidAddress(treasuryAddress)) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid treasury address',
            errorDetails: {
              type: 'VALIDATION_ERROR',
              details: 'Treasury address is required when treasury percentage is set',
              userMessage: 'Please provide a valid treasury address',
            }
          },
          { status: 400, headers: getSecurityHeaders(request) }
        );
      }

      treasuryAllocation = {
        percentage: treasuryPercentage,
        address: treasuryAddress,
      };

      if (treasuryVestingMonthsString) {
        const vestingMonths = parseInt(treasuryVestingMonthsString, 10);
        if (isNaN(vestingMonths) || vestingMonths < 0 || vestingMonths > 60) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Invalid treasury vesting period',
              errorDetails: {
                type: 'VALIDATION_ERROR',
                details: 'Treasury vesting must be between 0 and 60 months',
                userMessage: 'Treasury vesting period must be between 0 and 60 months',
              }
            },
            { status: 400, headers: getSecurityHeaders(request) }
          );
        }
        treasuryAllocation.vestingMonths = vestingMonths;
      }
    }

    // Calculate total allocation
    const teamAllocation = teamMembers.reduce((sum, member) => sum + member.percentage, 0);
    const totalAllocation = teamAllocation + treasuryPercentage;

    if (totalAllocation > 100) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Total allocation exceeds 100%',
          errorDetails: {
            type: 'VALIDATION_ERROR',
            details: `Total allocation: ${totalAllocation}% (team: ${teamAllocation}%, treasury: ${treasuryPercentage}%)`,
            userMessage: 'The combined team and treasury allocation cannot exceed 100%',
            totalAllocation,
            teamAllocation,
            treasuryPercentage,
          }
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    // Prepare token deployment payload for team deployment
    const deploymentPayload: TokenDeploymentPayload = {
      name,
      symbol,
      imageFile,
      fid,
      teamMembers,
      treasuryAllocation: treasuryAllocation || undefined,
    };

    // Initialize TransactionManager with token deployment processor
    const transactionManager = getTransactionManager({
      processor: tokenDeploymentProcessor,
      maxRetries: 3,
      retryDelay: 5000,
    });

    // Queue the team token deployment transaction
    try {
      const transactionId = await transactionManager.queueTransaction(
        {
          type: 'team_token_deployment',
          payload: deploymentPayload as Record<string, unknown>,
        },
        {
          userId: parseInt(fid, 10),
          description: `Team token deployment: ${name} (${symbol}) with ${teamMembers.length} members`,
        },
        'high' // High priority for token deployments
      );

      // Start processing if not already running
      transactionManager.startAutoProcessing(5000);

      return NextResponse.json({
        success: true,
        transactionId,
        message: 'Team token deployment queued successfully',
        statusUrl: `/api/transaction/${transactionId}`,
        teamMembers,
        ...(treasuryAllocation && { treasuryAllocation }),
      }, { headers: getSecurityHeaders(request) });

    } catch (error) {
      console.error('Failed to queue team token deployment:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to queue team token deployment',
          errorDetails: {
            type: 'QUEUE_ERROR',
            details: error instanceof Error ? error.message : 'Unknown error',
            userMessage: 'Failed to start team token deployment. Please try again.',
          }
        },
        { status: 500, headers: getSecurityHeaders(request) }
      );
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'An unexpected error occurred',
        errorDetails: {
          type: 'UNKNOWN_ERROR',
          details: error instanceof Error ? error.message : 'An unexpected error occurred',
          userMessage: 'Something went wrong. Please try again.',
        }
      },
      { status: 500, headers: getSecurityHeaders(request) }
    );
  }
}