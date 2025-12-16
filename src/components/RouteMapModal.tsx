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

      // Import gov_data for stop coordinates
      const govData = await import('@/data/gov_data.json');

      for (const leg of legs) {
        // Parse routeId (e.g., "22_0" -> route "22", direction "0")
        const [routeNo, dir] = leg.routeId.split('_');
        const key = leg.routeId;

        if (!newTrafficData[key]) {
          try {
            const traffic = await fetchTrafficApi(routeNo, dir);
            newTrafficData[key] = traffic || [];
            
            const totalSegments = (traffic || []).length;
            
            // Helper to get stop info with strict priority
            const getStopInfo = (stopId: string) => {
              const normalizedId = stopId.replace('/', '_');
              const baseId = stopId.split('/')[0].split('_')[0];
              
              // 1. Try strict match first
              let match = govData.default.stops.find((s: any) => 
                s.raw?.P_ALIAS === stopId || 
                s.raw?.P_ALIAS === normalizedId
              );
              
              // 2. Try Alias match (specific pole alias might match ALIAS?)
              if (!match) {
                 match = govData.default.stops.find((s: any) => 
                   s.raw?.ALIAS === stopId || 
                   s.raw?.ALIAS === normalizedId
                 );
              }
              
              // 3. Fallback to base ID (fuzzy)
              if (!match) {
                 match = govData.default.stops.find((s: any) => 
                   s.raw?.ALIAS === baseId || 
                   s.raw?.P_ALIAS?.startsWith(baseId + '_')
                 );
              }
              
              return match;
            };
            
            // Helper to find closest segment index for a stop
            const findClosestSegment = (stopId: string) => {
              const stopInfo = getStopInfo(stopId);
              
              if (!stopInfo || !traffic || traffic.length === 0) return -1;
              
              const stopLat = stopInfo.lat;
              const stopLng = stopInfo.lon;
              
              let minDist = Infinity;
              let closestIdx = -1;
              
              traffic.forEach((seg: TrafficSegment, idx: number) => {
                if (seg.path && seg.path.length > 0) {
                  // check all points in segment path to be more accurate
                  for (const point of seg.path) {
                    const dist = Math.abs(point[0] - stopLat) + Math.abs(point[1] - stopLng);
                    if (dist < minDist) {
                      minDist = dist;
                      closestIdx = idx;
                    }
                  }
                }
              });
              
              return closestIdx;
            };

            // Find start and end indices using geometric matching
            const startSegIdx = findClosestSegment(leg.stops[0]);
            const endSegIdx = findClosestSegment(leg.stops[leg.stops.length - 1]);
            
            // Start/End Refinement Heuristic
            // findClosestSegment finds the segment *containing* the closest point.
            // But we want the segment that *starts* at the stop (for correct slicing).
            // Usually if findClosest picks 'Arriving' (Ends at stop), we want Next (Starts at stop).
            // If it picks 'Leaving' (Starts at stop), we want Current.
            // We check dist(seg.start, stop) for current and next to decide.
            
            // Adjusted Heuristic: Head vs Tail Proximity
            // Instead of checking the next segment, we look at the matched segment itself.
            // If the stop is closer to the END of the matched segment, the cut point is AFTER this segment (idx + 1).
            // If the stop is closer to the START of the matched segment, the cut point is BEFORE this segment (idx).
            // This logic works for both Start (Boarding) and End (Alighting) boundaries.
            
            const getAdjustedIndex = (baseIdx: number, stopId: string) => {
               if (baseIdx === -1) return 0;
               
               const s = getStopInfo(stopId);
               if (!s) return baseIdx;
               
               const seg = traffic[baseIdx];
               if (!seg.path || seg.path.length === 0) return baseIdx;
               
               const startPt = seg.path[0];
               const endPt = seg.path[seg.path.length - 1];
               
               const distStart = Math.abs(startPt[0] - s.lat) + Math.abs(startPt[1] - s.lon);
               const distEnd = Math.abs(endPt[0] - s.lat) + Math.abs(endPt[1] - s.lon);
               
               // If closer to End, boundary is baseIdx + 1
               // If closer to Start (or equal), boundary is baseIdx
               return distEnd < distStart ? baseIdx + 1 : baseIdx;
            };

            const startSegIdxRefined = getAdjustedIndex(startSegIdx, leg.stops[0]);
            const endSegIdxRefined = getAdjustedIndex(endSegIdx, leg.stops[leg.stops.length - 1]);
            
            let start = 0;
            let end = totalSegments;
            
            if (startSegIdx !== -1 && endSegIdx !== -1) {
               start = startSegIdxRefined;
               end = endSegIdxRefined;
               
               // Sanity checks
               if (start > end) { 
                 // If inverted, maybe we picked the wrong end of a loop?
                 // Fallback to simple logic or clamp
                 // But trust the heuristic first, maybe just swap if strictly inverted?
                 // Actually, if start > end, it means we calculated Start AFTER End.
                 // This implies overlapping matches or loop. 
                 // Force consistent order:
                 end = Math.max(start + 1, end); 
               }
               
               // Clamp to bounds
               start = Math.max(0, Math.min(start, totalSegments - 1));
               end = Math.max(0, Math.min(end, totalSegments));
               
               console.log(`Route ${routeNo}: Refined [${startSegIdx}->${startSegIdxRefined}, ${endSegIdx}->${endSegIdxRefined}] showing [${start}->${end}]`);
            } else {
              console.log(`Route ${routeNo}: Geometric fallback (s:${startSegIdx} e:${endSegIdx}), showing full route`);
            }
            
            newSegmentIndices[key] = { start, end };
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

          {/* Traffic-colored route polylines - filtered to user's journey */}
          {legs.map((leg, legIdx) => {
            const allTraffic = trafficData[leg.routeId] || [];
            const indices = segmentIndices[leg.routeId];
            
            if (allTraffic.length === 0 || !indices) return null;
            
            // Filter using calculated indices
            const filteredSegments = allTraffic.slice(indices.start, indices.end);
            
            return filteredSegments.map((seg, segIdx) => {
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

          {/* Station markers - filtered match polylines */}
          {legs.map((leg, legIdx) => {
            const allTraffic = trafficData[leg.routeId] || [];
            const indices = segmentIndices[leg.routeId];
            
            if (allTraffic.length === 0 || !indices) return null;
            
            // Use same filtered set
            const filteredSegments = allTraffic.slice(indices.start, indices.end);
            
            return (
              <React.Fragment key={`markers-${legIdx}`}>
                {filteredSegments.map((seg, segIdx) => {
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
                })}
                
                {/* Add final destination marker at the end of the line */}
                {filteredSegments.length > 0 && (() => {
                  const lastSeg = filteredSegments[filteredSegments.length - 1];
                  const lastPoint = lastSeg.path[lastSeg.path.length - 1];
                  const dotIcon = L.divIcon({
                    className: '',
                    html: `<div style="
                      width: 8px;
                      height: 8px;
                      background-color: white;
                      border: 2px solid #14b8a6;
                      border-radius: 50%;
                      box-sizing: content-box;
                    "></div>`,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6] // Center the dot
                  });

                  return (
                    <Marker
                      key={`marker-${legIdx}-end`}
                      position={lastPoint}
                      icon={dotIcon}
                      zIndexOffset={1000} // Force on top of the Blue Pin
                    />
                  );
                })()}
              </React.Fragment>
            );
          })}

          {/* Destination markers - always show if we have coords */}
          {endCoords && (
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
