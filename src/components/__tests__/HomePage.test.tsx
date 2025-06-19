import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { HapticProvider } from '@/providers/HapticProvider';
import HomePage from '../HomePage';

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

describe('HomePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderWithHaptic = (ui: React.ReactElement) => {
    return render(
      <HapticProvider>{ui}</HapticProvider>
    );
  };
  it('renders all launch option cards', () => {
    render(<HomePage />);
    
    // Check all cards are rendered
    expect(screen.getByText('Simple Launch')).toBeInTheDocument();
    expect(screen.getByText('Fair Launch')).toBeInTheDocument();
    expect(screen.getByText('Team/Project')).toBeInTheDocument();
    expect(screen.getByText('Memecoin Degen')).toBeInTheDocument();
    expect(screen.getByText('The Works (Advanced)')).toBeInTheDocument();
  });

  it('renders launch option descriptions', () => {
    render(<HomePage />);
    
    expect(screen.getByText('One-tap token launch')).toBeInTheDocument();
    expect(screen.getByText('Fair and transparent launch')).toBeInTheDocument();
    expect(screen.getByText('Launch for teams or projects')).toBeInTheDocument();
    expect(screen.getByText('For meme and community tokens')).toBeInTheDocument();
    expect(screen.getByText('Full configuration options')).toBeInTheDocument();
  });

  it('renders correct links for each option', () => {
    render(<HomePage />);
    
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);
    
    // Check href attributes
    expect(links[0]).toHaveAttribute('href', '/simple-launch');
    expect(links[1]).toHaveAttribute('href', '/fair-launch');
    expect(links[2]).toHaveAttribute('href', '/team-launch');
    expect(links[3]).toHaveAttribute('href', '/memecoin-launch');
    expect(links[4]).toHaveAttribute('href', '/the-works');
  });

  it('has proper responsive container classes', () => {
    const { container } = render(<HomePage />);
    
    const mainContainer = container.querySelector('.flex.flex-col.pb-16');
    expect(mainContainer).toBeInTheDocument();
    
    const contentContainer = container.querySelector('.px-3.py-4');
    expect(contentContainer).toBeInTheDocument();
    
    const cardsContainer = container.querySelector('.space-y-2\\.5');
    expect(cardsContainer).toBeInTheDocument();
  });

  it('renders with proper mobile-friendly layout', () => {
    const { container } = render(<HomePage />);
    
    // Check for mobile-friendly padding
    const paddedContainer = container.querySelector('.px-3');
    expect(paddedContainer).toBeInTheDocument();
    
    // Check for proper bottom spacing for navigation
    const mainDiv = container.querySelector('.pb-16');
    expect(mainDiv).toBeInTheDocument();
  });

  describe('Haptic Feedback', () => {
    it('triggers haptic feedback when clicking on template cards', () => {
      renderWithHaptic(<HomePage />);
      
      const cards = screen.getAllByRole('link');
      
      // Click on Simple Launch card
      fireEvent.click(cards[0]);
      expect(mockCardSelect).toHaveBeenCalledTimes(1);
      
      // Click on The Works card
      fireEvent.click(cards[4]);
      expect(mockCardSelect).toHaveBeenCalledTimes(2);
    });

    it('triggers haptic feedback on touch for mobile users', () => {
      renderWithHaptic(<HomePage />);
      
      const cards = screen.getAllByRole('link');
      
      // Touch Simple Launch card
      fireEvent.touchStart(cards[0]);
      expect(mockCardSelect).toHaveBeenCalledTimes(1);
    });

    it('triggers haptic feedback for all template options', () => {
      renderWithHaptic(<HomePage />);
      
      const cards = screen.getAllByRole('link');
      expect(cards).toHaveLength(5);
      
      // Test each card triggers haptic
      cards.forEach((card, index) => {
        fireEvent.click(card);
        expect(mockCardSelect).toHaveBeenCalledTimes(index + 1);
      });
    });
  });
});