import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfilePage from '../page';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';

jest.mock('@/components/providers/FarcasterAuthProvider');
jest.mock('@/components/auth', () => ({
  AuthStatus: () => <div>Auth Status</div>,
}));

describe('ProfilePage Security', () => {
  const mockUseFarcasterAuth = useFarcasterAuth as jest.MockedFunction<typeof useFarcasterAuth>;
  const mockGetQuickAuthToken = jest.fn();
  
  const mockUser = {
    fid: 12345,
    username: 'testuser',
    displayName: 'Test User',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(window, 'alert').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should not log authentication tokens to console', async () => {
    const testToken = 'super-secret-token-12345';
    mockGetQuickAuthToken.mockResolvedValue(testToken);
    
    mockUseFarcasterAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
      getQuickAuthToken: mockGetQuickAuthToken,
      error: null,
      clearError: jest.fn(),
      castContext: null,
    });

    render(<ProfilePage />);
    
    const tokenButton = screen.getByRole('button', { name: /Get Quick Auth Token/i });
    fireEvent.click(tokenButton);

    await waitFor(() => {
      expect(mockGetQuickAuthToken).toHaveBeenCalled();
    });

    // Ensure console.log was never called with the token
    expect(console.log).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('token'));
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining(testToken));
    
    // Ensure alert shows success message without token
    expect(window.alert).toHaveBeenCalledWith('Token obtained successfully!');
    expect(window.alert).not.toHaveBeenCalledWith(expect.stringContaining(testToken));
  });

  it('should handle token retrieval failure securely', async () => {
    mockGetQuickAuthToken.mockResolvedValue(null);
    
    mockUseFarcasterAuth.mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
      getQuickAuthToken: mockGetQuickAuthToken,
      error: null,
      clearError: jest.fn(),
      castContext: null,
    });

    render(<ProfilePage />);
    
    const tokenButton = screen.getByRole('button', { name: /Get Quick Auth Token/i });
    fireEvent.click(tokenButton);

    await waitFor(() => {
      expect(mockGetQuickAuthToken).toHaveBeenCalled();
    });

    expect(window.alert).toHaveBeenCalledWith('Failed to get Quick Auth token');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('should not display sensitive information when not authenticated', () => {
    mockUseFarcasterAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
      getQuickAuthToken: jest.fn(),
      error: null,
      clearError: jest.fn(),
      castContext: null,
    });

    render(<ProfilePage />);
    
    expect(screen.getByText('Sign in to view your profile')).toBeInTheDocument();
    expect(screen.queryByText(/FID/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Get Quick Auth Token/i })).not.toBeInTheDocument();
  });
});