import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ContributionTracker } from '../ContributionTracker';

describe('ContributionTracker', () => {
  const mockContributions = {
    totalRaised: 1000000, // $1M
    targetAmount: 2000000, // $2M
    contributorCount: 150,
    userContribution: 5000, // $5k
    minContribution: 100,
    maxContribution: 10000,
  };

  it('should render contribution tracker with progress bar', () => {
    render(<ContributionTracker {...mockContributions} />);
    
    expect(screen.getByText(/Total Raised/)).toBeInTheDocument();
    expect(screen.getByText(/\$1,000,000/)).toBeInTheDocument();
    expect(screen.getByText(/of \$2,000,000/)).toBeInTheDocument();
  });

  it('should display progress percentage correctly', () => {
    render(<ContributionTracker {...mockContributions} />);
    
    expect(screen.getByText(/50%/)).toBeInTheDocument();
  });

  it('should show contributor count', () => {
    render(<ContributionTracker {...mockContributions} />);
    
    expect(screen.getByText(/150 Contributors/)).toBeInTheDocument();
  });

  it('should display user contribution if provided', () => {
    render(<ContributionTracker {...mockContributions} />);
    
    expect(screen.getByText(/Your Contribution/)).toBeInTheDocument();
    expect(screen.getByText(/\$5,000/)).toBeInTheDocument();
  });

  it('should not show user contribution section if not provided', () => {
    const propsWithoutUser = { ...mockContributions, userContribution: undefined };
    render(<ContributionTracker {...propsWithoutUser} />);
    
    expect(screen.queryByText(/Your Contribution/)).not.toBeInTheDocument();
  });

  it('should show contribution limits', () => {
    render(<ContributionTracker {...mockContributions} />);
    
    expect(screen.getByText(/Min: \$100/)).toBeInTheDocument();
    expect(screen.getByText(/Max: \$10,000/)).toBeInTheDocument();
  });

  it('should handle zero contributions gracefully', () => {
    const zeroProps = {
      ...mockContributions,
      totalRaised: 0,
      contributorCount: 0,
      userContribution: undefined,
    };
    
    render(<ContributionTracker {...zeroProps} />);
    
    expect(screen.getByText(/\$0/)).toBeInTheDocument();
    expect(screen.getByText(/0 Contributors/)).toBeInTheDocument();
    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  it('should show 100% when target is reached', () => {
    const reachedProps = {
      ...mockContributions,
      totalRaised: 2000000,
    };
    
    render(<ContributionTracker {...reachedProps} />);
    
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ContributionTracker {...mockContributions} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});