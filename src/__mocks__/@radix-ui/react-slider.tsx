import React from 'react';

export const Root = React.forwardRef<
  HTMLDivElement,
  React.PropsWithChildren<{
    value?: number[];
    onValueChange?: (value: number[]) => void;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    className?: string;
    'aria-label'?: string;
  }>
>(({ children, value, onValueChange, min = 0, max = 100, ...props }, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    if (onValueChange) {
      onValueChange([newValue]);
    }
  };

  return (
    <div ref={ref} {...props}>
      <input
        type="range"
        role="slider"
        value={value?.[0] || min}
        onChange={handleChange}
        min={min}
        max={max}
        disabled={props.disabled}
        aria-label={props['aria-label']}
      />
      {children}
    </div>
  );
});

Root.displayName = 'SliderRoot';

export const Track = React.forwardRef<HTMLDivElement, React.PropsWithChildren<{ className?: string }>>(
  ({ children, ...props }, ref) => <div ref={ref} {...props}>{children}</div>
);

Track.displayName = 'SliderTrack';

export const Range = React.forwardRef<HTMLDivElement, { className?: string }>(
  (props, ref) => <div ref={ref} {...props} />
);

Range.displayName = 'SliderRange';

export const Thumb = React.forwardRef<HTMLDivElement, { className?: string }>(
  (props, ref) => <div ref={ref} {...props} />
);

Thumb.displayName = 'SliderThumb';