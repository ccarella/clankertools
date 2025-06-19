export type EthereumProvider = {
  request: jest.MockedFunction<(args: { method: string }) => Promise<unknown>>;
};

const mockProvider: EthereumProvider = {
  request: jest.fn(),
};

const mockSdk = {
  actions: {
    ready: jest.fn().mockResolvedValue(undefined),
    signIn: jest.fn() as jest.MockedFunction<() => Promise<void>>,
    openUrl: jest.fn().mockResolvedValue(undefined),
  },
  quickAuth: {
    token: null,
    getToken: jest.fn(),
    fetch: jest.fn(),
  } as unknown,
  context: {
    then: jest.fn((callback) => {
      callback({
        user: null,
        client: {
          clientFid: 0,
          frameActionBody: {},
          added: false,
        },
      });
      return Promise.resolve();
    }),
  },
  wallet: {
    ethProvider: mockProvider,
    getEthereumProvider: jest.fn().mockResolvedValue(mockProvider),
    getSolanaProvider: jest.fn().mockResolvedValue(undefined),
  },
  getCapabilities: jest.fn().mockResolvedValue([]),
  haptics: {
    impactOccurred: jest.fn().mockResolvedValue(undefined),
    notificationOccurred: jest.fn().mockResolvedValue(undefined),
    selectionChanged: jest.fn().mockResolvedValue(undefined),
  },
  back: {
    enableWebNavigation: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
  },
} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

export const mockSDK = mockSdk;

export const resetSDKMocks = () => {
  mockSdk.actions.ready.mockClear();
  mockSdk.actions.signIn.mockClear();
  mockSdk.actions.openUrl.mockClear();
  mockSdk.quickAuth.getToken.mockClear();
  mockSdk.quickAuth.fetch.mockClear();
  mockSdk.wallet.getEthereumProvider.mockClear();
  mockSdk.wallet.getSolanaProvider.mockClear();
  mockSdk.getCapabilities.mockClear();
  mockSdk.haptics.impactOccurred.mockClear();
  mockSdk.haptics.notificationOccurred.mockClear();
  mockSdk.haptics.selectionChanged.mockClear();
  mockSdk.back.enableWebNavigation.mockClear();
  mockSdk.back.show.mockClear();
  mockSdk.back.hide.mockClear();
  mockProvider.request.mockClear();
};

export default mockSdk;