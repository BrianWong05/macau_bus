/**
 * NearbyFitBounds - Auto-fit map bounds for nearby stops view
 */

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { NearbyStop } from '../types';

interface MapBus {
  latitude: number;
  longitude: number;
  busPlate: string;
}

interface NearbyFitBoundsProps {
  center: { lat: number; lon: number } | null;
  stops: NearbyStop[];
  buses: MapBus[];
  expandedStop: string | null;
}

export const NearbyFitBounds: React.FC<NearbyFitBoundsProps> = ({
  center,
  stops,
  buses,
  expandedStop,
}) => {
  const map = useMap();
  const lastExpandedStop = useRef<string | null>(null);
  const hasCentered = useRef(false);

  useEffect(() => {
    if (!map) return;
    const bounds = L.latLngBounds([]);

    // Only zoom if:
    // 1. expandedStop changed (User clicked a new stop)
    // 2. Initial load (User hasn't moved yet)

    const isNewSelection = expandedStop !== lastExpandedStop.current;

    if (expandedStop) {
      // Only zoom on NEW selection, not auto-refresh
      if (isNewSelection) {
        const stop = stops.find((s) => s.code === expandedStop);
        if (stop) {
          bounds.extend([stop.lat, stop.lon]);
          // Include buses if available
          if (buses && buses.length > 0) {
            buses.forEach((b) => {
              if (b.latitude && b.longitude) {
                bounds.extend([b.latitude, b.longitude]);
              }
            });
          }
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
          }
          lastExpandedStop.current = expandedStop;
        }
      }
    } else if (center && stops.length > 0 && !hasCentered.current) {
      // Initial center on user location
      bounds.extend([center.lat, center.lon]);
      stops.forEach((s) => bounds.extend([s.lat, s.lon]));

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
        hasCentered.current = true;
      }
    }
  }, [center, stops, map, expandedStop, buses]);

  return null;
};

export default NearbyFitBounds;
