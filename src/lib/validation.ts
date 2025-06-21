export function isValidAddress(address: string): boolean {
  if (!address) return false;
  
  // Check for ENS name
  if (address.endsWith('.eth')) {
    return address.length > 4 && /^[a-z0-9-]+\.eth$/.test(address);
  }
  
  // Check for Ethereum address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return false;
  }
  
  return true;
}

export async function validateENS(ensName: string): Promise<string | null> {
  if (!ensName.endsWith('.eth')) {
    return null;
  }
  
  try {
    // In a real implementation, this would use ethers.js or similar
    // For now, return a mock address for testing
    if (process.env.NODE_ENV === 'test') {
      return '0x742d35Cc6634C0532925a3b8A7b1234567890123';
    }
    
    // TODO: Implement actual ENS resolution
    // const provider = new ethers.providers.JsonRpcProvider();
    // const address = await provider.resolveName(ensName);
    // return address;
    
    return null;
  } catch (error) {
    console.error('ENS resolution failed:', error);
    return null;
  }
}

export function validatePercentage(
  percentage: number,
  min: number = 0,
  max: number = 100
): { isValid: boolean; error?: string } {
  if (isNaN(percentage)) {
    return {
      isValid: false,
      error: 'Percentage must be a valid number',
    };
  }
  
  if (percentage < min) {
    return {
      isValid: false,
      error: `Percentage must be at least ${min}%`,
    };
  }
  
  if (percentage > max) {
    return {
      isValid: false,
      error: `Percentage cannot exceed ${max}%`,
    };
  }
  
  return { isValid: true };
}

export function validateTotalPercentage(
  percentages: number[],
  platformFee: number = 20
): { isValid: boolean; total: number; remaining: number; error?: string } {
  const total = percentages.reduce((sum, p) => sum + (p || 0), 0) + platformFee;
  const remaining = 100 - total;
  
  if (total > 100) {
    return {
      isValid: false,
      total,
      remaining,
      error: 'Total percentage cannot exceed 100%',
    };
  }
  
  return {
    isValid: true,
    total,
    remaining,
  };
}