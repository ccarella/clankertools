import { render, screen } from '@testing-library/react';
import { DiscrepancyAlerts } from '../DiscrepancyAlerts';
import type { RewardDiscrepancy } from '../types';

describe('DiscrepancyAlerts', () => {
  const mockDiscrepancies: RewardDiscrepancy[] = [
    {
      tokenAddress: '0x123',
      name: 'Token 1',
      symbol: 'TK1',
      deployedAt: '2025-06-23T00:00:00.000Z',
      fid: '12345',
      issue: 'Creator reward recipient mismatch',
      expected: '0xabc',
      actual: '0xdef',
    },
    {
      tokenAddress: '0x456',
      name: 'Token 2',
      symbol: 'TK2',
      deployedAt: '2025-06-22T00:00:00.000Z',
      fid: '67890',
      issue: 'No creator rewards configured',
      expected: '80%',
      actual: '0%',
    },
  ];

  it('renders high priority alerts', () => {
    render(<DiscrepancyAlerts discrepancies={mockDiscrepancies} />);

    expect(screen.getByText('Discrepancy Alerts')).toBeInTheDocument();
    expect(screen.getByText('High Priority Issues')).toBeInTheDocument();
    
    expect(screen.getByText(/Creator reward recipient mismatch/)).toBeInTheDocument();
    expect(screen.getByText('FID: 12345')).toBeInTheDocument();
    expect(screen.getByText(/Token 1 \(TK1\)/)).toBeInTheDocument();
    
    expect(screen.getByText(/No creator rewards configured/)).toBeInTheDocument();
    expect(screen.getByText('FID: 67890')).toBeInTheDocument();
  });

  it('shows expected vs actual values when available', () => {
    render(<DiscrepancyAlerts discrepancies={mockDiscrepancies} />);

    expect(screen.getByText(/Expected: 0xabc → Actual: 0xdef/)).toBeInTheDocument();
    expect(screen.getByText(/Expected: 80% → Actual: 0%/)).toBeInTheDocument();
  });

  it('truncates when there are many discrepancies', () => {
    const manyDiscrepancies = Array.from({ length: 10 }, (_, i) => ({
      tokenAddress: `0x${i}`,
      name: `Token ${i}`,
      symbol: `TK${i}`,
      deployedAt: '2025-06-23T00:00:00.000Z',
      fid: `${i}`,
      issue: 'Creator reward recipient mismatch',
    }));

    render(<DiscrepancyAlerts discrepancies={manyDiscrepancies} />);

    expect(screen.getByText('... and 5 more')).toBeInTheDocument();
  });

  it('renders nothing when no discrepancies', () => {
    const { container } = render(<DiscrepancyAlerts discrepancies={[]} />);

    expect(container.querySelector('[role="alert"]')).not.toBeInTheDocument();
  });
});