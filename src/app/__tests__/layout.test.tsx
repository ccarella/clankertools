import React from 'react'
import RootLayout from '../layout'
import { metadata, viewport } from '../layout'

jest.mock('@/components/BottomNavigation', () => ({
  __esModule: true,
  default: () => <nav data-testid="bottom-navigation">Bottom Navigation</nav>
}))

jest.mock('@/components/providers/FarcasterProvider', () => ({
  FarcasterProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

describe('RootLayout', () => {
  it('renders layout as a React Server Component', () => {
    // RootLayout is a server component that returns html/body elements
    // We can't directly test it with RTL, but we can verify it exports correctly
    expect(RootLayout).toBeDefined()
    expect(typeof RootLayout).toBe('function')
  })

  it('should have correct structure when called', () => {
    // Test that the component can be called without errors
    const result = RootLayout({ children: <div>Test</div> })
    expect(result).toBeDefined()
    expect(result.type).toBe('html')
    expect(result.props.lang).toBe('en')
  })
})

describe('Viewport Configuration', () => {
  it('should have correct viewport settings', () => {
    expect(viewport).toBeDefined()
    expect(viewport.width).toBe('device-width')
    expect(viewport.initialScale).toBe(1)
    expect(viewport.maximumScale).toBe(1)
    expect(viewport.userScalable).toBe(false)
    expect(viewport.viewportFit).toBe('cover')
  })
})

describe('Metadata', () => {
  it('should have correct metadata', () => {
    expect(metadata.title).toBe('Clanker Tools')
    expect(metadata.description).toBe('Your comprehensive platform for Clanker token management')
  })
})