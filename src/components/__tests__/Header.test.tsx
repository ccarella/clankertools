import { render, screen } from '@testing-library/react'
import Header from '../Header'

describe('Header', () => {
  it('renders the title "Clanker Tools"', () => {
    render(<Header />)
    const title = screen.getByText('Clanker Tools')
    expect(title).toBeInTheDocument()
  })

  it('renders with proper semantic structure', () => {
    render(<Header />)
    const header = screen.getByRole('banner')
    expect(header).toBeInTheDocument()
  })

  it('has responsive classes', () => {
    const { container } = render(<Header />)
    const header = container.querySelector('header')
    expect(header).toHaveClass('w-full')
  })
})