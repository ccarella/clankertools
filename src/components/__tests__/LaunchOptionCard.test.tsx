import React from 'react';
import { render, screen } from '@testing-library/react';
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

// Mock the LaunchOptionCardClient component
jest.mock('../LaunchOptionCardClient', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function MockLaunchOptionCardClient({ children, ...props }: any) {
    return (
      <a href={props.href} onClick={mockCardSelect} onTouchStart={mockCardSelect}>
        <div className={`p-3.5 hover:bg-card-hover active:scale-[0.98] ${props.iconColor}`}>
          {children}
          <div>{props.title}</div>
          <div>{props.description}</div>
        </div>
      </a>
    );
  };
});

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

  it('renders card with correct content', () => {
    render(<LaunchOptionCard {...defaultProps} />);
    
    expect(screen.getByText('Test Template')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('passes correct props to client component', () => {
    const { container } = render(<LaunchOptionCard {...defaultProps} />);
    
    const link = container.querySelector('a');
    expect(link).toHaveAttribute('href', '/test-route');
    
    const iconContainer = container.querySelector('.bg-purple-500');
    expect(iconContainer).toBeInTheDocument();
  });

  it('renders icon as child of client component', () => {
    render(<LaunchOptionCard {...defaultProps} />);
    
    // The Zap icon should be rendered
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('uses default icon color when not provided', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { iconColor, ...propsWithoutColor } = defaultProps;
    
    const { container } = render(<LaunchOptionCard {...propsWithoutColor} />);
    
    const iconContainer = container.querySelector('.bg-purple-500');
    expect(iconContainer).toBeInTheDocument();
  });
});