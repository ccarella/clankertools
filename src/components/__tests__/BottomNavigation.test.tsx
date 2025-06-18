import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { usePathname } from 'next/navigation';
import BottomNavigation from '../BottomNavigation';
import { useHaptic } from '@/providers/HapticProvider';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

// Mock haptic provider
jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: jest.fn(),
}));

describe('BottomNavigation with Haptic Feedback', () => {
  const mockHaptic = {
    navigationTap: jest.fn().mockResolvedValue(undefined),
    isEnabled: jest.fn().mockReturnValue(true),
    isSupported: jest.fn().mockReturnValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (usePathname as jest.Mock).mockReturnValue('/');
    (useHaptic as jest.Mock).mockReturnValue(mockHaptic);
  });

  it('should trigger haptic feedback on navigation tap', async () => {
    const user = userEvent.setup();
    render(<BottomNavigation />);

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    await user.click(dashboardLink);

    expect(mockHaptic.navigationTap).toHaveBeenCalledTimes(1);
  });

  it('should trigger haptic feedback for each navigation item', async () => {
    const user = userEvent.setup();
    render(<BottomNavigation />);

    const links = screen.getAllByRole('link');
    
    for (const link of links) {
      await user.click(link);
    }

    expect(mockHaptic.navigationTap).toHaveBeenCalledTimes(3);
  });

  it('should not trigger haptic feedback when haptics are disabled', async () => {
    mockHaptic.isEnabled.mockReturnValue(false);
    const user = userEvent.setup();
    render(<BottomNavigation />);

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    await user.click(dashboardLink);

    // Component should check if enabled before calling
    expect(mockHaptic.navigationTap).not.toHaveBeenCalled();
  });

  it('should still navigate when haptic feedback fails', async () => {
    mockHaptic.navigationTap.mockRejectedValue(new Error('Haptic failed'));
    const user = userEvent.setup();
    render(<BottomNavigation />);

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    
    // Should not throw error
    await expect(user.click(dashboardLink)).resolves.not.toThrow();
  });

  it('should highlight active navigation item', () => {
    (usePathname as jest.Mock).mockReturnValue('/dashboard');
    render(<BottomNavigation />);

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    const dashboardIcon = dashboardLink.querySelector('svg');
    const dashboardText = screen.getByText('Dashboard');

    expect(dashboardIcon).toHaveClass('text-primary');
    expect(dashboardText).toHaveClass('text-primary', 'font-medium');
  });
});