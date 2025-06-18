export const Clanker = jest.fn().mockImplementation(() => ({
  deployToken: jest.fn(),
  getToken: jest.fn(),
  getUserTokens: jest.fn(),
}));

export const createTokenFromForm = jest.fn();
export const validateSimpleTokenForm = jest.fn();