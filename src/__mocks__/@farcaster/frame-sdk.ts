const mockSdk = {
  actions: {
    ready: jest.fn().mockResolvedValue(undefined),
    signIn: jest.fn(),
  },
  quickAuth: Promise.resolve({ token: null }),
  context: Promise.resolve({
    user: null,
  }),
};

export default mockSdk;