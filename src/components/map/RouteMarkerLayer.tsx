import React from 'react';
import { Marker, CircleMarker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';
import type { RouteLeg } from '@/services/RouteFinder';
import type { TrafficSegment } from '@/types/mapTypes';
import { getStopInfo } from '@/utils/stopUtils';

interface RouteMarkerLayerProps {
  legs: RouteLeg[];
  trafficData: Record<string, TrafficSegment[]>;
  segmentIndices: Record<string, { start: number; end: number }>;
  endCoords?: { lat: number; lng: number };
}

export const RouteMarkerLayer: React.FC<RouteMarkerLayerProps> = ({ legs, trafficData, segmentIndices, endCoords }) => {
  const { t } = useTranslation();

  return (
    <>
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
              const isTransfer = legIdx < legs.length - 1;
              const borderColor = isTransfer ? '#f97316' : '#14b8a6'; // Orange for transfer, Teal for dest
              
              const dotIcon = L.divIcon({
                className: '',
                html: `<div style="
                  width: 8px;
                  height: 8px;
                  background-color: white;
                  border: 2px solid ${borderColor};
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

            {/* Transfer UI: If not the last leg, show transfer info */}
            {legIdx < legs.length - 1 && (() => {
              const currentLegEndStop = leg.stops[leg.stops.length - 1];
              const nextLegStartStop = legs[legIdx + 1].stops[0];
              
              // Get coordinates
              const endInfo = getStopInfo(currentLegEndStop);
              const startInfo = getStopInfo(nextLegStartStop);
              
              if (!endInfo || !startInfo) return null;
              
              const endPos: [number, number] = [endInfo.lat, endInfo.lon];
              const startPos: [number, number] = [startInfo.lat, startInfo.lon];
              
              // Check if walking is needed (different stops)
              const isWalking = currentLegEndStop !== nextLegStartStop;
              
              return (
                <React.Fragment key={`transfer-${legIdx}`}>
                  {/* Transfer Marker at Alight Stop */}
                  <Marker 
                    position={endPos}
                    icon={L.divIcon({
                      className: '',
                      html: `<div style="
                        background-color: white;
                        border: 2px solid #f97316;
                        border-radius: 4px;
                        padding: 2px 4px;
                        font-size: 10px;
                        font-weight: bold;
                        color: #f97316;
                        white-space: nowrap;
                        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                        transform: translate(-50%, -50%);
                      ">${t('route_result.transfer', 'Transfer')}</div>`,
                      iconSize: [40, 20],
                      iconAnchor: [20, 10]
                    })}
                    zIndexOffset={900}
                  />
                  
                  {/* Walking Path if needed */}
                  {isWalking && (
                    <Polyline
                      positions={[endPos, startPos]}
                      pathOptions={{
                        color: '#f97316', // Orange for transfer walk
                        dashArray: '5, 8',
                        weight: 3,
                        opacity: 0.8
                      }}
                    />
                  )}
                </React.Fragment>
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
    </>
  );
};
