'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { Link } from '../../src/routing';
import { Droplet } from 'lucide-react';

export function DonorNavButton() {
  const [isDonor, setIsDonor] = React.useState(false);
  const locale = useLocale();

  React.useEffect(() => {
    try {
      const token = localStorage.getItem('raktkhoj_donor_token');
      const id = localStorage.getItem('raktkhoj_donor_id');
      if (token && id) {
        setIsDonor(true);
      }
    } catch {
      // In private browsing or restricted environments
      setIsDonor(false);
    }
  }, []);

  if (!isDonor) return null;

  return (
    <Link
      href="/donor/dashboard"
      className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-red-600 transition-colors px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-red-300 shadow-xs"
    >
      <Droplet className="h-3.5 w-3.5 text-red-600 fill-current" />
      <span>{locale === 'hi' ? 'दाता डैशबोर्ड' : 'Donor Dashboard'}</span>
    </Link>
  );
}
