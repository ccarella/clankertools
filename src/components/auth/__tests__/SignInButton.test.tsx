import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignInButton } from '../SignInButton';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';

// Mock the auth hook
jest.mock('@/components/providers/FarcasterAuthProvider');
jest.mock('@/providers/HapticProvider');

const mockUseFarcasterAuth = useFarcasterAuth as jest.MockedFunction<typeof useFarcasterAuth>;

describe('SignInButton', () => {
  const mockSignIn = jest.fn();
  const mockSignOut = jest.fn();
  const mockClearError = jest.fn();

  const defaultAuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    signIn: mockSignIn,
    signOut: mockSignOut,
    clearError: mockClearError,
    getQuickAuthToken: jest.fn(),
    castContext: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFarcasterAuth.mockReturnValue(defaultAuthState);
  });

  describe('Unauthenticated State', () => {
    it('should render sign in button when not authenticated', () => {
      render(<SignInButton />);
      
      const button = screen.getByRole('button', { name: /sign in with farcaster/i });
      expect(button).toBeInTheDocument();
    });

    it('should call signIn when sign in button is clicked', async () => {
      const user = userEvent.setup();
      render(<SignInButton />);
      
      const button = screen.getByRole('button', { name: /sign in with farcaster/i });
      await user.click(button);
      
      expect(mockSignIn).toHaveBeenCalledTimes(1);
    });

    it('should show loading state when signing in', () => {
      mockUseFarcasterAuth.mockReturnValue({
        ...defaultAuthState,
        isLoading: true,
      });

      render(<SignInButton />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(screen.getByText(/signing in.../i)).toBeInTheDocument();
    });

    it('should show error message when there is an error', () => {
      const errorMessage = 'User rejected sign in';
      mockUseFarcasterAuth.mockReturnValue({
        ...defaultAuthState,
        error: errorMessage,
      });

      render(<SignInButton />);
      
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    });

    it('should clear error when dismiss button is clicked', async () => {
      const user = userEvent.setup();
      mockUseFarcasterAuth.mockReturnValue({
        ...defaultAuthState,
        error: 'Some error',
      });

      render(<SignInButton />);
      
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await user.click(dismissButton);
      
      expect(mockClearError).toHaveBeenCalledTimes(1);
    });
  });

  describe('Authenticated State', () => {
    const mockUser = {
      fid: 12345,
      username: 'testuser',
      displayName: 'Test User',
      pfpUrl: 'https://example.com/avatar.png',
    };

    beforeEach(() => {
      mockUseFarcasterAuth.mockReturnValue({
        ...defaultAuthState,
        user: mockUser,
        isAuthenticated: true,
      });
    });

    it('should display user info when authenticated', () => {
      render(<SignInButton />);
      
      // The username is shown in the button text
      expect(screen.getByText('Test User')).toBeInTheDocument();
      // The @username is shown in dropdown when opened
      const button = screen.getByRole('button', { name: /user menu/i });
      expect(button).toBeInTheDocument();
    });

    it('should show dropdown menu when clicked', async () => {
      const user = userEvent.setup();
      render(<SignInButton />);
      
      const button = screen.getByRole('button', { name: /user menu/i });
      await user.click(button);
      
      expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument();
    });

    it('should call signOut when sign out is clicked', async () => {
      const user = userEvent.setup();
      render(<SignInButton />);
      
      const menuButton = screen.getByRole('button', { name: /user menu/i });
      await user.click(menuButton);
      
      const signOutButton = screen.getByRole('menuitem', { name: /sign out/i });
      await user.click(signOutButton);
      
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('should handle users without profile pictures', () => {
      mockUseFarcasterAuth.mockReturnValue({
        ...defaultAuthState,
        user: { ...mockUser, pfpUrl: undefined },
        isAuthenticated: true,
      });

      render(<SignInButton />);
      
      // The avatar fallback should be rendered with gradient classes
      const button = screen.getByRole('button', { name: /user menu/i });
      const fallback = button.querySelector('[data-slot="avatar-fallback"]');
      expect(fallback).toHaveClass('bg-gradient-to-br', 'from-violet-500', 'to-purple-600');
    });

    it('should handle users without display names', () => {
      mockUseFarcasterAuth.mockReturnValue({
        ...defaultAuthState,
        user: { ...mockUser, displayName: undefined },
        isAuthenticated: true,
      });

      render(<SignInButton />);
      
      expect(screen.getByText('@testuser')).toBeInTheDocument();
      expect(screen.queryByText('Test User')).not.toBeInTheDocument();
    });
  });

  describe('Custom Props', () => {
    it('should apply custom className', () => {
      render(<SignInButton className="custom-class" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('should render with different variants', () => {
      const { rerender } = render(<SignInButton variant="outline" />);
      
      let button = screen.getByRole('button');
      expect(button).toHaveClass('border');

      rerender(<SignInButton variant="ghost" />);
      button = screen.getByRole('button');
      expect(button).toHaveClass('hover:bg-accent');
    });

    it('should render with different sizes', () => {
      const { rerender } = render(<SignInButton size="sm" />);
      
      let button = screen.getByRole('button');
      expect(button).toHaveClass('h-8');

      rerender(<SignInButton size="lg" />);
      button = screen.getByRole('button');
      expect(button).toHaveClass('h-10');
    });
  });

  describe('Loading Skeleton', () => {
    it('should show skeleton loading state when specified', () => {
      mockUseFarcasterAuth.mockReturnValue({
        ...defaultAuthState,
        isLoading: true,
      });

      render(<SignInButton showSkeleton />);
      
      expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
    });
  });
});