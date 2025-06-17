import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { FarcasterProvider } from '../FarcasterProvider'
import sdk from '@farcaster/frame-sdk'

jest.mock('@farcaster/frame-sdk', () => ({
  __esModule: true,
  default: {
    ready: jest.fn(),
  },
}))

describe('FarcasterProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render children', () => {
    const { getByText } = render(
      <FarcasterProvider>
        <div>Test Content</div>
      </FarcasterProvider>
    )
    
    expect(getByText('Test Content')).toBeInTheDocument()
  })

  it('should call sdk.ready() on mount', async () => {
    render(
      <FarcasterProvider>
        <div>Test Content</div>
      </FarcasterProvider>
    )
    
    await waitFor(() => {
      expect(sdk.ready).toHaveBeenCalledTimes(1)
    })
  })

  it('should only call sdk.ready() once with multiple children', async () => {
    render(
      <FarcasterProvider>
        <div>Child 1</div>
        <div>Child 2</div>
        <div>Child 3</div>
      </FarcasterProvider>
    )
    
    await waitFor(() => {
      expect(sdk.ready).toHaveBeenCalledTimes(1)
    })
  })

  it('should not crash when sdk.ready() throws', async () => {
    const mockError = new Error('SDK initialization failed')
    ;(sdk.ready as jest.Mock).mockRejectedValueOnce(mockError)
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
    
    const { getByText } = render(
      <FarcasterProvider>
        <div>Test Content</div>
      </FarcasterProvider>
    )
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize Farcaster SDK:', mockError)
    })
    
    expect(getByText('Test Content')).toBeInTheDocument()
    
    consoleSpy.mockRestore()
  })
})