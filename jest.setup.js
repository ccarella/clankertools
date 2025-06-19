import '@testing-library/jest-dom'
import React from 'react'

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