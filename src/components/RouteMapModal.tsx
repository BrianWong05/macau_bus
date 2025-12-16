import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchTrafficApi } from '@/services/api';
import type { RouteLeg } from '@/services/RouteFinder';
import { CloseIcon } from '@/components/Icons';
import { getStopInfo } from '@/utils/stopUtils';
import type { TrafficSegment } from '@/types/mapTypes';
import { FitBoundsOnLoad } from '@/components/map/FitBoundsOnLoad';
import { RoutePathLayer } from '@/components/map/RoutePathLayer';
import { RouteMarkerLayer } from '@/components/map/RouteMarkerLayer';

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

// ============== Types ==============
interface RouteMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  legs: RouteLeg[];
  startWalk?: { distanceMeters: number; durationMinutes: number };
  endWalk?: { distanceMeters: number; durationMinutes: number };
  startCoords?: { lat: number; lng: number };
  endCoords?: { lat: number; lng: number };
}

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

  // Fetch traffic data for all route legs and find correct segment indices
  useEffect(() => {
    if (!isOpen || legs.length === 0) return;

    const fetchAllTraffic = async () => {
      setLoading(true);
      const newTrafficData: Record<string, any[]> = {};
      const newSegmentIndices: Record<string, { start: number; end: number }> = {};
      
      for (const leg of legs) {
        const routeNo = leg.routeName;
        const direction = leg.direction;
        const key = leg.routeId;

        try {
            // Fetch traffic data
            const traffic = await fetchTrafficApi(routeNo, direction);
            newTrafficData[key] = traffic || [];
            
            const totalSegments = (traffic || []).length;
            
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
          <RoutePathLayer 
            legs={legs}
            trafficData={trafficData}
            segmentIndices={segmentIndices}
          />

          {/* Station markers, destination dots, and transfer indicators */}
          <RouteMarkerLayer 
            legs={legs}
            trafficData={trafficData}
            segmentIndices={segmentIndices}
            endCoords={endCoords}
          />

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
