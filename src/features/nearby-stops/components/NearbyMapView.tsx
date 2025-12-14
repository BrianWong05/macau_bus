/**
 * NearbyMapView - Map view component for nearby stops
 */

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { NearbyFitBounds } from './NearbyFitBounds';
import { NearbyStop, MapBus } from '../types';

interface NearbyMapViewProps {
  userLocation: { lat: number; lon: number };
  nearbyStops: NearbyStop[];
  stopBuses: MapBus[];
  expandedStop: string | null;
  onStopSelect: (stop: NearbyStop) => void;
}

export const NearbyMapView: React.FC<NearbyMapViewProps> = ({
  userLocation,
  nearbyStops,
  stopBuses,
  expandedStop,
  onStopSelect,
}) => {
  return (
    <div className="h-full w-full">
      <MapContainer 
        center={[userLocation.lat, userLocation.lon]} 
        zoom={15} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <NearbyFitBounds 
          center={userLocation} 
          stops={nearbyStops} 
          buses={stopBuses} 
          expandedStop={expandedStop} 
        />
        
        {/* User Marker */}
        <CircleMarker 
          center={[userLocation.lat, userLocation.lon]} 
          radius={8} 
          pathOptions={{ color: 'blue', fillColor: '#3b82f6', fillOpacity: 1 }}
        >
          <Popup>You are here</Popup>
        </CircleMarker>

        {/* Stops: Filter if Expanded */}
        {nearbyStops.map(stop => {
          const isSelected = expandedStop === stop.code;
          if (expandedStop && !isSelected) return null;

          return (
            <CircleMarker 
              key={stop.code} 
              center={[stop.lat, stop.lon]}
              radius={isSelected ? 10 : 6}
              pathOptions={{ 
                color: 'white', 
                fillColor: isSelected ? '#14b8a6' : '#ef4444', 
                fillOpacity: 1, 
                weight: 2 
              }}
            >
              <Popup>
                <div className="text-center">
                  <div className="font-bold">{stop.name}</div>
                  <div className="text-xs text-gray-500 mb-2">{stop.code}</div>
                  <button 
                    className="bg-teal-500 text-white text-xs px-2 py-1 rounded"
                    onClick={() => onStopSelect(stop)} 
                  >
                    View Arrivals
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Incoming Buses */}
        {stopBuses.map((bus, i) => (
          <Marker 
            key={`bus-${i}`} 
            position={[bus.latitude, bus.longitude]}
            icon={L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: white; border: 2px solid #0d9488; border-radius: 12px; padding: 0 6px; height: 24px; min-width: 36px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; color: #0f766e; box-shadow: 0 2px 4px rgba(0,0,0,0.2); white-space: nowrap;">
                <span style="font-size: 10px; margin-right: 2px;">🚌</span> ${bus.route}
              </div>`,
              iconSize: [40, 24],
              iconAnchor: [20, 12]
            })}
          >
            <Popup>
              <div className="text-center font-bold text-teal-700">
                Route {bus.route}
              </div>
              <div className="text-center text-xs">
                {bus.busPlate}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
