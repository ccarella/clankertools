import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { HapticProvider } from '@/providers/HapticProvider';
import LaunchOptionCard from '../LaunchOptionCard';
import { Zap } from 'lucide-react';

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

describe('LaunchOptionCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    title: 'Test Template',
    description: 'Test description',
    href: '/test-route',
    icon: Zap,
    iconColor: 'bg-purple-500',
  };

  const renderWithHaptic = (ui: React.ReactElement) => {
    return render(
      <HapticProvider>{ui}</HapticProvider>
    );
  };

  it('renders card with correct content', () => {
    renderWithHaptic(<LaunchOptionCard {...defaultProps} />);
    
    expect(screen.getByText('Test Template')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/test-route');
  });

  it('renders icon with correct color', () => {
    const { container } = renderWithHaptic(<LaunchOptionCard {...defaultProps} />);
    
    const iconContainer = container.querySelector('.bg-purple-500');
    expect(iconContainer).toBeInTheDocument();
  });

  it('triggers haptic feedback on click', () => {
    renderWithHaptic(<LaunchOptionCard {...defaultProps} />);
    
    const card = screen.getByRole('link');
    fireEvent.click(card);
    
    expect(mockCardSelect).toHaveBeenCalledTimes(1);
  });

  it('triggers haptic feedback on touch start', () => {
    renderWithHaptic(<LaunchOptionCard {...defaultProps} />);
    
    const card = screen.getByRole('link');
    fireEvent.touchStart(card);
    
    expect(mockCardSelect).toHaveBeenCalledTimes(1);
  });

  it('does not trigger haptic feedback multiple times for both touch and click', () => {
    renderWithHaptic(<LaunchOptionCard {...defaultProps} />);
    
    const card = screen.getByRole('link');
    
    // Simulate touch followed by click (common on mobile)
    fireEvent.touchStart(card);
    fireEvent.click(card);
    
    // Should only trigger once due to debouncing or event handling
    expect(mockCardSelect).toHaveBeenCalledTimes(1);
  });

  it('has proper mobile touch target size', () => {
    const { container } = renderWithHaptic(<LaunchOptionCard {...defaultProps} />);
    
    // Check for proper padding that ensures 44px+ touch target
    const card = container.querySelector('.p-3\\.5');
    expect(card).toBeInTheDocument();
  });

  it('has hover and active states', () => {
    const { container } = renderWithHaptic(<LaunchOptionCard {...defaultProps} />);
    
    const card = container.querySelector('.hover\\:bg-card-hover');
    expect(card).toBeInTheDocument();
    
    const activeCard = container.querySelector('.active\\:scale-\\[0\\.98\\]');
    expect(activeCard).toBeInTheDocument();
  });

  it('uses default icon color when not provided', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { iconColor, ...propsWithoutColor } = defaultProps;
    
    const { container } = renderWithHaptic(<LaunchOptionCard {...propsWithoutColor} />);
    
    const iconContainer = container.querySelector('.bg-purple-500');
    expect(iconContainer).toBeInTheDocument();
  });

  it('renders without haptic provider gracefully', () => {
    // Test that component works even without haptic provider
    render(<LaunchOptionCard {...defaultProps} />);
    
    const card = screen.getByRole('link');
    
    // Should not throw when clicking
    expect(() => fireEvent.click(card)).not.toThrow();
  });
});