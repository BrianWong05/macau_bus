/**
 * RouteStatusBanner - Displays active bus count or warnings
 */

import React from 'react';

interface RouteStatusBannerProps {
  activeBusCount: number;
  hasGPSWeakness: boolean;
}

export const RouteStatusBanner: React.FC<RouteStatusBannerProps> = ({
  activeBusCount,
  hasGPSWeakness,
}) => {
  if (activeBusCount > 0) {
    return (
      <div className="bg-green-50/80 backdrop-blur px-4 py-2 border-b border-green-100 text-xs font-medium text-green-700 flex items-center gap-2 sticky top-0 z-10">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
        {activeBusCount} buses live on route
      </div>
    );
  }

  return (
    <div className="bg-yellow-50/80 backdrop-blur px-4 py-2 border-b border-yellow-100 text-xs font-medium text-yellow-700 sticky top-0 z-10">
      {hasGPSWeakness ? 
        "⚠️ GPS Weak - Tracking by Station" : 
        "connecting to bus network..."}
    </div>
  );
};
