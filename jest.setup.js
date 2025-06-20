import '@testing-library/jest-dom'
import React from 'react'

// Add TextEncoder/TextDecoder for viem in tests
import { TextEncoder, TextDecoder } from 'util'
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock HapticProvider globally
jest.mock('@/providers/HapticProvider', () => ({
  HapticProvider: ({ children }) => children,
  useHaptic: () => ({
    isEnabled: () => false,
    isSupported: () => false,
    enable: jest.fn(),
    disable: jest.fn(),
    toggle: jest.fn(),
    navigationTap: jest.fn(),
    menuItemSelect: jest.fn(),
    buttonPress: jest.fn(),
    toggleStateChange: jest.fn(),
    dropdownOpen: jest.fn(),
    dropdownItemHover: jest.fn(),
    cardSelect: jest.fn(),
  }),
}))