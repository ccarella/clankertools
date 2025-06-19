import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { HapticProvider, useHaptic } from '../HapticProvider';
import { getHapticFeedbackService } from '@/services/haptic-feedback';

// Don't use the automatic mock for HapticProvider in this test
jest.unmock('@/providers/HapticProvider');
jest.mock('@/services/haptic-feedback');

const TestComponent = () => {
  const haptic = useHaptic();
  
  return (
    <div>
      <button onClick={() => haptic.navigationTap()}>Navigate</button>
      <button onClick={() => haptic.buttonPress()}>Press</button>
      <span data-testid="enabled">{haptic.isEnabled() ? 'enabled' : 'disabled'}</span>
      <span data-testid="supported">{haptic.isSupported() ? 'supported' : 'unsupported'}</span>
    </div>
  );
};

describe('HapticProvider', () => {
  const mockHapticService = {
    init: jest.fn().mockResolvedValue(undefined),
    isEnabled: jest.fn().mockReturnValue(false),
    isSupported: jest.fn().mockReturnValue(true),
    enable: jest.fn(),
    disable: jest.fn(),
    toggle: jest.fn(),
    navigationTap: jest.fn().mockResolvedValue(undefined),
    menuItemSelect: jest.fn().mockResolvedValue(undefined),
    buttonPress: jest.fn().mockResolvedValue(undefined),
    toggleStateChange: jest.fn().mockResolvedValue(undefined),
    dropdownOpen: jest.fn().mockResolvedValue(undefined),
    dropdownItemHover: jest.fn().mockResolvedValue(undefined),
    cardSelect: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getHapticFeedbackService as jest.Mock).mockResolvedValue(mockHapticService);
  });

  it('should provide haptic service to children', async () => {
    render(
      <HapticProvider>
        <TestComponent />
      </HapticProvider>
    );

    await waitFor(() => {
      expect(getHapticFeedbackService).toHaveBeenCalled();
    });

    expect(screen.getByTestId('enabled')).toHaveTextContent('disabled');
    expect(screen.getByTestId('supported')).toHaveTextContent('supported');
  });

  it('should forward method calls to haptic service', async () => {
    render(
      <HapticProvider>
        <TestComponent />
      </HapticProvider>
    );

    await waitFor(() => {
      expect(getHapticFeedbackService).toHaveBeenCalled();
    });

    const navigateButton = screen.getByText('Navigate');
    const pressButton = screen.getByText('Press');

    navigateButton.click();
    await waitFor(() => {
      expect(mockHapticService.navigationTap).toHaveBeenCalled();
    });

    pressButton.click();
    await waitFor(() => {
      expect(mockHapticService.buttonPress).toHaveBeenCalled();
    });
  });

  it('should handle loading state gracefully', () => {
    // Mock the service to not resolve immediately
    (getHapticFeedbackService as jest.Mock).mockImplementation(() => new Promise(() => {}));
    
    render(
      <HapticProvider>
        <TestComponent />
      </HapticProvider>
    );

    // Before service loads, should show defaults
    expect(screen.getByTestId('enabled')).toHaveTextContent('disabled');
    expect(screen.getByTestId('supported')).toHaveTextContent('unsupported');
  });

  it('should throw error when useHaptic is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    let errorMessage = '';
    const ThrowingComponent = () => {
      try {
        useHaptic();
      } catch (e) {
        errorMessage = (e as Error).message;
      }
      return null;
    };

    render(<ThrowingComponent />);
    
    expect(errorMessage).toBe('useHaptic must be used within a HapticProvider');
    
    consoleSpy.mockRestore();
  });
});