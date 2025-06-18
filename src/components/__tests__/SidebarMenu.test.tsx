import { render, screen, fireEvent } from '@testing-library/react'
import SidebarMenu from '../SidebarMenu'
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

describe('SidebarMenu', () => {
  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <NavigationProvider>
        {component}
      </NavigationProvider>
    )
  }
  it('renders hamburger menu button', () => {
    renderWithProvider(<SidebarMenu />)
    const button = screen.getByRole('button', { name: /toggle menu/i })
    expect(button).toBeInTheDocument()
  })

  it('sidebar is hidden by default', () => {
    renderWithProvider(<SidebarMenu />)
    const sidebar = screen.queryByRole('navigation')
    expect(sidebar).toHaveClass('-translate-x-full')
  })

  it('shows sidebar when hamburger is clicked', () => {
    renderWithProvider(<SidebarMenu />)
    const button = screen.getByRole('button', { name: /toggle menu/i })
    
    fireEvent.click(button)
    
    const sidebar = screen.getByRole('navigation')
    expect(sidebar).toHaveClass('translate-x-0')
  })

  it('hides sidebar when hamburger is clicked again', () => {
    renderWithProvider(<SidebarMenu />)
    const button = screen.getByRole('button', { name: /toggle menu/i })
    
    fireEvent.click(button) // Open
    fireEvent.click(button) // Close
    
    const sidebar = screen.getByRole('navigation')
    expect(sidebar).toHaveClass('-translate-x-full')
  })

  it('renders Home link in sidebar', () => {
    renderWithProvider(<SidebarMenu />)
    const button = screen.getByRole('button', { name: /toggle menu/i })
    
    fireEvent.click(button)
    
    const homeLink = screen.getByText('Home')
    expect(homeLink).toBeInTheDocument()
  })

  it('closes sidebar when overlay is clicked', () => {
    renderWithProvider(<SidebarMenu />)
    const button = screen.getByRole('button', { name: /toggle menu/i })
    
    fireEvent.click(button) // Open
    
    const overlay = screen.getByTestId('sidebar-overlay')
    fireEvent.click(overlay)
    
    const sidebar = screen.getByRole('navigation')
    expect(sidebar).toHaveClass('-translate-x-full')
  })
})