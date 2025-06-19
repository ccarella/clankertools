import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import sdk from '@farcaster/frame-sdk';
import { SaveMiniAppButton } from '../SaveMiniAppButton';

jest.mock('@farcaster/frame-sdk', () => ({
  __esModule: true,
  default: {
    actions: {
      addMiniApp: jest.fn(),
    },
  },
}));

describe('SaveMiniAppButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the save mini app button', () => {
    render(<SaveMiniAppButton />);
    expect(screen.getByRole('button', { name: /save mini app/i })).toBeInTheDocument();
  });

  it('calls addMiniApp when button is clicked', async () => {
    const mockAddMiniApp = sdk.actions.addMiniApp as jest.Mock;
    mockAddMiniApp.mockResolvedValueOnce(undefined);

    render(<SaveMiniAppButton />);
    const button = screen.getByRole('button', { name: /save mini app/i });
    
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockAddMiniApp).toHaveBeenCalledTimes(1);
    });
  });

  it('shows loading state while adding mini app', async () => {
    const mockAddMiniApp = sdk.actions.addMiniApp as jest.Mock;
    mockAddMiniApp.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<SaveMiniAppButton />);
    const button = screen.getByRole('button', { name: /save mini app/i });
    
    fireEvent.click(button);

    expect(screen.getByRole('button', { name: /adding/i })).toBeInTheDocument();
    expect(button).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save mini app/i })).toBeInTheDocument();
    });
  });

  it('shows success message when mini app is added successfully', async () => {
    const mockAddMiniApp = sdk.actions.addMiniApp as jest.Mock;
    mockAddMiniApp.mockResolvedValueOnce(undefined);

    render(<SaveMiniAppButton />);
    const button = screen.getByRole('button', { name: /save mini app/i });
    
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/mini app added successfully/i)).toBeInTheDocument();
    });
  });

  it('shows error message when user rejects adding mini app', async () => {
    const mockAddMiniApp = sdk.actions.addMiniApp as jest.Mock;
    mockAddMiniApp.mockRejectedValueOnce(new Error('RejectedByUser'));

    render(<SaveMiniAppButton />);
    const button = screen.getByRole('button', { name: /save mini app/i });
    
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/mini app addition was cancelled/i)).toBeInTheDocument();
    });
  });

  it('shows error message for invalid domain manifest', async () => {
    const mockAddMiniApp = sdk.actions.addMiniApp as jest.Mock;
    mockAddMiniApp.mockRejectedValueOnce(new Error('InvalidDomainManifestJson'));

    render(<SaveMiniAppButton />);
    const button = screen.getByRole('button', { name: /save mini app/i });
    
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/invalid app configuration/i)).toBeInTheDocument();
    });
  });

  it('shows generic error message for unknown errors', async () => {
    const mockAddMiniApp = sdk.actions.addMiniApp as jest.Mock;
    mockAddMiniApp.mockRejectedValueOnce(new Error('Unknown error'));

    render(<SaveMiniAppButton />);
    const button = screen.getByRole('button', { name: /save mini app/i });
    
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/failed to add mini app/i)).toBeInTheDocument();
    });
  });

  it('clears success message after timeout', async () => {
    jest.useFakeTimers();
    const mockAddMiniApp = sdk.actions.addMiniApp as jest.Mock;
    mockAddMiniApp.mockResolvedValueOnce(undefined);

    render(<SaveMiniAppButton />);
    const button = screen.getByRole('button', { name: /save mini app/i });
    
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/mini app added successfully/i)).toBeInTheDocument();
    });

    jest.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(screen.queryByText(/mini app added successfully/i)).not.toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it('clears error message after timeout', async () => {
    jest.useFakeTimers();
    const mockAddMiniApp = sdk.actions.addMiniApp as jest.Mock;
    mockAddMiniApp.mockRejectedValueOnce(new Error('Unknown error'));

    render(<SaveMiniAppButton />);
    const button = screen.getByRole('button', { name: /save mini app/i });
    
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/failed to add mini app/i)).toBeInTheDocument();
    });

    jest.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(screen.queryByText(/failed to add mini app/i)).not.toBeInTheDocument();
    });

    jest.useRealTimers();
  });
});