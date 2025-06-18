export type ContextType = 'cast' | 'notification' | 'share' | 'direct';

export interface CastAuthor {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl?: string;
}

export interface CastContext {
  type: 'cast';
  castId: string;
  parentCastId?: string;
  author: CastAuthor;
  embedUrl?: string;
}

export interface NotificationContext {
  type: 'notification';
}

export interface ShareContext {
  type: 'share';
}

export interface DirectContext {
  type: 'direct';
}

export type LaunchContext = CastContext | NotificationContext | ShareContext | DirectContext | null | undefined;

export interface TokenCastRelationship {
  tokenAddress: string;
  castId: string;
  parentCastId?: string;
  authorFid: number;
  authorUsername: string;
  embedUrl?: string;
  createdAt: number;
}