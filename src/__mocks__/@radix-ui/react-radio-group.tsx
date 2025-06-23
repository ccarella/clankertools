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
        const childProps = child.props as Record<string, unknown>;
        if (child.type === Item || childProps['data-slot'] === 'radio-group-item' || childProps.role === 'radio' || 
            (typeof child.type === 'function' && child.type.name === 'RadioGroupItem') || 
            childProps.value !== undefined) {
          const handleClick = (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (!childProps.disabled && !props.disabled) {
              onValueChange?.(childProps.value as string);
            }
          };
          
          return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
            'aria-checked': childProps.value === value,
            checked: childProps.value === value,
            onChange: () => onValueChange?.(childProps.value as string),
            onClick: handleClick,
            disabled: props.disabled || childProps.disabled,
          });
        } else if (childProps.children) {
          // Process nested children (like inside labels)
          return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
            children: processChildren(childProps.children as React.ReactNode),
          });
        }
      }
      return child;
    });
  };

  return (
    <div ref={ref} role="radiogroup" {...props}>
      {processChildren(children) || null}
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
>(({ id, checked, onChange, disabled, children, ...props }, ref) => {
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