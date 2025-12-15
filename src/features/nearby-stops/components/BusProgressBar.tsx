/**
 * BusProgressBar - Visual progress bar showing traffic-colored segments for bus arrival
 */

import React from 'react';

interface BusProgressBarProps {
  trafficSegments: number[];
  isDeparted?: boolean; // When true, flash the first segment to indicate bus is in transit
}

const getSegmentColor = (traffic: number): string => {
  if (traffic >= 3) return 'bg-red-500';
  if (traffic >= 2) return 'bg-yellow-400';
  return 'bg-green-500';
};

export const BusProgressBar: React.FC<BusProgressBarProps> = ({ trafficSegments, isDeparted = false }) => {
  if (!trafficSegments || trafficSegments.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      {/* Bus icon (current position) */}
      <span className="text-[10px]" title="Bus position">🚌</span>
      
      {/* Traffic segments */}
      <div className="flex-1 flex gap-0.5 h-1.5 rounded overflow-hidden">
        {trafficSegments.map((traffic, idx) => (
          <div 
            key={idx} 
            className={`flex-1 ${getSegmentColor(traffic)} first:rounded-l last:rounded-r ${
              idx === 0 && isDeparted ? 'animate-bus-flash' : ''
            }`}
            title={`Segment ${idx + 1}: Traffic level ${traffic}`}
          />
        ))}
      </div>
      
      {/* Pin icon (selected stop) */}
      <span className="text-[10px]" title="Your stop">📍</span>
    </div>
  );
};
