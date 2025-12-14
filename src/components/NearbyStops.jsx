import React, { useState, useEffect } from 'react';
import govData from '../data/gov_data.json';
const stopsData = govData.stops;

const NearbyStops = ({ onClose, onSelectRoute }) => {
  const [nearbyStops, setNearbyStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        findNearby(latitude, longitude);
      },
      (err) => {
        console.error("Geo Error:", err);
        setPermissionDenied(true);
        setLoading(false);
        // Fallback: Show random stops or just error?
        // Maybe default to a central location (Ferreira Amaral)? 
        // For now just error.
      }
    );
  }, []);

  const findNearby = (lat, lon) => {
    try {
        const processed = stopsData.map(stop => {
            const dist = getDistanceFromLatLonInKm(lat, lon, stop.lat, stop.lon);
            // Parse routes from raw.ROUTE_NOS string "33,26A,..."
            let routes = [];
            if (stop.raw && stop.raw.ROUTE_NOS) {
                routes = stop.raw.ROUTE_NOS.split(',').map(r => r.trim());
            }
            return { ...stop, distance: dist, routes };
        });

        // Sort by distance
        processed.sort((a, b) => a.distance - b.distance);

        // Take top 20
        setNearbyStops(processed.slice(0, 20));
        setLoading(false);
    } catch (e) {
        setError("Failed to process stop data.");
        setLoading(false);
    }
  };

  // Haversine Formula
  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  // deg2rad below
    var dLon = deg2rad(lon2-lon1); 
    var a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
      ; 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c; // Distance in km
    return d;
  }

  const deg2rad = (deg) => {
    return deg * (Math.PI/180)
  }

  const formatDistance = (km) => {
      if (km < 1) return `${Math.round(km * 1000)}m`;
      return `${km.toFixed(1)}km`;
  }

  return (
    <div className="flex flex-col h-full bg-white animate-fade-in-up">
        
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 sticky top-0 z-10">
            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                📍 Nearby Stops
            </h2>
            <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                title="Close"
            >
                ✕
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading && (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p>Locating you...</p>
                </div>
            )}

            {permissionDenied && (
                <div className="text-center p-6 text-gray-500">
                    <div className="text-4xl mb-2">🚫</div>
                    <p>Location access denied.</p>
                    <p className="text-sm">Please enable location services to find nearby stops.</p>
                </div>
            )}

            {!loading && !permissionDenied && nearbyStops.length === 0 && (
                <div className="text-center text-gray-500">No stops found nearby.</div>
            )}

            {nearbyStops.map(stop => (
                <div key={stop.code} className="border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow bg-white">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">{stop.name}</h3>
                            <div className="text-xs text-gray-400 font-mono">{stop.code}</div>
                        </div>
                        <div className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-1">
                            <span>📍</span> {formatDistance(stop.distance)}
                        </div>
                    </div>
                    
                    {/* Routes Chips */}
                    <div className="flex flex-wrap gap-2 mt-2">
                        {stop.routes && stop.routes.map(route => (
                            <button
                                key={route}
                                onClick={() => {
                                    onSelectRoute(route);
                                    onClose();
                                }}
                                className="px-3 py-1 bg-gray-100 hover:bg-teal-50 text-gray-600 hover:text-teal-700 text-sm font-medium rounded-full transition-colors border border-transparent hover:border-teal-200"
                            >
                                {route}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};

export default NearbyStops;
