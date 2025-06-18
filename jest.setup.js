import '@testing-library/jest-dom'

// Mock HapticProvider globally for all tests
const mockHaptic = {
  isEnabled: jest.fn(() => true),
  buttonPress: jest.fn(() => Promise.resolve()),
  toggleStateChange: jest.fn(() => Promise.resolve()),
  navigationTap: jest.fn(() => Promise.resolve()),
  menuItemSelect: jest.fn(() => Promise.resolve()),
  cardSelect: jest.fn(() => Promise.resolve()),
  tabSwitch: jest.fn(() => Promise.resolve()),
  isSupported: jest.fn(() => true),
  enable: jest.fn(),
  disable: jest.fn(),
  toggle: jest.fn(),
};

jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: jest.fn(() => mockHaptic),
  HapticProvider: ({ children }) => children,
}))