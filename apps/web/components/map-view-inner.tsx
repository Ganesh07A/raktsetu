'use client';

import * as React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapMarkerItem {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: 'user' | 'bank' | 'donor';
  address?: string | null;
  phone?: string | null;
  distanceKm?: number;
  stock?: {
    bloodGroup: string;
    componentType: string;
    unitsAvailable: number;
  }[];
  isVerified?: boolean;
}

export interface MapViewProps {
  center: [number, number];
  zoom?: number;
  radiusKm?: number;
  userLocation?: [number, number] | null;
  markers?: MapMarkerItem[];
  className?: string;
  height?: string;
}

// Custom Leaflet DivIcons to avoid missing PNG asset 404s
const createUserLocationIcon = () =>
  L.divIcon({
    className: 'custom-user-marker',
    html: `
      <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 24px; height: 24px; background: rgba(59, 130, 246, 0.35); border-radius: 50%; animation: pulse 2s infinite;"></div>
        <div style="width: 14px; height: 14px; background: #2563eb; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const createBloodBankIcon = (isVerified?: boolean) =>
  L.divIcon({
    className: 'custom-bank-marker',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="width: 32px; height: 32px; background: #dc2626; border: 2px solid #ffffff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 3px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
          <div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
        </div>
        ${
          isVerified
            ? `<div style="position: absolute; top: -4px; right: -4px; width: 12px; height: 12px; background: #16a34a; border: 1.5px solid #ffffff; border-radius: 50%;"></div>`
            : ''
        }
      </div>
    `,
    iconSize: [32, 38],
    iconAnchor: [16, 36],
    popupAnchor: [0, -34],
  });

const createDonorIcon = () =>
  L.divIcon({
    className: 'custom-donor-marker',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;">
        <div style="width: 30px; height: 30px; background: #16a34a; border: 2px solid #ffffff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 3px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
          <div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#ffffff">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </div>
        </div>
      </div>
    `,
    iconSize: [30, 36],
    iconAnchor: [15, 34],
    popupAnchor: [0, -32],
  });

function MapRecenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export function MapViewInner({
  center,
  zoom = 12,
  radiusKm,
  userLocation,
  markers = [],
  className = '',
  height = '400px',
}: MapViewProps) {
  const calculatedZoom = React.useMemo(() => {
    if (zoom) return zoom;
    if (radiusKm && radiusKm <= 5) return 13;
    if (radiusKm && radiusKm <= 10) return 12;
    if (radiusKm && radiusKm <= 50) return 10;
    return 12;
  }, [zoom, radiusKm]);

  const mapCenter = userLocation || center;

  return (
    <div
      className={`relative w-full rounded-xl overflow-hidden border border-slate-200 shadow-xs z-0 ${className}`}
      style={{ height }}
    >
      <MapContainer
        center={mapCenter}
        zoom={calculatedZoom}
        scrollWheelZoom={false}
        className="w-full h-full z-0"
        style={{ minHeight: '100%', minWidth: '100%' }}
      >
        <MapRecenter center={mapCenter} zoom={calculatedZoom} />

        {/* Free, standard OpenStreetMap Raster Tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* User Location Marker */}
        {userLocation && (
          <Marker position={userLocation} icon={createUserLocationIcon()}>
            <Popup>
              <div className="p-1 text-xs">
                <p className="font-bold text-slate-900">Your Location / आपका स्थान</p>
                <p className="text-slate-500 text-[11px]">
                  {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Emergency Search Radius Circle */}
        {radiusKm && radiusKm > 0 && (
          <Circle
            center={mapCenter}
            radius={radiusKm * 1000}
            pathOptions={{
              color: '#dc2626',
              fillColor: '#ef4444',
              fillOpacity: 0.08,
              weight: 2,
              dashArray: '4, 6',
            }}
          />
        )}

        {/* Markers for Blood Banks and Donors */}
        {markers.map((marker) => {
          const icon =
            marker.type === 'donor'
              ? createDonorIcon()
              : marker.type === 'user'
              ? createUserLocationIcon()
              : createBloodBankIcon(marker.isVerified);

          const totalStock = marker.stock?.reduce((acc, s) => acc + s.unitsAvailable, 0) ?? 0;

          return (
            <Marker
              key={marker.id}
              position={[marker.latitude, marker.longitude]}
              icon={icon}
            >
              <Popup>
                <div className="p-1 min-w-[200px] text-xs space-y-1.5">
                  <div className="flex items-start justify-between gap-1">
                    <p className="font-bold text-slate-900 text-sm leading-tight">
                      {marker.name}
                    </p>
                    {marker.isVerified && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.5 rounded-full shrink-0">
                        Verified
                      </span>
                    )}
                  </div>

                  {marker.distanceKm !== undefined && (
                    <p className="text-red-700 font-semibold text-xs">
                      {marker.distanceKm.toFixed(1)} km away
                    </p>
                  )}

                  {marker.address && (
                    <p className="text-slate-600 text-[11px] leading-snug">
                      {marker.address}
                    </p>
                  )}

                  {marker.stock && marker.stock.length > 0 && (
                    <div className="pt-1 border-t border-slate-100">
                      <p className="font-semibold text-slate-800 text-[11px] mb-1">
                        Stock Available ({totalStock} units):
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {marker.stock.map((s, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold"
                          >
                            {s.bloodGroup}: {s.unitsAvailable}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex items-center gap-2">
                    {marker.phone && (
                      <a
                        href={`tel:${marker.phone}`}
                        className="inline-flex items-center justify-center px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold"
                      >
                        Call
                      </a>
                    )}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${marker.latitude},${marker.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold"
                    >
                      Directions
                    </a>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
