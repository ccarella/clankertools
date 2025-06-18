import React from 'react'
import { render, screen } from '@testing-library/react'
import Header from '../Header'
import { FarcasterAuthProvider } from '../providers/FarcasterAuthProvider'
import { NavigationProvider } from '../providers/NavigationProvider'

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
}

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/test-path',
}))

jest.mock('@farcaster/frame-sdk', () => ({
  __esModule: true,
  default: {
    back: {
      enableWebNavigation: jest.fn(),
      show: jest.fn(),
      hide: jest.fn(),
    },
  },
}))

jest.mock('@/providers/HapticProvider')

describe('Header', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <NavigationProvider>
        <FarcasterAuthProvider>
          {component}
        </FarcasterAuthProvider>
      </NavigationProvider>
    )
  }

  it('renders the title "Clanker Tools"', () => {
    renderWithProviders(<Header />)
    const title = screen.getByText('Clanker Tools')
    expect(title).toBeInTheDocument()
  })

  it('renders with proper semantic structure', () => {
    renderWithProviders(<Header />)
    const header = screen.getByRole('banner')
    expect(header).toBeInTheDocument()
  })

  it('has responsive classes', () => {
    const { container } = renderWithProviders(<Header />)
    const header = container.querySelector('header')
    expect(header).toHaveClass('w-full')
  })

  it('renders sign in button', () => {
    renderWithProviders(<Header />)
    const signInButton = screen.getByRole('button', { name: /sign in with farcaster/i })
    expect(signInButton).toBeInTheDocument()
  })

  it('does not show back button when canGoBack is false', () => {
    renderWithProviders(<Header />)
    const backButton = screen.queryByTestId('back-button')
    expect(backButton).not.toBeInTheDocument()
  })

  it('renders header with navigation context correctly', () => {
    renderWithProviders(<Header />)
    
    const title = screen.getByText('Clanker Tools')
    expect(title).toBeInTheDocument()
    
    const signInButton = screen.getByRole('button', { name: /sign in with farcaster/i })
    expect(signInButton).toBeInTheDocument()
  })
})