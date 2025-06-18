import { render, screen } from '@testing-library/react'
import Header from '../Header'
import { FarcasterAuthProvider } from '../providers/FarcasterAuthProvider'

describe('Header', () => {
  const renderWithAuth = (component: React.ReactElement) => {
    return render(
      <FarcasterAuthProvider>
        {component}
      </FarcasterAuthProvider>
    )
  }

  it('renders the title "Clanker Tools"', () => {
    renderWithAuth(<Header />)
    const title = screen.getByText('Clanker Tools')
    expect(title).toBeInTheDocument()
  })

  it('renders with proper semantic structure', () => {
    renderWithAuth(<Header />)
    const header = screen.getByRole('banner')
    expect(header).toBeInTheDocument()
  })

  it('has responsive classes', () => {
    const { container } = renderWithAuth(<Header />)
    const header = container.querySelector('header')
    expect(header).toHaveClass('w-full')
  })

  it('renders sign in button', () => {
    renderWithAuth(<Header />)
    const signInButton = screen.getByRole('button', { name: /sign in with farcaster/i })
    expect(signInButton).toBeInTheDocument()
  })
})