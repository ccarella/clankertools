import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemeTemplate } from '../MemeTemplate'
import { useRouter } from 'next/navigation'
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider'

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

const mockPush = jest.fn()
const mockUser = {
  fid: '12345',
  username: 'testuser',
  displayName: 'Test User',
  pfpUrl: 'https://example.com/pfp.jpg'
}

describe('MemeTemplate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({ push: mockPush })
    ;(useFarcasterAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      user: mockUser
    })
  })

  it('renders the meme template with all key elements', () => {
    render(<MemeTemplate />)
    
    expect(screen.getByText(/Memecoin Degen/i)).toBeInTheDocument()
    expect(screen.getByText(/🚀 Launch in 60 seconds/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Quick Launch/i })).toBeInTheDocument()
    expect(screen.getByText(/Viral Metrics/i)).toBeInTheDocument()
  })

  it('displays viral metrics section', () => {
    render(<MemeTemplate />)
    
    expect(screen.getByText(/🔥 Holder Count/i)).toBeInTheDocument()
    expect(screen.getByText(/📈 Volume/i)).toBeInTheDocument()
    expect(screen.getByText(/💎 Diamond Hands/i)).toBeInTheDocument()
    expect(screen.getByText(/🐋 Whale Watch/i)).toBeInTheDocument()
  })

  it('shows meme generation options', () => {
    render(<MemeTemplate />)
    
    expect(screen.getByText(/Auto-Generated Memes/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Generate Meme/i })).toBeInTheDocument()
  })

  it('displays burn mechanism options', () => {
    render(<MemeTemplate />)
    
    expect(screen.getByText(/🔥 Burn Events/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Enable burn mechanism/i)).toBeInTheDocument()
  })

  it('navigates to quick launch when button is clicked', () => {
    render(<MemeTemplate />)
    
    const quickLaunchButton = screen.getByRole('button', { name: /Quick Launch/i })
    fireEvent.click(quickLaunchButton)
    
    expect(mockPush).toHaveBeenCalledWith('/templates/meme/launch')
  })

  it('shows social engagement features', () => {
    render(<MemeTemplate />)
    
    expect(screen.getByText(/Community Leaderboard/i)).toBeInTheDocument()
    expect(screen.getByText(/Top Holders/i)).toBeInTheDocument()
    expect(screen.getByText(/Most Active/i)).toBeInTheDocument()
  })

  it('handles meme generation', async () => {
    render(<MemeTemplate />)
    
    const generateButton = screen.getByRole('button', { name: /Generate Meme/i })
    fireEvent.click(generateButton)
    
    await waitFor(() => {
      expect(screen.getByText(/Generating.../i)).toBeInTheDocument()
    })
  })

  it('toggles burn mechanism', () => {
    render(<MemeTemplate />)
    
    const burnToggle = screen.getByLabelText(/Enable burn mechanism/i)
    expect(burnToggle).not.toBeChecked()
    
    fireEvent.click(burnToggle)
    expect(burnToggle).toBeChecked()
  })

  it('shows preset configurations', () => {
    render(<MemeTemplate />)
    
    expect(screen.getByText(/Preset Configs/i)).toBeInTheDocument()
    expect(screen.getByText(/🐸 Pepe Mode/i)).toBeInTheDocument()
    expect(screen.getByText(/🚀 Moon Shot/i)).toBeInTheDocument()
    expect(screen.getByText(/💎 Diamond Hands/i)).toBeInTheDocument()
  })

  it('redirects to login if not authenticated', () => {
    ;(useFarcasterAuth as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      user: null
    })
    
    render(<MemeTemplate />)
    
    expect(mockPush).toHaveBeenCalledWith('/')
  })
})