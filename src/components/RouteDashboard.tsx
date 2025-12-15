import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_ROUTES } from '@/data/routes';
import govData from '@/data/gov_data.json';
import { getDistanceFromLatLonInKm } from '@/utils/distance';
import { SearchModeToggle } from '@/components/dashboard/SearchModeToggle';
import { RouteGrid } from '@/components/dashboard/RouteGrid';
import { StopList } from '@/components/dashboard/StopList';

interface RouteDashboardProps {
  onSelectRoute: (route: string, stopCode?: string, direction?: string | null) => void;
  initialSearchMode?: 'route' | 'stop';
  onSearchModeChange?: (mode: 'route' | 'stop') => void;
  expandedStop?: string | null;
  onExpandedStopChange?: (stopCode: string | null) => void;
}

type SearchMode = 'route' | 'stop';

interface StopData {
  name: string;
  lat: number;
  lon: number;
  raw?: {
    ROUTE_NOS?: string;
    P_NAME?: string;
    P_NAME_EN?: string;
    P_NAME_POR?: string;
    P_ALIAS?: string;
  };
}

interface StopWithDistance extends StopData {
  distance: number;
  code: string;
}

const stopsData = govData.stops as StopData[];

const RouteDashboard: React.FC<RouteDashboardProps> = ({ onSelectRoute, initialSearchMode = 'route', onSearchModeChange, expandedStop, onExpandedStopChange }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>(initialSearchMode);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Notify parent when search mode changes
  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    setSearchTerm('');
    onSearchModeChange?.(mode);
  };

  // Get user location when stop mode is selected
  useEffect(() => {
    if (searchMode === 'stop' && !userLocation && !locationLoading) {
      setLocationLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          setLocationLoading(false);
        },
        (err) => {
          setLocationError(err.message);
          setLocationLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [searchMode, userLocation, locationLoading]);

  // Filter routes by search term
  const filteredRoutes = useMemo(() => {
    if (searchMode !== 'route') return [];
    return ALL_ROUTES.filter(route => 
      route.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, searchMode]);

  // Process all stops with distance calculation
  const allStopsWithDistance = useMemo((): StopWithDistance[] => {
    if (searchMode !== 'stop') return [];
    
    return stopsData.map(stop => {
      const distance = userLocation 
        ? getDistanceFromLatLonInKm(userLocation.lat, userLocation.lon, stop.lat, stop.lon)
        : 999;
      const code = (stop.raw?.P_ALIAS || 'UNKNOWN').replace(/[_-]/g, '/');
      return { ...stop, distance, code };
    });
  }, [searchMode, userLocation]);

  // Get stops to display: 15 nearest by default, or filtered results
  const displayStops = useMemo((): StopWithDistance[] => {
    if (searchMode !== 'stop') return [];
    let results = [...allStopsWithDistance];
    if (searchTerm.length > 0) {
      const term = searchTerm.toLowerCase();
      results = results.filter(stop => {
        const names = [stop.name, stop.raw?.P_NAME, stop.raw?.P_NAME_EN, stop.raw?.P_NAME_POR, stop.raw?.P_ALIAS]
          .filter(Boolean).map(n => n!.toLowerCase());
        return names.some(name => name.includes(term));
      });
    }
    results.sort((a, b) => a.distance - b.distance);
    let sliced = results.slice(0, searchTerm.length > 0 ? 30 : 15);
    
    // If there's an expanded stop that's not in the sliced list, add it at the beginning
    if (expandedStop && !sliced.some(s => s.code === expandedStop)) {
      const expandedStopData = allStopsWithDistance.find(s => s.code === expandedStop);
      if (expandedStopData) {
        sliced = [expandedStopData, ...sliced];
      }
    }
    
    return sliced;
  }, [allStopsWithDistance, searchTerm, searchMode, expandedStop]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="p-4 pb-0">
        {/* Search Mode Toggle */}
        <SearchModeToggle 
          searchMode={searchMode} 
          onModeChange={handleModeChange} 
        />

        {/* Search Header */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            {searchMode === 'route' ? t('all_routes') : (searchTerm ? t('search_stop') : t('nearby_stops'))}
          </h2>
          <input
            type="text"
            placeholder={searchMode === 'route' ? t('search_route_placeholder') : t('search_stop_placeholder')}
            className="w-full p-3 rounded-xl border border-gray-300 shadow-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-4">
          {searchMode === 'route' ? (
            <RouteGrid 
              routes={filteredRoutes} 
              onSelectRoute={onSelectRoute} 
            />
          ) : (
            <StopList 
              stops={displayStops}
              userLocation={userLocation}
              locationLoading={locationLoading}
              locationError={locationError}
              onSelectRoute={onSelectRoute}
              expandedStop={expandedStop}
              onExpandedStopChange={onExpandedStopChange}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default RouteDashboard;
