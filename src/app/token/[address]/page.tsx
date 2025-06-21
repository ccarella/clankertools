'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Copy, ExternalLink, TrendingUp, Users, Activity, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';
import ShareTemplateSelector from '@/components/token/ShareTemplateSelector';
import { getIpfsUrl } from '@/lib/ipfs';
import { cn } from '@/lib/utils';

interface TokenData {
  name: string;
  symbol: string;
  address: string;
  txHash: string;
  imageUrl: string;
  creatorAddress: string;
  totalSupply: string;
  marketCap: string;
  holders: number;
  volume24h: string;
  priceChange24h: number;
}

export default function TokenSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const { } = useFarcasterAuth();
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCelebration, setShowCelebration] = useState(true);

  const tokenAddress = params.address as string;

  useEffect(() => {
    fetchTokenData();
    const interval = setInterval(() => { fetchTokenData(); }, 30000); // Refresh every 30 seconds
    
    // Hide celebration after 3 seconds
    const celebrationTimer = setTimeout(() => setShowCelebration(false), 3000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(celebrationTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenAddress]);

  async function fetchTokenData() {
    try {
      const response = await fetch(`/api/token/${tokenAddress}`);
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load token data');
      }
      
      setTokenData(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(tokenAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  }

  function formatNumber(num: string | number): string {
    const value = typeof num === 'string' ? parseFloat(num) : num;
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function formatCurrency(amount: string | number): string {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading token details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-destructive/10 rounded-full p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <ExternalLink className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Error Loading Token</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              fetchTokenData();
            }}
            className="btn btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!tokenData) return null;

  const dexUrl = `https://dex.clanker.world/token/${tokenAddress}`;

  return (
    <div className="min-h-screen p-4 relative overflow-hidden">
      {/* Celebration Animation */}
      {showCelebration && (
        <div
          data-testid="celebration-animation"
          className={cn(
            "absolute inset-0 pointer-events-none z-50",
            "animate-in fade-in duration-500"
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <CheckCircle2 className="h-32 w-32 text-primary animate-bounce" />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.back()}
          className="btn btn-ghost btn-sm"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-semibold">Token Launched!</h1>
      </div>

      {/* Token Info */}
      <div
        data-testid="success-container"
        className={cn(
          "max-w-4xl mx-auto",
          "flex flex-col lg:flex-row gap-8"
        )}
      >
        {/* Left Column - Token Details */}
        <div className="flex-1 space-y-6">
          {/* Token Header */}
          <div className="bg-card rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative w-16 h-16">
                <Image
                  src={getIpfsUrl(tokenData.imageUrl)}
                  alt={tokenData.name}
                  fill
                  className="rounded-full object-cover"
                  sizes="64px"
                  priority
                />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{tokenData.name}</h2>
                <p className="text-muted-foreground">${tokenData.symbol}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <span>Deployed successfully!</span>
            </div>
          </div>

          {/* Token Address */}
          <div className="bg-card rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Token Address</h3>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono flex-1 truncate">{tokenAddress}</code>
              <button
                onClick={copyAddress}
                className="btn btn-ghost btn-sm"
                aria-label="Copy address"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            {copied && (
              <p className="text-sm text-primary mt-2 animate-in fade-in">Copied!</p>
            )}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">Market Cap</span>
              </div>
              <p className="text-xl font-semibold">{formatCurrency(tokenData.marketCap)}</p>
            </div>
            
            <div className="bg-card rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="text-sm">Holders</span>
              </div>
              <p className="text-xl font-semibold">{formatNumber(tokenData.holders)}</p>
            </div>
            
            <div className="bg-card rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Activity className="h-4 w-4" />
                <span className="text-sm">24h Volume</span>
              </div>
              <p className="text-xl font-semibold">{formatCurrency(tokenData.volume24h)}</p>
            </div>
            
            <div className="bg-card rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">24h Change</span>
              </div>
              <p className={cn(
                "text-xl font-semibold",
                tokenData.priceChange24h >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {tokenData.priceChange24h >= 0 ? '+' : ''}{tokenData.priceChange24h}%
              </p>
            </div>
          </div>
        </div>

        {/* Right Column - Actions */}
        <div className="lg:w-80 space-y-4">
          <ShareTemplateSelector
            tokenName={tokenData.name}
            tokenSymbol={tokenData.symbol}
            tokenAddress={tokenAddress}
            marketCap={tokenData.marketCap ? `$${(parseFloat(tokenData.marketCap) / 1000000).toFixed(2)}M` : undefined}
            holders={tokenData.holders}
            volume24h={tokenData.volume24h ? `$${(parseFloat(tokenData.volume24h) / 1000).toFixed(1)}K` : undefined}
          />
          
          <a
            href={dexUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary w-full"
          >
            View on DEX
            <ExternalLink className="h-4 w-4 ml-2" />
          </a>
          
          <div className="bg-muted/50 rounded-xl p-4 text-sm text-muted-foreground">
            <h4 className="font-medium mb-2">What&apos;s next?</h4>
            <ul className="space-y-1">
              <li>• Share your token on Farcaster</li>
              <li>• Monitor trading activity on DEX</li>
              <li>• Engage with your community</li>
              <li>• Track holder growth and volume</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}