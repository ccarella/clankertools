import React from 'react'
import { render, screen } from '@testing-library/react'
import { TransactionHistory } from '../TransactionHistory'
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider'

// Mock providers
jest.mock('@/components/providers/FarcasterAuthProvider')

const mockUseFarcasterAuth = useFarcasterAuth as jest.MockedFunction<typeof useFarcasterAuth>

const mockUser = {
  fid: 123,
  username: 'testuser',
  displayName: 'Test User',
  pfpUrl: 'https://example.com/pfp.jpg',
  profile: {
    bio: {
      text: 'Test bio',
      mentions: []
    }
  },
  followerCount: 100,
  followingCount: 50,
  verifications: ['0x123'],
  verifiedAddresses: {
    eth_addresses: ['0x123'],
    sol_addresses: []
  },
  activeStatus: 'inactive' as const,
  powerBadge: false
}


const mockTransactions = [
  {
    id: 'tx-1',
    hash: '0x123',
    type: 'token_deployment',
    status: 'success',
    timestamp: '2024-01-15T10:30:00Z',
    tokenName: 'Test Token',
    tokenSymbol: 'TEST',
    tokenAddress: '0xabc',
    gasUsed: '0.002',
    networkFee: '0.001',
    totalCost: '0.003'
  },
  {
    id: 'tx-2',
    hash: '0x456',
    type: 'token_deployment',
    status: 'success',
    timestamp: '2024-01-15T09:00:00Z',
    tokenName: 'Another Token',
    tokenSymbol: 'ANOTHER',
    tokenAddress: '0xdef',
    gasUsed: '0.001',
    networkFee: '0.0005',
    totalCost: '0.0015'
  },
  {
    id: 'tx-3',
    hash: '0x789',
    type: 'token_deployment',
    status: 'failed',
    timestamp: '2024-01-15T08:00:00Z',
    tokenName: 'Failed Token',
    tokenSymbol: 'FAIL',
    error: 'Insufficient funds'
  },
  {
    id: 'tx-4',
    hash: '0xabc',
    type: 'wallet_connection',
    status: 'pending',
    timestamp: '2024-01-15T07:00:00Z',
    walletAddress: '0x123456789'
  }
]

describe('TransactionHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseFarcasterAuth.mockReturnValue({
      user: mockUser,
      castContext: null,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      signIn: jest.fn(),
      signOut: jest.fn(),
      clearError: jest.fn(),
      getQuickAuthToken: jest.fn()
    })
  })

  describe('Basic Rendering', () => {
    it('renders with empty transaction list', () => {
      render(<TransactionHistory transactions={[]} />)
      
      expect(screen.getByText('Transaction History')).toBeInTheDocument()
      expect(screen.getByText('No transactions yet')).toBeInTheDocument()
      expect(screen.getByText('Start by deploying your first token!')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Deploy Token' })).toHaveAttribute('href', '/simple-launch')
    })

    it('renders loading state', () => {
      render(<TransactionHistory transactions={[]} isLoading={true} />)
      
      expect(screen.getByTestId('history-skeleton')).toBeInTheDocument()
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('renders error state', () => {
      render(<TransactionHistory transactions={[]} error="Failed to load" />)
      
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Failed to load transaction history')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })

    it('renders transaction list', () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      expect(screen.getByText('Transaction History')).toBeInTheDocument()
      expect(screen.getByText('Test User')).toBeInTheDocument()
      expect(screen.getByText('@testuser')).toBeInTheDocument()
      expect(screen.getByText('4 total transactions')).toBeInTheDocument()
      expect(screen.getByText('2 successful')).toBeInTheDocument()
      expect(screen.getByText('1 failed')).toBeInTheDocument()
    })
  })

  describe('Transaction Display', () => {
    it('displays individual transactions', () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      expect(screen.getByTestId('transaction-tx-1')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-tx-2')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-tx-3')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-tx-4')).toBeInTheDocument()
    })

    it('shows transaction types and statuses', () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      expect(screen.getByText('token_deployment - success')).toBeInTheDocument()
      expect(screen.getByText('token_deployment - failed')).toBeInTheDocument()
      expect(screen.getByText('wallet_connection - pending')).toBeInTheDocument()
    })
  })

  describe('Component Display', () => {
    it('displays transaction statistics', () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      expect(screen.getByText('Transaction History')).toBeInTheDocument()
      expect(screen.getByText('4 total transactions')).toBeInTheDocument()
      expect(screen.getByText('2 successful')).toBeInTheDocument()
      expect(screen.getByText('1 failed')).toBeInTheDocument()
    })

    it('displays all transactions', () => {
      render(<TransactionHistory transactions={mockTransactions} />)
      
      expect(screen.getByTestId('transaction-tx-1')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-tx-2')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-tx-3')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-tx-4')).toBeInTheDocument()
    })
  })
})