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
const createBusIcon = (bus) => {
    // Determine color based on busType
    // 1=Large (Blue), 2=Medium (Green), 3=Small (Purple)
    // Fallback: Blue
    let bgColor = 'bg-blue-600';
    let borderColor = 'border-blue-700';
    
    if (bus.busType === '2') { bgColor = 'bg-teal-600'; borderColor = 'border-teal-700'; }
    if (bus.busType === '3') { bgColor = 'bg-purple-600'; borderColor = 'border-purple-700'; }

    return L.divIcon({
        html: `
        <div class="relative flex flex-col items-center select-none" style="transform: translateY(-20px);">
            <!-- Bus Body -->
            <div class="${bgColor} ${borderColor} border-2 rounded-lg shadow-lg p-1 min-w-[50px] text-center flex flex-col items-center z-10">
                <div class="text-[10px] font-bold text-white leading-tight whitespace-nowrap px-1">
                    ${bus.busPlate}
                </div>
                <div class="text-[9px] text-white/90 leading-tight">
                    ${bus.speed} km/h
                </div>
            </div>
            <!-- Triangle Pointer -->
            <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] ${borderColor} transform -translate-y-[2px]"></div>
        </div>
        `,
        className: 'bus-marker-label-icon', // Use new class avoid default styling
        iconSize: [60, 40],
        iconAnchor: [30, 40]
    });
};

// Component to auto-fit bounds
const FitBounds = ({ stations, buses }) => {
    const map = useMap();
    const hasFitRef = React.useRef(false);

    useEffect(() => {
        // Filter stations with valid coordinates (if any). Stations usually have latitude/longitude normalized by now.
        const validStations = stations ? stations.filter(s => s.latitude && s.longitude) : [];
        
        // Buses: Normalize check
        const validBuses = buses ? buses.filter(b => (b.latitude || b.lat) && (b.longitude || b.lon || b.lng)) : [];

        // Only fit bounds if we haven't done so yet, and we have valid stations (or buses as fallback)
        if (!hasFitRef.current && (validStations.length > 0 || validBuses.length > 0)) {
            const bounds = L.latLngBounds();
            validStations.forEach(s => bounds.extend([s.latitude, s.longitude]));
            validBuses.forEach(b => bounds.extend([b.latitude || b.lat, b.longitude || b.lon || b.lng]));
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [20, 20] });
                hasFitRef.current = true; // Mark as fitted
            }
        }
    }, [stations, buses, map]);
    
    // Reset ref if the route changes (heuristic: stations array length significantly different or empty)
    // Actually, distinct routes might have same station count. Better to rely on parent to remount or key change?
    // For now, simple "fit once" logic is what's requested for "refreshing".
    // If user changes route, stations array identity changes. We might want to reset.
    // Let's rely on stations.length changing or just key the component.
    
    return null;
};

const MapComponent = ({ stations, buses, traffic }) => {
  // Hydrate stations with coordinates from Traffic Data (if available)
  // Traffic data is an array of segments. Segment i usually starts at Station i.
  const hydratedStations = stations.map((station, i) => {
      const segment = traffic && traffic[i];
      // Use existing coords if present, otherwise try to get from traffic segment start
      const lat = station.latitude || (segment && segment.path && segment.path.length > 0 ? segment.path[0][0] : null);
      const lon = station.longitude || (segment && segment.path && segment.path.length > 0 ? segment.path[0][1] : null);
      
      return {
          ...station,
          latitude: lat,
          longitude: lon,
          trafficLevel: segment ? segment.traffic : null
      };
  }).filter(s => s.latitude && s.longitude);

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
        
        {/* Traffic / Route Polylines */}
        {traffic && traffic.map((seg, idx) => {
            if (!seg.path || seg.path.length < 2) return null;
            const color = seg.traffic == 1 ? "green" 
                        : seg.traffic == 2 ? "orange" 
                        : seg.traffic >= 3 ? "red" 
                        : "teal";
            return <Polyline key={`path-${idx}`} positions={seg.path} color={color} weight={5} opacity={0.6} />;
        })}

        {/* Stations */}
        {hydratedStations.map((stop, idx) => {
           const color = stop.trafficLevel == 1 ? "green" 
                       : stop.trafficLevel == 2 ? "orange" 
                       : stop.trafficLevel >= 3 ? "red" 
                       : "teal";

           return (
           <CircleMarker 
             key={`stop-${stop.stationCode || idx}`}
             center={[stop.latitude, stop.longitude]}
             radius={5}
             fillColor="white"
             color={color}
             weight={2}
             fillOpacity={1}
             zIndexOffset={100}
           >
             <Popup>
               <div className="text-center">
                   <div className="font-bold">{idx + 1}. {stop.stationName || stop.staName}</div>
                   <div className="text-xs text-gray-500">{stop.stationCode || stop.staCode}</div>
               </div>
             </Popup>
           </CircleMarker>
           );
        })}

        {/* Real-time Buses */}
        {buses.map((bus, idx) => {
            let lat = parseFloat(bus.latitude || bus.lat);
            let lon = parseFloat(bus.longitude || bus.lon || bus.lng);
            
            // Fallback Hydration: If GPS is missing, use Station Coords
            if ((isNaN(lat) || isNaN(lon)) && bus.staCode) {
                 const matchStation = hydratedStations.find(s => s.staCode === bus.staCode);
                 if (matchStation && matchStation.latitude && matchStation.longitude) {
                     lat = parseFloat(matchStation.latitude);
                     lon = parseFloat(matchStation.longitude);
                 }
            }

            if (isNaN(lat) || isNaN(lon)) return null;

            return (
            <Marker 
                key={bus.busPlate || `bus-${idx}`}
                position={[lat, lon]}
                icon={createBusIcon(bus)} 
                zIndexOffset={1000} // Buses on top
            >
                <Popup>
                    <div className="text-center">
                        <div className="font-bold text-blue-600">{bus.busPlate}</div>
                        <div className="text-xs">Speed: {bus.speed} km/h</div>
                    </div>
                </Popup>
            </Marker>
            );
        })}

        <FitBounds key={stations ? stations.length : 'empty'} stations={hydratedStations} buses={buses} />
      </MapContainer>
    </div>
  );
};

export default MapComponent;
