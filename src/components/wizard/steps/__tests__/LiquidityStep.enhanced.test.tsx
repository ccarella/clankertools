import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiquidityStep } from '../LiquidityStep';
import { WizardStepProps } from '../../types';

const mockOnChange = jest.fn();
const mockHaptic = {
  isEnabled: jest.fn(() => true),
  isSupported: jest.fn(() => true),
  enable: jest.fn(),
  disable: jest.fn(),
  toggle: jest.fn(),
  navigationTap: jest.fn().mockResolvedValue(undefined),
  menuItemSelect: jest.fn().mockResolvedValue(undefined),
  buttonPress: jest.fn().mockResolvedValue(undefined),
  toggleStateChange: jest.fn().mockResolvedValue(undefined),
  dropdownOpen: jest.fn().mockResolvedValue(undefined),
  dropdownItemHover: jest.fn().mockResolvedValue(undefined),
  cardSelect: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: () => mockHaptic,
}));

describe('LiquidityStep with Custom Curve', () => {
  const defaultProps: WizardStepProps = {
    data: {},
    onChange: mockOnChange,
    errors: {},
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows custom curve option in liquidity curve selection', () => {
    render(<LiquidityStep {...defaultProps} />);
    
    // Check that all curve options are present in the radio group
    const radioGroup = screen.getByRole('radiogroup');
    expect(radioGroup).toBeInTheDocument();
    
    // Check for specific curve option text within cards
    const curveOptions = ['Linear', 'Exponential', 'Logarithmic', 'Sigmoid', 'Custom'];
    curveOptions.forEach(option => {
      const elements = screen.getAllByText(option);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  it('shows curve designer when custom is selected', () => {
    render(<LiquidityStep {...defaultProps} />);
    
    // Find the custom radio button
    const radioButtons = screen.getAllByRole('radio');
    const customRadio = radioButtons.find(radio => 
      radio.getAttribute('value') === 'custom'
    );
    
    expect(customRadio).toBeInTheDocument();
    fireEvent.click(customRadio!);
    
    expect(mockOnChange).toHaveBeenCalledWith('liquidityCurve', 'custom');
  });

  it('shows curve designer component when liquidityCurve is custom', () => {
    const props = {
      ...defaultProps,
      data: { liquidityCurve: 'custom' },
    };
    
    render(<LiquidityStep {...props} />);
    
    expect(screen.getByText('Liquidity Positions')).toBeInTheDocument();
    expect(screen.getByText('Add Position')).toBeInTheDocument();
  });

  it('saves curve positions when custom curve is configured', () => {
    const props = {
      ...defaultProps,
      data: { 
        liquidityCurve: 'custom',
        curvePositions: [
          { id: 'pos-1', minPrice: 0, maxPrice: 50, allocation: 100 },
        ],
      },
    };
    
    render(<LiquidityStep {...props} />);
    
    const addButton = screen.getByText('Add Position');
    fireEvent.click(addButton);
    
    expect(mockOnChange).toHaveBeenCalledWith('curvePositions', expect.any(Array));
  });

  it('validates curve positions when custom is selected', () => {
    const props = {
      ...defaultProps,
      data: { 
        liquidityCurve: 'custom',
        curvePositions: [
          { id: 'pos-1', minPrice: 0, maxPrice: 50, allocation: 60 },
          { id: 'pos-2', minPrice: 50, maxPrice: 100, allocation: 30 },
        ],
      },
      errors: { curvePositions: 'Total allocation must equal 100%' },
    };
    
    render(<LiquidityStep {...props} />);
    
    // The error appears in the LiquidityCurveDesigner component
    expect(screen.getByText(/Total allocation must equal 100%/)).toBeInTheDocument();
  });

  it('shows preset options in curve designer', () => {
    const props = {
      ...defaultProps,
      data: { liquidityCurve: 'custom' },
    };
    
    render(<LiquidityStep {...props} />);
    
    expect(screen.getByText('Balanced')).toBeInTheDocument();
    expect(screen.getByText('Concentrated')).toBeInTheDocument();
    expect(screen.getByText('Wide Range')).toBeInTheDocument();
  });

  it('maintains other fields when switching to custom curve', () => {
    const props = {
      ...defaultProps,
      data: { 
        liquidityAmount: '1.5',
        liquidityCurve: 'linear',
        maxSlippage: 10,
      },
    };
    
    const { rerender } = render(<LiquidityStep {...props} />);
    
    // Find the custom radio button
    const radioButtons = screen.getAllByRole('radio');
    const customRadio = radioButtons.find(radio => 
      radio.getAttribute('value') === 'custom'
    );
    
    expect(customRadio).toBeInTheDocument();
    fireEvent.click(customRadio!);
    
    expect(mockOnChange).toHaveBeenCalledWith('liquidityCurve', 'custom');
    
    // Rerender with updated curve type
    props.data.liquidityCurve = 'custom';
    rerender(<LiquidityStep {...props} />);
    
    // Other fields should still be present
    expect(screen.getByDisplayValue('1.5')).toBeInTheDocument();
    // Check for the slippage value (it might be in multiple places)
    const slippageElements = screen.getAllByText('10%');
    expect(slippageElements.length).toBeGreaterThan(0);
  });
});