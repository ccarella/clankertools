import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { NavigationLink } from '../NavigationLink'
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
  usePathname: () => '/current-path',
}))

jest.mock('@farcaster/frame-sdk', () => ({
  __esModule: true,
  default: {
    navigation: {
      goBack: jest.fn(),
    },
  },
}))

describe('NavigationLink', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders children correctly', () => {
    render(
      <NavigationProvider>
        <NavigationLink href="/test">Test Link</NavigationLink>
      </NavigationProvider>
    )

    expect(screen.getByText('Test Link')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(
      <NavigationProvider>
        <NavigationLink href="/test" className="custom-class">
          Test Link
        </NavigationLink>
      </NavigationProvider>
    )

    const link = screen.getByText('Test Link')
    expect(link).toHaveClass('custom-class')
  })

  it('handles click navigation', () => {
    render(
      <NavigationProvider>
        <NavigationLink href="/test-path">Click Me</NavigationLink>
      </NavigationProvider>
    )

    fireEvent.click(screen.getByText('Click Me'))
    expect(mockRouter.push).toHaveBeenCalledWith('/test-path')
  })

  it('handles replace navigation', () => {
    render(
      <NavigationProvider>
        <NavigationLink href="/test-path" replace>
          Replace Link
        </NavigationLink>
      </NavigationProvider>
    )

    fireEvent.click(screen.getByText('Replace Link'))
    expect(mockRouter.replace).toHaveBeenCalledWith('/test-path')
  })

  it('calls custom onClick handler', () => {
    const mockOnClick = jest.fn()
    
    render(
      <NavigationProvider>
        <NavigationLink href="/test" onClick={mockOnClick}>
          Custom Click
        </NavigationLink>
      </NavigationProvider>
    )

    fireEvent.click(screen.getByText('Custom Click'))
    expect(mockOnClick).toHaveBeenCalled()
    expect(mockRouter.push).toHaveBeenCalledWith('/test')
  })

  it('prevents default link behavior', () => {
    render(
      <NavigationProvider>
        <NavigationLink href="/test">Test Link</NavigationLink>
      </NavigationProvider>
    )

    const link = screen.getByText('Test Link')
    const clickEvent = new MouseEvent('click', { bubbles: true })
    const preventDefaultSpy = jest.spyOn(clickEvent, 'preventDefault')
    
    fireEvent(link, clickEvent)
    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('handles keyboard navigation (Enter key)', () => {
    render(
      <NavigationProvider>
        <NavigationLink href="/test-keyboard">Keyboard Nav</NavigationLink>
      </NavigationProvider>
    )

    const link = screen.getByText('Keyboard Nav')
    fireEvent.keyDown(link, { key: 'Enter' })
    expect(mockRouter.push).toHaveBeenCalledWith('/test-keyboard')
  })

  it('handles keyboard navigation (Space key)', () => {
    render(
      <NavigationProvider>
        <NavigationLink href="/test-space">Space Nav</NavigationLink>
      </NavigationProvider>
    )

    const link = screen.getByText('Space Nav')
    fireEvent.keyDown(link, { key: ' ' })
    expect(mockRouter.push).toHaveBeenCalledWith('/test-space')
  })

  it('ignores other keyboard keys', () => {
    render(
      <NavigationProvider>
        <NavigationLink href="/test-other">Other Key Nav</NavigationLink>
      </NavigationProvider>
    )

    const link = screen.getByText('Other Key Nav')
    fireEvent.keyDown(link, { key: 'Tab' })
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('has proper accessibility attributes', () => {
    render(
      <NavigationProvider>
        <NavigationLink href="/test">Accessible Link</NavigationLink>
      </NavigationProvider>
    )

    const link = screen.getByText('Accessible Link')
    expect(link).toHaveAttribute('role', 'button')
    expect(link).toHaveAttribute('tabIndex', '0')
  })

  it('throws error when used outside NavigationProvider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      render(<NavigationLink href="/test">Outside Provider</NavigationLink>)
    }).toThrow('useNavigation must be used within a NavigationProvider')
    
    consoleSpy.mockRestore()
  })
})