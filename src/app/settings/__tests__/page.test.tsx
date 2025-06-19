import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import sdk from '@farcaster/frame-sdk';
import Settings from '../page';
import { useHaptic } from '@/providers/HapticProvider';

jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: jest.fn(),
}));

jest.mock('@farcaster/frame-sdk', () => ({
  __esModule: true,
  default: {
    actions: {
      addMiniApp: jest.fn(),
    },
  },
}));

describe('Settings Page', () => {
  const mockHaptic = {
    isEnabled: jest.fn(),
    isSupported: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn(),
    impact: jest.fn(),
    notification: jest.fn(),
    selection: jest.fn(),
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
    (useHaptic as jest.Mock).mockReturnValue(mockHaptic);
    mockHaptic.isEnabled.mockReturnValue(true);
    mockHaptic.isSupported.mockReturnValue(true);
  });

  it('renders the settings page with all sections', () => {
    render(<Settings />);
    
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('User Preferences')).toBeInTheDocument();
    expect(screen.getByText('Customize your app experience')).toBeInTheDocument();
    expect(screen.getByText('Mini App')).toBeInTheDocument();
    expect(screen.getByText('Add ClankerTools to your Farcaster')).toBeInTheDocument();
  });

  it('renders the save mini app button', () => {
    render(<Settings />);
    
    expect(screen.getByRole('button', { name: /save mini app/i })).toBeInTheDocument();
  });

  it('handles haptic feedback toggle', () => {
    render(<Settings />);
    
    const checkbox = screen.getByRole('checkbox', { name: /enable haptic feedback/i });
    expect(checkbox).toBeChecked();
    
    fireEvent.click(checkbox);
    expect(mockHaptic.disable).toHaveBeenCalledTimes(1);
  });

  it('shows haptic feedback as disabled when not supported', () => {
    mockHaptic.isSupported.mockReturnValue(false);
    
    render(<Settings />);
    
    const checkbox = screen.getByRole('checkbox', { name: /enable haptic feedback/i });
    expect(checkbox).toBeDisabled();
    expect(screen.getByText('Not supported on this device')).toBeInTheDocument();
  });

  it('successfully adds mini app when button is clicked', async () => {
    const mockAddMiniApp = sdk.actions.addMiniApp as jest.Mock;
    mockAddMiniApp.mockResolvedValueOnce(undefined);

    render(<Settings />);
    
    const button = screen.getByRole('button', { name: /save mini app/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockAddMiniApp).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/mini app added successfully/i)).toBeInTheDocument();
    });
  });

  it('shows error when adding mini app fails', async () => {
    const mockAddMiniApp = sdk.actions.addMiniApp as jest.Mock;
    mockAddMiniApp.mockRejectedValueOnce(new Error('RejectedByUser'));

    render(<Settings />);
    
    const button = screen.getByRole('button', { name: /save mini app/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/mini app addition was cancelled/i)).toBeInTheDocument();
    });
  });
});