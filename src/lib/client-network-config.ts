'use client';

import { NetworkConfig, BASE_NETWORKS } from './network-config';

export function getClientNetworkConfig(): NetworkConfig {
  const networkEnv = process.env.NEXT_PUBLIC_BASE_NETWORK?.trim().toLowerCase() || 'testnet';
  
  if (networkEnv !== 'mainnet' && networkEnv !== 'testnet') {
    console.warn(`Invalid NEXT_PUBLIC_BASE_NETWORK value: ${process.env.NEXT_PUBLIC_BASE_NETWORK}. Defaulting to testnet`);
    return BASE_NETWORKS.testnet;
  }
  
  return BASE_NETWORKS[networkEnv];
}