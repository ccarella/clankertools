import React from 'react';
import { render, screen } from '@testing-library/react';
import { AuthStatus } from '../AuthStatus';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';

// Mock the auth hook
jest.mock('@/components/providers/FarcasterAuthProvider');

const mockUseFarcasterAuth = useFarcasterAuth as jest.MockedFunction<typeof useFarcasterAuth>;

describe('AuthStatus', () => {
  const defaultAuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    signIn: jest.fn(),
    signOut: jest.fn(),
    clearError: jest.fn(),
    getQuickAuthToken: jest.fn(),
    castContext: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFarcasterAuth.mockReturnValue(defaultAuthState);
  });

  it('should show authenticated message when user is signed in', () => {
    const mockUser = {
      fid: 12345,
      username: 'testuser',
      displayName: 'Test User',
    };

    mockUseFarcasterAuth.mockReturnValue({
      ...defaultAuthState,
      user: mockUser,
      isAuthenticated: true,
    });

    render(<AuthStatus />);
    
    expect(screen.getByText(/signed in as test user/i)).toBeInTheDocument();
    expect(screen.getByText(/fid: 12345/i)).toBeInTheDocument();
  });

  it('should show not authenticated message when user is not signed in', () => {
    render(<AuthStatus />);
    
    expect(screen.getByText(/not signed in/i)).toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockUseFarcasterAuth.mockReturnValue({
      ...defaultAuthState,
      isLoading: true,
    });

    render(<AuthStatus />);
    
    expect(screen.getByText(/loading.../i)).toBeInTheDocument();
  });

  it('should show error state', () => {
    mockUseFarcasterAuth.mockReturnValue({
      ...defaultAuthState,
      error: 'Authentication failed',
    });

    render(<AuthStatus />);
    
    expect(screen.getByText(/error: authentication failed/i)).toBeInTheDocument();
  });

  it('should handle user without display name', () => {
    const mockUser = {
      fid: 12345,
      username: 'testuser',
    };

    mockUseFarcasterAuth.mockReturnValue({
      ...defaultAuthState,
      user: mockUser,
      isAuthenticated: true,
    });

    render(<AuthStatus />);
    
    expect(screen.getByText(/signed in as @testuser/i)).toBeInTheDocument();
  });
});