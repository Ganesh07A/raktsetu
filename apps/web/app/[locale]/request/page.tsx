import * as React from 'react';
import { RequestWizard } from '@/components/request-wizard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Request Blood | RaktKhoj (रक्तखोज)',
  description:
    'Emergency blood discovery and routing — find nearby blood banks with stock or trigger instant WhatsApp notifications to nearby compatible donors.',
};

export default function RequestPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 text-slate-500">
          <div className="animate-pulse">Loading emergency request wizard...</div>
        </div>
      }
    >
      <RequestWizard />
    </React.Suspense>
  );
}

