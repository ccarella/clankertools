import { NeynarUser } from '@/services/neynar'

export function createMockNeynarUser(overrides: Partial<NeynarUser> = {}): NeynarUser {
  return {
    fid: 12345,
    username: 'testuser',
    displayName: 'Test User',
    pfp: {
      url: 'https://example.com/avatar.jpg'
    },
    profile: {
      bio: {
        text: 'Test bio'
      }
    },
    custodyAddress: '0xabc...',
    verifications: ['0x123...'],
    followerCount: 5000,
    followingCount: 250,
    ...overrides
  }
}