/**
 * RouteEtaCard - Displays ETA information for a single bus route
 */

import React from 'react';

interface BusInfo {
  plate: string;
  stopsAway: number;
  eta: number;
  distanceM: number;
  currentStop: string;
}

interface RouteEtaInfo {
  buses: BusInfo[];
  destination: string;
  status: 'active' | 'arriving' | 'no-service' | 'no-approaching';
  minStops: number;
  minEta: number;
  totalStops: number;
  direction?: string;
}

interface RouteEtaCardProps {
  route: string;
  info: RouteEtaInfo;
  onSelect: () => void;
}

// Color coding based on ETA
const getEtaTextColor = (eta: number): string => {
  if (eta <= 3) return 'text-green-600';
  if (eta <= 10) return 'text-yellow-600';
  return 'text-orange-600';
};

export const RouteEtaCard: React.FC<RouteEtaCardProps> = ({ route, info, onSelect }) => {
  const { buses, destination, status } = info;

  return (
    <div
      className="bg-white rounded-lg border overflow-hidden cursor-pointer hover:border-teal-300 hover:shadow-md transition"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Header: Route + Destination */}
      <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xl text-teal-600">{route}</span>
          {destination && (
            <span className="text-xs text-gray-500">→ {destination}</span>
          )}
        </div>
        {status === 'arriving' && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold animate-pulse">
            Arriving
          </span>
        )}
      </div>

      {/* Bus List */}
      <div className="p-3">
        {status === 'no-service' && (
          <div className="text-gray-400 text-xs">No active service</div>
        )}
        {status === 'no-approaching' && (
          <div className="text-gray-400 text-xs">No approaching buses</div>
        )}
        {status === 'arriving' && (
          <div className="flex items-center gap-2 text-green-600">
            <span className="text-lg">🚌</span>
            <span className="font-semibold">At station / Arriving now</span>
          </div>
        )}
        {status === 'active' && buses && buses.length > 0 && (
          <div className="space-y-2">
            {buses.map((bus, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-gray-50 rounded-lg p-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🚌</span>
                  <div>
                    <div className="text-[10px] text-gray-400 font-mono">
                      <span className="font-bold text-gray-600">{bus.plate}</span>
                      <span className="mx-1">•</span>
                      <span>@ {bus.currentStop}</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      {bus.stopsAway} {bus.stopsAway === 1 ? 'stop' : 'stops'} •{' '}
                      {bus.distanceM > 0
                        ? `${(bus.distanceM / 1000).toFixed(1)}km`
                        : '< 0.1km'}
                    </div>
                  </div>
                </div>
                <div className={`text-lg font-bold ${getEtaTextColor(bus.eta)}`}>
                  {bus.eta === 0 ? '<1' : bus.eta}
                  <span className="text-xs font-normal ml-0.5">min</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RouteEtaCard;
