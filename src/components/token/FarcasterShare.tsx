'use client';

import { useState } from 'react';
import { Share2, Loader2 } from 'lucide-react';
import sdk from '@farcaster/frame-sdk';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';
import { cn } from '@/lib/utils';

interface FarcasterShareProps {
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  message?: string;
  variant?: 'default' | 'compact';
  channel?: string;
}

export default function FarcasterShare({
  tokenName,
  tokenSymbol,
  tokenAddress,
  message,
  variant = 'default',
  channel,
}: FarcasterShareProps) {
  const { isAuthenticated } = useFarcasterAuth();
  const [loading, setLoading] = useState(false);

  async function handleShare() {
    if (!isAuthenticated || loading) return;

    setLoading(true);

    try {
      const defaultMessage = `🚀 Just launched ${tokenName} ($${tokenSymbol}) on @clanker!\n\nLet's go to the moon together! 🌙`;
      const castText = message || defaultMessage;
      
      // Frame URL for rich preview
      const frameUrl = `${window.location.origin}/api/frame/token/${tokenAddress}`;
      
      // Try using castIntent if openComposer is not available
      if (sdk.actions.openUrl) {
        const text = encodeURIComponent(castText);
        const embedsParam = encodeURIComponent(frameUrl);
        const castUrl = `https://warpcast.com/~/compose?text=${text}&embeds[]=${embedsParam}${channel ? `&channelKey=${channel}` : ''}`;
        await sdk.actions.openUrl(castUrl);
      } else {
        // Fallback to window.open
        const text = encodeURIComponent(castText);
        const embedsParam = encodeURIComponent(frameUrl);
        const castUrl = `https://warpcast.com/~/compose?text=${text}&embeds[]=${embedsParam}${channel ? `&channelKey=${channel}` : ''}`;
        window.open(castUrl, '_blank');
      }

      // Track analytics if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof window !== 'undefined' && (window as any).gtag) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).gtag('event', 'share_token', {
          token_address: tokenAddress,
          token_symbol: tokenSymbol,
          platform: 'farcaster',
        });
      }
    } catch (error) {
      console.error('Failed to open Farcaster composer:', error);
    } finally {
      setLoading(false);
    }
  }

  const isCompact = variant === 'compact';

  return (
    <div className="relative">
      <button
        onClick={handleShare}
        disabled={!isAuthenticated || loading}
        className={cn(
          "btn btn-primary w-full",
          isCompact && "btn-sm",
          !isAuthenticated && "opacity-50 cursor-not-allowed"
        )}
        title={!isAuthenticated ? "Sign in to share" : undefined}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" data-testid="share-loading" />
        ) : (
          <>
            <Share2 className="h-4 w-4" />
            {!isCompact && <span className="ml-2">Share on Farcaster</span>}
          </>
        )}
      </button>
      
      {!isAuthenticated && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-popover text-popover-foreground text-sm rounded-md px-3 py-1 shadow-lg">
            Sign in to share
          </div>
        </div>
      )}
    </div>
  );
}