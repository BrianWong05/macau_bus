import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { RouteFinder, RouteResult, BusStop } from '@/services/RouteFinder';
import { RouteResultCard } from '@/components/RouteResultCard';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

// ============== Icons (Inline SVG) ==============

const MapPinIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const NavigationIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const ArrowsUpDownIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
  </svg>
);

const SearchIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const CrosshairIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const LoaderIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// ============== Main Component ==============

export const RoutePlanner: React.FC = () => {
  const { t } = useTranslation();
  
  // State
  const [routeFinder, setRouteFinder] = useState<RouteFinder | null>(null);
  const [isRouteFinderLoading, setIsRouteFinderLoading] = useState(true);
  
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  
  // Selected Objects (Logical)
  const [selectedStart, setSelectedStart] = useState<BusStop | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<BusStop | null>(null);
  
  const [results, setResults] = useState<RouteResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locatingStart, setLocatingStart] = useState(false);

  // Initialize RouteFinder
  useEffect(() => {
    const initRouteFinder = async () => {
      try {
        const rf = new RouteFinder();
        await rf.load();
        setRouteFinder(rf);
      } catch (err) {
        console.error('Failed to load RouteFinder:', err);
        setError(t('route_planner.load_error', 'Failed to load bus data'));
      } finally {
        setIsRouteFinderLoading(false);
      }
    };
    
    initRouteFinder();
  }, [t]);

  // Use Current Location
  const handleUseMyLocation = useCallback(() => {
    if (!routeFinder) return;
    
    if (!navigator.geolocation) {
      setError(t('route_planner.geo_not_supported', 'Geolocation is not supported'));
      return;
    }

    setLocatingStart(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const nearestStopId = routeFinder.findNearestStop(latitude, longitude);
        
        if (nearestStopId) {
          const stop = routeFinder.getStop(nearestStopId);
          if (stop) {
            setStartInput(stop.name);
            setSelectedStart(stop);
          } else {
            setStartInput(nearestStopId);
            // If stop not found but ID exists (unlikely), treat as minimal stop
             setSelectedStart({ id: nearestStopId, name: nearestStopId, routes: [] });
          }
        } else {
          setError(t('route_planner.no_nearby_stop', 'No nearby stop found'));
        }
        setLocatingStart(false);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError(t('route_planner.geo_error', 'Failed to get location'));
        setLocatingStart(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [routeFinder, t]);

  // Swap Start/End
  const handleSwap = () => {
    setStartInput(endInput);
    setEndInput(startInput);
    setSelectedStart(selectedEnd);
    setSelectedEnd(selectedStart);
    setResults(null);
  };

  // Find Route
  const handleFindRoute = useCallback(async () => {
    if (!routeFinder || !startInput || !endInput) {
      setError(t('route_planner.missing_points', 'Please enter both start and end points'));
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Use ID if selected, otherwise try to use input as ID if user typed it manually
      const sId = selectedStart?.id || startInput;
      const eId = selectedEnd?.id || endInput;
      
      const foundRoutes = routeFinder.findRoute(sId, eId);
      
      if (foundRoutes.length > 0) {
        setResults(foundRoutes);
        
        // Enrich with traffic asynchronously
        routeFinder.enrichWithTraffic(foundRoutes).then(enriched => {
            // Only update if the user hasn't started a new search (simple check: if results are still non-null)
            // Ideally we'd valid against a search ID, but this is a simple app.
            // Using functional state update to ensure we don't overwrite if cleared
            setResults(prev => {
                if (!prev) return null; // Cancelled
                return [...enriched]; // Create new array to force re-render
            });
        }).catch(err => console.error("Traffic enrichment failed:", err));
        
      } else {
        setError(t('route_planner.no_route', 'No route found between these stops'));
      }
    } catch (err) {
      console.error('Route finding error:', err);
      setError(t('route_planner.search_error', 'An error occurred while searching'));
    } finally {
      setLoading(false);
    }
  }, [routeFinder, startInput, endInput, selectedStart, selectedEnd, t]);

  const [suggestions, setSuggestions] = useState<BusStop[]>([]);
  const [activeField, setActiveField] = useState<'start' | 'end' | null>(null);

  // Search Logic
  const updateSuggestions = useCallback((query: string) => {
    if (!routeFinder || !query) {
      setSuggestions([]);
      return;
    }
    const found = routeFinder.searchStops(query);
    setSuggestions(found);
  }, [routeFinder]);

  const selectStop = (stop: BusStop, field: 'start' | 'end') => {
    if (field === 'start') {
      setStartInput(stop.name);
      setSelectedStart(stop);
    } else {
      setEndInput(stop.name);
      setSelectedEnd(stop);
    }
    setSuggestions([]);
    setActiveField(null);
  };

  // Handle input change with search
  const handleStartChange = (value: string) => {
    setStartInput(value);
    // If typing, clear selected object unless it matches exactly (optional, simpler to clear)
    // Actually, we keep it as "unknown object" until selected
    setSelectedStart(null);
    
    setActiveField('start');
    updateSuggestions(value);
    
    // Auto-resolve if exact ID match (user typed "M123")
    if (routeFinder) {
       const stop = routeFinder.getStop(value.toUpperCase());
       if (stop) {
           setSelectedStart(stop);
           // Optional: Auto-switch input to name? No, might be annoying if typing ID.
       }
    }
  };

  const handleEndChange = (value: string) => {
    setEndInput(value);
    setSelectedEnd(null);
    
    setActiveField('end');
    updateSuggestions(value);
    
    if (routeFinder) {
       const stop = routeFinder.getStop(value.toUpperCase());
       if (stop) {
           setSelectedEnd(stop);
       }
    }
  };
  
  // Close suggestions on blur (delayed to allow click)
  const handleBlur = () => {
    setTimeout(() => setActiveField(null), 200);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white px-4 py-6 shadow-lg">
        <div className="max-w-md mx-auto relative">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <NavigationIcon className="w-7 h-7" />
                {t('route_planner.title', 'Trip Planner')}
              </h1>
              <p className="text-teal-100 text-sm mt-1">
                {t('route_planner.subtitle', 'Find the best bus route')}
              </p>
            </div>
            <div className="mt-1">
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Loading State for RouteFinder */}
        {isRouteFinderLoading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <LoaderIcon className="w-8 h-8 text-teal-500 mx-auto mb-3" />
            <p className="text-gray-500">{t('route_planner.loading_data', 'Loading bus data...')}</p>
          </div>
        )}

        {/* Input Section */}
        {!isRouteFinderLoading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            {/* From Input */}
            <div className="relative mb-4">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                {t('route_planner.from', 'From')}
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                  <input
                    type="text"
                    value={startInput}
                    onChange={(e) => handleStartChange(e.target.value)}
                    onFocus={() => setActiveField('start')}
                    onBlur={handleBlur}
                    placeholder={t('route_planner.search_placeholder', 'Search stop name or ID')}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  />
                  {suggestions.length > 0 && activeField === 'start' && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-1 max-h-60 overflow-y-auto">
                      {suggestions.map(stop => (
                        <button
                          key={stop.id}
                          className="w-full text-left px-4 py-2 hover:bg-teal-50 border-b border-gray-50 last:border-0"
                          onClick={() => selectStop(stop, 'start')}
                        >
                          <div className="font-bold text-gray-800">{stop.name}</div>
                          <div className="text-xs text-teal-600 font-mono">{stop.id}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleUseMyLocation}
                  disabled={locatingStart}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                  title={t('route_planner.use_location', 'Use my location')}
                >
                  {locatingStart ? (
                    <LoaderIcon className="w-5 h-5 text-gray-600" />
                  ) : (
                    <CrosshairIcon className="w-5 h-5 text-gray-600" />
                  )}
                </button>
              </div>
              {/* Optional: Show ID if selected */}
              {selectedStart && startInput !== selectedStart.id && (
                  <p className="text-xs text-teal-600 mt-1 pl-10">
                      ID: {selectedStart.id}
                  </p>
              )}
            </div>

            {/* Swap Button */}
            <div className="flex justify-center -my-2 relative z-10">
              <button
                onClick={handleSwap}
                className="w-10 h-10 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 hover:border-teal-400 transition-colors shadow-sm"
                title={t('route_planner.swap', 'Swap')}
              >
                <ArrowsUpDownIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* To Input */}
            <div className="relative mt-4">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
                {t('route_planner.to', 'To')}
              </label>
              <div className="relative">
                <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
                <input
                  type="text"
                  value={endInput}
                  onChange={(e) => handleEndChange(e.target.value)}
                  onFocus={() => setActiveField('end')}
                  onBlur={handleBlur}
                  placeholder={t('route_planner.search_placeholder', 'Search stop name or ID')}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                />
                {suggestions.length > 0 && activeField === 'end' && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-1 max-h-60 overflow-y-auto">
                      {suggestions.map(stop => (
                        <button
                          key={stop.id}
                          className="w-full text-left px-4 py-2 hover:bg-teal-50 border-b border-gray-50 last:border-0"
                          onClick={() => selectStop(stop, 'end')}
                        >
                          <div className="font-bold text-gray-800">{stop.name}</div>
                          <div className="text-xs text-teal-600 font-mono">{stop.id}</div>
                        </button>
                      ))}
                    </div>
                  )}
              </div>
              {selectedEnd && endInput !== selectedEnd.id && (
                  <p className="text-xs text-teal-600 mt-1 pl-10">
                      ID: {selectedEnd.id}
                  </p>
              )}
            </div>

            {/* Search Button */}
            <button
              onClick={handleFindRoute}
              disabled={loading || !startInput || !endInput}
              className="w-full mt-6 py-3.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoaderIcon className="w-5 h-5" />
                  {t('route_planner.searching', 'Searching...')}
                </>
              ) : (
                <>
                  <SearchIcon className="w-5 h-5" />
                  {t('route_planner.find_route', 'Find Route')}
                </>
              )}
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Results Section */}
        {loading && (
          <div className="space-y-4">
            {/* Skeleton Loader */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
              <div className="h-10 bg-gray-200 rounded-lg mb-4" />
              <div className="h-24 bg-gray-100 rounded-lg mb-3" />
              <div className="h-24 bg-gray-100 rounded-lg" />
            </div>
          </div>
        )}

        {results && !loading && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-700">
              {t('route_planner.results', 'Route Found')}
              <span className="ml-2 text-sm font-normal text-gray-500">
                {results.length > 1 ? `(${results.length} ${t('route_planner.options', 'options')})` : ''}
              </span>
            </h2>
            {results.map((result, index) => (
              <div key={index} className="relative">
                {/* Visual Connector between cards if needed, or just space */}
                <RouteResultCard result={result} />
              </div>
            ))}
          </div>
        )}

        {!loading && !results && !error && startInput && endInput && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">
              {t('route_planner.tap_search', 'Tap "Find Route" to search')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoutePlanner;
