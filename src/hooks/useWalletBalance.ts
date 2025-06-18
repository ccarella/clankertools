import { useState, useEffect } from 'react';
import { BASE_NETWORKS } from '@/lib/network-config';

interface BalanceResult {
  balance: string | null;
  isLoading: boolean;
  error: string | null;
}

const RPC_URLS: Record<number, string> = {
  [BASE_NETWORKS.mainnet.chainId]: BASE_NETWORKS.mainnet.rpcUrl,
  [BASE_NETWORKS.testnet.chainId]: BASE_NETWORKS.testnet.rpcUrl,
};

export function useWalletBalance(address: string | null, chainId: number | null): BalanceResult {
  const [result, setResult] = useState<BalanceResult>({
    balance: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!address || !chainId) {
      setResult({ balance: null, isLoading: false, error: null });
      return;
    }

    const rpcUrl = RPC_URLS[chainId];
    if (!rpcUrl) {
      setResult({ balance: null, isLoading: false, error: 'Unsupported network' });
      return;
    }

    let cancelled = false;

    const fetchBalance = async () => {
      if (cancelled) return;
      
      setResult(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch(rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getBalance',
            params: [address, 'latest'],
            id: 1,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch balance');
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error.message || 'RPC error');
        }

        // Convert from hex wei to decimal ETH
        const balanceWei = BigInt(data.result);
        const balanceEth = (Number(balanceWei) / 1e18).toFixed(18);

        if (!cancelled) {
          setResult({
            balance: balanceEth,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setResult({
            balance: null,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to fetch balance',
          });
        }
      }
    };

    // Initial fetch
    fetchBalance();

    // Set up polling interval (every 30 seconds)
    const interval = setInterval(fetchBalance, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [address, chainId]);

  return result;
}