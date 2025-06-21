import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LiquidityCurveDesigner } from '../LiquidityCurveDesigner';
import { useHaptic } from '@/providers/HapticProvider';

jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: jest.fn().mockReturnValue({
    buttonPress: jest.fn(),
    toggleStateChange: jest.fn(),
    cardSelect: jest.fn(),
    sliderChange: jest.fn(),
  }),
}));

describe('LiquidityCurveDesigner', () => {
  const mockOnChange = jest.fn();
  const defaultProps = {
    value: [],
    onChange: mockOnChange,
    maxPositions: 7,
    disabled: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with initial empty state', () => {
    render(<LiquidityCurveDesigner {...defaultProps} />);
    
    expect(screen.getByText(/add position/i)).toBeInTheDocument();
    expect(screen.getByText(/0 of 7 positions/i)).toBeInTheDocument();
    expect(screen.getByText(/tap to add your first liquidity position/i)).toBeInTheDocument();
  });

  it('renders existing positions', () => {
    const positions = [
      { id: '1', rangeStart: 0, rangeEnd: 25, allocation: 50 },
      { id: '2', rangeStart: 25, rangeEnd: 50, allocation: 50 },
    ];

    render(<LiquidityCurveDesigner {...defaultProps} value={positions} />);
    
    expect(screen.getByText(/2 of 7 positions/i)).toBeInTheDocument();
    expect(screen.getByText(/position 1/i)).toBeInTheDocument();
    expect(screen.getByText(/position 2/i)).toBeInTheDocument();
  });

  it('adds a new position when add button is clicked', async () => {
    render(<LiquidityCurveDesigner {...defaultProps} />);
    
    const addButton = screen.getByText(/add position/i);
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith([
        expect.objectContaining({
          id: expect.any(String),
          rangeStart: 0,
          rangeEnd: 100,
          allocation: 100,
        }),
      ]);
    });

    const haptic = useHaptic();
    expect(haptic.buttonPress).toHaveBeenCalledWith('primary');
  });

  it('prevents adding positions when max is reached', () => {
    const maxPositions = [
      { id: '1', rangeStart: 0, rangeEnd: 15, allocation: 15 },
      { id: '2', rangeStart: 15, rangeEnd: 30, allocation: 15 },
      { id: '3', rangeStart: 30, rangeEnd: 45, allocation: 15 },
      { id: '4', rangeStart: 45, rangeEnd: 60, allocation: 15 },
      { id: '5', rangeStart: 60, rangeEnd: 75, allocation: 15 },
      { id: '6', rangeStart: 75, rangeEnd: 90, allocation: 15 },
      { id: '7', rangeStart: 90, rangeEnd: 100, allocation: 10 },
    ];

    render(<LiquidityCurveDesigner {...defaultProps} value={maxPositions} />);
    
    const addButton = screen.getByRole('button', { name: /add position/i });
    expect(addButton).toBeDisabled();
    expect(screen.getByText(/maximum positions reached/i)).toBeInTheDocument();
  });

  it('removes a position when delete is clicked', async () => {
    const positions = [
      { id: '1', rangeStart: 0, rangeEnd: 50, allocation: 60 },
      { id: '2', rangeStart: 50, rangeEnd: 100, allocation: 40 },
    ];

    render(<LiquidityCurveDesigner {...defaultProps} value={positions} />);
    
    const deleteButtons = screen.getAllByLabelText(/remove position/i);
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith([
        { id: '2', rangeStart: 50, rangeEnd: 100, allocation: 40 },
      ]);
    });
  });

  it('updates position when slider values change', async () => {
    const positions = [
      { id: '1', rangeStart: 0, rangeEnd: 100, allocation: 100 },
    ];

    render(<LiquidityCurveDesigner {...defaultProps} value={positions} />);
    
    const rangeSlider = screen.getByLabelText(/price range/i);
    
    fireEvent.change(rangeSlider, { target: { value: '25,75' } });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith([
        { id: '1', rangeStart: 25, rangeEnd: 75, allocation: 100 },
      ]);
    });
  });

  it('validates total allocation equals 100%', () => {
    const invalidPositions = [
      { id: '1', rangeStart: 0, rangeEnd: 50, allocation: 60 },
      { id: '2', rangeStart: 50, rangeEnd: 100, allocation: 30 }, // Total: 90%
    ];

    render(<LiquidityCurveDesigner {...defaultProps} value={invalidPositions} />);
    
    expect(screen.getByText(/allocation must total 100%/i)).toBeInTheDocument();
    expect(screen.getByText(/currently: 90%/i)).toBeInTheDocument();
  });

  it('shows warning for overlapping ranges', () => {
    const overlappingPositions = [
      { id: '1', rangeStart: 0, rangeEnd: 60, allocation: 50 },
      { id: '2', rangeStart: 40, rangeEnd: 100, allocation: 50 },
    ];

    render(<LiquidityCurveDesigner {...defaultProps} value={overlappingPositions} />);
    
    expect(screen.getByText(/positions have overlapping ranges/i)).toBeInTheDocument();
  });

  it('applies preset template when selected', async () => {
    render(<LiquidityCurveDesigner {...defaultProps} />);
    
    const presetButton = screen.getByText(/conservative/i);
    fireEvent.click(presetButton);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            allocation: expect.any(Number),
            rangeStart: expect.any(Number),
            rangeEnd: expect.any(Number),
          }),
        ])
      );
    });
  });

  it('displays curve visualization', () => {
    const positions = [
      { id: '1', rangeStart: 0, rangeEnd: 50, allocation: 60 },
      { id: '2', rangeStart: 50, rangeEnd: 100, allocation: 40 },
    ];

    render(<LiquidityCurveDesigner {...defaultProps} value={positions} />);
    
    expect(screen.getByLabelText(/liquidity distribution curve/i)).toBeInTheDocument();
  });

  it('shows price impact preview', () => {
    const positions = [
      { id: '1', rangeStart: 0, rangeEnd: 100, allocation: 100 },
    ];

    render(<LiquidityCurveDesigner {...defaultProps} value={positions} />);
    
    expect(screen.getByText(/estimated price impact/i)).toBeInTheDocument();
  });

  it('disables all controls when disabled prop is true', () => {
    const positions = [
      { id: '1', rangeStart: 0, rangeEnd: 100, allocation: 100 },
    ];

    render(<LiquidityCurveDesigner {...defaultProps} value={positions} disabled={true} />);
    
    const addButton = screen.getByRole('button', { name: /add position/i });
    expect(addButton).toBeDisabled();
    
    const deleteButtons = screen.getAllByLabelText(/remove position/i);
    deleteButtons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('handles mobile touch interactions', async () => {
    const positions = [
      { id: '1', rangeStart: 0, rangeEnd: 100, allocation: 100 },
    ];

    render(<LiquidityCurveDesigner {...defaultProps} value={positions} />);
    
    const positionCard = screen.getByText(/position 1/i).closest('div');
    
    fireEvent.touchStart(positionCard!);
    fireEvent.touchEnd(positionCard!);

    const haptic = useHaptic();
    expect(haptic.cardSelect).toHaveBeenCalled();
  });

  it('shows educational tooltips', async () => {
    render(<LiquidityCurveDesigner {...defaultProps} />);
    
    const infoIcon = screen.getByLabelText(/learn about liquidity curves/i);
    fireEvent.mouseEnter(infoIcon);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  it('warns about unusual curve configurations', () => {
    const unusualPositions = [
      { id: '1', rangeStart: 0, rangeEnd: 5, allocation: 90 }, // Very narrow range with high allocation
      { id: '2', rangeStart: 95, rangeEnd: 100, allocation: 10 },
    ];

    render(<LiquidityCurveDesigner {...defaultProps} value={unusualPositions} />);
    
    expect(screen.getByText(/unusual liquidity distribution detected/i)).toBeInTheDocument();
  });

  it('updates allocation automatically when positions change', async () => {
    const positions = [
      { id: '1', rangeStart: 0, rangeEnd: 50, allocation: 100 },
    ];

    render(<LiquidityCurveDesigner {...defaultProps} value={positions} />);
    
    const addButton = screen.getByText(/add position/i);
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith([
        { id: '1', rangeStart: 0, rangeEnd: 50, allocation: 50 },
        expect.objectContaining({
          id: expect.any(String),
          rangeStart: 50,
          rangeEnd: 100,
          allocation: 50,
        }),
      ]);
    });
  });
});