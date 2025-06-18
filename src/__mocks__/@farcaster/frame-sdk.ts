const mockProvider = {
  request: jest.fn(),
};

const mockSdk = {
  actions: {
    ready: jest.fn().mockResolvedValue(undefined),
    signIn: jest.fn() as jest.MockedFunction<() => Promise<void>>,
  },
  quickAuth: {
    token: null,
    getToken: jest.fn(),
    fetch: jest.fn(),
  } as unknown,
  context: Promise.resolve({
    user: null,
    client: {
      clientFid: 0,
      frameActionBody: {},
      added: false,
    },
  }),
  wallet: {
    ethProvider: mockProvider,
    getEthereumProvider: jest.fn().mockResolvedValue(mockProvider),
    getSolanaProvider: jest.fn().mockResolvedValue(undefined),
  },
};

export default mockSdk;