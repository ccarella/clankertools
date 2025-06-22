// Mock implementation for token-api module used in tests

export const getTokenData = jest.fn();
export const getUserTokens = jest.fn();

// Reset mocks for each test
beforeEach(() => {
  jest.clearAllMocks();
  
  // Default mock implementation
  getTokenData.mockResolvedValue({
    name: 'Test Token',
    symbol: 'TEST',
    description: 'A test token',
    address: '0x1234567890123456789012345678901234567890',
    imageUrl: 'https://example.com/image.png',
    price: '0.001',
    marketCap: 1000000,
    volume24h: 50000,
    priceChange24h: 5.5,
    holders: 100,
    creatorReward: 5,
    isNsfw: false,
  });

  getUserTokens.mockResolvedValue({
    tokens: [
      {
        address: '0x1234567890123456789012345678901234567890',
        name: 'Test Token',
        symbol: 'TEST',
      }
    ],
    nextCursor: null,
  });
});