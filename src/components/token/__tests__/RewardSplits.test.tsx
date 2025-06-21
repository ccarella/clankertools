import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RewardSplits } from '../RewardSplits';
import type { RewardRecipient, RewardSplitsProps } from '../RewardSplits';

// Mock validation functions
jest.mock('../../../lib/validation', () => ({
  isValidAddress: jest.fn((address: string) => {
    return address.match(/^0x[a-fA-F0-9]{40}$/) !== null || address.endsWith('.eth');
  }),
  validateENS: jest.fn((name: string) => {
    return Promise.resolve(name.endsWith('.eth') ? '0x742d35Cc6634C0532925a3b8A7b1234567890123' : null);
  }),
  validatePercentage: jest.fn((percentage: number, min = 0, max = 100) => {
    if (isNaN(percentage)) {
      return { isValid: false, error: 'Percentage must be a valid number' };
    }
    if (percentage < min) {
      return { isValid: false, error: `Percentage must be at least ${min}%` };
    }
    if (percentage > max) {
      return { isValid: false, error: `Percentage cannot exceed ${max}%` };
    }
    return { isValid: true };
  }),
  validateTotalPercentage: jest.fn((percentages: number[], platformFee = 20) => {
    const total = percentages.reduce((sum, p) => sum + (p || 0), 0) + platformFee;
    const remaining = 100 - total;
    
    if (total > 100) {
      return {
        isValid: false,
        total,
        remaining,
        error: 'Total percentage cannot exceed 100%',
      };
    }
    
    return {
      isValid: true,
      total,
      remaining,
    };
  }),
}));

const defaultProps: RewardSplitsProps = {
  recipients: [],
  onChange: jest.fn(),
  maxRecipients: 6,
  platformFeePercentage: 20,
  disabled: false,
};

const mockRecipients: RewardRecipient[] = [
  {
    id: '1',
    address: '0x742d35Cc6634C0532925a3b8A7b1234567890123',
    percentage: 40,
    label: 'Creator',
  },
  {
    id: '2',
    address: '0x8ba1f109551bD432803012645Hac136c22416457',
    percentage: 40,
    label: 'Team Member',
  },
];

describe('RewardSplits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with platform fee section', () => {
      render(<RewardSplits {...defaultProps} />);
      
      expect(screen.getByText('Reward Distribution')).toBeInTheDocument();
      expect(screen.getByText('Platform Fee')).toBeInTheDocument();
      expect(screen.getAllByText('20%')).toHaveLength(2); // Platform fee and total sections
    });

    it('renders add recipient button when under max', () => {
      render(<RewardSplits {...defaultProps} />);
      
      expect(screen.getByRole('button', { name: /add recipient/i })).toBeInTheDocument();
    });

    it('disables add button when at max recipients', () => {
      const recipients = Array.from({ length: 6 }, (_, i) => ({
        id: `${i + 1}`,
        address: `0x742d35Cc6634C0532925a3b8A7b1234567890${i.toString().padStart(3, '0')}`,
        percentage: 10,
        label: `Recipient ${i + 1}`,
      }));

      render(<RewardSplits {...defaultProps} recipients={recipients} />);
      
      expect(screen.getByRole('button', { name: /add recipient/i })).toBeDisabled();
    });
  });

  describe('Recipient Management', () => {
    it('adds new recipient when button clicked', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<RewardSplits {...defaultProps} onChange={onChange} />);
      
      await user.click(screen.getByRole('button', { name: /add recipient/i }));
      
      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({
          id: expect.any(String),
          address: '',
          percentage: 0,
          label: '',
        }),
      ]);
    });

    it('removes recipient when remove button clicked', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<RewardSplits {...defaultProps} recipients={mockRecipients} onChange={onChange} />);
      
      const removeButtons = screen.getAllByRole('button', { name: /remove/i });
      await user.click(removeButtons[0]);
      
      expect(onChange).toHaveBeenCalledWith([mockRecipients[1]]);
    });

    it('calls onChange when recipient address is updated', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<RewardSplits {...defaultProps} recipients={mockRecipients} onChange={onChange} />);
      
      const addressInputs = screen.getAllByDisplayValue(mockRecipients[0].address);
      await user.type(addressInputs[0], '1');
      
      expect(onChange).toHaveBeenCalled();
    });

    it('calls onChange when recipient percentage is updated', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<RewardSplits {...defaultProps} recipients={mockRecipients} onChange={onChange} />);
      
      const percentageInputs = screen.getAllByDisplayValue('40');
      await user.type(percentageInputs[0], '5');
      
      expect(onChange).toHaveBeenCalled();
    });

    it('calls onChange when recipient label is updated', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<RewardSplits {...defaultProps} recipients={mockRecipients} onChange={onChange} />);
      
      const labelInputs = screen.getAllByDisplayValue('Creator');
      await user.type(labelInputs[0], 'X');
      
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('Address Validation', () => {
    it('shows error for invalid address format', async () => {
      const user = userEvent.setup();
      
      // Update mock to return false for invalid address
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isValidAddress } = require('../../../lib/validation');
      isValidAddress.mockReturnValueOnce(false);
      
      render(<RewardSplits {...defaultProps} recipients={mockRecipients} />);
      
      const addressInputs = screen.getAllByDisplayValue(mockRecipients[0].address);
      await user.clear(addressInputs[0]);
      await user.type(addressInputs[0], 'invalid-address');
      await user.tab();
      
      await waitFor(() => {
        expect(screen.getByText(/invalid address format/i)).toBeInTheDocument();
      });
    });

    it('accepts valid Ethereum address', async () => {
      const user = userEvent.setup();
      
      render(<RewardSplits {...defaultProps} recipients={mockRecipients} />);
      
      const addressInputs = screen.getAllByDisplayValue(mockRecipients[0].address);
      await user.clear(addressInputs[0]);
      await user.type(addressInputs[0], '0x742d35Cc6634C0532925a3b8A7b1234567890123');
      await user.tab();
      
      await waitFor(() => {
        expect(screen.queryByText(/invalid address format/i)).not.toBeInTheDocument();
      });
    });

    it('accepts ENS names', async () => {
      const user = userEvent.setup();
      
      render(<RewardSplits {...defaultProps} recipients={mockRecipients} />);
      
      const addressInputs = screen.getAllByDisplayValue(mockRecipients[0].address);
      await user.clear(addressInputs[0]);
      await user.type(addressInputs[0], 'vitalik.eth');
      await user.tab();
      
      await waitFor(() => {
        expect(screen.queryByText(/invalid address format/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Percentage Validation', () => {
    it('shows error when total exceeds 100%', () => {
      const invalidRecipients = [
        { ...mockRecipients[0], percentage: 60 },
        { ...mockRecipients[1], percentage: 60 }, // 60 + 60 + 20 (platform) = 140%
      ];

      render(<RewardSplits {...defaultProps} recipients={invalidRecipients} />);
      
      expect(screen.getByText(/total percentage cannot exceed 100%/i)).toBeInTheDocument();
    });

    it('shows success when total equals 100%', () => {
      const validRecipients = [
        { ...mockRecipients[0], percentage: 40 },
        { ...mockRecipients[1], percentage: 40 }, // 40 + 40 + 20 (platform) = 100%
      ];

      render(<RewardSplits {...defaultProps} recipients={validRecipients} />);
      
      expect(screen.getByText(/100%/)).toBeInTheDocument();
      expect(screen.queryByText(/total percentage cannot exceed 100%/i)).not.toBeInTheDocument();
    });

    it('shows available percentage remaining', () => {
      const partialRecipients = [
        { ...mockRecipients[0], percentage: 30 },
      ]; // 30 + 20 (platform) = 50%, so 50% remaining

      render(<RewardSplits {...defaultProps} recipients={partialRecipients} />);
      
      expect(screen.getByText(/50% available/i)).toBeInTheDocument();
    });

    it('prevents negative percentages', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      
      render(<RewardSplits {...defaultProps} recipients={mockRecipients} onChange={onChange} />);
      
      const percentageInputs = screen.getAllByLabelText(/percentage/i);
      await user.clear(percentageInputs[0]);
      await user.type(percentageInputs[0], '-10');
      
      // Should not allow negative values
      expect(onChange).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ percentage: -10 })
        ])
      );
    });
  });

  describe('Visual Split Representation', () => {
    it('renders split visualization bars', () => {
      const recipients = [
        { ...mockRecipients[0], percentage: 50 },
        { ...mockRecipients[1], percentage: 30 },
      ];

      render(<RewardSplits {...defaultProps} recipients={recipients} />);
      
      // Check for visualization elements
      expect(screen.getByTestId('split-visualization')).toBeInTheDocument();
    });

    it('shows correct percentages in visualization', () => {
      const recipients = [
        { ...mockRecipients[0], percentage: 60, label: 'Creator' },
        { ...mockRecipients[1], percentage: 20, label: 'Team' },
      ];

      render(<RewardSplits {...defaultProps} recipients={recipients} />);
      
      expect(screen.getByText('Creator: 60%')).toBeInTheDocument();
      expect(screen.getByText('Team: 20%')).toBeInTheDocument();
      expect(screen.getByText('Platform: 20%')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<RewardSplits {...defaultProps} recipients={mockRecipients} />);
      
      expect(screen.getAllByLabelText(/address/i)).toHaveLength(2);
      expect(screen.getAllByLabelText(/percentage/i)).toHaveLength(2);
      expect(screen.getAllByLabelText(/label/i)).toHaveLength(2);
    });

    it('announces errors to screen readers', async () => {
      const invalidRecipients = [
        { ...mockRecipients[0], percentage: 90 },
        { ...mockRecipients[1], percentage: 90 },
      ];

      render(<RewardSplits {...defaultProps} recipients={invalidRecipients} />);
      
      const errorElement = screen.getByText(/total percentage cannot exceed 100%/i);
      expect(errorElement).toHaveAttribute('role', 'alert');
    });
  });

  describe('Mobile Responsiveness', () => {
    it('renders properly on mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<RewardSplits {...defaultProps} recipients={mockRecipients} />);
      
      // Component should render without errors on mobile
      expect(screen.getByText('Reward Distribution')).toBeInTheDocument();
    });
  });

  describe('Integration with existing fee system', () => {
    it('properly integrates with platform fee of 20%', () => {
      render(<RewardSplits {...defaultProps} platformFeePercentage={20} />);
      
      expect(screen.getByText('Platform Fee')).toBeInTheDocument();
      expect(screen.getAllByText('20%')).toHaveLength(2); // Platform fee section and total
    });

    it('adapts to different platform fee percentages', () => {
      render(<RewardSplits {...defaultProps} platformFeePercentage={15} />);
      
      expect(screen.getAllByText('15%')).toHaveLength(2); // Platform fee section and visualization
    });
  });
});