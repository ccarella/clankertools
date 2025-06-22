/**
 * Team member information for token distribution
 */
export interface TeamMember {
  /** Ethereum address of the team member */
  address: string;
  /** Display name of the team member */
  name: string;
  /** Role within the team (e.g., "Founder", "Developer", "Advisor") */
  role: string;
  /** Percentage of team allocation (0-100) */
  percentage: number;
}

/**
 * Vesting schedule configuration for token distribution
 */
export interface VestingSchedule {
  /** Type of vesting schedule */
  type: 'linear' | 'cliff' | 'milestone' | 'custom';
  /** Total duration of vesting in months */
  duration: number;
  /** Cliff period in months (tokens locked until cliff ends) */
  cliff?: number;
  /** Initial release percentage at TGE (Token Generation Event) */
  initialRelease?: number;
  /** Custom milestones for milestone-based vesting */
  milestones?: Array<{
    /** Timestamp or month number for milestone */
    date: number;
    /** Percentage to release at this milestone */
    percentage: number;
    /** Description of the milestone */
    description?: string;
  }>;
}

/**
 * Form data structure for team token creation UI
 */
export interface TeamTokenFormData {
  /** Basic token information */
  tokenName: string;
  tokenSymbol: string;
  tokenDescription?: string;
  tokenImage?: File | string | null;
  
  /** Team distribution settings */
  teamAllocationPercentage: number;
  teamMembers: TeamMember[];
  
  /** Vesting configuration */
  vestingEnabled: boolean;
  vestingSchedule?: VestingSchedule;
  
  /** Additional settings */
  treasuryAddress?: string;
  treasuryPercentage?: number;
  communityPercentage?: number;
  liquidityPercentage?: number;
  
  /** Launch settings */
  launchType: 'immediate' | 'scheduled' | 'whitelist';
  launchDate?: Date;
  whitelistAddresses?: string[];
}

/**
 * API request structure for team token deployment
 */
export interface TeamTokenDeploymentRequest {
  /** Token metadata */
  name: string;
  symbol: string;
  description?: string;
  imageUrl?: string;
  
  /** Distribution configuration */
  distributions: Array<{
    address: string;
    percentage: number;
    vestingSchedule?: VestingSchedule;
  }>;
  
  /** Treasury configuration */
  treasury?: {
    address: string;
    percentage: number;
  };
  
  /** Launch configuration */
  launch: {
    type: 'immediate' | 'scheduled' | 'whitelist';
    timestamp?: number;
    whitelist?: string[];
  };
  
  /** Additional metadata */
  metadata?: {
    website?: string;
    twitter?: string;
    discord?: string;
    telegram?: string;
  };
}

/**
 * Response from team token deployment
 */
export interface TeamTokenDeploymentResponse {
  success: boolean;
  tokenAddress?: string;
  transactionHash?: string;
  vestingContracts?: Array<{
    beneficiary: string;
    contractAddress: string;
  }>;
  error?: string;
}

