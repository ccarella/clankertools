import {
  calculateLiquidityCurve,
  calculatePriceImpact,
  validatePositions,
  generatePresetCurve,
  detectOverlappingRanges,
  normalizeAllocations,
  calculateEffectiveLiquidity,
  CURVE_PRESETS,
} from '../curveUtils';
import { LiquidityPositionData } from '../types';

describe('curveUtils', () => {
  describe('calculateLiquidityCurve', () => {
    it('generates curve points for single position', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 0, rangeEnd: 100, allocation: 100 },
      ];

      const curve = calculateLiquidityCurve(positions);

      expect(curve).toHaveLength(101); // 0-100 inclusive
      expect(curve[0]).toEqual({ price: 0, liquidity: 100 });
      expect(curve[50]).toEqual({ price: 50, liquidity: 100 });
      expect(curve[100]).toEqual({ price: 100, liquidity: 100 });
    });

    it('generates curve points for multiple positions', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 0, rangeEnd: 50, allocation: 60 },
        { id: '2', rangeStart: 50, rangeEnd: 100, allocation: 40 },
      ];

      const curve = calculateLiquidityCurve(positions);

      expect(curve[25]).toEqual({ price: 25, liquidity: 60 });
      expect(curve[50]).toEqual({ price: 50, liquidity: 40 });
      expect(curve[75]).toEqual({ price: 75, liquidity: 40 });
    });

    it('handles overlapping positions correctly', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 0, rangeEnd: 60, allocation: 50 },
        { id: '2', rangeStart: 40, rangeEnd: 100, allocation: 50 },
      ];

      const curve = calculateLiquidityCurve(positions);

      expect(curve[30]).toEqual({ price: 30, liquidity: 50 });
      expect(curve[50]).toEqual({ price: 50, liquidity: 100 }); // Both positions active
      expect(curve[80]).toEqual({ price: 80, liquidity: 50 });
    });

    it('returns empty array for no positions', () => {
      const curve = calculateLiquidityCurve([]);
      expect(curve).toEqual([]);
    });
  });

  describe('calculatePriceImpact', () => {
    it('calculates price impact for uniform liquidity', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 0, rangeEnd: 100, allocation: 100 },
      ];

      const impact = calculatePriceImpact(positions, 10, 1);
      expect(impact).toBeCloseTo(0.1, 2); // 10% of trade size with uniform liquidity
    });

    it('calculates higher impact for concentrated liquidity', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 45, rangeEnd: 55, allocation: 100 },
      ];

      const impactInRange = calculatePriceImpact(positions, 50, 1);
      const impactOutOfRange = calculatePriceImpact(positions, 20, 1);

      expect(impactOutOfRange).toBeGreaterThan(impactInRange);
    });

    it('returns 0 for zero trade size', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 0, rangeEnd: 100, allocation: 100 },
      ];

      const impact = calculatePriceImpact(positions, 50, 0);
      expect(impact).toBe(0);
    });

    it('handles edge case prices correctly', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 10, rangeEnd: 90, allocation: 100 },
      ];

      const impactAtStart = calculatePriceImpact(positions, 0, 1);
      const impactAtEnd = calculatePriceImpact(positions, 100, 1);

      expect(impactAtStart).toBeGreaterThan(0);
      expect(impactAtEnd).toBeGreaterThan(0);
    });
  });

  describe('validatePositions', () => {
    it('validates correct positions', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 0, rangeEnd: 50, allocation: 60 },
        { id: '2', rangeStart: 50, rangeEnd: 100, allocation: 40 },
      ];

      const result = validatePositions(positions);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('detects allocation not summing to 100%', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 0, rangeEnd: 50, allocation: 60 },
        { id: '2', rangeStart: 50, rangeEnd: 100, allocation: 30 },
      ];

      const result = validatePositions(positions);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Total allocation must equal 100% (current: 90%)');
    });

    it('detects invalid ranges', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 60, rangeEnd: 40, allocation: 100 }, // End before start
      ];

      const result = validatePositions(positions);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Position 1: Range end must be greater than start');
    });

    it('detects overlapping ranges warning', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 0, rangeEnd: 60, allocation: 50 },
        { id: '2', rangeStart: 40, rangeEnd: 100, allocation: 50 },
      ];

      const result = validatePositions(positions);
      expect(result.warnings).toContain('Positions have overlapping ranges');
    });

    it('validates empty positions array', () => {
      const result = validatePositions([]);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one position is required');
    });

    it('detects positions outside valid range', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: -10, rangeEnd: 110, allocation: 100 },
      ];

      const result = validatePositions(positions);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Position 1: Range must be between 0 and 100');
    });
  });

  describe('generatePresetCurve', () => {
    it('generates conservative preset', () => {
      const positions = generatePresetCurve('conservative');
      
      expect(positions).toHaveLength(3);
      expect(positions[0].allocation).toBe(50); // Highest allocation in middle
      expect(positions[0].rangeStart).toBe(40);
      expect(positions[0].rangeEnd).toBe(60);
    });

    it('generates balanced preset', () => {
      const positions = generatePresetCurve('balanced');
      
      expect(positions).toHaveLength(5);
      const totalAllocation = positions.reduce((sum, p) => sum + p.allocation, 0);
      expect(totalAllocation).toBe(100);
    });

    it('generates aggressive preset', () => {
      const positions = generatePresetCurve('aggressive');
      
      expect(positions.length).toBeGreaterThanOrEqual(5);
      // Should have positions at extreme ranges
      expect(positions.some(p => p.rangeStart === 0)).toBe(true);
      expect(positions.some(p => p.rangeEnd === 100)).toBe(true);
    });

    it('generates wide preset', () => {
      const positions = generatePresetCurve('wide');
      
      expect(positions).toHaveLength(1);
      expect(positions[0].rangeStart).toBe(0);
      expect(positions[0].rangeEnd).toBe(100);
      expect(positions[0].allocation).toBe(100);
    });

    it('throws error for invalid preset', () => {
      expect(() => generatePresetCurve('invalid' as any)).toThrow('Invalid preset: invalid');
    });
  });

  describe('detectOverlappingRanges', () => {
    it('detects no overlaps in sequential positions', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 0, rangeEnd: 50, allocation: 50 },
        { id: '2', rangeStart: 50, rangeEnd: 100, allocation: 50 },
      ];

      const overlaps = detectOverlappingRanges(positions);
      expect(overlaps).toEqual([]);
    });

    it('detects overlapping positions', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 0, rangeEnd: 60, allocation: 50 },
        { id: '2', rangeStart: 40, rangeEnd: 100, allocation: 50 },
      ];

      const overlaps = detectOverlappingRanges(positions);
      expect(overlaps).toEqual([['1', '2']]);
    });

    it('detects multiple overlaps', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 0, rangeEnd: 50, allocation: 30 },
        { id: '2', rangeStart: 25, rangeEnd: 75, allocation: 40 },
        { id: '3', rangeStart: 60, rangeEnd: 100, allocation: 30 },
      ];

      const overlaps = detectOverlappingRanges(positions);
      expect(overlaps).toHaveLength(2);
      expect(overlaps).toContainEqual(['1', '2']);
      expect(overlaps).toContainEqual(['2', '3']);
    });
  });

  describe('normalizeAllocations', () => {
    it('normalizes allocations to sum to 100', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 0, rangeEnd: 50, allocation: 30 },
        { id: '2', rangeStart: 50, rangeEnd: 100, allocation: 20 },
      ];

      const normalized = normalizeAllocations(positions);
      
      expect(normalized[0].allocation).toBe(60);
      expect(normalized[1].allocation).toBe(40);
      
      const total = normalized.reduce((sum, p) => sum + p.allocation, 0);
      expect(total).toBe(100);
    });

    it('handles single position', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 0, rangeEnd: 100, allocation: 50 },
      ];

      const normalized = normalizeAllocations(positions);
      expect(normalized[0].allocation).toBe(100);
    });

    it('returns empty array for no positions', () => {
      const normalized = normalizeAllocations([]);
      expect(normalized).toEqual([]);
    });

    it('handles zero allocations', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 0, rangeEnd: 50, allocation: 0 },
        { id: '2', rangeStart: 50, rangeEnd: 100, allocation: 0 },
      ];

      const normalized = normalizeAllocations(positions);
      expect(normalized[0].allocation).toBe(50);
      expect(normalized[1].allocation).toBe(50);
    });
  });

  describe('calculateEffectiveLiquidity', () => {
    it('calculates effective liquidity at specific price', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 0, rangeEnd: 50, allocation: 60 },
        { id: '2', rangeStart: 25, rangeEnd: 75, allocation: 40 },
      ];

      expect(calculateEffectiveLiquidity(positions, 10)).toBe(60);
      expect(calculateEffectiveLiquidity(positions, 40)).toBe(100); // Both active
      expect(calculateEffectiveLiquidity(positions, 60)).toBe(40);
      expect(calculateEffectiveLiquidity(positions, 80)).toBe(0);
    });

    it('handles edge cases', () => {
      const positions: LiquidityPositionData[] = [
        { id: '1', rangeStart: 50, rangeEnd: 50, allocation: 100 }, // Zero-width range
      ];

      expect(calculateEffectiveLiquidity(positions, 50)).toBe(0);
    });
  });

  describe('CURVE_PRESETS', () => {
    it('has valid preset configurations', () => {
      expect(CURVE_PRESETS).toHaveProperty('conservative');
      expect(CURVE_PRESETS).toHaveProperty('balanced');
      expect(CURVE_PRESETS).toHaveProperty('aggressive');
      expect(CURVE_PRESETS).toHaveProperty('wide');

      Object.values(CURVE_PRESETS).forEach(preset => {
        expect(preset).toHaveProperty('name');
        expect(preset).toHaveProperty('description');
        expect(preset).toHaveProperty('icon');
      });
    });
  });
});