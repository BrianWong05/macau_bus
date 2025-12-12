import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom Bus Icon
const createBusIcon = (heading) => L.divIcon({
  html: `<div style="transform: rotate(${heading || 0}deg); font-size: 20px;">🚌</div>`,
  className: 'bus-marker-icon', // no default styling
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

// Component to auto-fit bounds
const FitBounds = ({ stations, buses }) => {
    const map = useMap();
    useEffect(() => {
        // Filter stations with valid coordinates (if any)
        const validStations = stations ? stations.filter(s => s.latitude && s.longitude) : [];
        const validBuses = buses ? buses.filter(b => b.latitude && b.longitude) : [];

        if (validStations.length > 0 || validBuses.length > 0) {
            const bounds = L.latLngBounds();
            validStations.forEach(s => bounds.extend([s.latitude, s.longitude]));
            validBuses.forEach(b => bounds.extend([b.latitude, b.longitude]));
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [20, 20] });
            }
        }
    }, [stations, buses, map]);
    return null;
};

const MapComponent = ({ stations, buses }) => {
  // Convert stations to path for Polyline - ONLY if coordinates exist
  const validStations = stations ? stations.filter(s => s.latitude && s.longitude) : [];
  const pathCoordinates = validStations.map(s => [s.latitude, s.longitude]);
  const hasPath = pathCoordinates.length > 1;

  return (
    <div className="h-[500px] w-full rounded-xl overflow-hidden shadow-inner border border-gray-200">
      <MapContainer 
        center={[22.1987, 113.5439]} // Default Macau center
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Route Path (Only if data available) */}
        {hasPath && <Polyline positions={pathCoordinates} color="teal" weight={4} opacity={0.7} />}

        {/* Stations (Only if data available) */}
        {validStations.map((stop, idx) => (
           <CircleMarker 
             key={`stop-${stop.stationCode || idx}`}
             center={[stop.latitude, stop.longitude]}
             radius={6}
             fillColor="white"
             color="teal"
             weight={2}
             fillOpacity={1}
           >
             <Popup>
               <div className="text-center">
                   <div className="font-bold">{idx + 1}. {stop.stationName || stop.staName}</div>
                   <div className="text-xs text-gray-500">{stop.stationCode || stop.staCode}</div>
               </div>
             </Popup>
           </CircleMarker>
        ))}

        {/* Real-time Buses */}
        {buses.map((bus, idx) => (
            bus.latitude && bus.longitude && (
            <Marker 
                key={`bus-${idx}`}
                position={[bus.latitude, bus.longitude]}
                icon={createBusIcon(0)} // No heading data yet?
            >
                <Popup>
                    <div className="text-center">
                        <div className="font-bold text-blue-600">{bus.busPlate}</div>
                        <div className="text-xs">Speed: {bus.speed} km/h</div>
                    </div>
                </Popup>
            </Marker>
            )
        ))}

        <FitBounds stations={stations} buses={buses} />
      </MapContainer>
    </div>
  );
};

export default MapComponent;
