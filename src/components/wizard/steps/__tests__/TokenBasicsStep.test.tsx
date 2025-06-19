import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TokenBasicsStep } from '../TokenBasicsStep';

describe('TokenBasicsStep', () => {
  const mockOnChange = jest.fn();
  const defaultProps = {
    data: {},
    onChange: mockOnChange,
    errors: {},
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all required fields', () => {
    render(<TokenBasicsStep {...defaultProps} />);

    expect(screen.getByLabelText('Token Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Token Symbol')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByLabelText('Token Image')).toBeInTheDocument();
  });

  it('displays initial values from data prop', () => {
    const data = {
      name: 'Test Token',
      symbol: 'TEST',
      description: 'A test token description',
      image: '/test-image.png',
    };

    render(<TokenBasicsStep {...defaultProps} data={data} />);

    expect(screen.getByDisplayValue('Test Token')).toBeInTheDocument();
    expect(screen.getByDisplayValue('TEST')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A test token description')).toBeInTheDocument();
  });

  it('calls onChange when name field is updated', () => {
    render(<TokenBasicsStep {...defaultProps} />);

    const nameInput = screen.getByLabelText('Token Name');
    fireEvent.change(nameInput, { target: { value: 'New Token' } });

    expect(mockOnChange).toHaveBeenCalledWith('name', 'New Token');
  });

  it('calls onChange when symbol field is updated', () => {
    render(<TokenBasicsStep {...defaultProps} />);

    const symbolInput = screen.getByLabelText('Token Symbol');
    fireEvent.change(symbolInput, { target: { value: 'NEW' } });

    expect(mockOnChange).toHaveBeenCalledWith('symbol', 'NEW');
  });

  it('calls onChange when description field is updated', () => {
    render(<TokenBasicsStep {...defaultProps} />);

    const descriptionInput = screen.getByLabelText('Description');
    fireEvent.change(descriptionInput, { target: { value: 'New description' } });

    expect(mockOnChange).toHaveBeenCalledWith('description', 'New description');
  });

  it('handles image upload', () => {
    render(<TokenBasicsStep {...defaultProps} />);

    const file = new File(['image content'], 'test.png', { type: 'image/png' });
    const fileInput = screen.getByLabelText('Token Image');
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(mockOnChange).toHaveBeenCalledWith('image', file);
  });

  it('displays validation errors', () => {
    const errors = {
      name: 'Name is required',
      symbol: 'Symbol must be 3-10 characters',
    };

    render(<TokenBasicsStep {...defaultProps} errors={errors} />);

    expect(screen.getByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Symbol must be 3-10 characters')).toBeInTheDocument();
  });

  it('limits symbol input to uppercase letters', () => {
    render(<TokenBasicsStep {...defaultProps} />);

    const symbolInput = screen.getByLabelText('Token Symbol');
    fireEvent.change(symbolInput, { target: { value: 'test123' } });

    expect(mockOnChange).toHaveBeenCalledWith('symbol', 'TEST');
  });

  it('limits description to character count', () => {
    const data = {
      description: 'a'.repeat(280), // Already at max
    };
    
    render(<TokenBasicsStep {...defaultProps} data={data} />);

    // Check that the character count is displayed
    expect(screen.getByText('280/280')).toBeInTheDocument();
    
    // Try to add more characters
    const descriptionInput = screen.getByLabelText('Description');
    fireEvent.change(descriptionInput, { target: { value: 'a'.repeat(281) } });

    // Should not call onChange since it would exceed the limit
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('shows image preview when image is provided', () => {
    const data = {
      image: '/test-image.png',
    };

    render(<TokenBasicsStep {...defaultProps} data={data} />);

    const imagePreview = screen.getByAltText('Token preview');
    expect(imagePreview).toHaveAttribute('src', '/test-image.png');
  });

  it('disables inputs when not active', () => {
    render(<TokenBasicsStep {...defaultProps} isActive={false} />);

    expect(screen.getByLabelText('Token Name')).toBeDisabled();
    expect(screen.getByLabelText('Token Symbol')).toBeDisabled();
    expect(screen.getByLabelText('Description')).toBeDisabled();
    expect(screen.getByLabelText('Token Image')).toBeDisabled();
  });
});