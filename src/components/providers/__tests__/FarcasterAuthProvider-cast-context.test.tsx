import React, { useEffect } from 'react';
import { render, waitFor } from '@testing-library/react';
import { FarcasterAuthProvider, useFarcasterAuth } from '../FarcasterAuthProvider';
import farcasterFrame from '@farcaster/frame-sdk';
import { CastContext } from '@/lib/types/cast-context';

jest.mock('@farcaster/frame-sdk', () => ({
  __esModule: true,
  default: {
    actions: {
      ready: jest.fn(),
      signIn: jest.fn(),
      openUrl: jest.fn(),
    },
    context: {},
  },
}));

const mockSdk = farcasterFrame as jest.Mocked<typeof farcasterFrame>;

const TestComponent = ({ autoSignIn = false }: { autoSignIn?: boolean }) => {
  const auth = useFarcasterAuth();
  
  useEffect(() => {
    if (autoSignIn && !auth.isAuthenticated) {
      auth.signIn();
    }
  }, [autoSignIn, auth]);
  
  return (
    <div>
      <div data-testid="is-authenticated">{auth.isAuthenticated ? 'true' : 'false'}</div>
      <div data-testid="cast-context">{JSON.stringify(auth.castContext)}</div>
    </div>
  );
};

describe('FarcasterAuthProvider - Cast Context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockSdk.actions.ready as jest.Mock).mockResolvedValue(undefined);
  });

  it('should capture cast context during authentication', async () => {
    const castContext: CastContext = {
      type: 'cast',
      castId: '0x1234567890abcdef',
      parentCastId: '0x0987654321fedcba',
      author: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User',
        pfpUrl: 'https://example.com/pfp.png'
      },
      embedUrl: 'https://example.com/frame'
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockSdk.context as any) = Promise.resolve({
      user: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User',
        profileImage: 'https://example.com/pfp.png',
      },
      client: {
        clientFid: 1,
        frameActionBody: {},
        added: true,
      },
      launchContext: castContext
    });

    (mockSdk.actions.signIn as jest.Mock).mockResolvedValue(undefined);

    const { getByTestId } = render(
      <FarcasterAuthProvider>
        <TestComponent autoSignIn />
      </FarcasterAuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('is-authenticated').textContent).toBe('true');
    });

    await waitFor(() => {
      const contextData = JSON.parse(getByTestId('cast-context').textContent || '{}');
      expect(contextData).toEqual(castContext);
    });
  });

  it('should handle context without launch context', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockSdk.context as any) = Promise.resolve({
      user: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User',
      },
      client: {
        clientFid: 1,
        frameActionBody: {},
        added: true,
      }
    });

    (mockSdk.actions.signIn as jest.Mock).mockResolvedValue(undefined);

    const { getByTestId } = render(
      <FarcasterAuthProvider>
        <TestComponent autoSignIn />
      </FarcasterAuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('is-authenticated').textContent).toBe('true');
    });

    await waitFor(() => {
      const contextData = getByTestId('cast-context').textContent;
      expect(contextData).toBe('null');
    });
  });

  it('should handle notification launch context', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockSdk.context as any) = Promise.resolve({
      user: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User',
      },
      client: {
        clientFid: 1,
        frameActionBody: {},
        added: true,
      },
      launchContext: {
        type: 'notification'
      }
    });

    (mockSdk.actions.signIn as jest.Mock).mockResolvedValue(undefined);

    const { getByTestId } = render(
      <FarcasterAuthProvider>
        <TestComponent autoSignIn />
      </FarcasterAuthProvider>
    );

    await waitFor(() => {
      expect(getByTestId('is-authenticated').textContent).toBe('true');
    });

    await waitFor(() => {
      const contextData = getByTestId('cast-context').textContent;
      expect(contextData).toBe('null');
    });
  });

  it('should persist cast context through re-renders', async () => {
    const castContext: CastContext = {
      type: 'cast',
      castId: '0x1234567890abcdef',
      author: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User'
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockSdk.context as any) = Promise.resolve({
      user: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User',
      },
      client: {
        clientFid: 1,
        frameActionBody: {},
        added: true,
      },
      launchContext: castContext
    });

    (mockSdk.actions.signIn as jest.Mock).mockResolvedValue(undefined);

    const { getByTestId, rerender } = render(
      <FarcasterAuthProvider>
        <TestComponent autoSignIn />
      </FarcasterAuthProvider>
    );

    await waitFor(() => {
      const contextData = JSON.parse(getByTestId('cast-context').textContent || '{}');
      expect(contextData).toEqual(castContext);
    });

    rerender(
      <FarcasterAuthProvider>
        <TestComponent autoSignIn />
      </FarcasterAuthProvider>
    );

    const contextData = JSON.parse(getByTestId('cast-context').textContent || '{}');
    expect(contextData).toEqual(castContext);
  });
});