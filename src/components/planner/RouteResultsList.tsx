import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RouteResult, TripResult } from '@/services/RouteFinder';
import RouteResultCard from '@/components/route-result/RouteResultCard';

interface RouteResultsListProps {
  results: RouteResult[];
  tripResults: TripResult[] | null;
  loading: boolean;
  showMap: boolean;
  onToggleMap: () => void;
  onSelectRoute: (index: number) => void;
  onViewMap: (index: number) => void;
  onRouteClick?: (route: string, stopCode: string) => void;
}

export const RouteResultsList: React.FC<RouteResultsListProps> = ({
  results,
  tripResults,
  loading,
  showMap,
  onToggleMap,
  onSelectRoute,
  onViewMap,
  onRouteClick
}) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Skeleton Loader */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
          <div className="h-10 bg-gray-200 rounded-lg mb-4" />
          <div className="h-24 bg-gray-100 rounded-lg mb-3" />
          <div className="h-24 bg-gray-100 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!results) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700">
          {t('route_planner.results', 'Route Found')}
          <span className="ml-2 text-sm font-normal text-gray-500">
            {results.length > 1 ? `(${results.length} ${t('route_planner.options', 'options')})` : ''}
          </span>
        </h2>
        <button
          onClick={onToggleMap}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
            showMap 
              ? 'bg-teal-500 text-white' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          🗺️ {showMap ? t('route_planner.hide_map', 'Hide Map') : t('route_planner.show_map', 'Show Map')}
        </button>
      </div>
      {results.map((result, index) => {
        // Get walking segments if available
        const trip = tripResults?.[index];
        
        return (
          <div key={index} className="relative">
            <RouteResultCard 
              result={result} 
              startWalk={trip?.startWalk}
              endWalk={trip?.endWalk}
              onHeaderClick={() => onSelectRoute(index)}
              onViewMap={() => onViewMap(index)}
              onRouteClick={onRouteClick}
            />
          </div>
        );
      })}
    </div>
  );
};
