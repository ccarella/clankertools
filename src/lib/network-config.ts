export interface NetworkConfig {
  chainId: number;
  chainIdHex: string;
  name: string;
  rpcUrl: string;
  isMainnet: boolean;
  network: 'mainnet' | 'testnet';
}

export const BASE_NETWORKS: Record<string, NetworkConfig> = {
  mainnet: {
    chainId: 8453,
    chainIdHex: '0x2105',
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    isMainnet: true,
    network: 'mainnet'
  },
  testnet: {
    chainId: 84532,
    chainIdHex: '0x14A34',
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    isMainnet: false,
    network: 'testnet'
  }
};

export function getNetworkConfig(): NetworkConfig {
  const networkEnv = process.env.BASE_NETWORK?.trim().toLowerCase() || 'testnet';
  
  if (networkEnv !== 'mainnet' && networkEnv !== 'testnet') {
    throw new Error(`Invalid BASE_NETWORK value: ${process.env.BASE_NETWORK}. Must be either "mainnet" or "testnet"`);
  }
  
  return BASE_NETWORKS[networkEnv];
}