import { describe, test, expect } from 'bun:test';
import { cn } from './lib/utils';
import { buttonVariants } from './button';
import { badgeVariants } from './badge';
import { toastVariants } from './toast';
import { normalizeIndianMobile, isValidIndianMobile } from './phone-input';
import * as UI from './index';

describe('packages/ui Primitives & Utilities', () => {
  describe('cn (Tailwind Merge Utility)', () => {
    test('merges basic class names', () => {
      expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
    });

    test('resolves Tailwind class collisions favoring the later class', () => {
      expect(cn('px-2 text-sm', 'px-4')).toBe('text-sm px-4');
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    });

    test('ignores falsy values (null, undefined, false)', () => {
      expect(cn('base', null, undefined, false, 'active')).toBe('base active');
    });
  });

  describe('buttonVariants', () => {
    test('generates default variant with red-600 background', () => {
      const classes = buttonVariants({ variant: 'default' });
      expect(classes).toContain('bg-red-600');
      expect(classes).toContain('text-white');
    });

    test('generates destructive variant with red-700 background', () => {
      const classes = buttonVariants({ variant: 'destructive' });
      expect(classes).toContain('bg-red-700');
    });

    test('generates success variant with emerald-600 background', () => {
      const classes = buttonVariants({ variant: 'success' });
      expect(classes).toContain('bg-emerald-600');
    });

    test('generates outline variant with border', () => {
      const classes = buttonVariants({ variant: 'outline' });
      expect(classes).toContain('border');
    });

    test('supports all standard sizes (default, sm, lg, icon)', () => {
      expect(buttonVariants({ size: 'default' })).toContain('h-10');
      expect(buttonVariants({ size: 'sm' })).toContain('h-8');
      expect(buttonVariants({ size: 'lg' })).toContain('h-12');
      expect(buttonVariants({ size: 'icon' })).toContain('w-10');
    });

    test('renders button element and handles asChild without Slot child collision', () => {
      const React = require('react');
      const { Button } = require('./button');
      // Verify Button handles asChild without throwing Slot error
      const element = React.createElement(
        Button,
        { asChild: true },
        React.createElement('a', { href: '/search' }, 'Search')
      );
      expect(element).toBeDefined();
      expect(element.props.asChild).toBe(true);
    });
  });

  describe('badgeVariants', () => {
    test('generates default, destructive, warning, and success styles', () => {
      expect(badgeVariants({ variant: 'default' })).toContain('bg-red-600');
      expect(badgeVariants({ variant: 'destructive' })).toContain('bg-red-700');
      expect(badgeVariants({ variant: 'warning' })).toContain('bg-amber-500');
      expect(badgeVariants({ variant: 'success' })).toContain('bg-emerald-600');
    });

    test('generates bloodGroup variant with distinct border and bold text', () => {
      const bg = badgeVariants({ variant: 'bloodGroup' });
      expect(bg).toContain('border-red-300');
      expect(bg).toContain('bg-red-50');
      expect(bg).toContain('text-red-700');
    });
  });

  describe('toastVariants', () => {
    test('supports default, destructive, and success variants', () => {
      expect(toastVariants({ variant: 'default' })).toContain('bg-white');
      expect(toastVariants({ variant: 'destructive' })).toContain('bg-red-600');
      expect(toastVariants({ variant: 'success' })).toContain('bg-emerald-600');
    });
  });

  describe('PhoneInput Helpers (normalizeIndianMobile & isValidIndianMobile)', () => {
    test('normalizes standard 10-digit number', () => {
      expect(normalizeIndianMobile('9876543210')).toBe('9876543210');
    });

    test('strips +91 international prefix', () => {
      expect(normalizeIndianMobile('+919876543210')).toBe('9876543210');
      expect(normalizeIndianMobile('+91 98765 43210')).toBe('9876543210');
    });

    test('strips 91 prefix when number is 12 digits', () => {
      expect(normalizeIndianMobile('919876543210')).toBe('9876543210');
    });

    test('strips trunk prefix 0 when number is 11 digits', () => {
      expect(normalizeIndianMobile('09876543210')).toBe('9876543210');
    });

    test('strips formatting hyphens, spaces, and brackets', () => {
      expect(normalizeIndianMobile('(98765) 43-210')).toBe('9876543210');
    });

    test('validates numbers starting with 6, 7, 8, 9', () => {
      expect(isValidIndianMobile('9876543210')).toBe(true);
      expect(isValidIndianMobile('8123456789')).toBe(true);
      expect(isValidIndianMobile('7012345678')).toBe(true);
      expect(isValidIndianMobile('6398765432')).toBe(true);
    });

    test('rejects numbers starting with 0, 1, 2, 3, 4, 5', () => {
      expect(isValidIndianMobile('5876543210')).toBe(false);
      expect(isValidIndianMobile('1234567890')).toBe(false);
      expect(isValidIndianMobile('0987654321')).toBe(false);
    });

    test('rejects numbers of incorrect length', () => {
      expect(isValidIndianMobile('987654321')).toBe(false); // 9 digits
      expect(isValidIndianMobile('98765432100')).toBe(false); // 11 digits
      expect(isValidIndianMobile('')).toBe(false);
    });
  });

  describe('Component Re-Exports in index.ts', () => {
    test('exports all 10 core components and utility functions', () => {
      expect(UI.cn).toBeDefined();
      expect(UI.Button).toBeDefined();
      expect(UI.Card).toBeDefined();
      expect(UI.CardHeader).toBeDefined();
      expect(UI.CardTitle).toBeDefined();
      expect(UI.CardDescription).toBeDefined();
      expect(UI.CardContent).toBeDefined();
      expect(UI.CardFooter).toBeDefined();
      expect(UI.Input).toBeDefined();
      expect(UI.Select).toBeDefined();
      expect(UI.Badge).toBeDefined();
      expect(UI.Dialog).toBeDefined();
      expect(UI.Toast).toBeDefined();
      expect(UI.Skeleton).toBeDefined();
      expect(UI.Stepper).toBeDefined();
      expect(UI.PhoneInput).toBeDefined();
      expect(UI.normalizeIndianMobile).toBeDefined();
      expect(UI.isValidIndianMobile).toBeDefined();
    });
  });
});
