import React from 'react';

const defaultHaptic = {
  isEnabled: () => false,
  isSupported: () => false,
  enable: () => {},
  disable: () => {},
  toggle: () => {},
  navigationTap: jest.fn().mockResolvedValue(undefined),
  menuItemSelect: jest.fn().mockResolvedValue(undefined),
  buttonPress: jest.fn().mockResolvedValue(undefined),
  toggleStateChange: jest.fn().mockResolvedValue(undefined),
  dropdownOpen: jest.fn().mockResolvedValue(undefined),
  dropdownItemHover: jest.fn().mockResolvedValue(undefined),
  cardSelect: jest.fn().mockResolvedValue(undefined),
};

export const useHaptic = jest.fn(() => defaultHaptic);

export const HapticProvider = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};