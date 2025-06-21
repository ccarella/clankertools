export interface WizardData {
  // Token Basics
  name?: string;
  symbol?: string;
  description?: string;
  image?: File | string | null;
  
  // Liquidity Settings
  liquidityAmount?: string;
  liquidityCurve?: string;
  lpTokenSymbol?: string;
  maxSlippage?: number;
  liquidityPositions?: Array<{
    id: string;
    rangeStart: number;
    rangeEnd: number;
    allocation: number;
  }>;
  
  // Fee Configuration
  swapFee?: number;
  protocolFee?: number;
  dynamicFees?: boolean;
  minFee?: number;
  maxFee?: number;
  
  // Rewards & Splits
  creatorRewardsEnabled?: boolean;
  creatorAddress?: string;
  creatorPercentage?: number;
  rewardSplits?: Array<{
    address: string;
    percentage: number;
    name?: string;
  }>;
  
  // Extensions
  extensions?: string[];
  
  // MEV Protection
  mevProtectionEnabled?: boolean;
  mevStrategy?: string;
  privateLaunch?: boolean;
}

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  fields: string[];
  component: React.ComponentType<WizardStepProps>;
  validate?: (data: WizardData) => Promise<ValidationResult>;
}

export interface WizardStepProps {
  data: WizardData;
  onChange: (field: string, value: unknown) => void;
  errors?: Record<string, string>;
  isActive: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  fieldErrors?: Record<string, string>;
}

export interface WizardContainerProps {
  steps: WizardStep[];
  onComplete: (data: WizardData) => void | Promise<void>;
  onStepChange?: (stepIndex: number) => void;
  initialStep?: number;
  completedSteps?: number[];
  persistKey?: string;
  className?: string;
  reviewComponent?: React.ComponentType<{ data: WizardData; onEdit: (stepIndex: number) => void }>;
}

export interface WizardState {
  currentStep: number;
  completedSteps: number[];
  data: WizardData;
  errors: Record<string, string>;
}