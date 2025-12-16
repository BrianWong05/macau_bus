import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// ============== Internal Helper Components ==============

interface FitBoundsProps {
  startCoords: { lat: number; lng: number } | null;
  endCoords: { lat: number; lng: number } | null;
  lastSelectedField: 'start' | 'end' | null;
}

const FitBoundsComponent: React.FC<FitBoundsProps> = ({ startCoords, endCoords, lastSelectedField }) => {
  const map = useMap();
  
  useEffect(() => {
    if (lastSelectedField === 'end' && endCoords) {
      map.setView([endCoords.lat, endCoords.lng], 17);
    } else if (lastSelectedField === 'start' && startCoords) {
      map.setView([startCoords.lat, startCoords.lng], 17);
    } else if (startCoords && endCoords) {
      const bounds = L.latLngBounds([
        [startCoords.lat, startCoords.lng],
        [endCoords.lat, endCoords.lng]
      ]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (startCoords) {
      map.setView([startCoords.lat, startCoords.lng], 17);
    } else if (endCoords) {
      map.setView([endCoords.lat, endCoords.lng], 17);
    }
  }, [map, startCoords, endCoords, lastSelectedField]);
  
  return null;
};

interface MapClickHandlerProps {
  pinDropMode: 'start' | 'end' | null;
  onMapClick: (lat: number, lng: number, mode: 'start' | 'end') => void;
}

const MapClickHandler: React.FC<MapClickHandlerProps> = ({ pinDropMode, onMapClick }) => {
  useMapEvents({
    click: (e) => {
      if (pinDropMode) {
        onMapClick(e.latlng.lat, e.latlng.lng, pinDropMode);
      }
    },
  });
  return null;
};

// ============== Main Component ==============

interface PlannerMapProps {
  startCoords: { lat: number; lng: number } | null;
  endCoords: { lat: number; lng: number } | null;
  lastSelectedField: 'start' | 'end' | null;
  pinDropMode: 'start' | 'end' | null;
  onSetPinDropMode: (mode: 'start' | 'end' | null) => void;
  onMapClick: (lat: number, lng: number, mode: 'start' | 'end') => void;
}

export const PlannerMap: React.FC<PlannerMapProps> = ({
  startCoords,
  endCoords,
  lastSelectedField,
  pinDropMode,
  onSetPinDropMode,
  onMapClick
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative z-0">
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">
          {pinDropMode 
            ? t('route_planner.tap_to_set', `Tap map to set ${pinDropMode === 'start' ? 'start' : 'end'}`)
            : t('route_planner.map_preview', 'Location Preview')
          }
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => onSetPinDropMode(pinDropMode === 'start' ? null : 'start')}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              pinDropMode === 'start' 
                ? 'bg-green-500 text-white' 
                : 'bg-gray-200 text-gray-600 hover:bg-green-100'
            }`}
          >
            📍 {t('route_planner.set_start', 'Set Start')}
          </button>
          <button
            onClick={() => onSetPinDropMode(pinDropMode === 'end' ? null : 'end')}
            className={`px-2 py-1 text-xs rounded-md transition-colors ${
              pinDropMode === 'end' 
                ? 'bg-red-500 text-white' 
                : 'bg-gray-200 text-gray-600 hover:bg-red-100'
            }`}
          >
            📍 {t('route_planner.set_end', 'Set End')}
          </button>
        </div>
      </div>
      <div style={{ height: '300px' }}>
        <MapContainer
          center={[22.1987, 113.5439]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          <FitBoundsComponent startCoords={startCoords} endCoords={endCoords} lastSelectedField={lastSelectedField} />
          <MapClickHandler pinDropMode={pinDropMode} onMapClick={onMapClick} />
          
          {/* Start Marker (Green) */}
          {startCoords && (
            <Marker 
              position={[startCoords.lat, startCoords.lng]}
              icon={L.divIcon({
                className: '',
                html: `<div style="
                  width: 14px;
                  height: 14px;
                  background-color: #22c55e;
                  border: 3px solid white;
                  border-radius: 50%;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                "></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })}
            >
              <Popup>{t('route_planner.start_location', 'Start')}</Popup>
            </Marker>
          )}
          
          {/* End Marker (Red) */}
          {endCoords && (
            <Marker 
              position={[endCoords.lat, endCoords.lng]}
              icon={L.divIcon({
                className: '',
                html: `<div style="
                  width: 14px;
                  height: 14px;
                  background-color: #ef4444;
                  border: 3px solid white;
                  border-radius: 50%;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                "></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })}
            >
              <Popup>{t('route_planner.end_location', 'Destination')}</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
};
