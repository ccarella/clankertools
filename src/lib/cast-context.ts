import { CastContext, LaunchContext } from './types/cast-context';

export function parseCastContext(context: LaunchContext): CastContext | null {
  if (!context || context.type !== 'cast') {
    return null;
  }

  return {
    type: 'cast',
    castId: context.castId,
    parentCastId: context.parentCastId,
    author: {
      fid: context.author.fid,
      username: context.author.username,
      displayName: context.author.displayName,
      pfpUrl: context.author.pfpUrl
    },
    embedUrl: context.embedUrl
  };
}

export function formatCastUrl(castId: string, author?: string): string {
  if (!castId) {
    return '';
  }

  if (author) {
    return `https://warpcast.com/${author}/${castId}`;
  }

  return `https://warpcast.com/~/conversations/${castId}`;
}

export function extractCastId(url: string): string | null {
  if (!url) {
    return null;
  }

  // Match warpcast URLs
  const patterns = [
    /https:\/\/warpcast\.com\/~\/conversations\/(0x[a-fA-F0-9]+)/,
    /https:\/\/warpcast\.com\/[^\/]+\/(0x[a-fA-F0-9]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export function truncateCastId(castId: string, length: number = 8): string {
  if (!castId || castId.length <= length * 2) {
    return castId;
  }

  const start = castId.slice(0, length);
  const end = castId.slice(-4);
  return `${start}...${end}`;
}