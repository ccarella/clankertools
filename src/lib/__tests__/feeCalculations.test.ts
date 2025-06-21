import {
  calculateFeeAmounts,
  calculateCreatorPlatformSplit,
  formatFeePercentage,
  validateFeePercentage,
  FeeConfiguration,
  PRESET_FEE_STRUCTURES,
} from '../feeCalculations';

describe('feeCalculations', () => {
  describe('calculateFeeAmounts', () => {
    it('calculates correct fee amounts for a trade', () => {
      const config: FeeConfiguration = {
        creatorFeePercentage: 80,
        platformFeePercentage: 20,
        totalFeePercentage: 0.4,
      };

      const result = calculateFeeAmounts(1000, config);

      expect(result.totalFee).toBe(4);
      expect(result.creatorFee).toBe(3.2);
      expect(result.platformFee).toBe(0.8);
      expect(result.netAmount).toBe(996);
    });

    it('handles zero trade amount', () => {
      const config: FeeConfiguration = {
        creatorFeePercentage: 80,
        platformFeePercentage: 20,
        totalFeePercentage: 0.4,
      };

      const result = calculateFeeAmounts(0, config);

      expect(result.totalFee).toBe(0);
      expect(result.creatorFee).toBe(0);
      expect(result.platformFee).toBe(0);
      expect(result.netAmount).toBe(0);
    });

    it('handles very small trade amounts', () => {
      const config: FeeConfiguration = {
        creatorFeePercentage: 80,
        platformFeePercentage: 20,
        totalFeePercentage: 0.4,
      };

      const result = calculateFeeAmounts(0.1, config);

      expect(result.totalFee).toBeCloseTo(0.0004, 6);
      expect(result.creatorFee).toBeCloseTo(0.00032, 6);
      expect(result.platformFee).toBeCloseTo(0.00008, 6);
      expect(result.netAmount).toBeCloseTo(0.0996, 6);
    });

    it('handles very large trade amounts', () => {
      const config: FeeConfiguration = {
        creatorFeePercentage: 90,
        platformFeePercentage: 10,
        totalFeePercentage: 0.4,
      };

      const result = calculateFeeAmounts(1000000, config);

      expect(result.totalFee).toBe(4000);
      expect(result.creatorFee).toBe(3600);
      expect(result.platformFee).toBe(400);
      expect(result.netAmount).toBe(996000);
    });

    it('throws error for negative trade amount', () => {
      const config: FeeConfiguration = {
        creatorFeePercentage: 80,
        platformFeePercentage: 20,
        totalFeePercentage: 0.4,
      };

      expect(() => calculateFeeAmounts(-100, config)).toThrow('Trade amount must be non-negative');
    });

    it('throws error for invalid fee configuration', () => {
      const invalidConfig: FeeConfiguration = {
        creatorFeePercentage: 60,
        platformFeePercentage: 50, // Total > 100%
        totalFeePercentage: 0.4,
      };

      expect(() => calculateFeeAmounts(1000, invalidConfig)).toThrow('Fee percentages must sum to 100%');
    });
  });

  describe('calculateCreatorPlatformSplit', () => {
    it('calculates correct split for standard configuration', () => {
      const split = calculateCreatorPlatformSplit(80);

      expect(split.creatorPercentage).toBe(80);
      expect(split.platformPercentage).toBe(20);
    });

    it('calculates correct split for extreme values', () => {
      const split1 = calculateCreatorPlatformSplit(95);
      expect(split1.creatorPercentage).toBe(95);
      expect(split1.platformPercentage).toBe(5);

      const split2 = calculateCreatorPlatformSplit(50);
      expect(split2.creatorPercentage).toBe(50);
      expect(split2.platformPercentage).toBe(50);
    });

    it('throws error for invalid percentages', () => {
      expect(() => calculateCreatorPlatformSplit(110)).toThrow('Creator percentage must be between 0 and 100');
      expect(() => calculateCreatorPlatformSplit(-10)).toThrow('Creator percentage must be between 0 and 100');
    });

    it('ensures total always equals 100%', () => {
      for (let i = 0; i <= 100; i += 10) {
        const split = calculateCreatorPlatformSplit(i);
        expect(split.creatorPercentage + split.platformPercentage).toBe(100);
      }
    });
  });

  describe('formatFeePercentage', () => {
    it('formats whole numbers correctly', () => {
      expect(formatFeePercentage(80)).toBe('80%');
      expect(formatFeePercentage(100)).toBe('100%');
      expect(formatFeePercentage(0)).toBe('0%');
    });

    it('formats decimal numbers correctly', () => {
      expect(formatFeePercentage(80.5)).toBe('80.5%');
      expect(formatFeePercentage(33.33)).toBe('33.33%');
      expect(formatFeePercentage(0.1)).toBe('0.1%');
    });

    it('rounds to specified decimal places', () => {
      expect(formatFeePercentage(33.3333, 2)).toBe('33.33%');
      expect(formatFeePercentage(66.6666, 1)).toBe('66.7%');
      expect(formatFeePercentage(99.999, 0)).toBe('100%');
    });

    it('handles edge cases', () => {
      expect(formatFeePercentage(0.001, 3)).toBe('0.001%');
      expect(formatFeePercentage(99.999, 3)).toBe('99.999%');
    });
  });

  describe('validateFeePercentage', () => {
    it('validates percentages within valid range', () => {
      expect(validateFeePercentage(80, 50, 95)).toEqual({ isValid: true });
      expect(validateFeePercentage(50, 50, 95)).toEqual({ isValid: true });
      expect(validateFeePercentage(95, 50, 95)).toEqual({ isValid: true });
    });

    it('returns error for percentages below minimum', () => {
      const result = validateFeePercentage(40, 50, 95);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Fee percentage must be between 50% and 95%');
    });

    it('returns error for percentages above maximum', () => {
      const result = validateFeePercentage(96, 50, 95);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Fee percentage must be between 50% and 95%');
    });

    it('uses default min/max when not provided', () => {
      expect(validateFeePercentage(0)).toEqual({ isValid: true });
      expect(validateFeePercentage(100)).toEqual({ isValid: true });
      expect(validateFeePercentage(-1)).toEqual({ 
        isValid: false, 
        error: 'Fee percentage must be between 0% and 100%' 
      });
      expect(validateFeePercentage(101)).toEqual({ 
        isValid: false, 
        error: 'Fee percentage must be between 0% and 100%' 
      });
    });

    it('handles decimal percentages', () => {
      expect(validateFeePercentage(75.5, 50, 95)).toEqual({ isValid: true });
      expect(validateFeePercentage(49.9, 50, 95)).toEqual({ 
        isValid: false, 
        error: 'Fee percentage must be between 50% and 95%' 
      });
    });
  });

  describe('PRESET_FEE_STRUCTURES', () => {
    it('contains expected preset configurations', () => {
      expect(PRESET_FEE_STRUCTURES).toHaveProperty('standard');
      expect(PRESET_FEE_STRUCTURES).toHaveProperty('creatorFocused');
      expect(PRESET_FEE_STRUCTURES).toHaveProperty('balanced');
    });

    it('has correct values for standard preset', () => {
      expect(PRESET_FEE_STRUCTURES.standard).toEqual({
        name: 'Standard',
        description: '80/20 split',
        creatorPercentage: 80,
        platformPercentage: 20,
      });
    });

    it('has correct values for creator focused preset', () => {
      expect(PRESET_FEE_STRUCTURES.creatorFocused).toEqual({
        name: 'Creator Focused',
        description: '90/10 split',
        creatorPercentage: 90,
        platformPercentage: 10,
      });
    });

    it('has correct values for balanced preset', () => {
      expect(PRESET_FEE_STRUCTURES.balanced).toEqual({
        name: 'Balanced',
        description: '70/30 split',
        creatorPercentage: 70,
        platformPercentage: 30,
      });
    });

    it('ensures all presets sum to 100%', () => {
      Object.values(PRESET_FEE_STRUCTURES).forEach(preset => {
        expect(preset.creatorPercentage + preset.platformPercentage).toBe(100);
      });
    });
  });

  describe('Integration Tests', () => {
    it('correctly calculates fees using preset structures', () => {
      const tradeAmount = 1000;
      const totalFeePercentage = 0.4;

      Object.values(PRESET_FEE_STRUCTURES).forEach(preset => {
        const config: FeeConfiguration = {
          creatorFeePercentage: preset.creatorPercentage,
          platformFeePercentage: preset.platformPercentage,
          totalFeePercentage,
        };

        const result = calculateFeeAmounts(tradeAmount, config);
        
        expect(result.totalFee).toBe(4);
        expect(result.creatorFee + result.platformFee).toBeCloseTo(result.totalFee, 10);
        expect(result.netAmount).toBe(996);
      });
    });

    it('validates and formats fee percentages correctly', () => {
      const creatorPercentage = 85;
      const validation = validateFeePercentage(creatorPercentage, 50, 95);
      
      expect(validation.isValid).toBe(true);
      
      const split = calculateCreatorPlatformSplit(creatorPercentage);
      expect(formatFeePercentage(split.creatorPercentage)).toBe('85%');
      expect(formatFeePercentage(split.platformPercentage)).toBe('15%');
    });
  });
});