import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { NavigationProvider, useNavigation } from '../NavigationProvider'

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

function TestComponent() {
  const navigation = useNavigation()
  
  return (
    <div>
      <div data-testid="can-go-back">{navigation.canGoBack.toString()}</div>
      <div data-testid="current-index">{navigation.currentIndex}</div>
      <div data-testid="history-length">{navigation.history.length}</div>
      <div data-testid="launch-context">{navigation.launchContext || 'none'}</div>
      <button 
        data-testid="navigate-button" 
        onClick={() => navigation.navigate('/new-path')}
      >
        Navigate
      </button>
      <button 
        data-testid="back-button" 
        onClick={() => navigation.goBack()}
      >
        Go Back
      </button>
      <button 
        data-testid="push-button" 
        onClick={() => navigation.push('/pushed-path')}
      >
        Push
      </button>
      <button 
        data-testid="replace-button" 
        onClick={() => navigation.replace('/replaced-path')}
      >
        Replace
      </button>
      <button 
        data-testid="set-context-button" 
        onClick={() => navigation.setLaunchContext('cast')}
      >
        Set Context
      </button>
    </div>
  )
}

describe('NavigationProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('provides initial navigation state', () => {
    render(
      <NavigationProvider>
        <TestComponent />
      </NavigationProvider>
    )

    expect(screen.getByTestId('can-go-back')).toHaveTextContent('false')
    expect(screen.getByTestId('current-index')).toHaveTextContent('0')
    expect(screen.getByTestId('history-length')).toHaveTextContent('1')
    expect(screen.getByTestId('launch-context')).toHaveTextContent('none')
  })

  it('handles navigation correctly', async () => {
    render(
      <NavigationProvider>
        <TestComponent />
      </NavigationProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByTestId('navigate-button'))
    })

    expect(mockRouter.push).toHaveBeenCalledWith('/new-path')
    expect(screen.getByTestId('history-length')).toHaveTextContent('2')
    expect(screen.getByTestId('current-index')).toHaveTextContent('1')
    expect(screen.getByTestId('can-go-back')).toHaveTextContent('true')
  })

  it('handles push navigation', async () => {
    render(
      <NavigationProvider>
        <TestComponent />
      </NavigationProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByTestId('push-button'))
    })

    expect(mockRouter.push).toHaveBeenCalledWith('/pushed-path')
  })

  it('handles replace navigation', async () => {
    render(
      <NavigationProvider>
        <TestComponent />
      </NavigationProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByTestId('replace-button'))
    })

    expect(mockRouter.replace).toHaveBeenCalledWith('/replaced-path')
  })

  it('handles back navigation with router', async () => {
    render(
      <NavigationProvider>
        <TestComponent />
      </NavigationProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByTestId('navigate-button'))
    })

    expect(screen.getByTestId('can-go-back')).toHaveTextContent('true')

    await act(async () => {
      fireEvent.click(screen.getByTestId('back-button'))
    })

    expect(mockRouter.back).toHaveBeenCalled()
    expect(screen.getByTestId('current-index')).toHaveTextContent('0')
    expect(screen.getByTestId('can-go-back')).toHaveTextContent('false')
  })

  it('handles launch context setting', async () => {
    render(
      <NavigationProvider>
        <TestComponent />
      </NavigationProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByTestId('set-context-button'))
    })

    expect(screen.getByTestId('launch-context')).toHaveTextContent('cast')
  })

  it('prevents navigation loops', async () => {
    render(
      <NavigationProvider>
        <TestComponent />
      </NavigationProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByTestId('navigate-button'))
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('navigate-button'))
    })

    expect(mockRouter.push).toHaveBeenCalledWith('/new-path')
    expect(screen.getByTestId('history-length')).toHaveTextContent('2')
  })

  it('throws error when used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useNavigation must be used within a NavigationProvider')
    
    consoleSpy.mockRestore()
  })

  it('tracks navigation history with timestamps', async () => {
    const TestHistoryComponent = () => {
      const navigation = useNavigation()
      return (
        <div>
          <div data-testid="first-entry-timestamp">
            {navigation.history[0]?.timestamp || 0}
          </div>
          <button 
            data-testid="navigate-button" 
            onClick={() => navigation.navigate('/new-path')}
          >
            Navigate
          </button>
        </div>
      )
    }

    render(
      <NavigationProvider>
        <TestHistoryComponent />
      </NavigationProvider>
    )

    const initialTimestamp = screen.getByTestId('first-entry-timestamp').textContent
    expect(Number(initialTimestamp)).toBeGreaterThan(0)

    await act(async () => {
      fireEvent.click(screen.getByTestId('navigate-button'))
    })
  })
})