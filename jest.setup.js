import '@testing-library/jest-dom'
import React from 'react'

// Mock HapticProvider globally
jest.mock('@/providers/HapticProvider', () => ({
  HapticProvider: ({ children }) => children,
  useHaptic: () => ({
    isEnabled: () => false,
    buttonPress: jest.fn(),
    lightImpact: jest.fn(),
    mediumImpact: jest.fn(),
    heavyImpact: jest.fn(),
    selectionChanged: jest.fn(),
    notificationSuccess: jest.fn(),
    notificationWarning: jest.fn(),
    notificationError: jest.fn(),
  }),
}))