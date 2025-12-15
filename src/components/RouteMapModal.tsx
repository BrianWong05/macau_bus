import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, useMap } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchTrafficApi } from '@/services/api';
import type { RouteLeg } from '@/services/RouteFinder';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// ============== Icons ==============
const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ============== Types ==============
interface TrafficSegment {
  traffic: number;
  path: [number, number][];
}

interface RouteMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  legs: RouteLeg[];
  startWalk?: { distanceMeters: number; durationMinutes: number };
  endWalk?: { distanceMeters: number; durationMinutes: number };
  startCoords?: { lat: number; lng: number };
  endCoords?: { lat: number; lng: number };
}

// ============== FitBounds Component ==============
const FitBoundsOnLoad: React.FC<{ points: [number, number][] }> = ({ points }) => {
  const map = useMap();
  
  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [points, map]);
  
  return null;
};

// ============== Main Component ==============
export const RouteMapModal: React.FC<RouteMapModalProps> = ({
  isOpen,
  onClose,
  legs,
  startWalk,
  endWalk,
  startCoords,
  endCoords
}) => {
  const { t } = useTranslation();
  const [trafficData, setTrafficData] = useState<Record<string, TrafficSegment[]>>({});
  const [segmentIndices, setSegmentIndices] = useState<Record<string, { start: number; end: number }>>({});
  const [loading, setLoading] = useState(false);

  // Fetch traffic data for all route legs and find correct segment indices
  useEffect(() => {
    if (!isOpen || legs.length === 0) return;

    const fetchAllTraffic = async () => {
      setLoading(true);
      const newTrafficData: Record<string, TrafficSegment[]> = {};
      const newSegmentIndices: Record<string, { start: number; end: number }> = {};

      for (const leg of legs) {
        // Parse routeId (e.g., "22_0" -> route "22", direction "0")
        const [routeNo, dir] = leg.routeId.split('_');
        const key = leg.routeId;

        if (!newTrafficData[key]) {
          try {
            const traffic = await fetchTrafficApi(routeNo, dir);
            newTrafficData[key] = traffic || [];
            
            // Use the leg's fromStopIndex directly - this is the exact position
            // in the full route where the user's journey starts
            const numSegmentsNeeded = leg.stops.length - 1;
            const totalSegments = (traffic || []).length;
            const startIdx = leg.fromStopIndex || 0;
            
            newSegmentIndices[key] = {
              start: startIdx,
              end: Math.min(startIdx + numSegmentsNeeded, totalSegments)
            };
          } catch (e) {
            console.error(`Failed to fetch traffic for ${routeNo}:`, e);
            newTrafficData[key] = [];
            newSegmentIndices[key] = { start: 0, end: 0 };
          }
        }
      }

      setTrafficData(newTrafficData);
      setSegmentIndices(newSegmentIndices);
      setLoading(false);
    };

    fetchAllTraffic();
  }, [isOpen, legs]);

  if (!isOpen) return null;

  // Collect all points for bounds calculation
  const allPoints: [number, number][] = [];
  
  // Add walking start point
  if (startCoords) {
    allPoints.push([startCoords.lat, startCoords.lng]);
  }
  
  // Add route points from traffic data
  Object.values(trafficData).forEach(segments => {
    segments.forEach(seg => {
      if (seg.path) {
        seg.path.forEach(point => allPoints.push(point));
      }
    });
  });
  
  // Add walking end point
  if (endCoords) {
    allPoints.push([endCoords.lat, endCoords.lng]);
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <span className="font-semibold">
            {legs.map(l => l.routeName).join(' → ')}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/20 rounded-full transition-colors"
          aria-label={t('close', 'Close')}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/80 flex items-center justify-center">
            <div className="text-teal-600 font-medium">{t('loading', 'Loading...')}</div>
          </div>
        )}
        
        <MapContainer
          center={[22.1987, 113.5439]}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          {/* Walking path to first stop */}
          {startCoords && startWalk && startWalk.durationMinutes > 0 && legs.length > 0 && (
            <>
              {/* Start marker (user location) */}
              <Marker position={[startCoords.lat, startCoords.lng]}>
                <Popup>{t('route_planner.my_location', 'My Location')}</Popup>
              </Marker>
            </>
          )}

          {/* Traffic-colored route polylines - show full route */}
          {legs.map((leg, legIdx) => {
            const allTraffic = trafficData[leg.routeId] || [];
            
            if (allTraffic.length === 0) return null;
            
            // Show full route for now - partial filtering needs more work
            return allTraffic.map((seg, segIdx) => {
              if (!seg.path || seg.path.length < 2) return null;
              
              const color = seg.traffic === 1 ? '#22c55e' // green
                          : seg.traffic === 2 ? '#f97316' // orange
                          : seg.traffic >= 3 ? '#ef4444' // red
                          : '#14b8a6'; // teal (default)
              
              return (
                <Polyline
                  key={`leg-${legIdx}-seg-${segIdx}`}
                  positions={seg.path}
                  color={color}
                  weight={5}
                  opacity={0.8}
                />
              );
            });
          })}

          {/* Station markers from traffic data */}
          {legs.map((leg, legIdx) => {
            const allTraffic = trafficData[leg.routeId] || [];
            
            if (allTraffic.length === 0) return null;
            
            return allTraffic.map((seg, segIdx) => {
              if (!seg.path || seg.path.length === 0) return null;
              const startPoint = seg.path[0];
              
              const color = seg.traffic === 1 ? '#22c55e'
                          : seg.traffic === 2 ? '#f97316'
                          : seg.traffic >= 3 ? '#ef4444'
                          : '#14b8a6';
              
              return (
                <CircleMarker
                  key={`marker-${legIdx}-${segIdx}`}
                  center={startPoint}
                  radius={5}
                  fillColor="white"
                  color={color}
                  weight={2}
                  fillOpacity={1}
                />
              );
            });
          })}

          {/* Walking path to destination */}
          {endCoords && endWalk && endWalk.durationMinutes > 0 && (
            <Marker position={[endCoords.lat, endCoords.lng]}>
              <Popup>{t('route_result.destination', 'Destination')}</Popup>
            </Marker>
          )}

          {allPoints.length > 0 && <FitBoundsOnLoad points={allPoints} />}
        </MapContainer>
      </div>

      {/* Footer info */}
      <div className="bg-white border-t px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              {t('traffic.smooth', 'Smooth')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-orange-500" />
              {t('traffic.moderate', 'Moderate')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              {t('traffic.congested', 'Congested')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteMapModal;
