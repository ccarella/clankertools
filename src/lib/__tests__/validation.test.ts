import {
  isValidAddress,
  validateENS,
  validatePercentage,
  validateTotalPercentage,
} from '../validation';

describe('Address Validation', () => {
  describe('isValidAddress', () => {
    it('validates correct Ethereum addresses', () => {
      expect(isValidAddress('0x742d35Cc6634C0532925a3b8A7b1234567890123')).toBe(true);
      expect(isValidAddress('0x8ba1f109551bD432803012645aac136c22416457')).toBe(true);
      expect(isValidAddress('0x0000000000000000000000000000000000000000')).toBe(true);
    });

    it('validates ENS names', () => {
      expect(isValidAddress('vitalik.eth')).toBe(true);
      expect(isValidAddress('test-name.eth')).toBe(true);
      expect(isValidAddress('1234.eth')).toBe(true);
    });

    it('rejects invalid addresses', () => {
      expect(isValidAddress('')).toBe(false);
      expect(isValidAddress('0x123')).toBe(false);
      expect(isValidAddress('0x742d35Cc6634C0532925a3b8A7b1234567890123456')).toBe(false);
      expect(isValidAddress('742d35Cc6634C0532925a3b8A7b1234567890123')).toBe(false);
      expect(isValidAddress('0xGGGd35Cc6634C0532925a3b8A7b1234567890123')).toBe(false);
    });

    it('rejects invalid ENS names', () => {
      expect(isValidAddress('.eth')).toBe(false);
      expect(isValidAddress('test')).toBe(false);
      expect(isValidAddress('test.com')).toBe(false);
      expect(isValidAddress('test.eth.com')).toBe(false);
    });
  });

  describe('validateENS', () => {
    it('returns null for non-ENS names', async () => {
      expect(await validateENS('0x742d35Cc6634C0532925a3b8A7b1234567890123')).toBeNull();
      expect(await validateENS('invalid')).toBeNull();
    });

    it('returns mock address for ENS names in test environment', async () => {
      const result = await validateENS('vitalik.eth');
      expect(result).toBe('0x742d35Cc6634C0532925a3b8A7b1234567890123');
    });
  });
});

describe('Percentage Validation', () => {
  describe('validatePercentage', () => {
    it('validates percentages within range', () => {
      expect(validatePercentage(0)).toEqual({ isValid: true });
      expect(validatePercentage(50)).toEqual({ isValid: true });
      expect(validatePercentage(100)).toEqual({ isValid: true });
      expect(validatePercentage(75.5)).toEqual({ isValid: true });
    });

    it('rejects percentages outside range', () => {
      expect(validatePercentage(-1)).toEqual({
        isValid: false,
        error: 'Percentage must be at least 0%',
      });
      expect(validatePercentage(101)).toEqual({
        isValid: false,
        error: 'Percentage cannot exceed 100%',
      });
    });

    it('rejects non-numeric values', () => {
      expect(validatePercentage(NaN)).toEqual({
        isValid: false,
        error: 'Percentage must be a valid number',
      });
    });

    it('respects custom min/max values', () => {
      expect(validatePercentage(5, 10, 90)).toEqual({
        isValid: false,
        error: 'Percentage must be at least 10%',
      });
      expect(validatePercentage(95, 10, 90)).toEqual({
        isValid: false,
        error: 'Percentage cannot exceed 90%',
      });
      expect(validatePercentage(50, 10, 90)).toEqual({ isValid: true });
    });
  });

  describe('validateTotalPercentage', () => {
    it('validates when total equals 100%', () => {
      const result = validateTotalPercentage([60, 20], 20);
      expect(result).toEqual({
        isValid: true,
        total: 100,
        remaining: 0,
      });
    });

    it('calculates remaining percentage correctly', () => {
      const result = validateTotalPercentage([30, 10], 20);
      expect(result).toEqual({
        isValid: true,
        total: 60,
        remaining: 40,
      });
    });

    it('detects when total exceeds 100%', () => {
      const result = validateTotalPercentage([60, 30], 20);
      expect(result).toEqual({
        isValid: false,
        total: 110,
        remaining: -10,
        error: 'Total percentage cannot exceed 100%',
      });
    });

    it('handles empty percentages array', () => {
      const result = validateTotalPercentage([], 20);
      expect(result).toEqual({
        isValid: true,
        total: 20,
        remaining: 80,
      });
    });

    it('handles undefined percentages as 0', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = validateTotalPercentage([undefined as any, 30, null as any], 20);
      expect(result).toEqual({
        isValid: true,
        total: 50,
        remaining: 50,
      });
    });

    it('uses default platform fee of 20%', () => {
      const result = validateTotalPercentage([30, 40]);
      expect(result).toEqual({
        isValid: true,
        total: 90,
        remaining: 10,
      });
    });
  });
});