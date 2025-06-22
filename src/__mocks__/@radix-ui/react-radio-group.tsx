import React from 'react';

export const Root = React.forwardRef<
  HTMLDivElement,
  React.PropsWithChildren<{
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
    className?: string;
  }>
>(({ children, value, onValueChange, ...props }, ref) => {
  const processChildren = (children: React.ReactNode): React.ReactNode => {
    return React.Children.map(children, child => {
      if (React.isValidElement(child)) {
        if (child.type === Item || child.props['data-slot'] === 'radio-group-item' || child.props.role === 'radio') {
          return React.cloneElement(child as React.ReactElement<any>, {
            'aria-checked': child.props.value === value,
            checked: child.props.value === value,
            onChange: () => onValueChange?.(child.props.value),
            onClick: () => !child.props.disabled && !props.disabled && onValueChange?.(child.props.value),
            disabled: props.disabled || child.props.disabled,
          });
        } else if (child.props.children) {
          // Process nested children (like inside labels)
          return React.cloneElement(child as React.ReactElement<any>, {
            children: processChildren(child.props.children),
          });
        }
      }
      return child;
    });
  };

  return (
    <div ref={ref} role="radiogroup" {...props}>
      {processChildren(children)}
    </div>
  );
});

Root.displayName = 'RadioGroupRoot';

export const Item = React.forwardRef<
  HTMLButtonElement,
  React.PropsWithChildren<{
    value: string;
    id?: string;
    checked?: boolean;
    onChange?: () => void;
    disabled?: boolean;
    className?: string;
  }>
>(({ value, id, checked, onChange, disabled, children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      id={id}
      aria-checked={checked || false}
      onClick={() => !disabled && onChange?.()}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
});

Item.displayName = 'RadioGroupItem';

export const Indicator = React.forwardRef<HTMLSpanElement, React.PropsWithChildren<{ className?: string }>>(
  ({ children, ...props }, ref) => <span ref={ref} {...props}>{children}</span>
);

Indicator.displayName = 'RadioGroupIndicator';