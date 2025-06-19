import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { HapticProvider } from '@/providers/HapticProvider';
import LaunchOptionCardClient from '../LaunchOptionCardClient';

// Mock next/link
jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// Mock the haptic feedback service
jest.mock('@/services/haptic-feedback', () => ({
  HapticFeedbackService: {
    getInstance: jest.fn(() => ({
      cardSelect: jest.fn().mockResolvedValue(undefined),
    })),
  },
  getHapticFeedbackService: jest.fn().mockResolvedValue({
    cardSelect: jest.fn().mockResolvedValue(undefined),
  }),
}));

// Mock the useHaptic hook
const mockCardSelect = jest.fn();
jest.mock('@/providers/HapticProvider', () => ({
  ...jest.requireActual('@/providers/HapticProvider'),
  useHaptic: () => ({
    cardSelect: mockCardSelect,
  }),
}));

describe('LaunchOptionCardClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    title: 'Test Template',
    description: 'Test description',
    href: '/test-route',
    iconColor: 'bg-purple-500',
    children: <svg data-testid="test-icon" />,
  };

  const renderWithHaptic = (ui: React.ReactElement) => {
    return render(
      <HapticProvider>{ui}</HapticProvider>
    );
  };

  it('renders card with correct content', () => {
    renderWithHaptic(<LaunchOptionCardClient {...defaultProps} />);
    
    expect(screen.getByText('Test Template')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/test-route');
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('triggers haptic feedback on click', () => {
    renderWithHaptic(<LaunchOptionCardClient {...defaultProps} />);
    
    const card = screen.getByRole('link');
    fireEvent.click(card);
    
    expect(mockCardSelect).toHaveBeenCalledTimes(1);
  });

  it('triggers haptic feedback on touch start', () => {
    renderWithHaptic(<LaunchOptionCardClient {...defaultProps} />);
    
    const card = screen.getByRole('link');
    fireEvent.touchStart(card);
    
    expect(mockCardSelect).toHaveBeenCalledTimes(1);
  });

  it('does not trigger haptic feedback multiple times for both touch and click', () => {
    renderWithHaptic(<LaunchOptionCardClient {...defaultProps} />);
    
    const card = screen.getByRole('link');
    
    // Simulate touch followed by click (common on mobile)
    fireEvent.touchStart(card);
    fireEvent.click(card);
    
    // Should only trigger once due to debouncing
    expect(mockCardSelect).toHaveBeenCalledTimes(1);
  });
});