import * as React from 'react';
import { cn } from './lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    const isInvalid = error || props['aria-invalid'] === true || props['aria-invalid'] === 'true';

    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
          isInvalid && 'border-red-600 focus-visible:ring-red-600 text-red-950 placeholder:text-red-300',
          className
        )}
        ref={ref}
        aria-invalid={isInvalid ? 'true' : undefined}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';
