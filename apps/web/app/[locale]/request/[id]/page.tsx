import * as React from 'react';
import { WaitingRoom } from '@/components/waiting-room';

export default async function RequestWaitingRoomPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="py-4">
      <WaitingRoom requestId={id} />
    </div>
  );
}
