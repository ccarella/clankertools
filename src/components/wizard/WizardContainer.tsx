"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Circle, CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WizardContainerProps, WizardState, ValidationResult, WizardData } from './types';

export function WizardContainer({
  steps,
  onComplete,
  onStepChange,
  initialStep = 0,
  completedSteps: initialCompletedSteps = [],
  persistKey,
  className,
  reviewComponent,
}: WizardContainerProps) {
  const [state, setState] = useState<WizardState>(() => {
    if (persistKey && typeof window !== 'undefined') {
      const saved = localStorage.getItem(persistKey);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse saved wizard state:', e);
        }
      }
    }
    return {
      currentStep: initialStep,
      completedSteps: initialCompletedSteps,
      data: {} as WizardData,
      errors: {},
    };
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (persistKey && typeof window !== 'undefined') {
      localStorage.setItem(persistKey, JSON.stringify(state));
    }
  }, [state, persistKey]);

  const currentStepConfig = steps[state.currentStep];
  const progressPercentage = Math.round(((state.currentStep + 1) / steps.length) * 100);
  const canGoBack = state.currentStep > 0;
  const canGoNext = state.currentStep < steps.length - 1;
  const isLastStep = state.currentStep === steps.length - 1;

  useEffect(() => {
    onStepChange?.(state.currentStep);
  }, [state.currentStep, onStepChange]);

  const validateStep = useCallback(async (): Promise<boolean> => {
    if (!currentStepConfig.validate) return true;

    const result: ValidationResult = await currentStepConfig.validate(state.data);
    
    if (!result.isValid) {
      setValidationErrors(result.errors || []);
      if (result.fieldErrors) {
        setState(prev => ({
          ...prev,
          errors: { ...prev.errors, ...result.fieldErrors },
        }));
      }
      return false;
    }

    return true;
  }, [currentStepConfig, state.data]);

  const handleNext = useCallback(async () => {
    if (!canGoNext) return;

    const isValid = await validateStep();
    if (!isValid) return;

    setState(prev => ({
      ...prev,
      currentStep: prev.currentStep + 1,
      completedSteps: [...new Set([...prev.completedSteps, prev.currentStep])],
      errors: {},
    }));
    setValidationErrors([]);
  }, [canGoNext, validateStep]);

  const handleBack = useCallback(() => {
    if (!canGoBack) return;

    setState(prev => ({
      ...prev,
      currentStep: prev.currentStep - 1,
      errors: {},
    }));
    setValidationErrors([]);
  }, [canGoBack]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && canGoNext) {
        handleNext();
      } else if (e.key === 'ArrowLeft' && canGoBack) {
        handleBack();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canGoNext, canGoBack, handleNext, handleBack]);

  const handleDataChange = useCallback((field: string, value: unknown) => {
    setState(prev => ({
      ...prev,
      data: { ...prev.data, [field]: value },
      errors: { ...prev.errors, [field]: '' },
    }));
    setValidationErrors([]);
  }, []);

  const handleStepClick = (stepIndex: number) => {
    if (stepIndex <= Math.max(...state.completedSteps, state.currentStep)) {
      setState(prev => ({
        ...prev,
        currentStep: stepIndex,
        errors: {},
      }));
      setValidationErrors([]);
    }
  };

  const handleComplete = async () => {
    const isValid = await validateStep();
    if (!isValid) return;

    if (reviewComponent) {
      setIsReviewing(true);
    } else {
      await onComplete(state.data);
    }
  };

  const handleEditFromReview = (stepIndex: number) => {
    setIsReviewing(false);
    setState(prev => ({
      ...prev,
      currentStep: stepIndex,
    }));
  };

  const getStepStatus = (index: number) => {
    if (state.completedSteps.includes(index)) return 'completed';
    if (index === state.currentStep) return 'current';
    return 'pending';
  };

  const StepComponent = currentStepConfig.component;

  const renderDesktopView = () => (
    <div className={cn('max-w-4xl mx-auto p-6', className)}>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">The Works</h1>
          <span className="text-sm text-muted-foreground">
            Step {state.currentStep + 1} of {steps.length}
          </span>
        </div>
        <Progress value={progressPercentage} className="h-2" aria-valuenow={progressPercentage} />
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto">
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          return (
            <button
              key={step.id}
              onClick={() => handleStepClick(index)}
              disabled={index > Math.max(...state.completedSteps, state.currentStep)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap',
                status === 'completed' && 'bg-primary/10 text-primary hover:bg-primary/20',
                status === 'current' && 'bg-primary text-primary-foreground',
                status === 'pending' && 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              {status === 'completed' && <CheckCircle2 className="w-4 h-4" data-testid={`step-${index}-completed`} />}
              {status === 'current' && <CircleDot className="w-4 h-4" data-testid={`step-${index}-current`} />}
              {status === 'pending' && <Circle className="w-4 h-4" data-testid={`step-${index}-pending`} />}
              <span className="text-sm font-medium">{step.title}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{currentStepConfig.title}</CardTitle>
          {currentStepConfig.description && (
            <CardDescription>{currentStepConfig.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {validationErrors.length > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          
          <StepComponent
            data={state.data}
            onChange={handleDataChange}
            errors={state.errors}
            isActive={true}
          />
        </CardContent>
      </Card>

      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={!canGoBack}
        >
          Back
        </Button>
        
        {isLastStep ? (
          <Button onClick={handleComplete}>Review</Button>
        ) : (
          <Button onClick={handleNext}>Next</Button>
        )}
      </div>
    </div>
  );

  const renderMobileView = () => (
    <div className={cn('p-4', className)}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">The Works</h1>
        <Progress value={progressPercentage} className="h-2" />
        <p className="text-sm text-muted-foreground mt-2">
          {state.completedSteps.length} of {steps.length} sections completed
        </p>
      </div>

      {validationErrors.length > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            <ul className="list-disc pl-4">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Accordion
        type="single"
        value={currentStepConfig.id}
        onValueChange={(value) => {
          const index = steps.findIndex(s => s.id === value);
          if (index >= 0) handleStepClick(index);
        }}
      >
        {steps.map((step, index) => {
          const status = getStepStatus(index);
          const isAccessible = index <= Math.max(...state.completedSteps, state.currentStep);
          const StepComp = step.component;

          return (
            <AccordionItem key={step.id} value={step.id} disabled={!isAccessible}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  {status === 'completed' && <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />}
                  {status === 'current' && <CircleDot className="w-5 h-5 text-primary flex-shrink-0" />}
                  {status === 'pending' && <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
                  <div>
                    <div className="font-medium">{step.title}</div>
                    {status === 'completed' && (
                      <div className="text-xs text-primary">Complete</div>
                    )}
                    {step.description && (
                      <div className="text-xs text-muted-foreground mt-1">{step.description}</div>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-4">
                  <StepComp
                    data={state.data}
                    onChange={handleDataChange}
                    errors={state.errors}
                    isActive={index === state.currentStep}
                  />
                  
                  {index === state.currentStep && (
                    <div className="flex gap-2 mt-6">
                      {canGoBack && (
                        <Button variant="outline" onClick={handleBack} className="flex-1">
                          Back
                        </Button>
                      )}
                      {isLastStep ? (
                        <Button onClick={handleComplete} className="flex-1">
                          Review & Deploy
                        </Button>
                      ) : (
                        <Button onClick={handleNext} className="flex-1">
                          Continue
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );

  if (isReviewing && reviewComponent) {
    const ReviewComponent = reviewComponent;
    return (
      <div role="region" aria-label="Token configuration review">
        <ReviewComponent 
          data={state.data} 
          onEdit={handleEditFromReview}
        />
      </div>
    );
  }

  return (
    <div role="region" aria-label="Token configuration wizard">
      {isMobile ? renderMobileView() : renderDesktopView()}
    </div>
  );
}