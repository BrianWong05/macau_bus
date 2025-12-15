import React from 'react';
import { useTranslation } from 'react-i18next';
import { BusProgressBar } from '@/features/nearby-stops/components/BusProgressBar';
import { ArrivalData } from '@/features/nearby-stops/types';

interface StopCardProps {
  stop: any;
  isExpanded: boolean;
  arrivalData: ArrivalData;
  loadingArrivals: boolean;
  onToggle: () => void;
  onSelectRoute: (route: string, stopCode?: string, direction?: string | null) => void;
  userLocation: { lat: number; lon: number } | null;
}

export const StopCard: React.FC<StopCardProps> = ({
  stop,
  isExpanded,
  arrivalData,
  loadingArrivals,
  onToggle,
  onSelectRoute,
  userLocation
}) => {
  const { t, i18n } = useTranslation();

  const getDisplayName = (stop: any) => {
    const lang = i18n.language;
    if (lang === 'en') return stop.raw?.P_NAME_EN || stop.name;
    if (lang === 'pt') return stop.raw?.P_NAME_POR || stop.name;
    return stop.raw?.P_NAME || stop.name;
  };

  const formatDist = (km: number) => {
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
  };

  const getEtaTextColor = (eta: number) => {
    if (eta <= 2) return 'text-green-600';
    if (eta <= 5) return 'text-yellow-600';
    return 'text-gray-700';
  };

  const routes = stop.raw?.ROUTE_NOS?.split(',').map((r: string) => r.trim()).filter(Boolean) || [];
  const stopArrivals = arrivalData[stop.code] || {};

  return (
    <div className={`border rounded-xl shadow-sm transition-all bg-white overflow-hidden ${isExpanded ? 'ring-2 ring-teal-500 shadow-md' : 'hover:shadow-md border-gray-100'}`}>
      {/* Stop Header - Clickable */}
      <div 
        className="p-4 flex justify-between items-start cursor-pointer"
        onClick={onToggle}
      >
        <div>
          <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
            {getDisplayName(stop)}
            {isExpanded 
              ? <span className="text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">{t('open')}</span>
              : <span className="text-xs text-gray-400">▼</span>
            }
          </h3>
          <div className="text-xs text-gray-400 font-mono">{stop.code}</div>
        </div>
        <div className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
          <span>📍</span> {formatDist(stop.distance)}
        </div>
      </div>

      {/* Collapsed: Route Tags */}
      {!isExpanded && routes.length > 0 && (
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {routes.map((route: string) => (
            <span 
              key={route} 
              className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded cursor-pointer hover:bg-teal-50 hover:text-teal-600 transition"
              onClick={(e) => { e.stopPropagation(); onSelectRoute(route, stop.code, null); }}
            >
              {route}
            </span>
          ))}
        </div>
      )}

      {/* Expanded Content - Arrival Data */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          {loadingArrivals && Object.keys(stopArrivals).length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-sm">{t('loading')}</div>
          ) : routes.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-sm">{t('no_data')}</div>
          ) : (
            <div className="space-y-3">
              {routes.map((route: string) => {
                const info = stopArrivals[route];
                const isRichInfo = info && typeof info === 'object'; // Simple type check

                if (!isRichInfo) {
                  return (
                    <div 
                      key={route}
                      className="bg-white p-3 rounded-lg border cursor-pointer hover:border-teal-300 transition"
                      onClick={(e) => { e.stopPropagation(); onSelectRoute(route, stop.code, null); }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-lg text-teal-600">{route}</span>
                        <span className="text-xs text-gray-400">{info || '---'}</span>
                      </div>
                    </div>
                  );
                }

                // If explicit casting needed, normally we use TS interfaces, using 'any' for speed here mimicking original file simplicity
                const { buses, destination, status } = info as any;

                return (
                  <div 
                    key={route}
                    className="bg-white rounded-lg border overflow-hidden cursor-pointer hover:border-teal-300 hover:shadow-md transition"
                    onClick={(e) => { e.stopPropagation(); onSelectRoute(route, stop.code, info.direction || null); }}
                  >
                    {/* Route Header */}
                    <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-gray-50 to-white">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xl text-teal-600">{route}</span>
                        {destination && <span className="text-xs text-gray-500">→ {destination}</span>}
                      </div>
                      {status === 'arrived' && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                          {t('arriving')}
                        </span>
                      )}
                    </div>

                    {/* Bus List */}
                    <div className="p-3">
                      {status === 'no-service' && <div className="text-gray-400 text-xs">{t('no_active_service')}</div>}
                      {status === 'no-approaching' && <div className="text-gray-400 text-xs">{t('no_approaching')}</div>}
                      {(status === 'active' || status === 'arrived') && buses && buses.length > 0 && (
                        <div className="space-y-2">
                          {buses.map((bus: any, bidx: number) => (
                            <div key={bidx} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                              <div className="flex items-center gap-2">
                                <span className="text-base">🚌</span>
                                <div>
                                  <div className="text-[10px] text-gray-400 font-mono">
                                    <span className="font-bold text-gray-600">{bus.plate}</span>
                                    <span className="mx-1">•</span>
                                    <span>
                                      {bus.isEnRoute 
                                        ? t('en_route')
                                        : bus.isDeparted && bus.nextStop 
                                          ? `${t('going_to')} ${bus.nextStop}`
                                          : `@ ${bus.currentStop}`
                                      }
                                    </span>
                                  </div>
                                  {bus.stopsAway > 0 && (
                                    <div className="text-xs text-gray-600">
                                      {bus.stopsAway} {t('stops')} • {bus.distanceM > 0 ? `${(bus.distanceM / 1000).toFixed(1)}km` : '< 0.1km'}
                                    </div>
                                  )}
                                  {bus.trafficSegments && bus.trafficSegments.length > 0 && (
                                    <BusProgressBar trafficSegments={bus.trafficSegments} isDeparted={bus.isDeparted} />
                                  )}
                                </div>
                              </div>
                              {bus.stopsAway === 0 ? (
                                <div className="text-sm font-bold text-green-600 animate-pulse">
                                  {bus.isEnRoute ? t('arriving') : t('at_station')}
                                </div>
                              ) : (
                                <div className={`text-lg font-bold ${getEtaTextColor(bus.eta)}`}>
                                  {bus.eta === 0 ? '<1' : bus.eta}
                                  <span className="text-xs font-normal ml-0.5">{t('min')}</span>
                                </div>
                              )}
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
  );
};
