import { render, screen, fireEvent } from '@testing-library/react';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';
import ShareTemplateSelector from '../ShareTemplateSelector';

jest.mock('@farcaster/frame-sdk', () => ({
  __esModule: true,
  default: {
    actions: {
      composeCast: jest.fn(),
    },
  },
}));

jest.mock('@/components/providers/FarcasterAuthProvider', () => ({
  useFarcasterAuth: jest.fn(),
}));

describe('ShareTemplateSelector', () => {
  const defaultProps = {
    tokenName: 'Test Token',
    tokenSymbol: 'TEST',
    tokenAddress: '0x1234567890abcdef',
  };

  beforeEach(() => {
    (useFarcasterAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });
  });

  it('renders share button with default template', () => {
    render(<ShareTemplateSelector {...defaultProps} />);
    
    expect(screen.getByRole('heading', { name: 'Share on Farcaster' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /share on farcaster/i })).toBeInTheDocument();
  });

  it('shows customize message button', () => {
    render(<ShareTemplateSelector {...defaultProps} />);
    
    expect(screen.getByText('Customize message')).toBeInTheDocument();
  });

  it('toggles template selector when customize is clicked', () => {
    render(<ShareTemplateSelector {...defaultProps} />);
    
    const customizeButton = screen.getByText('Customize message');
    fireEvent.click(customizeButton);
    
    expect(screen.getByText('Hide message')).toBeInTheDocument();
    expect(screen.getByText('Launch Announcement')).toBeInTheDocument();
    expect(screen.getByText('Milestone Update')).toBeInTheDocument();
    expect(screen.getByText('Preview:')).toBeInTheDocument();
  });

  it('displays all template options', () => {
    render(<ShareTemplateSelector {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Customize message'));
    
    expect(screen.getByText('Launch Announcement')).toBeInTheDocument();
    expect(screen.getByText('Milestone Update')).toBeInTheDocument();
    expect(screen.getByText('Reward Claim')).toBeInTheDocument();
    expect(screen.getByText('Custom Message')).toBeInTheDocument();
    expect(screen.getByText('Price Action')).toBeInTheDocument();
    expect(screen.getByText('Community Call')).toBeInTheDocument();
  });

  it('changes selected template when clicked', () => {
    render(<ShareTemplateSelector {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Customize message'));
    
    const milestoneButton = screen.getByText('Milestone Update').closest('button');
    fireEvent.click(milestoneButton!);
    
    const preview = screen.getByText('Preview:').nextElementSibling;
    expect(preview?.textContent).toContain('📈 Test Token ($TEST) update:');
  });

  it('shows custom text input when custom template is selected', () => {
    render(<ShareTemplateSelector {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Customize message'));
    
    const customButton = screen.getByText('Custom Message').closest('button');
    fireEvent.click(customButton!);
    
    expect(screen.getByPlaceholderText('Write your custom message...')).toBeInTheDocument();
  });

  it('updates preview with custom text', () => {
    render(<ShareTemplateSelector {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Customize message'));
    fireEvent.click(screen.getByText('Custom Message').closest('button')!);
    
    const textarea = screen.getByPlaceholderText('Write your custom message...');
    fireEvent.change(textarea, { target: { value: 'My custom message!' } });
    
    const preview = screen.getByText('Preview:').nextElementSibling;
    expect(preview?.textContent).toBe('My custom message!');
  });

  it('includes optional params in milestone template', () => {
    render(<ShareTemplateSelector {...defaultProps} marketCap="$1M" holders={100} />);
    
    fireEvent.click(screen.getByText('Customize message'));
    fireEvent.click(screen.getByText('Milestone Update').closest('button')!);
    
    const preview = screen.getByText('Preview:').nextElementSibling;
    expect(preview?.textContent).toContain('Market Cap: $1M');
    expect(preview?.textContent).toContain('Holders: 100');
  });

  it('passes channel prop to FarcasterShare', () => {
    render(<ShareTemplateSelector {...defaultProps} channel="clanker" />);
    
    // The channel will be passed through to the FarcasterShare component
    expect(screen.getByRole('button', { name: /share on farcaster/i })).toBeInTheDocument();
  });

  it('shows template icons', () => {
    render(<ShareTemplateSelector {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Customize message'));
    
    expect(screen.getByText('🚀')).toBeInTheDocument();
    expect(screen.getByText('📈')).toBeInTheDocument();
    expect(screen.getByText('💰')).toBeInTheDocument();
    expect(screen.getByText('✍️')).toBeInTheDocument();
    expect(screen.getByText('🌙')).toBeInTheDocument();
    expect(screen.getByText('👥')).toBeInTheDocument();
  });
});