// Token API wrapper for fetching token data
// Token API functions

export interface TokenData {
  name: string;
  symbol: string;
  description?: string;
  address: string;
  imageUrl: string;
  price: string;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  holders: number;
  creatorReward: number;
  isNsfw: boolean;
}

export interface UserToken {
  address: string;
  name: string;
  symbol: string;
  createdAt?: string;
}

export interface UserTokensResponse {
  tokens: UserToken[];
  nextCursor: string | null;
}

/**
 * Fetches token data by calling the internal API
 */
export async function getTokenData(address: string, baseUrl?: string): Promise<TokenData> {
  const url = baseUrl || process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
  const response = await fetch(`${url}/api/token/${address}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch token data: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch token data');
  }
  
  // Map the API response to our expected format
  return {
    name: data.data.name,
    symbol: data.data.symbol,
    description: '', // API doesn't provide description currently
    address: data.data.address,
    imageUrl: data.data.imageUrl,
    price: '0.001', // Calculate from marketCap/totalSupply if needed
    marketCap: parseFloat(data.data.marketCap) || 0,
    volume24h: parseFloat(data.data.volume24h) || 0,
    priceChange24h: data.data.priceChange24h || 0,
    holders: data.data.holders || 0,
    creatorReward: 80, // Default value, could be stored in token metadata
    isNsfw: false, // Would need to be stored in metadata
  };
}

/**
 * Fetches user tokens by calling the internal API
 */
export async function getUserTokens(
  userId: string, 
  cursor?: string, 
  limit: number = 10,
  baseUrl?: string
): Promise<UserTokensResponse> {
  const url = baseUrl || process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
  const params = new URLSearchParams();
  
  if (cursor) params.append('cursor', cursor);
  params.append('limit', limit.toString());
  
  const headers = new Headers();
  headers.set('x-farcaster-user-id', userId);
  
  const response = await fetch(`${url}/api/user/tokens?${params.toString()}`, {
    headers,
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch user tokens: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  return {
    tokens: data.tokens || [],
    nextCursor: data.nextCursor || null,
  };
}