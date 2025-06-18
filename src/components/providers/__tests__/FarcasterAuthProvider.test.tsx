import React from 'react';
import { render, renderHook, act, screen } from '@testing-library/react';
import { FarcasterAuthProvider, useFarcasterAuth } from '../FarcasterAuthProvider';
import sdk from '@farcaster/frame-sdk';

jest.mock('@farcaster/frame-sdk');

const mockSdk = sdk as jest.Mocked<typeof sdk>;

describe('FarcasterAuthProvider', () => {
  const mockUser = {
    fid: 12345,
    username: 'testuser',
    displayName: 'Test User',
    pfpUrl: 'https://example.com/avatar.png',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Storage.prototype, 'getItem');
    jest.spyOn(Storage.prototype, 'setItem');
    jest.spyOn(Storage.prototype, 'removeItem');
    Storage.prototype.getItem = jest.fn();
    Storage.prototype.setItem = jest.fn();
    Storage.prototype.removeItem = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Provider Initialization', () => {
    it('should provide auth context to children', () => {
      const TestComponent = () => {
        const auth = useFarcasterAuth();
        return <div>{auth ? 'Context Available' : 'No Context'}</div>;
      };

      render(
        <FarcasterAuthProvider>
          <TestComponent />
        </FarcasterAuthProvider>
      );

      expect(screen.getByText('Context Available')).toBeInTheDocument();
    });

    it('should initialize with no user when sessionStorage is empty', () => {
      (Storage.prototype.getItem as jest.Mock).mockReturnValue(null);

      const { result } = renderHook(() => useFarcasterAuth(), {
        wrapper: FarcasterAuthProvider,
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    it('should restore user from sessionStorage on mount', () => {
      const storedUser = JSON.stringify(mockUser);
      (Storage.prototype.getItem as jest.Mock).mockReturnValue(storedUser);

      const { result } = renderHook(() => useFarcasterAuth(), {
        wrapper: FarcasterAuthProvider,
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(Storage.prototype.getItem).toHaveBeenCalledWith('farcaster_user');
    });
  });

  describe('Sign In', () => {
    it('should sign in successfully and store user data', async () => {
      mockSdk.actions.signIn.mockResolvedValue({});
      
      mockSdk.context = Promise.resolve({
        user: mockUser,
      });

      const { result } = renderHook(() => useFarcasterAuth(), {
        wrapper: FarcasterAuthProvider,
      });

      await act(async () => {
        await result.current.signIn();
      });

      expect(mockSdk.actions.signIn).toHaveBeenCalledWith({
        nonce: expect.any(String),
      });
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(Storage.prototype.setItem).toHaveBeenCalledWith(
        'farcaster_user',
        JSON.stringify(mockUser)
      );
    });

    it('should handle sign in errors when no user context', async () => {
      mockSdk.actions.signIn.mockResolvedValue({});
      mockSdk.context = Promise.resolve({ user: null });

      const { result } = renderHook(() => useFarcasterAuth(), {
        wrapper: FarcasterAuthProvider,
      });

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Failed to get user context after sign in');
      expect(result.current.isLoading).toBe(false);
    });

    it('should set loading state during sign in', async () => {
      let resolveSignIn: (value: unknown) => void;
      const signInPromise = new Promise<unknown>((resolve) => {
        resolveSignIn = resolve;
      });
      
      mockSdk.actions.signIn.mockReturnValue(signInPromise);
      mockSdk.context = Promise.resolve({ user: mockUser });

      const { result } = renderHook(() => useFarcasterAuth(), {
        wrapper: FarcasterAuthProvider,
      });

      act(() => {
        result.current.signIn();
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn!({});
        await signInPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should handle SDK exceptions', async () => {
      const error = new Error('SDK Error');
      mockSdk.actions.signIn.mockRejectedValue(error);

      const { result } = renderHook(() => useFarcasterAuth(), {
        wrapper: FarcasterAuthProvider,
      });

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('SDK Error');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Sign Out', () => {
    it('should clear user data and sessionStorage on sign out', () => {
      const storedUser = JSON.stringify(mockUser);
      (Storage.prototype.getItem as jest.Mock).mockReturnValue(storedUser);

      const { result } = renderHook(() => useFarcasterAuth(), {
        wrapper: FarcasterAuthProvider,
      });

      expect(result.current.user).toEqual(mockUser);

      act(() => {
        result.current.signOut();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(Storage.prototype.removeItem).toHaveBeenCalledWith('farcaster_user');
    });
  });

  describe('Error Handling', () => {
    it('should clear error when signing in again', async () => {
      const { result } = renderHook(() => useFarcasterAuth(), {
        wrapper: FarcasterAuthProvider,
      });

      // First simulate a failed sign in (no user context)
      mockSdk.actions.signIn.mockResolvedValueOnce({});
      mockSdk.context = Promise.resolve({ user: null });

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBe('Failed to get user context after sign in');

      // Then simulate a successful sign in
      mockSdk.actions.signIn.mockResolvedValueOnce({});
      mockSdk.context = Promise.resolve({ user: mockUser });

      await act(async () => {
        await result.current.signIn();
      });

      expect(result.current.error).toBeNull();
    });

    it('should provide clearError function', () => {
      const { result } = renderHook(() => useFarcasterAuth(), {
        wrapper: FarcasterAuthProvider,
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('useFarcasterAuth Hook', () => {
    it('should throw error when used outside provider', () => {
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        renderHook(() => useFarcasterAuth());
      }).toThrow('useFarcasterAuth must be used within a FarcasterAuthProvider');

      console.error = originalError;
    });
  });

  describe('Quick Auth', () => {
    it('should get Quick Auth JWT token', async () => {
      const mockToken = 'jwt-token-12345';
      const mockQuickAuthResult = {
        token: mockToken,
      };
      
      mockSdk.quickAuth = Promise.resolve(mockQuickAuthResult);

      const { result } = renderHook(() => useFarcasterAuth(), {
        wrapper: FarcasterAuthProvider,
      });

      let token: string | null = null;
      await act(async () => {
        token = await result.current.getQuickAuthToken();
      });

      expect(token).toBe(mockToken);
    });

    it('should handle Quick Auth errors', async () => {
      mockSdk.quickAuth = Promise.reject(new Error('Quick Auth failed'));

      const { result } = renderHook(() => useFarcasterAuth(), {
        wrapper: FarcasterAuthProvider,
      });

      let token: string | null = null;
      await act(async () => {
        token = await result.current.getQuickAuthToken();
      });

      expect(token).toBeNull();
      expect(result.current.error).toBe('Quick Auth failed');
    });
  });
});