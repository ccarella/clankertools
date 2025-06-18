const mockSdk = {
  actions: {
    ready: jest.fn().mockResolvedValue(undefined),
    signIn: jest.fn(),
  },
  quickAuth: jest.fn(),
  context: {
    user: null,
  },
};

export default mockSdk;