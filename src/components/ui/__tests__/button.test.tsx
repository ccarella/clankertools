import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../button';
import { useHaptic } from '@/providers/HapticProvider';

// Mock haptic provider
jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: jest.fn(),
}));

describe('Button with Haptic Feedback', () => {
  const mockHaptic = {
    buttonPress: jest.fn().mockResolvedValue(undefined),
    isEnabled: jest.fn().mockReturnValue(true),
    isSupported: jest.fn().mockReturnValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useHaptic as jest.Mock).mockReturnValue(mockHaptic);
  });

  it('should trigger haptic feedback on button press', async () => {
    const user = userEvent.setup();
    render(<Button>Click me</Button>);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(mockHaptic.buttonPress).toHaveBeenCalledTimes(1);
    expect(mockHaptic.buttonPress).toHaveBeenCalledWith('default');
  });

  it('should trigger different haptic intensity for destructive variant', async () => {
    const user = userEvent.setup();
    render(<Button variant="destructive">Delete</Button>);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(mockHaptic.buttonPress).toHaveBeenCalledWith('destructive');
  });

  it('should trigger appropriate haptic for each button variant', async () => {
    const user = userEvent.setup();
    const variants = [
      { variant: 'default', expected: 'default' },
      { variant: 'destructive', expected: 'destructive' },
      { variant: 'outline', expected: 'outline' },
      { variant: 'secondary', expected: 'secondary' },
      { variant: 'ghost', expected: 'ghost' },
      { variant: 'link', expected: 'link' },
    ] as const;

    for (const { variant, expected } of variants) {
      const { unmount } = render(<Button variant={variant}>Test</Button>);
      const button = screen.getByRole('button');
      
      await user.click(button);
      
      expect(mockHaptic.buttonPress).toHaveBeenLastCalledWith(expected);
      unmount();
    }
  });

  it('should not trigger haptic feedback when disabled', async () => {
    const user = userEvent.setup();
    render(<Button disabled>Click me</Button>);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(mockHaptic.buttonPress).not.toHaveBeenCalled();
  });

  it('should handle onClick alongside haptic feedback', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();
    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(mockHaptic.buttonPress).toHaveBeenCalledTimes(1);
  });

  it('should not interfere with button functionality if haptic fails', async () => {
    mockHaptic.buttonPress.mockRejectedValue(new Error('Haptic failed'));
    const handleClick = jest.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not trigger haptic when haptics are globally disabled', async () => {
    mockHaptic.isEnabled.mockReturnValue(false);
    const user = userEvent.setup();
    render(<Button>Click me</Button>);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(mockHaptic.buttonPress).not.toHaveBeenCalled();
  });
});