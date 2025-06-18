type EthereumProvider = {
  request: jest.MockedFunction<(args: { method: string }) => Promise<unknown>>;
};

const mockProvider: EthereumProvider = {
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
    getEthereumProvider: jest.fn().mockResolvedValue(mockProvider) as jest.MockedFunction<() => Promise<EthereumProvider | undefined>>,
    getSolanaProvider: jest.fn().mockResolvedValue(undefined) as jest.MockedFunction<() => Promise<unknown>>,
  },
};

export default mockSdk;