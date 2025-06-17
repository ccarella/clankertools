import React from 'react'
import { render } from '@testing-library/react'
import RootLayout from '../layout'
import { metadata, viewport } from '../layout'

jest.mock('@/components/Header', () => ({
  __esModule: true,
  default: () => <div data-testid="header">Header</div>
}))

jest.mock('@/components/SidebarMenu', () => ({
  __esModule: true,
  default: () => <div data-testid="sidebar">Sidebar</div>
}))

jest.mock('@/components/providers/FarcasterProvider', () => ({
  FarcasterProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

describe('RootLayout', () => {
  it('should render with FarcasterProvider', () => {
    const { getByText } = render(
      <RootLayout>
        <div>Test Content</div>
      </RootLayout>
    )
    
    expect(getByText('Test Content')).toBeInTheDocument()
  })

  it('should render with proper structure', () => {
    const { getByTestId } = render(
      <RootLayout>
        <div>Test Content</div>
      </RootLayout>
    )
    
    expect(getByTestId('header')).toBeInTheDocument()
    expect(getByTestId('sidebar')).toBeInTheDocument()
  })
})

describe('Viewport Configuration', () => {
  it('should have correct viewport settings', () => {
    expect(viewport).toBeDefined()
    expect(viewport.width).toBe(424)
    expect(viewport.height).toBe(695)
    expect(viewport.initialScale).toBe(1)
    expect(viewport.maximumScale).toBe(1)
    expect(viewport.userScalable).toBe(false)
    expect(viewport.viewportFit).toBe('cover')
  })
})

describe('Metadata', () => {
  it('should have updated metadata for Farcaster', () => {
    expect(metadata.title).toBe('Clanker Tools')
    expect(metadata.description).toBe('Your comprehensive platform for Clanker token management')
    expect(metadata.viewport).toBeUndefined()
  })
})