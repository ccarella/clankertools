import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WizardContainer } from '../index';
import { WizardStep } from '../types';

const mockSteps: WizardStep[] = [
  {
    id: 'token-basics',
    title: 'Token Basics',
    description: 'Configure basic token parameters',
    fields: ['name', 'symbol', 'description'],
    component: () => <div>Token Basics Content</div>,
  },
  {
    id: 'liquidity',
    title: 'Liquidity Settings',
    description: 'Configure liquidity parameters',
    fields: ['liquidityAmount', 'liquidityCurve'],
    component: () => <div>Liquidity Content</div>,
  },
  {
    id: 'fees',
    title: 'Fee Configuration',
    description: 'Set up fee structure',
    fields: ['swapFee', 'protocolFee'],
    component: () => <div>Fees Content</div>,
  },
];

const mockOnComplete = jest.fn();
const mockOnStepChange = jest.fn();

describe('WizardContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('renders initial step correctly', () => {
    render(
      <WizardContainer
        steps={mockSteps}
        onComplete={mockOnComplete}
      />
    );

    expect(screen.getByRole('heading', { name: 'The Works' })).toBeInTheDocument();
    expect(screen.getByText('Configure basic token parameters')).toBeInTheDocument();
    expect(screen.getByText('Token Basics Content')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });

  it('shows progress bar with correct percentage', () => {
    render(
      <WizardContainer
        steps={mockSteps}
        onComplete={mockOnComplete}
      />
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '33');
  });

  it('navigates to next step when Next button is clicked', async () => {
    render(
      <WizardContainer
        steps={mockSteps}
        onComplete={mockOnComplete}
        onStepChange={mockOnStepChange}
      />
    );

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Liquidity Content')).toBeInTheDocument();
      expect(mockOnStepChange).toHaveBeenCalledWith(1);
    });
  });

  it('navigates to previous step when Back button is clicked', async () => {
    render(
      <WizardContainer
        steps={mockSteps}
        onComplete={mockOnComplete}
        initialStep={1}
      />
    );

    const backButton = screen.getByText('Back');
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(screen.getByText('Token Basics Content')).toBeInTheDocument();
    });
  });

  it('disables Back button on first step', () => {
    render(
      <WizardContainer
        steps={mockSteps}
        onComplete={mockOnComplete}
      />
    );

    const backButton = screen.getByText('Back');
    expect(backButton).toBeDisabled();
  });

  it('shows Review button on last step', () => {
    render(
      <WizardContainer
        steps={mockSteps}
        onComplete={mockOnComplete}
        initialStep={2}
      />
    );

    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('calls onComplete when Review button is clicked on last step', async () => {
    render(
      <WizardContainer
        steps={mockSteps}
        onComplete={mockOnComplete}
        initialStep={2}
      />
    );

    const reviewButton = screen.getByText('Review');
    fireEvent.click(reviewButton);

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it('renders accordion view on mobile viewport', () => {
    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });
    
    // Trigger resize event
    window.dispatchEvent(new Event('resize'));

    render(
      <WizardContainer
        steps={mockSteps}
        onComplete={mockOnComplete}
      />
    );

    expect(screen.getByRole('region', { name: 'Token configuration wizard' })).toBeInTheDocument();
    // Check that accordion is rendered by looking for accordion-specific elements
    expect(screen.getByText('0 of 3 sections completed')).toBeInTheDocument();
  });

  it('persists progress to localStorage', async () => {
    // Ensure desktop view
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    
    render(
      <WizardContainer
        steps={mockSteps}
        onComplete={mockOnComplete}
        persistKey="wizard-progress"
      />
    );

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      const savedProgress = localStorage.getItem('wizard-progress');
      expect(savedProgress).toBeTruthy();
      const parsed = JSON.parse(savedProgress!);
      expect(parsed.currentStep).toBe(1);
      expect(screen.getByText('Liquidity Content')).toBeInTheDocument();
    });
  });

  it('validates current step before proceeding', async () => {
    // Ensure desktop view
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    
    const mockValidate = jest.fn().mockResolvedValue({ isValid: false, errors: ['Name is required'] });
    const stepsWithValidation = [
      { ...mockSteps[0], validate: mockValidate },
      ...mockSteps.slice(1)
    ];

    render(
      <WizardContainer
        steps={stepsWithValidation}
        onComplete={mockOnComplete}
      />
    );

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(mockValidate).toHaveBeenCalled();
    });
    
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
    
    // Verify we're still on the same step
    expect(screen.getByText('Token Basics Content')).toBeInTheDocument();
  });

  it('allows jumping to completed steps in accordion view', async () => {
    // Mock window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });
    
    window.dispatchEvent(new Event('resize'));

    render(
      <WizardContainer
        steps={mockSteps}
        onComplete={mockOnComplete}
        completedSteps={[0]}
        initialStep={1}
      />
    );

    // Since we're on mobile, we should be able to click the accordion trigger
    const liquidityTrigger = screen.getAllByRole('button').find(button => 
      button.textContent?.includes('Liquidity Settings')
    );
    
    expect(liquidityTrigger).toBeTruthy();
    
    // The current step (1) should already be expanded and showing its content
    expect(screen.getByText('Liquidity Content')).toBeInTheDocument();
  });

  it('shows step status indicators', () => {
    // Ensure we're testing desktop view
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    
    render(
      <WizardContainer
        steps={mockSteps}
        onComplete={mockOnComplete}
        completedSteps={[0]}
        initialStep={1}
      />
    );

    const completedIcon = screen.getByTestId('step-0-completed');
    const currentIcon = screen.getByTestId('step-1-current');
    const pendingIcon = screen.getByTestId('step-2-pending');

    expect(completedIcon).toBeInTheDocument();
    expect(currentIcon).toBeInTheDocument();
    expect(pendingIcon).toBeInTheDocument();
  });

  it('handles keyboard navigation', async () => {
    render(
      <WizardContainer
        steps={mockSteps}
        onComplete={mockOnComplete}
      />
    );

    fireEvent.keyDown(document, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(screen.getByText('Liquidity Settings')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'ArrowLeft' });

    await waitFor(() => {
      expect(screen.getByText('Token Basics')).toBeInTheDocument();
    });
  });
});