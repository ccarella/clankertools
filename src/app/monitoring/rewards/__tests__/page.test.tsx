import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';
import RewardsMonitoring from '../page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/components/providers/FarcasterAuthProvider', () => ({
  useFarcasterAuth: jest.fn(),
}));

const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
};

describe('RewardsMonitoring Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });
    
    // Mock fetch
    global.fetch = jest.fn();
  });

  it('redirects to home if not authenticated', () => {
    (useFarcasterAuth as jest.Mock).mockReturnValue({
      isAuthenticated: false,
    });

    render(<RewardsMonitoring />);

    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('renders the page when authenticated', async () => {
    (useFarcasterAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
    });

    (window.localStorage.getItem as jest.Mock).mockReturnValue('test-admin-token');

    const mockReport = {
      period: {
        start: '2025-06-16T00:00:00.000Z',
        end: '2025-06-23T00:00:00.000Z',
      },
      summary: {
        totalDeployments: 10,
        deploymentsWithRewards: 8,
        deploymentsWithoutRewards: 2,
        discrepanciesFound: 1,
      },
      discrepancies: [],
      deployments: [],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockReport,
    });

    render(<RewardsMonitoring />);

    expect(screen.getByText('Rewards Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Monitor token deployments and creator reward distributions')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Total Deployments')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  it('displays error when admin token is missing', async () => {
    (useFarcasterAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
    });

    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);

    render(<RewardsMonitoring />);

    await waitFor(() => {
      expect(screen.getByText(/Admin token required/)).toBeInTheDocument();
    });
  });

  it('handles date range selection', async () => {
    (useFarcasterAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
    });

    (window.localStorage.getItem as jest.Mock).mockReturnValue('test-admin-token');

    const mockReport = {
      period: {
        start: '2025-06-16T00:00:00.000Z',
        end: '2025-06-23T00:00:00.000Z',
      },
      summary: {
        totalDeployments: 10,
        deploymentsWithRewards: 8,
        deploymentsWithoutRewards: 2,
        discrepanciesFound: 1,
      },
      discrepancies: [],
      deployments: [],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockReport,
    });

    render(<RewardsMonitoring />);

    await waitFor(() => {
      expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    });

    // Change date range
    fireEvent.click(screen.getByText('Last 7 days'));
    fireEvent.click(screen.getByText('Last 30 days'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('handles retry on error', async () => {
    (useFarcasterAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
    });

    (window.localStorage.getItem as jest.Mock).mockReturnValue('test-admin-token');

    (global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          period: { start: '', end: '' },
          summary: {
            totalDeployments: 0,
            deploymentsWithRewards: 0,
            deploymentsWithoutRewards: 0,
            discrepanciesFound: 0,
          },
          discrepancies: [],
          deployments: [],
        }),
      });

    render(<RewardsMonitoring />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    const retryButton = screen.getByText('Try again');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.queryByText('Network error')).not.toBeInTheDocument();
    });
  });
});