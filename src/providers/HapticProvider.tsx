'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { HapticFeedbackService, getHapticFeedbackService } from '@/services/haptic-feedback';

interface HapticContextValue {
  isEnabled: () => boolean;
  isSupported: () => boolean;
  enable: () => void;
  disable: () => void;
  toggle: () => void;
  navigationTap: () => Promise<void>;
  menuItemSelect: () => Promise<void>;
  buttonPress: (variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link') => Promise<void>;
  toggleStateChange: (isOn: boolean) => Promise<void>;
  dropdownOpen: () => Promise<void>;
  dropdownItemHover: () => Promise<void>;
  cardSelect: () => Promise<void>;
}

const HapticContext = createContext<HapticContextValue | null>(null);

// Default no-op implementation for loading state
const defaultHapticService: HapticContextValue = {
  isEnabled: () => false,
  isSupported: () => false,
  enable: () => {},
  disable: () => {},
  toggle: () => {},
  navigationTap: async () => {},
  menuItemSelect: async () => {},
  buttonPress: async () => {},
  toggleStateChange: async () => {},
  dropdownOpen: async () => {},
  dropdownItemHover: async () => {},
  cardSelect: async () => {},
};

export function HapticProvider({ children }: { children: React.ReactNode }) {
  const [hapticService, setHapticService] = useState<HapticFeedbackService | null>(null);

  useEffect(() => {
    getHapticFeedbackService().then(setHapticService);
  }, []);

  const contextValue: HapticContextValue = hapticService ? {
    isEnabled: () => hapticService.isEnabled(),
    isSupported: () => hapticService.isSupported(),
    enable: () => hapticService.enable(),
    disable: () => hapticService.disable(),
    toggle: () => hapticService.toggle(),
    navigationTap: () => hapticService.navigationTap(),
    menuItemSelect: () => hapticService.menuItemSelect(),
    buttonPress: (variant) => hapticService.buttonPress(variant),
    toggleStateChange: (isOn) => hapticService.toggleStateChange(isOn),
    dropdownOpen: () => hapticService.dropdownOpen(),
    dropdownItemHover: () => hapticService.dropdownItemHover(),
    cardSelect: () => hapticService.cardSelect(),
  } : defaultHapticService;

  return (
    <HapticContext.Provider value={contextValue}>
      {children}
    </HapticContext.Provider>
  );
}

export function useHaptic() {
  const context = useContext(HapticContext);
  if (!context) {
    throw new Error('useHaptic must be used within a HapticProvider');
  }
  return context;
}