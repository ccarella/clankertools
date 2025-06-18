import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import SimpleLaunchPage from '../page';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/providers/WalletProvider', () => ({
  useWallet: jest.fn(() => ({
    isConnected: false,
    address: null,
  })),
}));

jest.mock('@/components/providers/FarcasterAuthProvider', () => ({
  useFarcasterAuth: jest.fn(() => ({
    user: { fid: '12345', username: 'testuser' },
    isAuthenticated: true,
    isLoading: false,
    error: null,
    signIn: jest.fn(),
    signOut: jest.fn(),
    clearError: jest.fn(),
    getQuickAuthToken: jest.fn(),
    castContext: null,
  })),
}));

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock Response for tests
if (typeof Response === 'undefined') {
  global.Response = class Response {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(private body: any, private init?: ResponseInit) {}
    
    async json() {
      return JSON.parse(this.body);
    }
    
    get ok() {
      return !this.init || (this.init.status && this.init.status >= 200 && this.init.status < 300);
    }
    
    get status() {
      return this.init?.status || 200;
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// Suppress console.error for deployment error test
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

describe('SimpleLaunchPage', () => {
  const mockRouter = {
    push: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    jest.clearAllMocks();
  });

  it('renders all form fields', () => {
    render(<SimpleLaunchPage />);
    
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/symbol/i)).toBeInTheDocument();
    expect(screen.getByText(/click to upload or drag and drop/i)).toBeInTheDocument();
    expect(screen.getByText(/80% \/ 20% split/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /launch token/i })).toBeInTheDocument();
  });

  it('navigates back when back button is clicked', () => {
    render(<SimpleLaunchPage />);
    
    const backButton = screen.getByRole('button', { name: '' });
    fireEvent.click(backButton);
    
    expect(mockRouter.back).toHaveBeenCalled();
  });

  describe('Form Validation', () => {
    it('validates token name is required', async () => {
      render(<SimpleLaunchPage />);
      
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      fireEvent.click(launchButton);
      
      await waitFor(() => {
        expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      });
    });

    it('validates token name max length of 32 characters', async () => {
      render(<SimpleLaunchPage />);
      
      const nameInput = screen.getByLabelText(/name/i);
      await userEvent.type(nameInput, 'a'.repeat(33));
      
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      fireEvent.click(launchButton);
      
      await waitFor(() => {
        expect(screen.getByText(/name must be 32 characters or less/i)).toBeInTheDocument();
      });
    });

    it('validates symbol is required', async () => {
      render(<SimpleLaunchPage />);
      
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      fireEvent.click(launchButton);
      
      await waitFor(() => {
        expect(screen.getByText(/symbol is required/i)).toBeInTheDocument();
      });
    });

    it('validates symbol length between 3-8 characters', async () => {
      render(<SimpleLaunchPage />);
      
      const symbolInput = screen.getByLabelText(/symbol/i);
      await userEvent.type(symbolInput, 'AB');
      
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      fireEvent.click(launchButton);
      
      await waitFor(() => {
        expect(screen.getByText(/symbol must be between 3 and 8 characters/i)).toBeInTheDocument();
      });
    });

    it('auto-uppercases symbol input', async () => {
      render(<SimpleLaunchPage />);
      
      const symbolInput = screen.getByLabelText(/symbol/i) as HTMLInputElement;
      await userEvent.type(symbolInput, 'abc');
      
      expect(symbolInput.value).toBe('ABC');
    });

    it('validates image is required', async () => {
      render(<SimpleLaunchPage />);
      
      // Fill in name and symbol
      const nameInput = screen.getByLabelText(/name/i);
      const symbolInput = screen.getByLabelText(/symbol/i);
      await userEvent.type(nameInput, 'Test Token');
      await userEvent.type(symbolInput, 'TEST');
      
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      fireEvent.click(launchButton);
      
      // Should stay on form page due to missing image
      expect(screen.getByText(/click to upload or drag and drop/i)).toBeInTheDocument();
    });
  });

  describe('Image Upload', () => {
    it('handles file upload', async () => {
      render(<SimpleLaunchPage />);
      
      const file = new File(['image'], 'token.png', { type: 'image/png' });
      const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      await waitFor(() => {
        expect(uploadInput).toBeInTheDocument();
      });
      
      fireEvent.change(uploadInput, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByAltText(/token preview/i)).toBeInTheDocument();
      });
    });

    it('shows camera option on mobile', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: jest.fn().mockResolvedValue(true),
        },
        writable: true,
      });
      
      render(<SimpleLaunchPage />);
      
      await waitFor(() => {
        expect(screen.getByText(/take photo/i)).toBeInTheDocument();
      });
    });
  });

  describe('Review Step', () => {
    it('shows review screen when all fields are valid', async () => {
      render(<SimpleLaunchPage />);
      
      const nameInput = screen.getByLabelText(/name/i);
      const symbolInput = screen.getByLabelText(/symbol/i);
      
      await userEvent.type(nameInput, 'My Test Token');
      await userEvent.type(symbolInput, 'MTT');
      
      const file = new File(['image'], 'token.png', { type: 'image/png' });
      const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(uploadInput, { target: { files: [file] } })
      
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      fireEvent.click(launchButton);
      
      await waitFor(() => {
        expect(screen.getByText(/review your token/i)).toBeInTheDocument();
        expect(screen.getByText(/my test token/i)).toBeInTheDocument();
        expect(screen.getByText(/MTT/i)).toBeInTheDocument();
        expect(screen.getByText(/1,000,000,000/i)).toBeInTheDocument();
        expect(screen.getByText(/80% creator/i)).toBeInTheDocument();
        expect(screen.getByText(/20% platform/i)).toBeInTheDocument();
      });
    });

    it('allows going back from review to edit', async () => {
      render(<SimpleLaunchPage />);
      
      const nameInput = screen.getByLabelText(/name/i);
      const symbolInput = screen.getByLabelText(/symbol/i);
      
      await userEvent.type(nameInput, 'My Test Token');
      await userEvent.type(symbolInput, 'MTT');
      
      const file = new File(['image'], 'token.png', { type: 'image/png' });
      const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(uploadInput, { target: { files: [file] } })
      
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      fireEvent.click(launchButton);
      
      await waitFor(() => {
        expect(screen.getByText(/review your token/i)).toBeInTheDocument();
      });
      
      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);
      
      expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    });
  });

  describe('Token Deployment', () => {
    it('shows loading state during deployment', async () => {
      // Create a promise that we can control
      let resolveDeployment: (value: Response) => void;
      const deploymentPromise = new Promise<Response>((resolve) => {
        resolveDeployment = resolve;
      });
      
      (fetch as jest.Mock).mockReturnValue(deploymentPromise);
      
      render(<SimpleLaunchPage />);
      
      const nameInput = screen.getByLabelText(/name/i);
      const symbolInput = screen.getByLabelText(/symbol/i);
      
      await userEvent.type(nameInput, 'My Test Token');
      await userEvent.type(symbolInput, 'MTT');
      
      const file = new File(['image'], 'token.png', { type: 'image/png' });
      const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(uploadInput, { target: { files: [file] } })
      
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      fireEvent.click(launchButton);
      
      await waitFor(() => {
        expect(screen.getByText(/review your token/i)).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByRole('button', { name: /confirm & launch/i });
      
      // Click confirm and check loading state immediately
      await act(async () => {
        fireEvent.click(confirmButton);
      });
      
      // Check loading state
      expect(screen.getByText(/deploying your token/i)).toBeInTheDocument();
      
      // Resolve the deployment promise to clean up
      await act(async () => {
        resolveDeployment(new Response(JSON.stringify({
          success: true,
          tokenAddress: '0x123...',
          txHash: '0xabc...',
          imageUrl: 'ipfs://test',
        }), { status: 200 }));
        // Wait for component to update
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    });

    it('handles deployment success', async () => {
      (fetch as jest.Mock).mockResolvedValue(
        new Response(JSON.stringify({
          success: true,
          tokenAddress: '0x123...',
          txHash: '0xabc...',
          imageUrl: 'ipfs://test',
        }), { status: 200 })
      );
      
      render(<SimpleLaunchPage />);
      
      const nameInput = screen.getByLabelText(/name/i);
      const symbolInput = screen.getByLabelText(/symbol/i);
      
      await userEvent.type(nameInput, 'My Test Token');
      await userEvent.type(symbolInput, 'MTT');
      
      const file = new File(['image'], 'token.png', { type: 'image/png' });
      const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(uploadInput, { target: { files: [file] } })
      
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      fireEvent.click(launchButton);
      
      await waitFor(() => {
        expect(screen.getByText(/review your token/i)).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByRole('button', { name: /confirm & launch/i });
      
      await act(async () => {
        fireEvent.click(confirmButton);
        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/token/0x123...');
      }, { timeout: 3000 });
    });

    it('handles deployment errors', async () => {
      (fetch as jest.Mock).mockResolvedValue(
        new Response(JSON.stringify({
          success: false,
          error: 'Deployment failed',
        }), { status: 500 })
      );
      
      render(<SimpleLaunchPage />);
      
      const nameInput = screen.getByLabelText(/name/i);
      const symbolInput = screen.getByLabelText(/symbol/i);
      
      await userEvent.type(nameInput, 'My Test Token');
      await userEvent.type(symbolInput, 'MTT');
      
      const file = new File(['image'], 'token.png', { type: 'image/png' });
      const uploadInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(uploadInput, { target: { files: [file] } })
      
      const launchButton = screen.getByRole('button', { name: /launch token/i });
      fireEvent.click(launchButton);
      
      await waitFor(() => {
        expect(screen.getByText(/review your token/i)).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByRole('button', { name: /confirm & launch/i });
      
      await act(async () => {
        fireEvent.click(confirmButton);
        // Wait for async operations
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      await waitFor(() => {
        expect(screen.getByText('Deployment Failed')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
});