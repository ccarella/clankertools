import '@testing-library/jest-dom'

// Mock HapticProvider globally for all tests
jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: jest.fn(() => ({
    haptic: {
      isEnabled: jest.fn(() => true),
      buttonPress: jest.fn(() => Promise.resolve()),
      toggleStateChange: jest.fn(() => Promise.resolve()),
    },
  })),
}))