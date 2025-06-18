import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HomePage from '../HomePage';
import { useHaptic } from '@/providers/HapticProvider';

// Mock next/link
jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: jest.fn(),
}));

describe('HomePage', () => {
  const mockHaptic = {
    cardSelect: jest.fn().mockResolvedValue(undefined),
    isEnabled: jest.fn().mockReturnValue(true),
    isSupported: jest.fn().mockReturnValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useHaptic as jest.Mock).mockReturnValue(mockHaptic);
  });
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

  it('triggers haptic feedback on template tap', async () => {
    render(<HomePage />);

    const firstLink = screen.getByRole('link', { name: /simple launch/i });
    fireEvent.click(firstLink);

    await waitFor(() => {
      expect(mockHaptic.cardSelect).toHaveBeenCalledTimes(1);
    });
  });

  it('does not trigger haptic when disabled', async () => {
    mockHaptic.isEnabled.mockReturnValue(false);
    render(<HomePage />);

    const firstLink = screen.getByRole('link', { name: /simple launch/i });
    fireEvent.click(firstLink);

    await waitFor(() => {
      expect(mockHaptic.cardSelect).not.toHaveBeenCalled();
    });
  });
});