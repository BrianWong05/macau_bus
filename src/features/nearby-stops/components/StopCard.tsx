/**
 * StopCard - Displays a single bus stop with expandable route information
 */

import React from 'react';
import { NearbyStop } from '../types';

interface StopCardProps {
  stop: NearbyStop;
  index: number;
  isExpanded: boolean;
  isLoading: boolean;
  lastUpdated: Date | null;
  onExpand: () => void;
  onRefresh: () => void;
  children?: React.ReactNode;
}

export const StopCard: React.FC<StopCardProps> = ({
  stop,
  index,
  isExpanded,
  isLoading,
  lastUpdated,
  onExpand,
  onRefresh,
  children,
}) => {
  const formatDistance = (km: number): string => {
    if (km < 1) return `${Math.round(km * 1000)}m`;
    return `${km.toFixed(1)}km`;
  };

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border-2 transition-all duration-200 overflow-hidden ${
        isExpanded
          ? 'border-teal-400 shadow-lg'
          : 'border-transparent hover:border-teal-200'
      }`}
    >
      {/* Stop Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer group"
        onClick={onExpand}
      >
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-teal-500 to-green-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shadow-md">
            {index + 1}
          </div>
          <div>
            <div className="font-semibold text-gray-800 group-hover:text-teal-700 transition-colors">
              {stop.name}
            </div>
            <div className="text-xs text-gray-400">{stop.code}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium px-2 py-0.5 rounded-full ${
              stop.distance < 0.2
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            📍 {formatDistance(stop.distance)}
          </span>
          <span
            className={`transition-transform duration-200 ${
              isExpanded ? 'rotate-90' : ''
            }`}
          >
            ▸
          </span>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100 bg-gray-50/50">
          {/* Last Updated */}
          {lastUpdated && (
            <div className="text-right text-[10px] text-gray-400 pt-2">
              Updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="text-gray-500 flex items-center justify-center py-2">
              Loading live data...
            </div>
          ) : (
            <div className="space-y-2">{children}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default StopCard;
