import { render, screen, fireEvent } from '@testing-library/react'
import SidebarMenu from '../SidebarMenu'

describe('SidebarMenu', () => {
  it('renders hamburger menu button', () => {
    render(<SidebarMenu />)
    const button = screen.getByRole('button', { name: /toggle menu/i })
    expect(button).toBeInTheDocument()
  })

  it('sidebar is hidden by default', () => {
    render(<SidebarMenu />)
    const sidebar = screen.queryByRole('navigation')
    expect(sidebar).toHaveClass('-translate-x-full')
  })

  it('shows sidebar when hamburger is clicked', () => {
    render(<SidebarMenu />)
    const button = screen.getByRole('button', { name: /toggle menu/i })
    
    fireEvent.click(button)
    
    const sidebar = screen.getByRole('navigation')
    expect(sidebar).toHaveClass('translate-x-0')
  })

  it('hides sidebar when hamburger is clicked again', () => {
    render(<SidebarMenu />)
    const button = screen.getByRole('button', { name: /toggle menu/i })
    
    fireEvent.click(button) // Open
    fireEvent.click(button) // Close
    
    const sidebar = screen.getByRole('navigation')
    expect(sidebar).toHaveClass('-translate-x-full')
  })

  it('renders Home link in sidebar', () => {
    render(<SidebarMenu />)
    const button = screen.getByRole('button', { name: /toggle menu/i })
    
    fireEvent.click(button)
    
    const homeLink = screen.getByRole('link', { name: /home/i })
    expect(homeLink).toBeInTheDocument()
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('closes sidebar when overlay is clicked', () => {
    render(<SidebarMenu />)
    const button = screen.getByRole('button', { name: /toggle menu/i })
    
    fireEvent.click(button) // Open
    
    const overlay = screen.getByTestId('sidebar-overlay')
    fireEvent.click(overlay)
    
    const sidebar = screen.getByRole('navigation')
    expect(sidebar).toHaveClass('-translate-x-full')
  })
})