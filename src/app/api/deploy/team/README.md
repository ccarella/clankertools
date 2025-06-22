# Team Token Deployment API

This directory contains the API route for deploying team tokens with advanced features:

## Features

- **Team Member Allocations**: Distribute tokens to multiple team members with configurable percentages
- **Vesting Schedules**: Set individual vesting periods (with optional cliff periods) for each team member
- **Treasury Management**: Allocate tokens to a treasury address with optional vesting
- **Validation**: Comprehensive validation of addresses, percentages, and limits

## Request Format

```typescript
POST /api/deploy/team
Content-Type: multipart/form-data

Fields:
- name: string (required, max 32 chars)
- symbol: string (required, 3-8 chars)
- image: File (required, image file)
- teamMembers: JSON array of team member objects
  - address: string (valid Ethereum address)
  - percentage: number (0.1-100)
  - role: string (max 50 chars)
  - vestingMonths: number (0-60)
  - cliffMonths?: number (optional, must be less than vestingMonths)
- treasuryPercentage?: number (optional, 0-100)
- treasuryAddress?: string (optional, valid Ethereum address)
- treasuryVestingMonths?: number (optional, 0-60)
```

## Validation Rules

1. **Total Allocation**: Sum of all team member percentages + treasury percentage must not exceed 100%
2. **Team Size**: Maximum 10 team members
3. **Minimum Allocation**: Each allocation must be at least 0.1%
4. **Unique Addresses**: No duplicate team member addresses
5. **Vesting Limits**: Maximum vesting period is 60 months (5 years)
6. **Authentication**: Requires valid Farcaster authentication

## Response Format

```typescript
{
  success: boolean,
  tokenAddress?: string,
  txHash?: string,
  imageUrl?: string,
  network?: string,
  chainId?: number,
  teamMembers?: Array<{
    address: string,
    percentage: number,
    role: string,
    vestingMonths: number,
    cliffMonths?: number
  }>,
  treasuryAllocation?: {
    percentage: number,
    address: string,
    vestingMonths?: number
  },
  error?: string,
  errorDetails?: object
}
```

## Implementation Notes

When implementing this route:

1. Reuse deployment logic from simple/advanced routes
2. Implement vesting contract integration
3. Store team member data in Redis for tracking
4. Ensure proper error handling for all validation cases
5. Track deployment with appropriate metadata