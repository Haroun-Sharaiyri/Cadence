import React from 'react';
import clsx from 'clsx';

export interface GlassContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'card' | 'bar' | 'floating' | 'subtle';
  interactive?: boolean;
  children: React.ReactNode;
}

export const GlassContainer = React.forwardRef<HTMLDivElement, GlassContainerProps>(
  ({ variant = 'card', interactive = false, className, children, ...props }, ref) => {
    const baseClasses = 'relative transition-all duration-200';

    const variantClasses = {
      card: [
        'bg-[var(--glass-surface-bg)]',
        'backdrop-blur-[24px]',
        'backdrop-saturate-[190%]',
        'border border-[var(--glass-surface-border)]',
        'shadow-[var(--glass-shadow)]',
        'rounded-[16px]',
        'after:content-[""] after:absolute after:inset-0 after:rounded-[16px] after:pointer-events-none',
        'after:shadow-[var(--glass-surface-specular)]',
      ].join(' '),
      bar: [
        'bg-[var(--nav-bar-bg)]',
        'backdrop-blur-[24px]',
        'backdrop-saturate-[190%]',
        'border-b border-[var(--separator)]',
      ].join(' '),
      floating: [
        'bg-[var(--tab-bar-bg)]',
        'backdrop-blur-[28px]',
        'backdrop-saturate-[200%]',
        'border border-[var(--tab-bar-border)]',
        'shadow-[var(--tab-bar-shadow)]',
        'rounded-full',
      ].join(' '),
      subtle: [
        'bg-[var(--secondary-system-grouped-background)]',
        'border border-[var(--separator)]',
        'rounded-[12px]',
      ].join(' '),
    }[variant];

    const interactiveClasses = interactive
      ? 'cursor-pointer active:scale-[0.985] transition-transform select-none'
      : '';

    return (
      <div
        ref={ref}
        className={clsx(baseClasses, variantClasses, interactiveClasses, className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassContainer.displayName = 'GlassContainer';
