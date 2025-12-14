import React from 'react';
import { formatDistance } from '../../../utils/distance';
import { getEtaTextColor } from '../../../utils/etaColors';
import { NearbyStop, ArrivalData } from '../types';

interface NearbyStopsListProps {
  nearbyStops: NearbyStop[];
  expandedStop: string | null;
  arrivalData: ArrivalData;
  loadingArrivals: Record<string, boolean>;
  lastUpdated: Date | null;
  permissionDenied: boolean;
  onExpandStop: (stop: NearbyStop) => void;
  onSelectRoute: (route: string, stopCode: string, dir: string | null) => void;
  onClose: () => void;
}

export const NearbyStopsList: React.FC<NearbyStopsListProps> = ({
  nearbyStops,
  expandedStop,
  arrivalData,
  loadingArrivals,
  lastUpdated,
  permissionDenied,
  onExpandStop,
  onSelectRoute,
  onClose,
}) => {
  if (permissionDenied) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-gray-500">
        <div className="text-4xl mb-2">🚫</div>
        <p>Location access denied.</p>
        <p className="text-xs mt-1">Enable location to see nearby stops.</p>
      </div>
    );
  }

  if (nearbyStops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-gray-400">
        <div className="text-3xl mb-2">🚏</div>
        <div>No stops found nearby.</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {nearbyStops.map((stop, index) => (
        <div 
          key={stop.raw?.POLE_ID || `${stop.code}-${index}`} 
          className={`border rounded-xl shadow-sm transition-all bg-white overflow-hidden ${expandedStop === stop.code ? 'ring-2 ring-teal-500 shadow-md' : 'hover:shadow-md border-gray-100'}`}
        >
          {/* Stop Header */}
          <div className="p-4 flex justify-between items-start cursor-pointer" onClick={() => onExpandStop(stop)}>
            <div>
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                {stop.name}
                {expandedStop === stop.code 
                  ? <span className="text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">Open</span> 
                  : <span className="text-xs text-gray-400">▼</span>
                }
              </h3>
              <div className="text-xs text-gray-400 font-mono">{stop.code}</div>
            </div>
            <div className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
              <span>📍</span> {formatDistance(stop.distance)}
            </div>
          </div>
          
          {/* Collapsed: Route Tags */}
          {expandedStop !== stop.code && (
            <div className="px-4 pb-4 flex flex-wrap gap-2">
              {stop.routes && stop.routes.map(route => (
                <span key={route} className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">{route}</span>
              ))}
            </div>
          )}

          {/* Expanded: Route ETAs */}
          {expandedStop === stop.code && (
            <div className="bg-gray-50 border-t p-3 text-sm">
              {lastUpdated && (
                <div className="text-[10px] text-gray-400 text-right mb-2">
                  Updated: {lastUpdated.toLocaleTimeString()}
                </div>
              )}
              
              {loadingArrivals[stop.code] ? (
                <div className="text-gray-500 flex items-center justify-center py-2">Loading live data...</div>
              ) : (
                <div className="space-y-2">
                  {stop.routes.map(route => {
                    const info = arrivalData[stop.code]?.[route];
                    const isRichInfo = info && typeof info === 'object';
                    
                    // Fallback for legacy string format
                    if (!isRichInfo) {
                      const strInfo = info || "---";
                      const active = typeof strInfo === 'string' && (strInfo.includes("stops") || strInfo.includes("Arriving"));
                      return (
                        <div 
                          key={route} 
                          className="bg-white p-3 rounded-lg border cursor-pointer hover:border-teal-300 transition"
                          onClick={(e) => { e.stopPropagation(); onSelectRoute(route, stop.code, null); onClose(); }}
                        >
                          <div className="font-bold text-lg text-gray-700">{route}</div>
                          <div className={`text-xs font-semibold ${active ? 'text-green-600' : 'text-gray-400'}`}>{strInfo}</div>
                        </div>
                      );
                    }

                    // Rich ETA Card
                    const { buses, destination, totalStops, status, minStops } = info;

                    return (
                      <div 
                        key={route} 
                        className="bg-white rounded-lg border overflow-hidden cursor-pointer hover:border-teal-300 hover:shadow-md transition"
                        onClick={(e) => { e.stopPropagation(); onSelectRoute(route, stop.code, info.direction || null); onClose(); }}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-gray-50 to-white">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xl text-teal-600">{route}</span>
                            {destination && <span className="text-xs text-gray-500">→ {destination}</span>}
                          </div>
                          {status === 'arriving' && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                              Arriving
                            </span>
                          )}
                        </div>

                        {/* Bus List */}
                        <div className="p-3">
                          {status === 'no-service' && <div className="text-gray-400 text-xs">No active service</div>}
                          {status === 'no-approaching' && <div className="text-gray-400 text-xs">No approaching buses</div>}
                          {status === 'arriving' && (
                            <div className="flex items-center gap-2 text-green-600">
                              <span className="text-lg">🚌</span>
                              <span className="font-semibold">At station / Arriving now</span>
                            </div>
                          )}
                          {status === 'active' && buses && buses.length > 0 && (
                            <div className="space-y-2">
                              {buses.map((bus: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">🚌</span>
                                    <div>
                                      <div className="text-[10px] text-gray-400 font-mono">
                                        <span className="font-bold text-gray-600">{bus.plate}</span>
                                        <span className="mx-1">•</span>
                                        <span>@ {bus.currentStop}</span>
                                      </div>
                                      <div className="text-xs text-gray-600">
                                        {bus.stopsAway} {bus.stopsAway === 1 ? 'stop' : 'stops'} • {bus.distanceM > 0 ? `${(bus.distanceM / 1000).toFixed(1)}km` : '< 0.1km'}
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
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
