import {
  VestingSchedule,
  validateVestingSchedule,
  calculateLinearVesting,
  calculateCliffVesting,
  calculateVesting,
  createVestingSchedule,
  getVestingProgress,
} from '../vesting';

describe('Vesting Utilities', () => {
  const baseSchedule: VestingSchedule = {
    totalAmount: 1000000n,
    startTime: 1000,
    endTime: 2000,
    vestingType: 'linear',
  };

  describe('validateVestingSchedule', () => {
    it('should validate a valid linear vesting schedule', () => {
      const result = validateVestingSchedule(baseSchedule);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate a valid cliff vesting schedule', () => {
      const schedule: VestingSchedule = {
        ...baseSchedule,
        vestingType: 'cliff',
      };
      const result = validateVestingSchedule(schedule);
      expect(result.valid).toBe(true);
    });

    it('should validate a schedule with cliff duration', () => {
      const schedule: VestingSchedule = {
        ...baseSchedule,
        cliffDuration: 300,
      };
      const result = validateVestingSchedule(schedule);
      expect(result.valid).toBe(true);
    });

    it('should reject schedule with zero total amount', () => {
      const schedule: VestingSchedule = {
        ...baseSchedule,
        totalAmount: 0n,
      };
      const result = validateVestingSchedule(schedule);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Total amount must be greater than 0');
    });

    it('should reject schedule with negative total amount', () => {
      const schedule: VestingSchedule = {
        ...baseSchedule,
        totalAmount: -1000n,
      };
      const result = validateVestingSchedule(schedule);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Total amount must be greater than 0');
    });

    it('should reject schedule with negative start time', () => {
      const schedule: VestingSchedule = {
        ...baseSchedule,
        startTime: -100,
      };
      const result = validateVestingSchedule(schedule);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Start time cannot be negative');
    });

    it('should reject schedule where end time is before start time', () => {
      const schedule: VestingSchedule = {
        ...baseSchedule,
        startTime: 2000,
        endTime: 1000,
      };
      const result = validateVestingSchedule(schedule);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('End time must be after start time');
    });

    it('should reject schedule where end time equals start time', () => {
      const schedule: VestingSchedule = {
        ...baseSchedule,
        startTime: 1000,
        endTime: 1000,
      };
      const result = validateVestingSchedule(schedule);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('End time must be after start time');
    });

    it('should reject schedule with negative cliff duration', () => {
      const schedule: VestingSchedule = {
        ...baseSchedule,
        cliffDuration: -100,
      };
      const result = validateVestingSchedule(schedule);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cliff duration cannot be negative');
    });

    it('should reject schedule where cliff duration exceeds vesting period', () => {
      const schedule: VestingSchedule = {
        ...baseSchedule,
        cliffDuration: 1100,
      };
      const result = validateVestingSchedule(schedule);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cliff duration cannot exceed vesting period');
    });

    it('should reject schedule with invalid vesting type', () => {
      const schedule = {
        ...baseSchedule,
        vestingType: 'invalid' as 'linear' | 'cliff',
      };
      const result = validateVestingSchedule(schedule);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid vesting type');
    });
  });

  describe('calculateLinearVesting', () => {
    it('should return 0% vested before start time', () => {
      const result = calculateLinearVesting(baseSchedule, 500);
      expect(result.vestedAmount).toBe(0n);
      expect(result.unvestedAmount).toBe(1000000n);
      expect(result.releasableAmount).toBe(0n);
      expect(result.percentVested).toBe(0);
      expect(result.isFullyVested).toBe(false);
      expect(result.nextReleaseTime).toBe(1000);
    });

    it('should calculate 50% vested at midpoint', () => {
      const result = calculateLinearVesting(baseSchedule, 1500);
      expect(result.vestedAmount).toBe(500000n);
      expect(result.unvestedAmount).toBe(500000n);
      expect(result.releasableAmount).toBe(500000n);
      expect(result.percentVested).toBe(50);
      expect(result.isFullyVested).toBe(false);
    });

    it('should calculate 100% vested at end time', () => {
      const result = calculateLinearVesting(baseSchedule, 2000);
      expect(result.vestedAmount).toBe(1000000n);
      expect(result.unvestedAmount).toBe(0n);
      expect(result.releasableAmount).toBe(1000000n);
      expect(result.percentVested).toBe(100);
      expect(result.isFullyVested).toBe(true);
      expect(result.nextReleaseTime).toBeUndefined();
      expect(result.nextReleaseAmount).toBeUndefined();
    });

    it('should calculate 100% vested after end time', () => {
      const result = calculateLinearVesting(baseSchedule, 3000);
      expect(result.vestedAmount).toBe(1000000n);
      expect(result.unvestedAmount).toBe(0n);
      expect(result.percentVested).toBe(100);
      expect(result.isFullyVested).toBe(true);
    });

    it('should handle partial vesting at 25%', () => {
      const result = calculateLinearVesting(baseSchedule, 1250);
      expect(result.vestedAmount).toBe(250000n);
      expect(result.unvestedAmount).toBe(750000n);
      expect(result.percentVested).toBe(25);
    });

    it('should account for released amounts', () => {
      const result = calculateLinearVesting(baseSchedule, 1500, 200000n);
      expect(result.vestedAmount).toBe(500000n);
      expect(result.releasableAmount).toBe(300000n);
    });

    it('should handle cliff period correctly', () => {
      const scheduleWithCliff: VestingSchedule = {
        ...baseSchedule,
        cliffDuration: 300,
      };
      
      const beforeCliff = calculateLinearVesting(scheduleWithCliff, 1200);
      expect(beforeCliff.vestedAmount).toBe(0n);
      expect(beforeCliff.nextReleaseTime).toBe(1300);
      
      const atCliffEnd = calculateLinearVesting(scheduleWithCliff, 1300);
      expect(atCliffEnd.vestedAmount).toBe(0n);
      
      const afterCliff = calculateLinearVesting(scheduleWithCliff, 1301);
      expect(afterCliff.vestedAmount).toBeGreaterThan(0n);
    });

    it('should calculate linear vesting after cliff', () => {
      const scheduleWithCliff: VestingSchedule = {
        ...baseSchedule,
        cliffDuration: 200,
      };
      
      const atCliffEnd = calculateLinearVesting(scheduleWithCliff, 1200);
      expect(atCliffEnd.vestedAmount).toBe(0n);
      
      const quarterWayAfterCliff = calculateLinearVesting(scheduleWithCliff, 1400);
      expect(quarterWayAfterCliff.vestedAmount).toBe(250000n);
      
      const midwayAfterCliff = calculateLinearVesting(scheduleWithCliff, 1600);
      expect(midwayAfterCliff.vestedAmount).toBe(500000n);
    });
  });

  describe('calculateCliffVesting', () => {
    const cliffSchedule: VestingSchedule = {
      ...baseSchedule,
      vestingType: 'cliff',
    };

    it('should return 0% vested before cliff end', () => {
      const result = calculateCliffVesting(cliffSchedule, 1500);
      expect(result.vestedAmount).toBe(0n);
      expect(result.unvestedAmount).toBe(1000000n);
      expect(result.releasableAmount).toBe(0n);
      expect(result.percentVested).toBe(0);
      expect(result.isFullyVested).toBe(false);
      expect(result.nextReleaseTime).toBe(2000);
      expect(result.nextReleaseAmount).toBe(1000000n);
    });

    it('should return 100% vested at cliff end', () => {
      const result = calculateCliffVesting(cliffSchedule, 2000);
      expect(result.vestedAmount).toBe(1000000n);
      expect(result.unvestedAmount).toBe(0n);
      expect(result.releasableAmount).toBe(1000000n);
      expect(result.percentVested).toBe(100);
      expect(result.isFullyVested).toBe(true);
    });

    it('should return 100% vested after cliff end', () => {
      const result = calculateCliffVesting(cliffSchedule, 3000);
      expect(result.vestedAmount).toBe(1000000n);
      expect(result.percentVested).toBe(100);
      expect(result.isFullyVested).toBe(true);
    });

    it('should account for released amounts after cliff', () => {
      const result = calculateCliffVesting(cliffSchedule, 2500, 400000n);
      expect(result.vestedAmount).toBe(1000000n);
      expect(result.releasableAmount).toBe(600000n);
    });
  });

  describe('calculateVesting', () => {
    it('should use linear calculation for linear type', () => {
      const result = calculateVesting(baseSchedule, 1500);
      expect(result.vestedAmount).toBe(500000n);
      expect(result.percentVested).toBe(50);
    });

    it('should use cliff calculation for cliff type', () => {
      const cliffSchedule: VestingSchedule = {
        ...baseSchedule,
        vestingType: 'cliff',
      };
      const result = calculateVesting(cliffSchedule, 1500);
      expect(result.vestedAmount).toBe(0n);
      expect(result.percentVested).toBe(0);
    });

    it('should throw error for invalid schedule', () => {
      const invalidSchedule: VestingSchedule = {
        ...baseSchedule,
        totalAmount: 0n,
      };
      expect(() => calculateVesting(invalidSchedule, 1500)).toThrow(
        'Total amount must be greater than 0'
      );
    });

    it('should handle edge case with 0% vesting', () => {
      const result = calculateVesting(baseSchedule, 500);
      expect(result.vestedAmount).toBe(0n);
      expect(result.percentVested).toBe(0);
      expect(result.releasableAmount).toBe(0n);
    });

    it('should handle edge case with 100% immediate vesting', () => {
      const immediateSchedule: VestingSchedule = {
        totalAmount: 1000000n,
        startTime: 1000,
        endTime: 1001,
        vestingType: 'linear',
      };
      const result = calculateVesting(immediateSchedule, 1001);
      expect(result.vestedAmount).toBe(1000000n);
      expect(result.percentVested).toBe(100);
      expect(result.isFullyVested).toBe(true);
    });
  });

  describe('createVestingSchedule', () => {
    it('should create a basic linear vesting schedule', () => {
      const schedule = createVestingSchedule(1000000n, 1000);
      expect(schedule.totalAmount).toBe(1000000n);
      expect(schedule.endTime - schedule.startTime).toBe(1000);
      expect(schedule.vestingType).toBe('linear');
      expect(schedule.cliffDuration).toBeUndefined();
    });

    it('should create a schedule with custom start time', () => {
      const customStart = 2000;
      const schedule = createVestingSchedule(1000000n, 1000, {
        startTime: customStart,
      });
      expect(schedule.startTime).toBe(customStart);
      expect(schedule.endTime).toBe(3000);
    });

    it('should create a cliff vesting schedule', () => {
      const schedule = createVestingSchedule(1000000n, 1000, {
        vestingType: 'cliff',
      });
      expect(schedule.vestingType).toBe('cliff');
    });

    it('should create a schedule with cliff duration', () => {
      const schedule = createVestingSchedule(1000000n, 1000, {
        cliffDuration: 300,
      });
      expect(schedule.cliffDuration).toBe(300);
    });

    it('should use current time as default start time', () => {
      const before = Math.floor(Date.now() / 1000);
      const schedule = createVestingSchedule(1000000n, 1000);
      const after = Math.floor(Date.now() / 1000);
      
      expect(schedule.startTime).toBeGreaterThanOrEqual(before);
      expect(schedule.startTime).toBeLessThanOrEqual(after);
    });
  });

  describe('getVestingProgress', () => {
    it('should return 0% progress before start', () => {
      const progress = getVestingProgress(baseSchedule, 500);
      expect(progress.elapsedTime).toBe(0);
      expect(progress.remainingTime).toBe(1000);
      expect(progress.progressPercent).toBe(0);
    });

    it('should return correct progress at midpoint', () => {
      const progress = getVestingProgress(baseSchedule, 1500);
      expect(progress.elapsedTime).toBe(500);
      expect(progress.remainingTime).toBe(500);
      expect(progress.progressPercent).toBe(50);
    });

    it('should return 100% progress at end', () => {
      const progress = getVestingProgress(baseSchedule, 2000);
      expect(progress.elapsedTime).toBe(1000);
      expect(progress.remainingTime).toBe(0);
      expect(progress.progressPercent).toBe(100);
    });

    it('should return 100% progress after end', () => {
      const progress = getVestingProgress(baseSchedule, 3000);
      expect(progress.elapsedTime).toBe(1000);
      expect(progress.remainingTime).toBe(0);
      expect(progress.progressPercent).toBe(100);
    });

    it('should handle cliff duration correctly', () => {
      const scheduleWithCliff: VestingSchedule = {
        ...baseSchedule,
        cliffDuration: 300,
      };
      
      const beforeCliff = getVestingProgress(scheduleWithCliff, 1200);
      expect(beforeCliff.elapsedTime).toBe(0);
      expect(beforeCliff.progressPercent).toBe(0);
      
      const afterCliff = getVestingProgress(scheduleWithCliff, 1300);
      expect(afterCliff.elapsedTime).toBe(0);
      expect(afterCliff.remainingTime).toBe(700);
      
      const midway = getVestingProgress(scheduleWithCliff, 1650);
      expect(midway.elapsedTime).toBe(350);
      expect(midway.remainingTime).toBe(350);
      expect(midway.progressPercent).toBe(50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large token amounts', () => {
      const largeSchedule: VestingSchedule = {
        totalAmount: 1000000000000000000n,
        startTime: 1000,
        endTime: 2000,
        vestingType: 'linear',
      };
      const result = calculateVesting(largeSchedule, 1500);
      expect(result.vestedAmount).toBe(500000000000000000n);
    });

    it('should handle very small vesting periods', () => {
      const shortSchedule: VestingSchedule = {
        totalAmount: 1000000n,
        startTime: 1000,
        endTime: 1001,
        vestingType: 'linear',
      };
      const result = calculateVesting(shortSchedule, 1000);
      expect(result.vestedAmount).toBe(0n);
      
      const resultEnd = calculateVesting(shortSchedule, 1001);
      expect(resultEnd.vestedAmount).toBe(1000000n);
    });

    it('should handle cliff duration equal to vesting period', () => {
      const fullCliffSchedule: VestingSchedule = {
        totalAmount: 1000000n,
        startTime: 1000,
        endTime: 2000,
        cliffDuration: 1000,
        vestingType: 'linear',
      };
      
      const beforeEnd = calculateVesting(fullCliffSchedule, 1999);
      expect(beforeEnd.vestedAmount).toBe(0n);
      
      const atEnd = calculateVesting(fullCliffSchedule, 2000);
      expect(atEnd.vestedAmount).toBe(1000000n);
    });

    it('should handle zero cliff duration', () => {
      const zeroCliffSchedule: VestingSchedule = {
        ...baseSchedule,
        cliffDuration: 0,
      };
      
      const result = calculateVesting(zeroCliffSchedule, 1001);
      expect(result.vestedAmount).toBeGreaterThan(0n);
    });

    it('should handle precision in calculations', () => {
      const precisionSchedule: VestingSchedule = {
        totalAmount: 333n,
        startTime: 1000,
        endTime: 1003,
        vestingType: 'linear',
      };
      
      const third = calculateVesting(precisionSchedule, 1001);
      expect(third.vestedAmount).toBe(111n);
      
      const twoThirds = calculateVesting(precisionSchedule, 1002);
      expect(twoThirds.vestedAmount).toBe(222n);
      
      const full = calculateVesting(precisionSchedule, 1003);
      expect(full.vestedAmount).toBe(333n);
    });
  });
});