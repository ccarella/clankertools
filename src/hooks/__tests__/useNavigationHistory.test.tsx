import React from 'react'
import { render, screen } from '@testing-library/react'
import { NavigationProvider } from '@/components/providers/NavigationProvider'
import { useNavigationHistory } from '../useNavigationHistory'

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
    navigation: {
      goBack: jest.fn(),
    },
  },
}))

function TestComponent() {
  const {
    history,
    currentIndex,
    canGoBack,
    canGoForward,
    getCurrentPath,
    getPreviousPath,
    getNavigationState
  } = useNavigationHistory()
  
  return (
    <div>
      <div data-testid="history-length">{history.length}</div>
      <div data-testid="current-index">{currentIndex}</div>
      <div data-testid="can-go-back">{canGoBack.toString()}</div>
      <div data-testid="can-go-forward">{canGoForward.toString()}</div>
      <div data-testid="current-path">{getCurrentPath()}</div>
      <div data-testid="previous-path">{getPreviousPath() || 'none'}</div>
      <div data-testid="navigation-state">{JSON.stringify(getNavigationState())}</div>
    </div>
  )
}

describe('useNavigationHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('provides initial navigation history state', () => {
    render(
      <NavigationProvider>
        <TestComponent />
      </NavigationProvider>
    )

    expect(screen.getByTestId('history-length')).toHaveTextContent('1')
    expect(screen.getByTestId('current-index')).toHaveTextContent('0')
    expect(screen.getByTestId('can-go-back')).toHaveTextContent('false')
    expect(screen.getByTestId('can-go-forward')).toHaveTextContent('false')
    expect(screen.getByTestId('current-path')).toHaveTextContent('/test-path')
    expect(screen.getByTestId('previous-path')).toHaveTextContent('none')
  })

  it('returns correct navigation state object', () => {
    render(
      <NavigationProvider>
        <TestComponent />
      </NavigationProvider>
    )

    const stateText = screen.getByTestId('navigation-state').textContent
    const state = JSON.parse(stateText || '{}')
    
    expect(state).toEqual({
      history: expect.arrayContaining([
        expect.objectContaining({
          path: '/test-path',
          timestamp: expect.any(Number)
        })
      ]),
      currentIndex: 0,
      canGoBack: false
    })
  })

  it('throws error when used outside NavigationProvider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useNavigation must be used within a NavigationProvider')
    
    consoleSpy.mockRestore()
  })
})