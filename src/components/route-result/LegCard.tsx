import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RouteLeg } from '@/services/RouteFinder';
import govData from '@/data/gov_data.json';

import { BusIcon, ChevronDownIcon } from '@/components/Icons';

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

// ============== LegCard Component ==============

export interface LegCardProps {
  leg: RouteLeg;
  isFirst: boolean;
  isLast: boolean;
  legIndex: number;
}

export const LegCard: React.FC<LegCardProps> = ({ leg, isFirst, isLast, legIndex }) => {
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

          {/* From/To Stations with expandable stop list */}
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            {/* Container with continuous line */}
            <div className="relative">
              {/* Continuous vertical line - positioned behind everything */}
              <div className="absolute left-[5px] top-3 bottom-8 w-0.5 bg-gray-300" />
              
              {/* Board at */}
              <div className="relative flex items-start gap-3">
                <div className="w-3 flex justify-center flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 z-10" />
                </div>
                <div className="flex-1 pb-1">
                  <div className="text-xs text-gray-400">{t('route_result.board_at', 'Board at')}</div>
                  <div className="font-medium text-gray-800">{leg.fromStopName}</div>
                </div>
              </div>
              
              {/* Intermediate Stops (when expanded) */}
              {expanded && leg.stops.slice(1, -1).map((stopId, idx) => {
                // Normalize stopId: replace "/" with "_" to match gov_data format
                const normalizedId = stopId.replace('/', '_');
                const baseId = stopId.split('/')[0].split('_')[0];
                
                // Find stop name from govData
                const stopInfo = govData.stops.find(
                  (s) => s.raw?.ALIAS === stopId || 
                         s.raw?.P_ALIAS === stopId ||
                         s.raw?.ALIAS === normalizedId ||
                         s.raw?.P_ALIAS === normalizedId ||
                         s.raw?.ALIAS === baseId ||
                         s.raw?.P_ALIAS?.startsWith(baseId + '_')
                );
                const stopName = stopInfo?.name || stopId;
                
                return (
                  <div key={stopId} className="relative flex items-start gap-3 py-0.5">
                    <div className="w-3 flex justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-gray-300 z-10" />
                    </div>
                    <div className="flex-1 text-sm text-gray-500">
                      <span className="text-gray-400 mr-1">{idx + 2}.</span>
                      {stopName}
                    </div>
                  </div>
                );
              })}
              
              {/* Alight at */}
              <div className="relative flex items-start gap-3">
                <div className="w-3 flex justify-center flex-shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 z-10" />
                </div>
                <div className="flex-1">
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
          </div>
        </div>
      </div>
    </div>
  );
};
