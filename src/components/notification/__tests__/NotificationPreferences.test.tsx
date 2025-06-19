import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationPreferences } from '../NotificationPreferences';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';

jest.mock('@/components/providers/FarcasterAuthProvider');

// Mock fetch
global.fetch = jest.fn();

describe('NotificationPreferences', () => {
  const mockUseFarcasterAuth = useFarcasterAuth as jest.MockedFunction<typeof useFarcasterAuth>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFarcasterAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        fid: 123,
        username: 'testuser',
        displayName: 'Test User',
        pfpUrl: 'https://example.com/pfp.png'
      },
      castContext: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      isLoading: false,
      error: null,
      clearError: jest.fn(),
      getQuickAuthToken: jest.fn()
    });
  });

  it('renders notification preference toggles', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tokenLaunched: true,
        tokenMilestones: true,
        followerActivity: true,
        castMentions: true,
        creatorRewards: true
      })
    });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Token Launched')).toBeInTheDocument();
    });

    expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    expect(screen.getByText('Token Milestones')).toBeInTheDocument();
    expect(screen.getByText('Follower Activity')).toBeInTheDocument();
    expect(screen.getByText('Cast Mentions')).toBeInTheDocument();
    expect(screen.getByText('Creator Rewards')).toBeInTheDocument();
  });

  it('loads user preferences on mount', async () => {
    const mockPreferences = {
      tokenLaunched: true,
      tokenMilestones: false,
      followerActivity: true,
      castMentions: false,
      creatorRewards: true
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPreferences
    });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/notifications/preferences?fid=123');
    });

    // Check that toggles are set according to preferences
    const tokenLaunchedCheckbox = screen.getByRole('checkbox', { name: /token launched/i });
    const tokenMilestonesCheckbox = screen.getByRole('checkbox', { name: /token milestones/i });
    
    expect(tokenLaunchedCheckbox).toBeChecked();
    expect(tokenMilestonesCheckbox).not.toBeChecked();
  });

  it('saves preferences when toggled', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tokenLaunched: true,
          tokenMilestones: true,
          followerActivity: true,
          castMentions: true,
          creatorRewards: true
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /token launched/i })).toBeChecked();
    });

    // Toggle a preference
    const tokenLaunchedCheckbox = screen.getByRole('checkbox', { name: /token launched/i });
    fireEvent.click(tokenLaunchedCheckbox);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/notifications/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fid: 123,
          preferences: {
            tokenLaunched: false,
            tokenMilestones: true,
            followerActivity: true,
            castMentions: true,
            creatorRewards: true
          }
        })
      });
    });
  });

  it('shows error message when preferences fail to load', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500
    });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load preferences')).toBeInTheDocument();
    });
  });

  it('shows error message when preferences fail to save', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tokenLaunched: true,
          tokenMilestones: true,
          followerActivity: true,
          castMentions: true,
          creatorRewards: true
        })
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500
      })
      // Mock for reloading preferences after error
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tokenLaunched: true,
          tokenMilestones: true,
          followerActivity: true,
          castMentions: true,
          creatorRewards: true
        })
      });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /token launched/i })).toBeChecked();
    });

    // Toggle a preference
    const tokenLaunchedCheckbox = screen.getByRole('checkbox', { name: /token launched/i });
    fireEvent.click(tokenLaunchedCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Failed to save preferences')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows loading state while fetching preferences', () => {
    (global.fetch as jest.Mock).mockImplementation(() => 
      new Promise(() => {}) // Never resolves
    );

    render(<NotificationPreferences />);

    expect(screen.getByText('Loading preferences...')).toBeInTheDocument();
  });

  it('requires authentication to view preferences', () => {
    mockUseFarcasterAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      castContext: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      isLoading: false,
      error: null,
      clearError: jest.fn(),
      getQuickAuthToken: jest.fn()
    });

    render(<NotificationPreferences />);

    expect(screen.getByText('Please sign in to manage notification preferences')).toBeInTheDocument();
    expect(screen.queryByText('Notification Preferences')).not.toBeInTheDocument();
  });

  it('shows descriptions for each notification type', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tokenLaunched: true,
        tokenMilestones: true,
        followerActivity: true,
        castMentions: true,
        creatorRewards: true
      })
    });

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByText('Get notified when your tokens are successfully launched')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Receive updates on trading volume and holder milestones')).toBeInTheDocument();
    expect(screen.getByText('Know when notable accounts follow you')).toBeInTheDocument();
    expect(screen.getByText('Get alerted when you\'re mentioned in casts')).toBeInTheDocument();
    expect(screen.getByText('Track your creator reward earnings')).toBeInTheDocument();
  });

  it('disables all toggles while saving', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tokenLaunched: true,
          tokenMilestones: true,
          followerActivity: true,
          castMentions: true,
          creatorRewards: true
        })
      })
      .mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ success: true })
        }), 100))
      );

    render(<NotificationPreferences />);

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /token launched/i })).toBeChecked();
    });

    // Toggle a preference
    const tokenLaunchedCheckbox = screen.getByRole('checkbox', { name: /token launched/i });
    fireEvent.click(tokenLaunchedCheckbox);

    // All checkboxes should be disabled while saving
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(checkbox => {
      expect(checkbox).toBeDisabled();
    });
  });
});