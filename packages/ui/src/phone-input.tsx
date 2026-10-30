import * as React from 'react';
import { Check, Phone } from 'lucide-react';
import { cn } from './lib/utils';

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value?: string;
  onChange?: (value: string) => void;
  error?: boolean;
}

/**
 * Normalizes input string to extract pure 10-digit Indian mobile number
 */
export function normalizeIndianMobile(raw: string): string {
  // Strip whitespace, hyphens, parentheses
  let cleaned = raw.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('91') && cleaned.length > 10) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('0') && cleaned.length > 10) {
    cleaned = cleaned.slice(1);
  }
  return cleaned.replace(/\D/g, '').slice(0, 10);
}

export function isValidIndianMobile(number: string): boolean {
  return /^[6-9]\d{9}$/.test(number);
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value, onChange, error, disabled, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(
      value ? normalizeIndianMobile(value) : ''
    );

    React.useEffect(() => {
      if (value !== undefined) {
        setInternalValue(normalizeIndianMobile(value));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const normalized = normalizeIndianMobile(e.target.value);
      setInternalValue(normalized);
      onChange?.(normalized);
    };

    const isValid = isValidIndianMobile(internalValue);
    const hasValue = internalValue.length > 0;
    const isError = error || (hasValue && internalValue.length === 10 && !isValid);

    return (
      <div className="relative flex w-full items-center">
        {/* +91 Indian Flag / Code Badge */}
        <div className="absolute left-0 top-0 bottom-0 flex items-center justify-center rounded-l-md border-r border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700 select-none">
          <span className="mr-1.5 text-base" aria-hidden="true">🇮🇳</span>
          <span>+91</span>
        </div>

        {/* 10-digit phone number input */}
        <input
          ref={ref}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          value={internalValue}
          onChange={handleChange}
          disabled={disabled}
          placeholder="98765 43210"
          className={cn(
            'flex h-10 w-full rounded-md border border-slate-300 bg-white pl-22 pr-10 py-2 text-sm text-slate-900 ring-offset-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
            isError && 'border-red-600 focus-visible:ring-red-600 text-red-950',
            isValid && 'border-emerald-500 focus-visible:ring-emerald-500',
            className
          )}
          aria-invalid={isError ? 'true' : undefined}
          {...props}
        />

        {/* Validation Status Icon */}
        <div className="absolute right-3 flex items-center pointer-events-none">
          {isValid ? (
            <Check className="h-4 w-4 text-emerald-600" aria-label="Valid phone number" />
          ) : (
            <Phone className="h-4 w-4 text-slate-400" aria-hidden="true" />
          )}
        </div>
      </div>
    );
  }
);
PhoneInput.displayName = 'PhoneInput';
