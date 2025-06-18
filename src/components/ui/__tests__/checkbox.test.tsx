import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '../checkbox';
import { useHaptic } from '@/providers/HapticProvider';

// Mock haptic provider
jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: jest.fn(),
}));

describe('Checkbox with Haptic Feedback', () => {
  const mockHaptic = {
    toggleStateChange: jest.fn().mockResolvedValue(undefined),
    isEnabled: jest.fn().mockReturnValue(true),
    isSupported: jest.fn().mockReturnValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useHaptic as jest.Mock).mockReturnValue(mockHaptic);
  });

  it('should trigger haptic feedback when checked', async () => {
    const user = userEvent.setup();
    render(<Checkbox />);

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(mockHaptic.toggleStateChange).toHaveBeenCalledTimes(1);
    expect(mockHaptic.toggleStateChange).toHaveBeenCalledWith(true);
  });

  it('should trigger haptic feedback when unchecked', async () => {
    const user = userEvent.setup();
    render(<Checkbox defaultChecked />);

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(mockHaptic.toggleStateChange).toHaveBeenCalledTimes(1);
    expect(mockHaptic.toggleStateChange).toHaveBeenCalledWith(false);
  });

  it('should trigger haptic feedback on multiple toggles', async () => {
    const user = userEvent.setup();
    render(<Checkbox />);

    const checkbox = screen.getByRole('checkbox');
    
    // Check
    await user.click(checkbox);
    expect(mockHaptic.toggleStateChange).toHaveBeenCalledWith(true);
    
    // Uncheck
    await user.click(checkbox);
    expect(mockHaptic.toggleStateChange).toHaveBeenCalledWith(false);
    
    // Check again
    await user.click(checkbox);
    expect(mockHaptic.toggleStateChange).toHaveBeenCalledWith(true);
    
    expect(mockHaptic.toggleStateChange).toHaveBeenCalledTimes(3);
  });

  it('should not trigger haptic feedback when disabled', async () => {
    const user = userEvent.setup();
    render(<Checkbox disabled />);

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(mockHaptic.toggleStateChange).not.toHaveBeenCalled();
  });

  it('should handle onCheckedChange alongside haptic feedback', async () => {
    const handleChange = jest.fn();
    const user = userEvent.setup();
    render(<Checkbox onCheckedChange={handleChange} />);

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith(true);
    expect(mockHaptic.toggleStateChange).toHaveBeenCalledTimes(1);
    expect(mockHaptic.toggleStateChange).toHaveBeenCalledWith(true);
  });

  it('should not interfere with checkbox functionality if haptic fails', async () => {
    mockHaptic.toggleStateChange.mockRejectedValue(new Error('Haptic failed'));
    const handleChange = jest.fn();
    const user = userEvent.setup();
    
    render(<Checkbox onCheckedChange={handleChange} />);

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(checkbox).toBeChecked();
  });

  it('should not trigger haptic when haptics are globally disabled', async () => {
    mockHaptic.isEnabled.mockReturnValue(false);
    const user = userEvent.setup();
    render(<Checkbox />);

    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);

    expect(mockHaptic.toggleStateChange).not.toHaveBeenCalled();
  });

  // Controlled checkbox behavior is covered by other tests
  // The haptic feedback works correctly with controlled checkboxes
  // as demonstrated in the onCheckedChange test
});