import { LiquidityPositionData, CurvePoint, ValidationResult, CurvePreset, PresetType } from './types';

export function calculateLiquidityCurve(positions: LiquidityPositionData[]): CurvePoint[] {
  if (!positions.length) return [];
  
  const points: CurvePoint[] = [];
  
  // Generate points from 0 to 100
  for (let price = 0; price <= 100; price++) {
    const liquidity = calculateEffectiveLiquidity(positions, price);
    points.push({ price, liquidity });
  }
  
  return points;
}

export function calculateEffectiveLiquidity(positions: LiquidityPositionData[], price: number): number {
  return positions.reduce((total, position) => {
    if (price >= position.rangeStart && price <= position.rangeEnd) {
      return total + position.allocation;
    }
    return total;
  }, 0);
}

export function calculatePriceImpact(
  positions: LiquidityPositionData[], 
  currentPrice: number, 
  tradeSize: number
): number {
  if (tradeSize === 0) return 0;
  
  const effectiveLiquidity = calculateEffectiveLiquidity(positions, currentPrice);
  
  if (effectiveLiquidity === 0) {
    // No liquidity at current price, high impact
    return 100;
  }
  
  // Simplified price impact calculation
  // In reality, this would use a bonding curve formula
  const baseImpact = (tradeSize / effectiveLiquidity) * 10;
  
  // Cap at 100%
  return Math.min(100, baseImpact);
}

export function validatePositions(positions: LiquidityPositionData[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (positions.length === 0) {
    errors.push('At least one position is required');
    return { isValid: false, errors };
  }
  
  // Check total allocation
  const totalAllocation = positions.reduce((sum, pos) => sum + pos.allocation, 0);
  if (Math.abs(totalAllocation - 100) > 0.01) {
    errors.push(`Total allocation must equal 100% (current: ${totalAllocation.toFixed(1)}%)`);
  }
  
  // Check individual positions
  positions.forEach((pos, index) => {
    if (pos.rangeEnd <= pos.rangeStart) {
      errors.push(`Position ${index + 1}: Range end must be greater than start`);
    }
    
    if (pos.rangeStart < 0 || pos.rangeEnd > 100) {
      errors.push(`Position ${index + 1}: Range must be between 0 and 100`);
    }
    
    if (pos.allocation <= 0 || pos.allocation > 100) {
      errors.push(`Position ${index + 1}: Allocation must be between 0 and 100%`);
    }
  });
  
  // Check for overlaps
  const overlaps = detectOverlappingRanges(positions);
  if (overlaps.length > 0) {
    warnings.push('Positions have overlapping ranges');
  }
  
  // Check for unusual configurations
  const veryNarrowPositions = positions.filter(
    pos => (pos.rangeEnd - pos.rangeStart) < 5 && pos.allocation > 50
  );
  if (veryNarrowPositions.length > 0) {
    warnings.push('Very narrow ranges with high allocation detected - may cause high slippage');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function detectOverlappingRanges(positions: LiquidityPositionData[]): string[][] {
  const overlaps: string[][] = [];
  
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const pos1 = positions[i];
      const pos2 = positions[j];
      
      // Check if ranges overlap
      if (pos1.rangeStart < pos2.rangeEnd && pos2.rangeStart < pos1.rangeEnd) {
        overlaps.push([pos1.id, pos2.id]);
      }
    }
  }
  
  return overlaps;
}

export function normalizeAllocations(positions: LiquidityPositionData[]): LiquidityPositionData[] {
  if (positions.length === 0) return [];
  
  const totalAllocation = positions.reduce((sum, pos) => sum + pos.allocation, 0);
  
  if (totalAllocation === 0) {
    // Equal distribution if all allocations are 0
    const equalAllocation = 100 / positions.length;
    return positions.map(pos => ({
      ...pos,
      allocation: equalAllocation,
    }));
  }
  
  // Normalize to sum to 100
  const factor = 100 / totalAllocation;
  return positions.map(pos => ({
    ...pos,
    allocation: pos.allocation * factor,
  }));
}

export const CURVE_PRESETS: Record<PresetType, CurvePreset> = {
  conservative: {
    name: 'Conservative',
    description: 'Concentrated liquidity around mid-range for stability',
    icon: '🛡️',
    positions: [
      { rangeStart: 40, rangeEnd: 60, allocation: 50 },
      { rangeStart: 30, rangeEnd: 40, allocation: 25 },
      { rangeStart: 60, rangeEnd: 70, allocation: 25 },
    ],
  },
  balanced: {
    name: 'Balanced',
    description: 'Even distribution across price range',
    icon: '⚖️',
    positions: [
      { rangeStart: 0, rangeEnd: 20, allocation: 20 },
      { rangeStart: 20, rangeEnd: 40, allocation: 20 },
      { rangeStart: 40, rangeEnd: 60, allocation: 20 },
      { rangeStart: 60, rangeEnd: 80, allocation: 20 },
      { rangeStart: 80, rangeEnd: 100, allocation: 20 },
    ],
  },
  aggressive: {
    name: 'Aggressive',
    description: 'High liquidity at extremes for volatility',
    icon: '🚀',
    positions: [
      { rangeStart: 0, rangeEnd: 10, allocation: 25 },
      { rangeStart: 10, rangeEnd: 30, allocation: 15 },
      { rangeStart: 40, rangeEnd: 60, allocation: 20 },
      { rangeStart: 70, rangeEnd: 90, allocation: 15 },
      { rangeStart: 90, rangeEnd: 100, allocation: 25 },
    ],
  },
  wide: {
    name: 'Wide Range',
    description: 'Full range coverage for maximum accessibility',
    icon: '🌊',
    positions: [
      { rangeStart: 0, rangeEnd: 100, allocation: 100 },
    ],
  },
};

export function generatePresetCurve(preset: PresetType): LiquidityPositionData[] {
  const presetConfig = CURVE_PRESETS[preset];
  if (!presetConfig) {
    throw new Error(`Invalid preset: ${preset}`);
  }
  
  return presetConfig.positions.map((pos, index) => ({
    id: `preset-${preset}-${index}`,
    ...pos,
  }));
}

export function calculateLiquidityMetrics(positions: LiquidityPositionData[]) {
  if (positions.length === 0) {
    return {
      totalLiquidity: 0,
      concentrationScore: 0,
      priceRangeUtilization: 0,
      averageAllocation: 0,
    };
  }
  
  const totalLiquidity = positions.reduce((sum, pos) => sum + pos.allocation, 0);
  
  // Calculate concentration score (higher score = more concentrated)
  const averageRange = positions.reduce((sum, pos) => sum + (pos.rangeEnd - pos.rangeStart), 0) / positions.length;
  const concentrationScore = Math.max(0, 100 - averageRange);
  
  // Calculate price range utilization
  const coveredRanges = new Set<number>();
  positions.forEach(pos => {
    for (let i = pos.rangeStart; i <= pos.rangeEnd; i++) {
      coveredRanges.add(i);
    }
  });
  const priceRangeUtilization = coveredRanges.size;
  
  const averageAllocation = totalLiquidity / positions.length;
  
  return {
    totalLiquidity,
    concentrationScore,
    priceRangeUtilization,
    averageAllocation,
  };
}