'use client';

import dynamic from 'next/dynamic';
import type { MapViewProps } from './map-view-inner';
import { Skeleton } from '@repo/ui/skeleton';

export type { MapViewProps, MapMarkerItem } from './map-view-inner';

export const MapView = dynamic<MapViewProps>(
  () => import('./map-view-inner').then((mod) => mod.MapViewInner),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[400px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex flex-col items-center justify-center p-6 space-y-3">
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
    ),
  }
);

export default MapView;
