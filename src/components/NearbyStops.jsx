import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { fetchBusListApi, fetchMapLocationApi, fetchTrafficApi } from '../services/api';
import govData from '../data/gov_data.json';

// Import extracted utilities
import { getDistanceFromLatLonInKm, formatDistance } from '../utils/distance';
import { getStopCoords, getStopName } from '../utils/stopCodeMatcher';
import { getEtaColor, getEtaTextColor } from '../utils/etaColors';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const stopsData = govData.stops;

// NearbyFitBounds is now imported from features/nearby-stops/components
import { NearbyFitBounds } from '../features/nearby-stops/components/NearbyFitBounds';
import { NearbyStopsHeader } from '../features/nearby-stops/components/NearbyStopsHeader';
import { useArrivalData } from '../features/nearby-stops/hooks/useArrivalData';

const NearbyStops = ({ onClose, onSelectRoute }) => {
  const [nearbyStops, setNearbyStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [expandedStop, setExpandedStop] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [viewMode, setViewMode] = useState('list'); 
  
  // Use extracted hook for arrival data management
  const { arrivalData, loadingArrivals, stopBuses, lastUpdated, fetchStopData } = useArrivalData();

  // ... (useEffect for geolocation) ...
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setLoading(false);
      return;
    }

    console.log("Requesting Geolocation...");
    const timeoutId = setTimeout(() => {
        // Fallback or just log if it takes too long
        console.warn("Geolocation timed out (manual check).");
        // We could force an error here if we want to stop "finding forever"
        // But typically the OS prompt handles this.
        // Let's force an error state after 15 seconds to unblock UI
        if (loading) {
            setError("Location request timed out. Please check permissions.");
            setLoading(false);
        }
    }, 15000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        console.log("Location Found:", position.coords);
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lon: longitude });
        findNearby(latitude, longitude);
      },
      (err) => {
        clearTimeout(timeoutId);
        console.error("Geo Error:", err);
        setError(`Location access error: ${err.message}`);
        setPermissionDenied(true);
        setLoading(false);
      },
      {
          enableHighAccuracy: true,
          timeout: 10000, 
          maximumAge: 0
      }
    );
    
    return () => clearTimeout(timeoutId);
  }, []);

  const findNearby = (lat, lon) => {
    try {
        const processed = stopsData.map(stop => {
            const dist = getDistanceFromLatLonInKm(lat, lon, stop.lat, stop.lon);
            let routes = [];
            if (stop.raw && stop.raw.ROUTE_NOS) {
                routes = [...new Set(stop.raw.ROUTE_NOS.split(',').map(r => r.trim()))];
            }
            let rawCode = stop.code || stop.raw?.P_ALIAS || stop.raw?.ALIAS || 'UNKNOWN';
            const code = rawCode.replace(/[_-]/g, '/');
            return { ...stop, code, distance: dist, routes };
        });

        processed.sort((a, b) => a.distance - b.distance);
        setNearbyStops(processed.slice(0, 50));
        setLoading(false);
    } catch (e) {
        setError("Failed to process stop data.");
        setLoading(false);
    }
  };

  // Note: getDistanceFromLatLonInKm and formatDistance are now imported from utils/distance
  // Note: fetchStopData is now provided by useArrivalData hook

  // Auto-Refresh Effect
  useEffect(() => {
      let intervalId;
      if (expandedStop) {
          // Initial Fetch
          fetchStopData(expandedStop);

          // Interval Fetch (every 5 seconds)
          intervalId = setInterval(() => {
              fetchStopData(expandedStop);
          }, 5000);
      }

      return () => {
          if (intervalId) clearInterval(intervalId);
      };
  }, [expandedStop, fetchStopData]);

  const handleExpandStop = (stop) => {
      if (expandedStop === stop.code) {
          setExpandedStop(null);
      } else {
          setExpandedStop(stop.code);
          // State is now managed by useArrivalData hook
      }
  };

  const handleManualRefresh = () => {
      if (expandedStop) {
          // Loading state managed by hook
          fetchStopData(expandedStop);
      } else if (userLocation) {
          setLoading(true);
          findNearby(userLocation.lat, userLocation.lon);
      }
  };

  return (
    <div className="flex flex-col h-full bg-white animate-fade-in-up">
        {/* ... Header ... */}
        <NearbyStopsHeader
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={handleManualRefresh}
          onClose={onClose}
        />

        {/* Content */}
        <div className="flex-1 overflow-y-auto relative">
            {loading && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
                    <div className="text-sm">Finding nearby stops...</div>
                </div>
            )}

            {!loading && error && (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center text-red-500">
                    <div className="text-3xl mb-2">⚠️</div>
                    <div>{error}</div>
                    {permissionDenied && <div className="text-xs text-gray-400 mt-2">Please enable location access.</div>}
                </div>
            )}
            
            {!loading && viewMode === 'list' && (
                <div className="p-4 space-y-3">
                     {permissionDenied && (
                        <div className="flex flex-col items-center justify-center p-6 text-gray-500">
                            <div className="text-4xl mb-2">🚫</div>
                            <p>Location access denied.</p>
                            <p className="text-xs mt-1">Enable location to see nearby stops.</p>
                        </div>
                     )}
                     
                     {!permissionDenied && nearbyStops.length === 0 && (
                         <div className="flex flex-col items-center justify-center p-10 text-gray-400">
                             <div className="text-3xl mb-2">🚏</div>
                             <div>No stops found nearby.</div>
                         </div>
                     )}

                     {nearbyStops.map((stop, index) => (
                        <div 
                            key={stop.raw?.POLE_ID || `${stop.code}-${index}`} 
                            className={`border rounded-xl shadow-sm transition-all bg-white overflow-hidden ${expandedStop === stop.code ? 'ring-2 ring-teal-500 shadow-md' : 'hover:shadow-md border-gray-100'}`}
                        >
                             {/* ... existing card content ... */}
                             <div className="p-4 flex justify-between items-start cursor-pointer" onClick={() => handleExpandStop(stop)}>
                                <div>
                                    <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                        {stop.name}
                                        {expandedStop === stop.code ? <span className="text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">Open</span> : <span className="text-xs text-gray-400">▼</span>}
                                    </h3>
                                    <div className="text-xs text-gray-400 font-mono">{stop.code}</div>
                                </div>
                                <div className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                                    <span>📍</span> {formatDistance(stop.distance)}
                                </div>
                            </div>
                            
                            {expandedStop !== stop.code && (
                                <div className="px-4 pb-4 flex flex-wrap gap-2">
                                    {stop.routes && stop.routes.map(route => (
                                        <span key={route} className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">{route}</span>
                                    ))}
                                </div>
                            )}

                            {expandedStop === stop.code && (
                                <div className="bg-gray-50 border-t p-3 text-sm">
                                    {/* Last Updated Timestamp */}
                                    {lastUpdated && (
                                        <div className="text-[10px] text-gray-400 text-right mb-2">
                                            Updated: {lastUpdated.toLocaleTimeString()}
                                        </div>
                                    )}
                                    
                                    {loadingArrivals[stop.code] ? (
                                        <div className="text-gray-500 flex items-center justify-center py-2">Loading live data...</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {stop.routes.map(route => {
                                                const info = arrivalData[stop.code]?.[route];
                                                const isRichInfo = info && typeof info === 'object';
                                                
                                                // Fallback for legacy string format
                                                if (!isRichInfo) {
                                                    const strInfo = info || "---";
                                                    const active = typeof strInfo === 'string' && (strInfo.includes("stops") || strInfo.includes("Arriving"));
                                                    return (
                                                        <div 
                                                            key={route} 
                                                            className="bg-white p-3 rounded-lg border cursor-pointer hover:border-teal-300 transition"
                                                            onClick={(e) => { e.stopPropagation(); onSelectRoute(route, stop.code, null); onClose(); }}
                                                        >
                                                            <div className="font-bold text-lg text-gray-700">{route}</div>
                                                            <div className={`text-xs font-semibold ${active ? 'text-green-600' : 'text-gray-400'}`}>{strInfo}</div>
                                                        </div>
                                                    );
                                                }

                                                // Rich ETA Card
                                                const { buses, destination, totalStops, currentStopIdx, status, minStops, minEta } = info;
                                                
                                                // Note: getEtaColor and getEtaTextColor are now imported from utils/etaColors

                                                // Progress bar calculation
                                                const progressPercent = totalStops > 0 && minStops < 999
                                                    ? Math.round(((totalStops - minStops) / totalStops) * 100)
                                                    : 0;

                                                return (
                                                    <div 
                                                        key={route} 
                                                        className="bg-white rounded-lg border overflow-hidden cursor-pointer hover:border-teal-300 hover:shadow-md transition"
                                                        onClick={(e) => { e.stopPropagation(); onSelectRoute(route, stop.code, info.direction); onClose(); }}
                                                    >
                                                        {/* Header: Route + Destination */}
                                                        <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-gray-50 to-white">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-xl text-teal-600">{route}</span>
                                                                {destination && (
                                                                    <span className="text-xs text-gray-500">→ {destination}</span>
                                                                )}
                                                            </div>
                                                            {status === 'arriving' && (
                                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                                                                    Arriving
                                                                </span>
                                                            )}
                                                        </div>



                                                        {/* Bus List */}
                                                        <div className="p-3">
                                                            {status === 'no-service' && (
                                                                <div className="text-gray-400 text-xs">No active service</div>
                                                            )}
                                                            {status === 'no-approaching' && (
                                                                <div className="text-gray-400 text-xs">No approaching buses</div>
                                                            )}
                                                            {status === 'arriving' && (
                                                                <div className="flex items-center gap-2 text-green-600">
                                                                    <span className="text-lg">🚌</span>
                                                                    <span className="font-semibold">At station / Arriving now</span>
                                                                </div>
                                                            )}
                                                            {status === 'active' && buses && buses.length > 0 && (
                                                                <div className="space-y-2">
                                                                    {buses.map((bus, idx) => (
                                                                        <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-base">🚌</span>
                                                                                <div>
                                                                                    <div className="text-[10px] text-gray-400 font-mono">
                                                                                        <span className="font-bold text-gray-600">{bus.plate}</span>
                                                                                        <span className="mx-1">•</span>
                                                                                        <span>@ {bus.currentStop}</span>
                                                                                    </div>
                                                                                    <div className="text-xs text-gray-600">
                                                                                        {bus.stopsAway} {bus.stopsAway === 1 ? 'stop' : 'stops'} • {bus.distanceM > 0 ? `${(bus.distanceM / 1000).toFixed(1)}km` : '< 0.1km'}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div className={`text-lg font-bold ${getEtaTextColor(bus.eta)}`}>
                                                                                {bus.eta === 0 ? '<1' : bus.eta}
                                                                                <span className="text-xs font-normal ml-0.5">min</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                     ))}
                </div>
            )}

            {!loading && viewMode === 'map' && userLocation && (
                <div className="h-full w-full">
                    <MapContainer center={[userLocation.lat, userLocation.lon]} zoom={15} style={{ height: '100%', width: '100%' }}>
                        <TileLayer
                          attribution='&copy; CARTO'
                          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                        />
                        <NearbyFitBounds center={userLocation} stops={nearbyStops} buses={stopBuses} expandedStop={expandedStop} />
                        
                        {/* User Marker */}
                        <CircleMarker center={[userLocation.lat, userLocation.lon]} radius={8} pathOptions={{ color: 'blue', fillColor: '#3b82f6', fillOpacity: 1 }}>
                            <Popup>You are here</Popup>
                        </CircleMarker>

                        {/* Stops: Filter if Expanded */}
                        {nearbyStops.map(stop => {
                            // If expandedStop is set, split behavior:
                            // Show ONLY expanded stop? Or show others as faded/small?
                            // User request: "the map should show the only that stop"
                            const isSelected = expandedStop === stop.code;
                            if (expandedStop && !isSelected) return null; // Hide others

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
                                                onClick={() => { setViewMode('list'); handleExpandStop(stop); }} 
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
            )}
        </div>
    </div>
  );
};

export default NearbyStops;
