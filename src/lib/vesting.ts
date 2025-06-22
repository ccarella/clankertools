export interface VestingSchedule {
  totalAmount: bigint;
  startTime: number;
  endTime: number;
  cliffDuration?: number;
  vestingType: 'linear' | 'cliff';
}

export interface VestingCalculation {
  vestedAmount: bigint;
  unvestedAmount: bigint;
  releasableAmount: bigint;
  percentVested: number;
  isFullyVested: boolean;
  nextReleaseTime?: number;
  nextReleaseAmount?: bigint;
}

export function validateVestingSchedule(schedule: VestingSchedule): { valid: boolean; error?: string } {
  if (schedule.totalAmount <= BigInt(0)) {
    return { valid: false, error: 'Total amount must be greater than 0' };
  }

  if (schedule.startTime < 0) {
    return { valid: false, error: 'Start time cannot be negative' };
  }

  if (schedule.endTime <= schedule.startTime) {
    return { valid: false, error: 'End time must be after start time' };
  }

  if (schedule.cliffDuration !== undefined && schedule.cliffDuration < 0) {
    return { valid: false, error: 'Cliff duration cannot be negative' };
  }

  if (schedule.cliffDuration !== undefined && schedule.cliffDuration > (schedule.endTime - schedule.startTime)) {
    return { valid: false, error: 'Cliff duration cannot exceed vesting period' };
  }

  if (schedule.vestingType !== 'linear' && schedule.vestingType !== 'cliff') {
    return { valid: false, error: 'Invalid vesting type' };
  }

  return { valid: true };
}

export function calculateLinearVesting(
  schedule: VestingSchedule,
  currentTime: number,
  releasedAmount: bigint = BigInt(0)
): VestingCalculation {
  if (currentTime <= schedule.startTime) {
    return {
      vestedAmount: BigInt(0),
      unvestedAmount: schedule.totalAmount,
      releasableAmount: BigInt(0),
      percentVested: 0,
      isFullyVested: false,
      nextReleaseTime: schedule.startTime,
      nextReleaseAmount: BigInt(0),
    };
  }

  if (schedule.cliffDuration) {
    const cliffEndTime = schedule.startTime + schedule.cliffDuration;
    if (currentTime < cliffEndTime) {
      return {
        vestedAmount: BigInt(0),
        unvestedAmount: schedule.totalAmount,
        releasableAmount: BigInt(0),
        percentVested: 0,
        isFullyVested: false,
        nextReleaseTime: cliffEndTime,
        nextReleaseAmount: calculateVestedAtTime(schedule, cliffEndTime),
      };
    }
  }

  const vestedAmount = calculateVestedAtTime(schedule, currentTime);
  const unvestedAmount = schedule.totalAmount - vestedAmount;
  const releasableAmount = vestedAmount - releasedAmount;
  const percentVested = Number((vestedAmount * BigInt(100)) / schedule.totalAmount);
  const isFullyVested = currentTime >= schedule.endTime;

  let nextReleaseTime: number | undefined;
  let nextReleaseAmount: bigint | undefined;

  if (!isFullyVested) {
    // Calculate next meaningful release time (1 second increment)
    nextReleaseTime = Math.min(currentTime + 1, schedule.endTime);
    nextReleaseAmount = calculateVestedAtTime(schedule, nextReleaseTime) - vestedAmount;
  }

  return {
    vestedAmount,
    unvestedAmount,
    releasableAmount,
    percentVested,
    isFullyVested,
    nextReleaseTime,
    nextReleaseAmount,
  };
}

export function calculateCliffVesting(
  schedule: VestingSchedule,
  currentTime: number,
  releasedAmount: bigint = BigInt(0)
): VestingCalculation {
  const cliffEndTime = schedule.endTime;

  if (currentTime < cliffEndTime) {
    return {
      vestedAmount: BigInt(0),
      unvestedAmount: schedule.totalAmount,
      releasableAmount: BigInt(0),
      percentVested: 0,
      isFullyVested: false,
      nextReleaseTime: cliffEndTime,
      nextReleaseAmount: schedule.totalAmount,
    };
  }

  return {
    vestedAmount: schedule.totalAmount,
    unvestedAmount: BigInt(0),
    releasableAmount: schedule.totalAmount - releasedAmount,
    percentVested: 100,
    isFullyVested: true,
  };
}

export function calculateVesting(
  schedule: VestingSchedule,
  currentTime: number,
  releasedAmount: bigint = BigInt(0)
): VestingCalculation {
  const validation = validateVestingSchedule(schedule);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  if (schedule.vestingType === 'cliff') {
    return calculateCliffVesting(schedule, currentTime, releasedAmount);
  }

  return calculateLinearVesting(schedule, currentTime, releasedAmount);
}

function calculateVestedAtTime(schedule: VestingSchedule, time: number): bigint {
  if (time <= schedule.startTime) {
    return BigInt(0);
  }

  if (time >= schedule.endTime) {
    return schedule.totalAmount;
  }

  const effectiveStartTime = schedule.cliffDuration 
    ? schedule.startTime + schedule.cliffDuration 
    : schedule.startTime;

  if (time < effectiveStartTime) {
    return BigInt(0);
  }

  const totalDuration = schedule.endTime - effectiveStartTime;
  const elapsedDuration = time - effectiveStartTime;
  
  return (schedule.totalAmount * BigInt(elapsedDuration)) / BigInt(totalDuration);
}

export function createVestingSchedule(
  totalAmount: bigint,
  durationInSeconds: number,
  options?: {
    startTime?: number;
    cliffDuration?: number;
    vestingType?: 'linear' | 'cliff';
  }
): VestingSchedule {
  const startTime = options?.startTime ?? Math.floor(Date.now() / 1000);
  const endTime = startTime + durationInSeconds;

  return {
    totalAmount,
    startTime,
    endTime,
    cliffDuration: options?.cliffDuration,
    vestingType: options?.vestingType ?? 'linear',
  };
}

export function getVestingProgress(schedule: VestingSchedule, currentTime: number): {
  elapsedTime: number;
  remainingTime: number;
  progressPercent: number;
} {
  const effectiveStartTime = schedule.cliffDuration 
    ? schedule.startTime + schedule.cliffDuration 
    : schedule.startTime;

  if (currentTime <= effectiveStartTime) {
    return {
      elapsedTime: 0,
      remainingTime: schedule.endTime - effectiveStartTime,
      progressPercent: 0,
    };
  }

  if (currentTime >= schedule.endTime) {
    return {
      elapsedTime: schedule.endTime - effectiveStartTime,
      remainingTime: 0,
      progressPercent: 100,
    };
  }

  const elapsedTime = currentTime - effectiveStartTime;
  const totalDuration = schedule.endTime - effectiveStartTime;
  const remainingTime = schedule.endTime - currentTime;
  const progressPercent = (elapsedTime / totalDuration) * 100;

  return {
    elapsedTime,
    remainingTime,
    progressPercent,
  };
}