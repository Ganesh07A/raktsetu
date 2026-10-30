import * as React from 'react';
import { RequestWizard } from '@/components/request-wizard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search & Request Blood | RaktKhoj (रक्तखोज)',
  description:
    'Mobile-centric emergency blood discovery — search nearby blood banks with stock or trigger instant WhatsApp notifications to nearby compatible donors.',
};

export default function SearchPage() {
  return <RequestWizard />;
}
