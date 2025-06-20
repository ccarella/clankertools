export const createPublicClient = jest.fn(() => ({
  chain: { id: 8453 },
  transport: {},
}));

export const createWalletClient = jest.fn(() => ({
  account: { address: '0x1234567890123456789012345678901234567890' },
  chain: { id: 8453 },
  transport: {},
}));

export const custom = jest.fn((provider) => provider);
export const http = jest.fn(() => ({}));
export const parseEther = jest.fn((value: string) => BigInt(Number(value) * 1e18));

export const base = { id: 8453, name: 'Base' };
export const baseSepolia = { id: 84532, name: 'Base Sepolia' };