import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RouteResult } from '@/services/RouteFinder';
import { LegCard } from '@/components/route-result/LegCard';
import { TransferIndicator } from '@/components/route-result/TransferIndicator';
import { BusIcon, WalkIcon } from '@/components/Icons';

// ============== Main Component ==============

interface RouteResultCardProps {
  result: RouteResult;
  className?: string;
  startWalk?: { distanceMeters: number; durationMinutes: number };
  endWalk?: { distanceMeters: number; durationMinutes: number };
  onHeaderClick?: () => void;
  onViewMap?: () => void;
  onRouteClick?: (route: string, stopCode: string) => void;
}

export const RouteResultCard: React.FC<RouteResultCardProps> = ({ 
  result, 
  className = '', 
  startWalk, 
  endWalk, 
  onHeaderClick,
  onViewMap,
  onRouteClick
}) => {
  const { t } = useTranslation();

  if (!result || result.legs.length === 0) {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center ${className}`}>
        <div className="text-gray-400">{t('route_result.no_route', 'No route found')}</div>
      </div>
    );
  }

  const { legs, totalStops, transferCount } = result;

  return (
    <div 
      className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${className}`}
    >
      {/* Header Summary - Clickable to open map */}
      <div 
        className={`px-4 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white ${onHeaderClick ? 'cursor-pointer hover:from-teal-600 hover:to-emerald-600 transition-colors' : ''}`}
        onClick={onHeaderClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BusIcon className="w-5 h-5" />
            <span className="font-semibold">
              {legs.map(l => l.routeName).join(' → ')}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm opacity-90">
            <span>{totalStops} {t('route_result.stops', 'stops')}</span>
            {transferCount > 0 && (
              <>
                <span>•</span>
                <span>{transferCount} {t('route_result.transfers', 'transfer(s)')}</span>
              </>
            )}
            <span>•</span>
            <span className="font-bold text-teal-100 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {Math.round(result.totalDuration || 0)} {t('min', 'min')}
            </span>
          </div>
        </div>
      </div>

      {/* Timeline Body */}
      <div className="p-4">
        {/* Walk to first bus stop */}
        {startWalk && startWalk.durationMinutes > 0 && (
          <div className="flex gap-3 mb-3">
            <div className="relative z-10 flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shadow-md">
                <WalkIcon className="w-4 h-4 text-white" />
              </div>
              <div className="absolute left-1/2 top-8 bottom-0 w-0.5 -ml-px h-4 bg-blue-200" />
            </div>
            <div className="flex-1 pb-2">
              <div className="text-sm font-medium text-blue-700">
                {t('route_planner.walk_to_stop', 'Walk to bus stop')}
              </div>
              <div className="text-xs text-blue-600">
                {startWalk.durationMinutes} {t('min', 'min')} • {startWalk.distanceMeters}m
              </div>
            </div>
          </div>
        )}

        {legs.map((leg, index) => (
          <React.Fragment key={`${leg.routeId}-${index}`}>
            {/* Transfer Indicator (between legs) */}
            {index > 0 && (
              <TransferIndicator fromLeg={legs[index - 1]} toLeg={leg} />
            )}

            {/* Leg Card */}
            <LegCard
              leg={leg}
              isFirst={index === 0}
              isLast={index === legs.length - 1}
              legIndex={index}
              onBadgeClick={() => onRouteClick?.(leg.routeName, leg.fromStop)}
            />
          </React.Fragment>
        ))}

        {/* Final Destination Node */}
        <div className="flex gap-3">
          <div className="relative z-10 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center shadow-md">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
          </div>
          <div className="flex items-center">
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-wide">
                {t('route_result.destination', 'Destination')}
              </div>
              <div className="font-semibold text-gray-800">
                {legs[legs.length - 1].toStopName}
              </div>
            </div>
          </div>
        </div>

        {/* Walk from bus stop to final destination */}
        {endWalk && endWalk.durationMinutes > 0 && (
          <div className="flex gap-3 mt-3">
            <div className="relative z-10 flex-shrink-0">
              <div className="absolute left-1/2 bottom-8 top-0 w-0.5 -ml-px h-4 bg-green-200" />
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-md mt-4">
                <WalkIcon className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="flex-1 pt-2">
              <div className="text-sm font-medium text-green-700">
                {t('route_planner.walk_to_destination', 'Walk to destination')}
              </div>
              <div className="text-xs text-green-600">
                {endWalk.durationMinutes} {t('min', 'min')} • {endWalk.distanceMeters}m
              </div>
            </div>
          </div>
        )}

        {/* View Map Button */}
        {onViewMap && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewMap();
            }}
            className="mt-4 w-full py-2 px-4 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-lg font-medium text-sm hover:from-teal-600 hover:to-emerald-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            {t('route_result.view_map', 'View Map')}
          </button>
        )}
      </div>
    </div>
  );
};

export default RouteResultCard;
