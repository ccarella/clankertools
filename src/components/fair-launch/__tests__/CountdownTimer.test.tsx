import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CountdownTimer } from '../CountdownTimer';

describe('CountdownTimer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should render countdown timer with correct initial values', () => {
    const targetDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    
    render(<CountdownTimer targetDate={targetDate} />);
    
    // The countdown should show approximately 24 hours
    const hoursElement = screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'span' && /^\d+h$/.test(content);
    });
    expect(hoursElement).toBeInTheDocument();
  });

  it('should update countdown every second', () => {
    const targetDate = new Date(Date.now() + 60 * 1000); // 60 seconds from now
    
    render(<CountdownTimer targetDate={targetDate} />);
    
    // Should show 0h 0m 59s (or 60s initially)
    expect(screen.getByText((content) => content.includes('0h'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('s'))).toBeInTheDocument();
    
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    
    // After 1 second, should show different seconds
    const secondsElement = screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'span' && /^\d+s$/.test(content) && content !== '60s';
    });
    expect(secondsElement).toBeInTheDocument();
  });

  it('should show "Launch Started!" when countdown reaches zero', () => {
    const targetDate = new Date(Date.now() - 1000); // 1 second ago
    
    render(<CountdownTimer targetDate={targetDate} />);
    
    expect(screen.getByText(/Launch Started!/)).toBeInTheDocument();
  });

  it('should call onComplete callback when countdown finishes', () => {
    const onComplete = jest.fn();
    const targetDate = new Date(Date.now() + 1000); // 1 second from now
    
    render(<CountdownTimer targetDate={targetDate} onComplete={onComplete} />);
    
    expect(onComplete).not.toHaveBeenCalled();
    
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('should apply custom className', () => {
    const targetDate = new Date(Date.now() + 60 * 1000);
    
    const { container } = render(
      <CountdownTimer targetDate={targetDate} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should clean up interval on unmount', () => {
    const targetDate = new Date(Date.now() + 60 * 1000);
    
    const { unmount } = render(<CountdownTimer targetDate={targetDate} />);
    
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    
    unmount();
    
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});