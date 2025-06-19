export interface NeynarUser {
  fid: number;
  username: string;
  displayName: string;
  pfp?: {
    url: string;
  };
  profile?: {
    bio?: {
      text: string;
    };
  };
  custodyAddress: string;
  verifications?: string[];
  followerCount?: number;
  followingCount?: number;
}

export interface WalletAddress {
  address: string;
  chainType: 'ethereum' | 'solana';
}

export interface FollowersResponse {
  users: NeynarUser[];
  nextCursor: string | null;
}

export interface PaginationOptions {
  cursor?: string;
  limit?: number;
}

export class NeynarService {
  private apiKey: string;
  private baseUrl = 'https://api.neynar.com/v2/farcaster';

  constructor() {
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      throw new Error('NEYNAR_API_KEY environment variable is not set');
    }
    
    this.apiKey = apiKey;
  }

  private async fetchAPI(endpoint: string, options?: RequestInit) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'accept': 'application/json',
        'api_key': this.apiKey,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Neynar API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getUserByFid(fid: number): Promise<NeynarUser> {
    if (fid <= 0) {
      throw new Error('Invalid FID: must be a positive number');
    }

    try {
      const data = await this.fetchAPI(`/user/bulk?fids=${fid}`);
      const user = data.users?.[0];
      
      if (!user) {
        throw new Error(`User with FID ${fid} not found`);
      }

      return this.mapUser(user);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      throw new Error(`Failed to fetch user with FID ${fid}: ${error}`);
    }
  }

  async getUserByUsername(username: string): Promise<NeynarUser> {
    try {
      const data = await this.fetchAPI(`/user/by_username?username=${encodeURIComponent(username)}`);
      
      if (!data.user) {
        throw new Error(`User with username ${username} not found`);
      }

      return this.mapUser(data.user);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw error;
      }
      throw new Error(`Failed to fetch user with username ${username}: ${error}`);
    }
  }

  async getUserWalletAddresses(fid: number): Promise<WalletAddress[]> {
    try {
      const data = await this.fetchAPI(`/user/bulk?fids=${fid}`);
      const user = data.users?.[0];
      const addresses: WalletAddress[] = [];

      if (user?.verified_addresses) {
        user.verified_addresses.eth_addresses?.forEach((address: string) => {
          addresses.push({
            address,
            chainType: 'ethereum'
          });
        });

        user.verified_addresses.sol_addresses?.forEach((address: string) => {
          addresses.push({
            address,
            chainType: 'solana'
          });
        });
      }

      return addresses;
    } catch (error) {
      console.error(`Failed to fetch wallet addresses for FID ${fid}:`, error);
      return [];
    }
  }

  async getUserFollowers(fid: number, options?: PaginationOptions): Promise<FollowersResponse> {
    try {
      const params = new URLSearchParams({
        fid: fid.toString(),
        limit: (options?.limit || 100).toString(),
      });
      
      if (options?.cursor) {
        params.append('cursor', options.cursor);
      }

      const data = await this.fetchAPI(`/followers?${params}`);

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        users: (data.users || []).map((user: any) => this.mapUser(user)),
        nextCursor: data.next?.cursor || null
      };
    } catch (error) {
      throw new Error(`Failed to fetch followers for FID ${fid}: ${error}`);
    }
  }

  async getUserFollowing(fid: number, options?: PaginationOptions): Promise<FollowersResponse> {
    try {
      const params = new URLSearchParams({
        fid: fid.toString(),
        limit: (options?.limit || 100).toString(),
      });
      
      if (options?.cursor) {
        params.append('cursor', options.cursor);
      }

      const data = await this.fetchAPI(`/following?${params}`);

      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        users: (data.users || []).map((user: any) => this.mapUser(user)),
        nextCursor: data.next?.cursor || null
      };
    } catch (error) {
      throw new Error(`Failed to fetch following for FID ${fid}: ${error}`);
    }
  }

  async getRelevantFollowers(targetFid: number, viewerFid: number): Promise<NeynarUser[]> {
    try {
      const data = await this.fetchAPI(`/user/${targetFid}/followers/relevant?viewer_fid=${viewerFid}`);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data.users || []).map((user: any) => this.mapUser(user));
    } catch (error) {
      throw new Error(`Failed to fetch relevant followers: ${error}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapUser(apiUser: any): NeynarUser {
    return {
      fid: apiUser.fid,
      username: apiUser.username || '',
      displayName: apiUser.display_name || apiUser.displayName || '',
      pfp: apiUser.pfp_url ? { url: apiUser.pfp_url } : apiUser.pfp,
      profile: apiUser.profile || (apiUser.bio ? { bio: { text: apiUser.bio } } : undefined),
      custodyAddress: apiUser.custody_address || apiUser.custodyAddress || '',
      verifications: apiUser.verifications || apiUser.verified_addresses?.eth_addresses || [],
      followerCount: apiUser.follower_count || apiUser.followerCount,
      followingCount: apiUser.following_count || apiUser.followingCount
    };
  }
}