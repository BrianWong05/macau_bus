import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { RouteFinder, RouteResult, BusStop, TripResult } from '@/services/RouteFinder';
import { RouteMapModal } from '@/components/RouteMapModal';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { searchPlace, PlaceResult } from '@/services/Geocoding';
import { PlannerMap } from '@/components/planner/PlannerMap';
import { SearchForm } from '@/components/planner/SearchForm';
import { RouteResultsList } from '@/components/planner/RouteResultsList';

// ============== Icons (Inline SVG) ==============



const NavigationIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);



const SearchIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
  const [tripResults, setTripResults] = useState<TripResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locatingStart, setLocatingStart] = useState(false);
  
  // Coordinates for place-based routing
  const [startCoords, setStartCoords] = useState<{lat: number; lng: number} | null>(null);
  const [endCoords, setEndCoords] = useState<{lat: number; lng: number} | null>(null);
  const [lastSelectedField, setLastSelectedField] = useState<'start' | 'end' | null>(null);
  const [pinDropMode, setPinDropMode] = useState<'start' | 'end' | null>(null);
  
  // Place search results
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  
  // Map modal state
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(null);
  const [showMapWithResults, setShowMapWithResults] = useState(false);

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
    if (!navigator.geolocation) {
      setError(t('route_planner.geo_not_supported', 'Geolocation is not supported'));
      return;
    }

    setLocatingStart(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        // Store raw coordinates for coordinate-based routing (walking segment calculation)
        setStartCoords({ lat: latitude, lng: longitude });
        setStartInput(t('route_planner.my_location', 'My Location'));
        setSelectedStart(null); // Not a bus stop
        setLocatingStart(false);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError(t('route_planner.geo_error', 'Failed to get location'));
        setLocatingStart(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [t]);

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
    setTripResults(null);

    try {
      // Small delay for UX
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Determine if we're doing coordinate-based or stop-based search
      let useCoordSearch = !!(startCoords && endCoords);
      let finalStartCoords: {lat: number; lng: number} | null = startCoords;
      let finalEndCoords: {lat: number; lng: number} | null = endCoords;
      
      // Auto-geocode if input looks like a place name (not a stop ID)
      // Stop IDs typically start with M, T, C followed by numbers
      const isStopId = (input: string) => /^[MTC]\d+/i.test(input.trim());
      
      // If no coords but input doesn't look like a stop ID, try to geocode
      if (!startCoords && !selectedStart && !isStopId(startInput)) {
        const places = await searchPlace(startInput);
        if (places.length > 0) {
          finalStartCoords = { lat: places[0].lat, lng: places[0].lng };
          useCoordSearch = true;
        }
      }
      
      if (!endCoords && !selectedEnd && !isStopId(endInput)) {
        const places = await searchPlace(endInput);
        if (places.length > 0) {
          finalEndCoords = { lat: places[0].lat, lng: places[0].lng };
          useCoordSearch = true;
        }
      }
      
      // If we have any coordinates, do coordinate-based search
      if (useCoordSearch && finalStartCoords && finalEndCoords) {
        const trips = routeFinder.findTrip(finalStartCoords, finalEndCoords);
        if (trips && trips.length > 0) {
          setTripResults(trips);
          setResults(trips.map(trip => trip.busRoute));
        } else {
          setError(t('route_planner.no_route', 'No route found between these locations'));
        }
      } else {
        // Use stop ID-based routing (existing logic)
        const sId = selectedStart?.id || startInput;
        const eId = selectedEnd?.id || endInput;
        
        const foundRoutes = routeFinder.findRoute(sId, eId);
        
        if (foundRoutes.length > 0) {
          setResults(foundRoutes);
          
          // Enrich with traffic asynchronously
          routeFinder.enrichWithTraffic(foundRoutes).then(enriched => {
              setResults(prev => {
                  if (!prev) return null;
                  return [...enriched];
              });
          }).catch(err => console.error("Traffic enrichment failed:", err));
          
        } else {
          setError(t('route_planner.no_route', 'No route found between these stops'));
        }
      }
    } catch (err) {
      console.error('Route finding error:', err);
      setError(t('route_planner.search_error', 'An error occurred while searching'));
    } finally {
      setLoading(false);
    }
  }, [routeFinder, startInput, endInput, selectedStart, selectedEnd, startCoords, endCoords, t]);

  const [suggestions, setSuggestions] = useState<BusStop[]>([]);
  const [activeField, setActiveField] = useState<'start' | 'end' | null>(null);
  
  // Debounce timer for place search
  const placeSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search Logic - combines bus stops and places
  const updateSuggestions = useCallback((query: string) => {
    if (!routeFinder || !query || query.length < 2) {
      setSuggestions([]);
      setPlaceResults([]);
      return;
    }
    
    // Bus stop search (synchronous)
    const stops = routeFinder.searchStops(query);
    setSuggestions(stops);
    
    // Debounced place search (async) - only if query is 2+ chars
    // Cancel previous timer to avoid rate limiting
    if (placeSearchTimerRef.current) {
      clearTimeout(placeSearchTimerRef.current);
    }
    
    if (query.length >= 2) {
      // Wait 500ms after user stops typing before searching
      placeSearchTimerRef.current = setTimeout(async () => {
        try {
          const places = await searchPlace(query);
          setPlaceResults(places);
        } catch (e) {
          console.error('Place search error:', e);
          // Don't clear on error, keep previous results
        }
      }, 500);
    } else {
      // Clear place results if query is too short
      setPlaceResults([]);
    }
  }, [routeFinder]);

  const selectStop = (stop: BusStop, field: 'start' | 'end') => {
    if (field === 'start') {
      setStartInput(stop.name);
      setSelectedStart(stop);
      setStartCoords(stop.lat && stop.lng ? { lat: stop.lat, lng: stop.lng } : null);
    } else {
      setEndInput(stop.name);
      setSelectedEnd(stop);
      setEndCoords(stop.lat && stop.lng ? { lat: stop.lat, lng: stop.lng } : null);
    }
    setLastSelectedField(field);
    setSuggestions([]);
    setPlaceResults([]);
    setActiveField(null);
  };

  const selectPlace = (place: PlaceResult, field: 'start' | 'end') => {
    if (field === 'start') {
      setStartInput(place.name);
      setSelectedStart(null); // Not a bus stop
      setStartCoords({ lat: place.lat, lng: place.lng });
    } else {
      setEndInput(place.name);
      setSelectedEnd(null);
      setEndCoords({ lat: place.lat, lng: place.lng });
    }
    setLastSelectedField(field);
    setSuggestions([]);
    setPlaceResults([]);
    setActiveField(null);
  };

  // Handle map click for pin drop
  const handleMapClick = useCallback((lat: number, lng: number, mode: 'start' | 'end') => {
    const coords = { lat, lng };
    const label = t('route_planner.dropped_pin', 'Dropped Pin');
    
    if (mode === 'start') {
      setStartInput(label);
      setSelectedStart(null);
      setStartCoords(coords);
    } else {
      setEndInput(label);
      setSelectedEnd(null);
      setEndCoords(coords);
    }
    setLastSelectedField(mode);
    setPinDropMode(null);
  }, [t]);

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
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white px-4 py-6 shadow-lg sticky top-0 z-30">
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

        {/* Search Form */}
        {!isRouteFinderLoading && (
          <SearchForm
            startInput={startInput}
            endInput={endInput}
            onStartChange={handleStartChange}
            onEndChange={handleEndChange}
            onSwap={handleSwap}
            onFindRoute={handleFindRoute}
            loading={loading}
            suggestions={suggestions}
            placeResults={placeResults}
            activeField={activeField}
            onFocusField={setActiveField}
            onBlurField={handleBlur}
            onSelectStop={selectStop}
            onSelectPlace={selectPlace}
            onUseMyLocation={handleUseMyLocation}
            locatingStart={locatingStart}
            selectedStart={selectedStart}
            selectedEnd={selectedEnd}
          />
        )}

        {/* Map Preview */}
        {(!results || showMapWithResults || activeField) && (
          <PlannerMap
            startCoords={startCoords}
            endCoords={endCoords}
            lastSelectedField={lastSelectedField}
            pinDropMode={pinDropMode}
            onSetPinDropMode={setPinDropMode}
            onMapClick={handleMapClick}
          />
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Results List */}
        <RouteResultsList
          results={results || []}
          tripResults={tripResults}
          loading={loading}
          showMap={showMapWithResults}
          onToggleMap={() => setShowMapWithResults(!showMapWithResults)}
          onSelectRoute={setSelectedRouteIndex}
        />

        {!loading && !results && !error && startInput && endInput && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
            <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">
              {t('route_planner.tap_search', 'Tap "Find Route" to search')}
            </p>
          </div>
        )}
      </div>

      {/* Route Map Modal */}
      {selectedRouteIndex !== null && results && results[selectedRouteIndex] && (
        <RouteMapModal
          isOpen={true}
          onClose={() => setSelectedRouteIndex(null)}
          legs={results[selectedRouteIndex].legs}
          startWalk={tripResults?.[selectedRouteIndex]?.startWalk}
          endWalk={tripResults?.[selectedRouteIndex]?.endWalk}
          startCoords={startCoords || undefined}
          endCoords={endCoords || undefined}
        />
      )}
    </div>
  );
};

export default RoutePlanner;
