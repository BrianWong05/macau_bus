import React from 'react';
import { Polyline } from 'react-leaflet';
import type { RouteLeg } from '@/services/RouteFinder';
import type { TrafficSegment } from '@/types/mapTypes';

interface RoutePathLayerProps {
  legs: RouteLeg[];
  trafficData: Record<string, TrafficSegment[]>;
  segmentIndices: Record<string, { start: number; end: number }>;
}

export const RoutePathLayer: React.FC<RoutePathLayerProps> = ({ legs, trafficData, segmentIndices }) => {
  return (
    <>
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
    </>
  );
};
