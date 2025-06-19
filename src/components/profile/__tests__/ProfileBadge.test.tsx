import React from 'react'
import { render, screen } from '@testing-library/react'
import { ProfileBadge } from '../ProfileBadge'
import { createMockNeynarUser } from '@/test-utils/mockNeynarUser'

const mockUser = createMockNeynarUser({
  displayName: 'Test User',
  profile: {
    bio: {
      text: 'Test bio'
    }
  }
})

describe('ProfileBadge', () => {
  it('renders user display name', () => {
    render(<ProfileBadge user={mockUser} />)
    expect(screen.getByText('Test User')).toBeInTheDocument()
  })

  it('renders username with @ prefix', () => {
    render(<ProfileBadge user={mockUser} />)
    expect(screen.getByText('@testuser')).toBeInTheDocument()
  })

  it('displays follower count', () => {
    render(<ProfileBadge user={mockUser} />)
    expect(screen.getByText('5K')).toBeInTheDocument()
    expect(screen.getByText('followers')).toBeInTheDocument()
  })

  it('displays following count', () => {
    render(<ProfileBadge user={mockUser} />)
    expect(screen.getByText('250')).toBeInTheDocument()
    expect(screen.getByText('following')).toBeInTheDocument()
  })

  it('shows verification badge when user has verified addresses', () => {
    render(<ProfileBadge user={mockUser} />)
    expect(screen.getByTestId('verification-badge')).toBeInTheDocument()
  })

  it('does not show verification badge when no verified addresses', () => {
    const unverifiedUser = createMockNeynarUser({
      ...mockUser,
      verifications: []
    })
    render(<ProfileBadge user={unverifiedUser} />)
    expect(screen.queryByTestId('verification-badge')).not.toBeInTheDocument()
  })

  it('renders profile picture container', () => {
    render(<ProfileBadge user={mockUser} />)
    const avatarContainer = screen.getByText('T').closest('[data-slot="avatar"]')
    expect(avatarContainer).toBeInTheDocument()
  })

  it('handles missing profile picture gracefully', () => {
    const userWithoutPfp = createMockNeynarUser({ ...mockUser, pfp: undefined })
    render(<ProfileBadge user={userWithoutPfp} />)
    expect(screen.getByTestId('avatar-fallback')).toBeInTheDocument()
  })

  it('formats large follower counts correctly', () => {
    const userWithManyFollowers = createMockNeynarUser({ ...mockUser, followerCount: 1234567 })
    render(<ProfileBadge user={userWithManyFollowers} />)
    expect(screen.getByText('1.2M')).toBeInTheDocument()
  })

  it('renders compact variant correctly', () => {
    render(<ProfileBadge user={mockUser} variant="compact" />)
    expect(screen.getByTestId('profile-badge-compact')).toBeInTheDocument()
  })

  it('renders expanded variant with bio', () => {
    render(<ProfileBadge user={mockUser} variant="expanded" />)
    expect(screen.getByText('Test bio')).toBeInTheDocument()
  })

  it('handles loading state', () => {
    render(<ProfileBadge user={null} loading />)
    expect(screen.getByTestId('profile-badge-skeleton')).toBeInTheDocument()
  })

  it('handles error state', () => {
    render(<ProfileBadge user={null} error="Failed to load profile" />)
    expect(screen.getByText('Failed to load profile')).toBeInTheDocument()
  })
})