import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPinIcon, NavigationIcon, ArrowsUpDownIcon, SearchIcon, CrosshairIcon, LoaderIcon } from '@/components/Icons';
import type { BusStop } from '@/services/RouteFinder';
import type { PlaceResult } from '@/services/Geocoding';

// ============== Internal Icons (Specific to this form) ==============
// (Note: We imported shared icons, but some might be unique or we can reuse shared ones. 
//  Let's check if the icons in RoutePlanner are already in Icons.tsx or if we should move them there.
//  For now, I'll inline the ones I can't find or reuse shared ones if apparent.)

// Re-defining icons here if they aren't exported from shared Icons.tsx yet, 
// OR better, let's assume we should move them to shared later. 
// For this extraction, to be safe and fast, I will copy the inline icons from RoutePlanner 
// if they differ from shared ones. Start/End inputs use specific icons.

const CrosshairIconLocal: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const ArrowsUpDownIconLocal: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
  </svg>
);

const SearchIconLocal: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const LoaderIconLocal: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const MapPinIconLocal: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

interface SearchFormProps {
  startInput: string;
  endInput: string;
  onStartChange: (val: string) => void;
  onEndChange: (val: string) => void;
  onSwap: () => void;
  onFindRoute: () => void;
  loading: boolean;
  
  // Suggestions logic
  suggestions: BusStop[];
  placeResults: PlaceResult[];
  activeField: 'start' | 'end' | null;
  onFocusField: (field: 'start' | 'end') => void;
  onBlurField: () => void;
  onSelectStop: (stop: BusStop, field: 'start' | 'end') => void;
  onSelectPlace: (place: PlaceResult, field: 'start' | 'end') => void;
  
  // Geolocation
  onUseMyLocation: () => void;
  locatingStart: boolean;
  
  // Selected Objects for ID display
  selectedStart: BusStop | null;
  selectedEnd: BusStop | null;
}

export const SearchForm: React.FC<SearchFormProps> = ({
  startInput,
  endInput,
  onStartChange,
  onEndChange,
  onSwap,
  onFindRoute,
  loading,
  suggestions,
  placeResults,
  activeField,
  onFocusField,
  onBlurField,
  onSelectStop,
  onSelectPlace,
  onUseMyLocation,
  locatingStart,
  selectedStart,
  selectedEnd
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      {/* From Input */}
      <div className="relative mb-4">
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          {t('route_planner.from', 'From')}
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <MapPinIconLocal className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
            <input
              type="text"
              value={startInput}
              onChange={(e) => onStartChange(e.target.value)}
              onFocus={() => onFocusField('start')}
              onBlur={onBlurField}
              placeholder={t('route_planner.search_placeholder', 'Search stop, place or ID')}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
            />
            {(suggestions.length > 0 || placeResults.length > 0) && activeField === 'start' && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-1 max-h-60 overflow-y-auto">
                {suggestions.map(stop => (
                  <button
                    key={stop.id}
                    className="w-full text-left px-4 py-2 hover:bg-teal-50 border-b border-gray-50 last:border-0"
                    onClick={() => onSelectStop(stop, 'start')}
                  >
                    <div className="font-bold text-gray-800">{stop.name}</div>
                    <div className="text-xs text-teal-600 font-mono">{stop.id}</div>
                  </button>
                ))}
                {/* Place Results */}
                {placeResults.length > 0 && (
                  <>
                    <div className="px-4 py-1 text-xs text-gray-400 bg-gray-50 font-semibold">Places</div>
                    {placeResults.map((place, idx) => (
                      <button
                        key={`place-${idx}`}
                        className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-gray-50 last:border-0"
                        onClick={() => onSelectPlace(place, 'start')}
                      >
                        <div className="font-bold text-gray-800">{place.name}</div>
                        <div className="text-xs text-blue-600">📍 Place</div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onUseMyLocation}
            disabled={locatingStart}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            title={t('route_planner.use_location', 'Use my location')}
          >
            {locatingStart ? (
              <LoaderIconLocal className="w-5 h-5 text-gray-600" />
            ) : (
              <CrosshairIconLocal className="w-5 h-5 text-gray-600" />
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
          onClick={onSwap}
          className="w-10 h-10 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 hover:border-teal-400 transition-colors shadow-sm"
          title={t('route_planner.swap', 'Swap')}
        >
          <ArrowsUpDownIconLocal className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* To Input */}
      <div className="relative mt-4">
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          {t('route_planner.to', 'To')}
        </label>
        <div className="relative">
          <MapPinIconLocal className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
          <input
            type="text"
            value={endInput}
            onChange={(e) => onEndChange(e.target.value)}
            onFocus={() => onFocusField('end')}
            onBlur={onBlurField}
            placeholder={t('route_planner.search_placeholder', 'Search stop, place or ID')}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
          />
          {(suggestions.length > 0 || placeResults.length > 0) && activeField === 'end' && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-1 max-h-60 overflow-y-auto">
                {suggestions.map(stop => (
                  <button
                    key={stop.id}
                    className="w-full text-left px-4 py-2 hover:bg-teal-50 border-b border-gray-50 last:border-0"
                    onClick={() => onSelectStop(stop, 'end')}
                  >
                    <div className="font-bold text-gray-800">{stop.name}</div>
                    <div className="text-xs text-teal-600 font-mono">{stop.id}</div>
                  </button>
                ))}
                {/* Place Results */}
                {placeResults.length > 0 && (
                  <>
                    <div className="px-4 py-1 text-xs text-gray-400 bg-gray-50 font-semibold">Places</div>
                    {placeResults.map((place, idx) => (
                      <button
                        key={`place-end-${idx}`}
                        className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-gray-50 last:border-0"
                        onClick={() => onSelectPlace(place, 'end')}
                      >
                        <div className="font-bold text-gray-800">{place.name}</div>
                        <div className="text-xs text-blue-600">📍 Place</div>
                      </button>
                    ))}
                  </>
                )}
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
        onClick={onFindRoute}
        disabled={loading || !startInput || !endInput}
        className="w-full mt-6 py-3.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <LoaderIconLocal className="w-5 h-5" />
            {t('route_planner.searching', 'Searching...')}
          </>
        ) : (
          <>
            <SearchIconLocal className="w-5 h-5" />
            {t('route_planner.find_route', 'Find Route')}
          </>
        )}
      </button>
    </div>
  );
};
