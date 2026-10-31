import * as React from 'react';
import { WaitingRoom } from '@/components/waiting-room';

export default async function RequestWaitingRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ closeToken?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  return (
    <div className="py-4">
      <WaitingRoom requestId={id} requestCloseToken={query.closeToken || null} />
    </div>
  );
}
