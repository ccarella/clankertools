import { render, screen } from '@testing-library/react';
import { RewardsSummary } from '../RewardsSummary';

describe('RewardsSummary', () => {
  const mockSummary = {
    totalDeployments: 100,
    deploymentsWithRewards: 75,
    deploymentsWithoutRewards: 25,
    discrepanciesFound: 5,
  };

  it('renders all summary statistics', () => {
    render(<RewardsSummary summary={mockSummary} />);

    expect(screen.getByText('Total Deployments')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();

    expect(screen.getByText('With Rewards')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();

    expect(screen.getByText('Without Rewards')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();

    expect(screen.getByText('Discrepancies')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('handles zero deployments', () => {
    const zeroSummary = {
      totalDeployments: 0,
      deploymentsWithRewards: 0,
      deploymentsWithoutRewards: 0,
      discrepanciesFound: 0,
    };

    render(<RewardsSummary summary={zeroSummary} />);

    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});