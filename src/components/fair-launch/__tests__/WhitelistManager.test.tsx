import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WhitelistManager } from '../WhitelistManager';

describe('WhitelistManager', () => {
  const mockOnWhitelistChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render whitelist manager with input field', () => {
    render(<WhitelistManager onWhitelistChange={mockOnWhitelistChange} />);
    
    expect(screen.getByPlaceholderText(/Add Farcaster username or FID/)).toBeInTheDocument();
    expect(screen.getByText(/Add/)).toBeInTheDocument();
  });

  it('should add user to whitelist on button click', async () => {
    render(<WhitelistManager onWhitelistChange={mockOnWhitelistChange} />);
    
    const input = screen.getByPlaceholderText(/Add Farcaster username or FID/);
    const addButton = screen.getByText(/Add/);
    
    fireEvent.change(input, { target: { value: 'testuser' } });
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(screen.getByText(/testuser/)).toBeInTheDocument();
    });
  });

  it('should add user on Enter key press', async () => {
    render(<WhitelistManager onWhitelistChange={mockOnWhitelistChange} />);
    
    const input = screen.getByPlaceholderText(/Add Farcaster username or FID/);
    
    fireEvent.change(input, { target: { value: 'testuser' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 13, charCode: 13 });
    
    await waitFor(() => {
      expect(screen.getByText(/testuser/)).toBeInTheDocument();
    });
  });

  it('should remove user from whitelist', async () => {
    render(<WhitelistManager onWhitelistChange={mockOnWhitelistChange} />);
    
    const input = screen.getByPlaceholderText(/Add Farcaster username or FID/);
    const addButton = screen.getByText(/Add/);
    
    fireEvent.change(input, { target: { value: 'testuser' } });
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(screen.getByText(/testuser/)).toBeInTheDocument();
    });
    
    const removeButton = screen.getByLabelText(/Remove testuser/);
    fireEvent.click(removeButton);
    
    await waitFor(() => {
      expect(screen.queryByText(/testuser/)).not.toBeInTheDocument();
    });
  });

  it('should not add duplicate users', async () => {
    render(<WhitelistManager onWhitelistChange={mockOnWhitelistChange} />);
    
    const input = screen.getByPlaceholderText(/Add Farcaster username or FID/);
    const addButton = screen.getByText(/Add/);
    
    fireEvent.change(input, { target: { value: 'testuser' } });
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(screen.getByText(/testuser/)).toBeInTheDocument();
    });
    
    fireEvent.change(input, { target: { value: 'testuser' } });
    fireEvent.click(addButton);
    
    const userElements = screen.getAllByText(/testuser/);
    expect(userElements).toHaveLength(1);
  });

  it('should clear input after adding user', async () => {
    render(<WhitelistManager onWhitelistChange={mockOnWhitelistChange} />);
    
    const input = screen.getByPlaceholderText(/Add Farcaster username or FID/) as HTMLInputElement;
    const addButton = screen.getByText(/Add/);
    
    fireEvent.change(input, { target: { value: 'testuser' } });
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('should call onWhitelistChange with updated list', async () => {
    render(<WhitelistManager onWhitelistChange={mockOnWhitelistChange} />);
    
    const input = screen.getByPlaceholderText(/Add Farcaster username or FID/);
    const addButton = screen.getByText(/Add/);
    
    fireEvent.change(input, { target: { value: 'testuser' } });
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(mockOnWhitelistChange).toHaveBeenCalledWith(['testuser']);
    });
  });

  it('should handle bulk import from CSV', async () => {
    render(<WhitelistManager onWhitelistChange={mockOnWhitelistChange} />);
    
    const bulkImportButton = screen.getByText(/Bulk Import/);
    fireEvent.click(bulkImportButton);
    
    const textarea = screen.getByPlaceholderText(/Paste usernames or FIDs/);
    fireEvent.change(textarea, { target: { value: 'user1\nuser2\nuser3' } });
    
    const importButton = screen.getAllByText(/Import/)[1]; // Get the second Import button (inside dialog)
    fireEvent.click(importButton);
    
    await waitFor(() => {
      expect(screen.getByText(/user1/)).toBeInTheDocument();
      expect(screen.getByText(/user2/)).toBeInTheDocument();
      expect(screen.getByText(/user3/)).toBeInTheDocument();
    });
  });

  it('should display count of whitelisted users', async () => {
    render(<WhitelistManager onWhitelistChange={mockOnWhitelistChange} />);
    
    expect(screen.getByText(/0 users whitelisted/)).toBeInTheDocument();
    
    const input = screen.getByPlaceholderText(/Add Farcaster username or FID/);
    const addButton = screen.getByText(/Add/);
    
    fireEvent.change(input, { target: { value: 'testuser' } });
    fireEvent.click(addButton);
    
    await waitFor(() => {
      expect(screen.getByText(/1 user whitelisted/)).toBeInTheDocument();
    });
  });

  it('should not add empty usernames', () => {
    render(<WhitelistManager onWhitelistChange={mockOnWhitelistChange} />);
    
    const addButton = screen.getByText(/Add/);
    fireEvent.click(addButton);
    
    expect(mockOnWhitelistChange).not.toHaveBeenCalled();
  });
});