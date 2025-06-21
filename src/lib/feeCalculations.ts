export interface FeeConfiguration {
  creatorFeePercentage: number;
  platformFeePercentage: number;
  totalFeePercentage: number;
}

export interface FeeCalculationResult {
  totalFee: number;
  creatorFee: number;
  platformFee: number;
  netAmount: number;
}

export interface FeePreset {
  name: string;
  description: string;
  creatorPercentage: number;
  platformPercentage: number;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const PRESET_FEE_STRUCTURES: Record<string, FeePreset> = {
  standard: {
    name: 'Standard',
    description: '80/20 split',
    creatorPercentage: 80,
    platformPercentage: 20,
  },
  creatorFocused: {
    name: 'Creator Focused',
    description: '90/10 split',
    creatorPercentage: 90,
    platformPercentage: 10,
  },
  balanced: {
    name: 'Balanced',
    description: '70/30 split',
    creatorPercentage: 70,
    platformPercentage: 30,
  },
};

export function calculateFeeAmounts(
  tradeAmount: number,
  config: FeeConfiguration
): FeeCalculationResult {
  if (tradeAmount < 0) {
    throw new Error('Trade amount must be non-negative');
  }

  const totalPercentage = config.creatorFeePercentage + config.platformFeePercentage;
  if (Math.abs(totalPercentage - 100) > 0.001) {
    throw new Error('Fee percentages must sum to 100%');
  }

  const totalFee = (tradeAmount * config.totalFeePercentage) / 100;
  const creatorFee = (totalFee * config.creatorFeePercentage) / 100;
  const platformFee = (totalFee * config.platformFeePercentage) / 100;
  const netAmount = tradeAmount - totalFee;

  return {
    totalFee,
    creatorFee,
    platformFee,
    netAmount,
  };
}

export function calculateCreatorPlatformSplit(creatorPercentage: number): {
  creatorPercentage: number;
  platformPercentage: number;
} {
  if (creatorPercentage < 0 || creatorPercentage > 100) {
    throw new Error('Creator percentage must be between 0 and 100');
  }

  return {
    creatorPercentage,
    platformPercentage: 100 - creatorPercentage,
  };
}

export function formatFeePercentage(percentage: number, decimalPlaces: number = 2): string {
  const factor = Math.pow(10, decimalPlaces);
  const rounded = Math.round(percentage * factor) / factor;
  
  if (decimalPlaces === 0) {
    return `${rounded.toFixed(0)}%`;
  }
  
  const formatted = rounded.toFixed(decimalPlaces);
  const trimmed = formatted.replace(/\.?0+$/, '');
  
  return `${trimmed}%`;
}

export function validateFeePercentage(
  percentage: number,
  min: number = 0,
  max: number = 100
): ValidationResult {
  if (percentage < min || percentage > max) {
    return {
      isValid: false,
      error: `Fee percentage must be between ${min}% and ${max}%`,
    };
  }

  return { isValid: true };
}