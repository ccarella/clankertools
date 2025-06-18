import { renderHook, act, waitFor } from '@testing-library/react';
import { useWalletBalance } from '../useWalletBalance';

// Mock fetch
global.fetch = jest.fn();

describe('useWalletBalance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });

  it('should return null balance when no address is provided', () => {
    const { result } = renderHook(() => useWalletBalance(null, 8453));

    expect(result.current.balance).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should fetch balance for valid address', async () => {
    const mockBalance = '1234567890000000000'; // 1.23456789 ETH in wei
    const mockResponse = {
      result: mockBalance,
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() => 
      useWalletBalance('0x1234567890123456789012345678901234567890', 8453)
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(parseFloat(result.current.balance!).toFixed(9)).toBe('1.234567890');
      expect(result.current.error).toBeNull();
    });
  });

  it('should handle fetch errors gracefully', async () => {
    const errorMessage = 'Network error';
    
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(errorMessage));

    const { result } = renderHook(() => 
      useWalletBalance('0x1234567890123456789012345678901234567890', 8453)
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.balance).toBeNull();
      expect(result.current.error).toBe(errorMessage);
    });
  });

  it('should refetch balance when address changes', async () => {
    const address1 = '0x1234567890123456789012345678901234567890';
    const address2 = '0x0987654321098765432109876543210987654321';
    const balance1 = '1000000000000000000'; // 1 ETH
    const balance2 = '2000000000000000000'; // 2 ETH

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: balance1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: balance2 }),
      });

    const { result, rerender } = renderHook(
      ({ address }) => useWalletBalance(address, 8453),
      { initialProps: { address: address1 } }
    );

    await waitFor(() => {
      expect(result.current.balance).toBe('1.000000000000000000');
    });

    rerender({ address: address2 });

    await waitFor(() => {
      expect(result.current.balance).toBe('2.000000000000000000');
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should poll balance at regular intervals', async () => {
    jest.useFakeTimers();

    const address = '0x1234567890123456789012345678901234567890';
    const initialBalance = '1000000000000000000'; // 1 ETH
    const updatedBalance = '1500000000000000000'; // 1.5 ETH

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: initialBalance }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: updatedBalance }),
      });

    const { result } = renderHook(() => useWalletBalance(address, 8453));

    await waitFor(() => {
      expect(result.current.balance).toBe('1.000000000000000000');
    });

    // Fast forward 30 seconds (default polling interval)
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    await waitFor(() => {
      expect(result.current.balance).toBe('1.500000000000000000');
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it('should handle zero balance', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: '0x0' }),
    });

    const { result } = renderHook(() => 
      useWalletBalance('0x1234567890123456789012345678901234567890', 8453)
    );

    await waitFor(() => {
      expect(result.current.balance).toBe('0.000000000000000000');
    });
  });

  it('should cleanup interval on unmount', () => {
    jest.useFakeTimers();
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ result: '1000000000000000000' }),
    });

    const { unmount } = renderHook(() => 
      useWalletBalance('0x1234567890123456789012345678901234567890', 8453)
    );

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();

    jest.useRealTimers();
    clearIntervalSpy.mockRestore();
  });
});