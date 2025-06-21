import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LiquidityPosition } from '../LiquidityPosition';
import { useHaptic } from '@/providers/HapticProvider';

jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: jest.fn().mockReturnValue({
    sliderChange: jest.fn(),
    buttonPress: jest.fn(),
    cardSelect: jest.fn(),
  }),
}));

jest.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange, min, max, step, disabled, className, 'aria-label': ariaLabel }: any) => (
    <input
      type="range"
      value={value?.[0] || 0}
      onChange={(e) => onValueChange?.([parseInt(e.target.value)])}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
      data-testid="slider"
    />
  ),
}));

describe('LiquidityPosition', () => {
  const mockOnChange = jest.fn();
  const mockOnRemove = jest.fn();
  
  const defaultProps = {
    position: {
      id: '1',
      rangeStart: 25,
      rangeEnd: 75,
      allocation: 50,
    },
    index: 0,
    totalPositions: 2,
    onChange: mockOnChange,
    onRemove: mockOnRemove,
    disabled: false,
    canRemove: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders position details correctly', () => {
    render(<LiquidityPosition {...defaultProps} />);
    
    expect(screen.getByText(/position 1/i)).toBeInTheDocument();
    expect(screen.getByText(/25% - 75%/i)).toBeInTheDocument();
    expect(screen.getByText(/50% allocation/i)).toBeInTheDocument();
  });

  it('handles range slider changes', async () => {
    render(<LiquidityPosition {...defaultProps} />);
    
    const rangeSlider = screen.getByLabelText(/price range for position 1/i);
    fireEvent.change(rangeSlider, { target: { value: '30,80' } });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({
        ...defaultProps.position,
        rangeStart: 30,
        rangeEnd: 80,
      });
    });

    const haptic = useHaptic();
    expect(haptic.sliderChange).toHaveBeenCalled();
  });

  it('handles allocation slider changes', async () => {
    render(<LiquidityPosition {...defaultProps} />);
    
    const allocationSlider = screen.getByLabelText(/allocation percentage/i);
    fireEvent.change(allocationSlider, { target: { value: '60' } });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith({
        ...defaultProps.position,
        allocation: 60,
      });
    });
  });

  it('prevents invalid range selections', () => {
    render(<LiquidityPosition {...defaultProps} />);
    
    const rangeSlider = screen.getByLabelText(/price range for position 1/i);
    
    // Try to set end before start
    fireEvent.change(rangeSlider, { target: { value: '75,25' } });

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('shows remove button when canRemove is true', () => {
    render(<LiquidityPosition {...defaultProps} />);
    
    const removeButton = screen.getByLabelText(/remove position 1/i);
    expect(removeButton).toBeInTheDocument();
    expect(removeButton).not.toBeDisabled();
  });

  it('hides remove button when canRemove is false', () => {
    render(<LiquidityPosition {...defaultProps} canRemove={false} />);
    
    expect(screen.queryByLabelText(/remove position/i)).not.toBeInTheDocument();
  });

  it('handles remove button click', async () => {
    render(<LiquidityPosition {...defaultProps} />);
    
    const removeButton = screen.getByLabelText(/remove position 1/i);
    fireEvent.click(removeButton);

    expect(mockOnRemove).toHaveBeenCalled();
    
    const haptic = useHaptic();
    expect(haptic.buttonPress).toHaveBeenCalledWith('destructive');
  });

  it('disables all controls when disabled prop is true', () => {
    render(<LiquidityPosition {...defaultProps} disabled={true} />);
    
    const rangeSlider = screen.getByLabelText(/price range/i);
    const allocationSlider = screen.getByLabelText(/allocation percentage/i);
    const removeButton = screen.getByLabelText(/remove position/i);
    
    expect(rangeSlider).toBeDisabled();
    expect(allocationSlider).toBeDisabled();
    expect(removeButton).toBeDisabled();
  });

  it('displays position color indicator', () => {
    render(<LiquidityPosition {...defaultProps} />);
    
    const colorIndicator = screen.getByTestId('position-color-indicator');
    expect(colorIndicator).toBeInTheDocument();
  });

  it('shows range preview visualization', () => {
    render(<LiquidityPosition {...defaultProps} />);
    
    const rangePreview = screen.getByLabelText(/range preview/i);
    expect(rangePreview).toBeInTheDocument();
  });

  it('handles touch interactions on mobile', async () => {
    render(<LiquidityPosition {...defaultProps} />);
    
    const positionCard = screen.getByText(/position 1/i).closest('div');
    
    fireEvent.touchStart(positionCard!);
    fireEvent.touchEnd(positionCard!);

    const haptic = useHaptic();
    expect(haptic.cardSelect).toHaveBeenCalled();
  });

  it('validates allocation input', () => {
    render(<LiquidityPosition {...defaultProps} />);
    
    const allocationSlider = screen.getByLabelText(/allocation percentage/i);
    
    // Try to set allocation > 100
    fireEvent.change(allocationSlider, { target: { value: '150' } });
    
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('shows warning for very narrow ranges', () => {
    const narrowPosition = {
      ...defaultProps.position,
      rangeStart: 49,
      rangeEnd: 51,
    };

    render(<LiquidityPosition {...defaultProps} position={narrowPosition} />);
    
    expect(screen.getByText(/very narrow range/i)).toBeInTheDocument();
  });

  it('shows warning for very wide ranges', () => {
    const widePosition = {
      ...defaultProps.position,
      rangeStart: 0,
      rangeEnd: 100,
    };

    render(<LiquidityPosition {...defaultProps} position={widePosition} />);
    
    expect(screen.getByText(/full range position/i)).toBeInTheDocument();
  });

  it('updates visual indicators on hover', async () => {
    render(<LiquidityPosition {...defaultProps} />);
    
    const positionCard = screen.getByTestId('position-card');
    
    fireEvent.mouseEnter(positionCard);
    
    await waitFor(() => {
      expect(positionCard).toHaveClass('hover:shadow-lg');
    });
  });

  it('shows allocation in both percentage and decimal', () => {
    render(<LiquidityPosition {...defaultProps} />);
    
    expect(screen.getByText(/50%/)).toBeInTheDocument();
    expect(screen.getByText(/0.50/)).toBeInTheDocument();
  });

  it('displays position number correctly', () => {
    render(<LiquidityPosition {...defaultProps} index={2} />);
    
    expect(screen.getByText(/position 3/i)).toBeInTheDocument();
  });

  it('handles edge case allocations', () => {
    const edgeCasePosition = {
      ...defaultProps.position,
      allocation: 0.5, // Very small allocation
    };

    render(<LiquidityPosition {...defaultProps} position={edgeCasePosition} />);
    
    expect(screen.getByText(/0.5%/)).toBeInTheDocument();
    expect(screen.getByText(/low allocation warning/i)).toBeInTheDocument();
  });
});