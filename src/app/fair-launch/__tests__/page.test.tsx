import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FairLaunchPage from '../page';
import { useRouter } from 'next/navigation';
import { useFarcasterContext } from '@/components/providers/FarcasterProvider';
import { useHaptic } from '@/providers/HapticProvider';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/components/providers/FarcasterProvider', () => ({
  useFarcasterContext: jest.fn(),
}));

jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: jest.fn(),
}));

jest.mock('@/components/BottomNavigation', () => ({
  __esModule: true,
  default: () => <div data-testid="bottom-navigation">Bottom Navigation</div>,
}));

jest.mock('@/components/fair-launch/WhitelistManager', () => ({
  WhitelistManager: ({ onWhitelistChange }: { onWhitelistChange: (whitelist: string[]) => void }) => {
    // Simulate adding a user when rendered
    React.useEffect(() => {
      onWhitelistChange(['testuser']);
    }, [onWhitelistChange]);
    return <div data-testid="whitelist-manager">Whitelist Manager</div>;
  },
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...props} />;
  },
}));

describe('FairLaunchPage', () => {
  const mockRouter = {
    push: jest.fn(),
    back: jest.fn(),
  };

  const mockFarcasterContext = {
    isAuthenticated: true,
    user: {
      fid: '123',
      username: 'testuser',
      displayName: 'Test User',
      pfpUrl: 'https://example.com/pfp.jpg',
    },
  };

  const mockHaptic = {
    light: jest.fn(),
    medium: jest.fn(),
    heavy: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useFarcasterContext as jest.Mock).mockReturnValue(mockFarcasterContext);
    (useHaptic as jest.Mock).mockReturnValue(mockHaptic);
  });

  it('should render the fair launch page with all steps', () => {
    render(<FairLaunchPage />);
    
    expect(screen.getByText(/Fair Launch Setup/)).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 5/)).toBeInTheDocument();
  });

  it('should show basic info form on step 1', () => {
    render(<FairLaunchPage />);
    
    expect(screen.getByLabelText(/Token Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Token Ticker/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Token Description/)).toBeInTheDocument();
    expect(screen.getByText(/Upload Token Image/)).toBeInTheDocument();
  });

  it('should navigate to whitelist management on step 2', async () => {
    render(<FairLaunchPage />);
    
    // Fill in basic info
    fireEvent.change(screen.getByLabelText(/Token Name/), { target: { value: 'Fair Token' } });
    fireEvent.change(screen.getByLabelText(/Token Ticker/), { target: { value: 'FAIR' } });
    
    // Click next
    fireEvent.click(screen.getByText(/Next/));
    
    await waitFor(() => {
      expect(screen.getByText(/Step 2 of 5/)).toBeInTheDocument();
      expect(screen.getByText(/Whitelist Management/)).toBeInTheDocument();
    });
  });

  it('should show contribution limits on step 3', async () => {
    render(<FairLaunchPage />);
    
    // Navigate to step 3
    fireEvent.change(screen.getByLabelText(/Token Name/), { target: { value: 'Fair Token' } });
    fireEvent.change(screen.getByLabelText(/Token Ticker/), { target: { value: 'FAIR' } });
    fireEvent.click(screen.getByText(/Next/));
    
    await waitFor(() => {
      fireEvent.click(screen.getByText(/Next/));
    });
    
    await waitFor(() => {
      expect(screen.getByText(/Step 3 of 5/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Minimum Contribution/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Maximum Contribution/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Target Raise Amount/)).toBeInTheDocument();
    });
  });

  it('should show launch schedule on step 4', async () => {
    render(<FairLaunchPage />);
    
    // Navigate through steps
    fireEvent.change(screen.getByLabelText(/Token Name/), { target: { value: 'Fair Token' } });
    fireEvent.change(screen.getByLabelText(/Token Ticker/), { target: { value: 'FAIR' } });
    fireEvent.click(screen.getByText(/Next/));
    
    await waitFor(() => fireEvent.click(screen.getByText(/Next/)));
    await waitFor(() => fireEvent.click(screen.getByText(/Next/)));
    
    await waitFor(() => {
      expect(screen.getByText(/Step 4 of 5/)).toBeInTheDocument();
      expect(screen.getByText(/Launch Schedule/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Launch Start Time/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Launch Duration/)).toBeInTheDocument();
    });
  });

  it('should show review page on step 5', async () => {
    render(<FairLaunchPage />);
    
    // Navigate through all steps
    fireEvent.change(screen.getByLabelText(/Token Name/), { target: { value: 'Fair Token' } });
    fireEvent.change(screen.getByLabelText(/Token Ticker/), { target: { value: 'FAIR' } });
    fireEvent.click(screen.getByText(/Next/));
    
    await waitFor(() => fireEvent.click(screen.getByText(/Next/)));
    await waitFor(() => fireEvent.click(screen.getByText(/Next/)));
    await waitFor(() => fireEvent.click(screen.getByText(/Next/)));
    
    await waitFor(() => {
      expect(screen.getByText(/Step 5 of 5/)).toBeInTheDocument();
      expect(screen.getByText(/Review & Deploy/)).toBeInTheDocument();
      expect(screen.getByText(/Fair Token/)).toBeInTheDocument();
    });
  });

  it('should handle unauthenticated users', () => {
    (useFarcasterContext as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      user: null,
    });
    
    render(<FairLaunchPage />);
    
    expect(mockRouter.push).toHaveBeenCalledWith('/');
  });

  it('should trigger haptic feedback on navigation', async () => {
    render(<FairLaunchPage />);
    
    fireEvent.change(screen.getByLabelText(/Token Name/), { target: { value: 'Fair Token' } });
    fireEvent.change(screen.getByLabelText(/Token Ticker/), { target: { value: 'FAIR' } });
    fireEvent.click(screen.getByText(/Next/));
    
    await waitFor(() => {
      expect(mockHaptic.light).toHaveBeenCalled();
    });
  });
});