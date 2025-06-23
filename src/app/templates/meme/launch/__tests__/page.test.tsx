import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MemeQuickLaunch from '../page'
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider'
import { useRouter } from 'next/navigation'

jest.mock('next/navigation')
jest.mock('@/components/providers/FarcasterAuthProvider', () => ({
  useFarcasterAuth: jest.fn()
}))
jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: () => ({
    isEnabled: () => false,
    isSupported: () => false,
    enable: jest.fn(),
    disable: jest.fn(),
    toggle: jest.fn(),
    navigationTap: jest.fn(),
    menuItemSelect: jest.fn(),
    buttonPress: jest.fn(),
    toggleStateChange: jest.fn(),
    dropdownOpen: jest.fn(),
    dropdownItemHover: jest.fn(),
    cardSelect: jest.fn()
  })
}))
jest.mock('@hookform/resolvers/zod', () => ({
  zodResolver: () => jest.fn()
}))

const mockPush = jest.fn()
const mockUser = {
  fid: '12345',
  username: 'testuser',
  displayName: 'Test User',
  pfpUrl: 'https://example.com/pfp.jpg'
}

global.fetch = jest.fn()

describe('MemeQuickLaunch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
    ;(useFarcasterAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      user: mockUser
    })
  })

  it('renders the quick launch form', () => {
    render(<MemeQuickLaunch />)
    
    expect(screen.getByText(/🚀 Quick Meme Launch/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Token Name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Token Symbol/i)).toBeInTheDocument()
    expect(screen.getByText(/Upload Meme/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Launch Now!/i })).toBeInTheDocument()
  })

  it('shows preset suggestions', () => {
    render(<MemeQuickLaunch />)
    
    expect(screen.getByText(/Quick Suggestions/i)).toBeInTheDocument()
    expect(screen.getByText(/DOGE/i)).toBeInTheDocument()
    expect(screen.getByText(/PEPE/i)).toBeInTheDocument()
    expect(screen.getByText(/SHIB/i)).toBeInTheDocument()
    expect(screen.getByText(/WOJAK/i)).toBeInTheDocument()
  })

  it('fills form with preset when clicked', () => {
    render(<MemeQuickLaunch />)
    
    const pepeButton = screen.getByText(/PEPE/)
    fireEvent.click(pepeButton)
    
    const nameInput = screen.getByLabelText(/Token Name/i) as HTMLInputElement
    const symbolInput = screen.getByLabelText(/Token Symbol/i) as HTMLInputElement
    
    expect(nameInput.value).toBe('Pepe')
    expect(symbolInput.value).toBe('PEPE')
  })

  it('validates form before submission', async () => {
    render(<MemeQuickLaunch />)
    
    const launchButton = screen.getByRole('button', { name: /Launch Now!/i })
    fireEvent.click(launchButton)
    
    await waitFor(() => {
      expect(screen.getByText(/Name is required/i)).toBeInTheDocument()
      expect(screen.getByText(/Symbol is required/i)).toBeInTheDocument()
    })
  })

  it('handles image upload', async () => {
    render(<MemeQuickLaunch />)
    
    const file = new File(['meme'], 'meme.png', { type: 'image/png' })
    const uploadButton = screen.getByText(/Upload Meme/i).closest('button')
    const input = uploadButton?.querySelector('input[type="file"]') as HTMLInputElement
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    })
    
    fireEvent.change(input)
    
    await waitFor(() => {
      expect(screen.getByText(/meme.png/i)).toBeInTheDocument()
    })
  })

  it('launches token successfully', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        tokenAddress: '0x123',
        transactionHash: '0xabc'
      })
    })
    
    render(<MemeQuickLaunch />)
    
    const nameInput = screen.getByLabelText(/Token Name/i)
    const symbolInput = screen.getByLabelText(/Token Symbol/i)
    
    fireEvent.change(nameInput, { target: { value: 'Doge Coin' } })
    fireEvent.change(symbolInput, { target: { value: 'DOGE' } })
    
    const file = new File(['meme'], 'meme.png', { type: 'image/png' })
    const uploadButton = screen.getByText(/Upload Meme/i).closest('button')
    const input = uploadButton?.querySelector('input[type="file"]') as HTMLInputElement
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    })
    
    fireEvent.change(input)
    
    const launchButton = screen.getByRole('button', { name: /Launch Now!/i })
    fireEvent.click(launchButton)
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/deploy/meme', expect.objectContaining({
        method: 'POST'
      }))
    })
    
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/token/0x123')
    })
  })

  it('shows countdown timer', () => {
    render(<MemeQuickLaunch />)
    
    expect(screen.getByText(/Time to Launch:/i)).toBeInTheDocument()
    expect(screen.getByText(/60s/i)).toBeInTheDocument()
  })

  it('displays motivational messages', () => {
    render(<MemeQuickLaunch />)
    
    expect(screen.getByText(/🚀 Ready to moon/i)).toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Failed to deploy token'
      })
    })
    
    render(<MemeQuickLaunch />)
    
    const nameInput = screen.getByLabelText(/Token Name/i)
    const symbolInput = screen.getByLabelText(/Token Symbol/i)
    
    fireEvent.change(nameInput, { target: { value: 'Test Token' } })
    fireEvent.change(symbolInput, { target: { value: 'TEST' } })
    
    const launchButton = screen.getByRole('button', { name: /Launch Now!/i })
    fireEvent.click(launchButton)
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to deploy token/i)).toBeInTheDocument()
    })
  })
})