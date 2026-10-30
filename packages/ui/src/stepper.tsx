import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from './lib/utils';

export interface StepItem {
  title: string;
  description?: string;
}

export interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  steps: StepItem[];
  currentStep: number; // 1-indexed (1 to steps.length)
  onStepClick?: (step: number) => void;
}

export function Stepper({
  steps,
  currentStep,
  onStepClick,
  className,
  ...props
}: StepperProps) {
  return (
    <nav
      aria-label="Progress"
      className={cn('w-full py-2', className)}
      {...props}
    >
      <ol className="flex items-center justify-between w-full">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isClickable = Boolean(onStepClick && isCompleted);

          return (
            <li
              key={step.title}
              className={cn(
                'relative flex-1 flex flex-col items-center group',
                index !== steps.length - 1 && 'pr-4 sm:pr-8'
              )}
            >
              {/* Connecting line */}
              {index !== steps.length - 1 && (
                <div
                  className="absolute top-4 left-1/2 w-full h-0.5 -z-10"
                  aria-hidden="true"
                >
                  <div
                    className={cn(
                      'h-full transition-colors duration-300',
                      isCompleted ? 'bg-red-600' : 'bg-slate-200'
                    )}
                  />
                </div>
              )}

              <button
                type="button"
                disabled={!isClickable}
                onClick={() => onStepClick?.(stepNumber)}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
                  isCompleted &&
                    'bg-red-600 text-white hover:bg-red-700 cursor-pointer',
                  isCurrent &&
                    'border-2 border-red-600 bg-white text-red-600 ring-2 ring-red-100',
                  !isCompleted &&
                    !isCurrent &&
                    'border-2 border-slate-200 bg-white text-slate-400 cursor-default'
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <span>{stepNumber}</span>
                )}
              </button>

              <div className="mt-2 text-center">
                <span
                  className={cn(
                    'block text-xs font-medium',
                    isCurrent ? 'text-red-600 font-semibold' : isCompleted ? 'text-slate-800' : 'text-slate-400'
                  )}
                >
                  {step.title}
                </span>
                {step.description && (
                  <span className="hidden sm:block text-[10px] text-slate-500">
                    {step.description}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
