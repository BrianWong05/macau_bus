import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RouteLeg, RouteResult } from '@/services/RouteFinder';

// ============== Icons (Inline SVG) ==============

const BusIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="4" width="18" height="14" rx="2" />
    <path d="M3 10h18" />
    <circle cx="7" cy="20" r="2" />
    <circle cx="17" cy="20" r="2" />
    <path d="M7 4V2M17 4V2" />
  </svg>
);

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const WalkIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="4" r="2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v4l3 3M12 10l-3 7M12 10l3 7" />
  </svg>
);

// ============== Route Badge Colors ==============

const getRouteColor = (routeName: string): string => {
  // Color coding based on route type
  if (routeName.startsWith('N')) return 'bg-indigo-600 text-white'; // Night routes
  if (routeName.startsWith('MT')) return 'bg-purple-500 text-white'; // MT routes
  if (routeName.startsWith('AP')) return 'bg-sky-500 text-white'; // Airport
  if (routeName.startsWith('H')) return 'bg-rose-500 text-white'; // Hospital
  if (routeName.includes('X')) return 'bg-amber-500 text-white'; // Express
  if (routeName.includes('A')) return 'bg-teal-500 text-white'; // A variants
  if (routeName.includes('B')) return 'bg-emerald-500 text-white'; // B variants
  return 'bg-blue-500 text-white'; // Default
};

const getRouteLineColor = (routeName: string): string => {
  if (routeName.startsWith('N')) return 'bg-indigo-400';
  if (routeName.startsWith('MT')) return 'bg-purple-400';
  if (routeName.startsWith('AP')) return 'bg-sky-400';
  if (routeName.startsWith('H')) return 'bg-rose-400';
  if (routeName.includes('X')) return 'bg-amber-400';
  if (routeName.includes('A')) return 'bg-teal-400';
  if (routeName.includes('B')) return 'bg-emerald-400';
  return 'bg-blue-400';
};

// ============== Sub-Components ==============

interface LegCardProps {
  leg: RouteLeg;
  isFirst: boolean;
  isLast: boolean;
  legIndex: number;
}

const LegCard: React.FC<LegCardProps> = ({ leg, isFirst, isLast, legIndex }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const badgeColor = getRouteColor(leg.routeName);
  const lineColor = getRouteLineColor(leg.routeName);

  return (
    <div className="relative">
      {/* Timeline Line */}
      <div className={`absolute left-4 top-6 bottom-0 w-1 ${lineColor} ${isLast ? 'hidden' : ''}`} />

      {/* Leg Content */}
      <div className="flex gap-3">
        {/* Timeline Node */}
        <div className="relative z-10 flex-shrink-0">
          {isFirst ? (
            // Start Node - Hollow circle
            <div className="w-8 h-8 rounded-full border-3 border-teal-500 bg-white flex items-center justify-center shadow-sm">
              <div className="w-3 h-3 rounded-full bg-teal-500" />
            </div>
          ) : (
            // Intermediate Node - Bus icon in colored circle
            <div className={`w-8 h-8 rounded-full ${badgeColor} flex items-center justify-center shadow-sm`}>
              <BusIcon className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Leg Details */}
        <div className="flex-1 pb-6">
          {/* Header with Route Badge */}
          <div className="flex items-center gap-2 mb-1">
            {isFirst && (
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                {t('route_result.start', 'Start')}
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-md text-sm font-bold ${badgeColor} flex items-center gap-1`}>
              <BusIcon className="w-3 h-3" />
              {leg.routeName}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <span>{leg.stopCount} {t('route_result.stops', 'stops')}</span>
              <span>•</span>
              <span className="font-medium text-teal-600">{Math.round(leg.duration || 0)} {t('min', 'min')}</span>
            </span>
          </div>

          {/* From/To Stations */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div className="flex items-start gap-2">
              <div className="flex flex-col items-center pt-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <div className="w-0.5 h-6 bg-gray-300" />
                <div className="w-2 h-2 rounded-full bg-red-500" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="text-xs text-gray-400">{t('route_result.board_at', 'Board at')}</div>
                  <div className="font-medium text-gray-800">{leg.fromStopName}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">{t('route_result.alight_at', 'Alight at')}</div>
                  <div className="font-medium text-gray-800">{leg.toStopName}</div>
                </div>
              </div>
            </div>

            {/* Details Toggle (Accordion) */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-teal-600 transition-colors py-1"
            >
              <span>{expanded ? t('route_result.hide_stops', 'Hide stops') : t('route_result.show_stops', 'Show stops')}</span>
              <ChevronDownIcon className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>

            {/* Expanded Stop List (Placeholder) */}
            {expanded && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-400 italic">
                  {/* TODO: Render leg.stops here when available */}
                  {t('route_result.stop_list_placeholder', 'Stop list will be shown here...')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface TransferIndicatorProps {
  fromLeg: RouteLeg;
  toLeg: RouteLeg;
}

const TransferIndicator: React.FC<TransferIndicatorProps> = ({ fromLeg, toLeg }) => {
  const { t } = useTranslation();

  return (
    <div className="relative">
      {/* Connecting Line */}
      <div className="absolute left-4 top-0 bottom-0 w-1 bg-gray-300" />

      {/* Transfer Badge */}
      <div className="flex gap-3 py-3">
        <div className="relative z-10 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-orange-100 border-2 border-orange-400 flex items-center justify-center">
            <WalkIcon className="w-4 h-4 text-orange-600" />
          </div>
        </div>
        <div className="flex items-center">
          <span className="text-sm font-medium text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
            {t('route_result.transfer', 'Transfer')}
          </span>
        </div>
      </div>
    </div>
  );
};

// ============== Main Component ==============

interface RouteResultCardProps {
  result: RouteResult;
  className?: string;
  startWalk?: { distanceMeters: number; durationMinutes: number };
  endWalk?: { distanceMeters: number; durationMinutes: number };
  onClick?: () => void;
}

export const RouteResultCard: React.FC<RouteResultCardProps> = ({ result, className = '', startWalk, endWalk, onClick }) => {
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
        className={`px-4 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white ${onClick ? 'cursor-pointer hover:from-teal-600 hover:to-emerald-600 transition-colors' : ''}`}
        onClick={onClick}
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
        {onClick && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
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
