import React, { useState, useEffect } from 'react';
import { fetchBusListApi } from '../services/api';
import govData from '../data/gov_data.json';
const stopsData = govData.stops;

const NearbyStops = ({ onClose, onSelectRoute }) => {
  const [nearbyStops, setNearbyStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [expandedStop, setExpandedStop] = useState(null);
  const [arrivalData, setArrivalData] = useState({}); // { stopCode: { route: "3 stops" } }
  const [loadingArrivals, setLoadingArrivals] = useState({}); // { stopCode: true/false }

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
                // Split, trim, and deduplicate
                routes = [...new Set(stop.raw.ROUTE_NOS.split(',').map(r => r.trim()))];
            }
            // Fix: Map code from raw if missing
            // Fix: Map code from raw if missing, and enforce slash format (T311/2) as requested
            let rawCode = stop.code || stop.raw?.P_ALIAS || stop.raw?.ALIAS || 'UNKNOWN';
            const code = rawCode.replace(/[_-]/g, '/');
            return { ...stop, code, distance: dist, routes };
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

  // --- New Logic: Fetch Arrivals for a Stop ---
  const handleExpandStop = async (stop) => {
      // Toggle logic
      if (expandedStop === stop.code) {
          setExpandedStop(null);
          return;
      }
      setExpandedStop(stop.code);

      // Guard: Don't refetch if already valid (cache for 1 min?) - For now just re-fetch
      setLoadingArrivals(prev => ({...prev, [stop.code]: true}));
      setArrivalData(prev => ({...prev, [stop.code]: {} })); // Clear old

      try {
          // Process all routes for this stop
          // Note: We don't know direction. We must probe.
          // This is expensive (N routes * 2 directions).
          
          const newArrivals = {};
          
          await Promise.all(stop.routes.map(async (route) => {
               // Initial guess: Try Dir 0 first
               // We only need one valid direction that CONTAINS this stop.
               
               let found = false;
               let info = "Waiting...";
               
               // Helper to check direction
               const checkDir = async (d) => {
                   try {
                     // Fetch both types in parallel to ensure we catch buses
                     const [res2, res0] = await Promise.all([
                        fetchBusListApi(route, d, '2'),
                        fetchBusListApi(route, d, '0')
                     ]);

                     let chosenStops = null;

                     // Helper to valid stops
                     const isValid = (r) => r.data && r.data.data && r.data.data.routeInfo && r.data.data.routeInfo.length > 0;
                     // Helper to counts buses (Property is 'busInfo' not 'buses'!)
                     const countBuses = (stops) => stops.flatMap(s => s.busInfo || []).length;

                     // Determine matching stop index
                     const findStopIndex = (stops) => {
                         return stops.findIndex(s => {
                             const sCode = (s.staCode || "").replace(/\//g, '-').replace(/_/g, '-');
                             const target = (stop.code || "").replace(/\//g, '-').replace(/_/g, '-');
                             const targetBase = target.split('-')[0];
                             if (sCode === target) return true;
                             if (sCode === targetBase || sCode.split('-')[0] === targetBase) return true;
                             return false;
                         });
                     };

                     // Check candidates
                     let candidates = [];
                     if (isValid(res2)) candidates.push(res2.data.data.routeInfo);
                     if (isValid(res0)) candidates.push(res0.data.data.routeInfo);

                     // Find best candidate
                     let bestStops = null;
                     let bestIdx = -1;

                     for (const cStops of candidates) {
                         const idx = findStopIndex(cStops);
                         if (idx !== -1) {
                             // Found stop. Is it better?
                             if (!bestStops) {
                                 bestStops = cStops;
                                 bestIdx = idx;
                             } else {
                                 // Already have a match. Prefer the one with MORE buses.
                                 if (countBuses(cStops) > countBuses(bestStops)) {
                                     bestStops = cStops;
                                     bestIdx = idx;
                                 }
                             }
                         }
                     }

                     if (bestStops && bestIdx !== -1) {
                         const stops = bestStops;
                         const stopIdx = bestIdx;
                         
                         if (stopIdx !== -1) {
                             // Found stop in this route direction!
                             found = true;
                             
                             // Calculate Arrivals
                             // Find active buses before this stop
                            const buses = stops.flatMap(s => s.busInfo || []);
                            
                            // Parse bus stop indices
                            // Bus object: { busPlate: "MW-12-34", ... } -> It's attached to the stop object usually.
                            // In this API structure, 'buses' array is inside the 'stop' object.
                            
                            // Find closest bus
                            let minStops = 999;
                            let closestBus = null;

                             for (let i = 0; i <= stopIdx; i++) {
                                 if (stops[i].busInfo && stops[i].busInfo.length > 0) {
                                     const dist = stopIdx - i;
                                     if (dist < minStops) {
                                         minStops = dist;
                                         closestBus = stops[i].busInfo[0];
                                     }
                                 }
                             }

                              const totalActiveBuses = stops.flatMap(s => s.busInfo || []).length;
 
                              if (minStops === 999) {
                                  if (totalActiveBuses > 0) {
                                      info = "No approaching bus"; // Buses exist but passed or far away
                                  } else {
                                      info = "No active service"; // No buses on this line
                                  }
                              } else if (minStops === 0) {
                                  info = "Arriving / At Station";
                              } else {
                                  info = `${minStops} stops away`;
                              }
                             return true; // Stop searching directions for THIS route
                         }
                     }
                   } catch (e) { console.warn(e); }
                   return false;
               };

               // Probe Dir 0
               if (await checkDir('0')) {
                   newArrivals[route] = info;
                   return;
               }
               // Probe Dir 1
               if (await checkDir('1')) {
                   newArrivals[route] = info;
               } else {
                   newArrivals[route] = "No Service / Wrong Sta";
               }

          }));

          setArrivalData(prev => ({...prev, [stop.code]: newArrivals }));

      } catch (err) {
          console.error("Arrival fetch failed", err);
      } finally {
          setLoadingArrivals(prev => ({...prev, [stop.code]: false}));
      }
  };

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

            {nearbyStops.map((stop, index) => (
                <div 
                    key={stop.raw?.POLE_ID || `${stop.code}-${index}`} 
                    className={`border rounded-xl shadow-sm transition-all bg-white overflow-hidden ${expandedStop === stop.code ? 'ring-2 ring-teal-500 shadow-md' : 'hover:shadow-md border-gray-100'}`}
                >
                    <div 
                        className="p-4 flex justify-between items-start cursor-pointer"
                        onClick={() => handleExpandStop(stop)}
                    >
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                {stop.name}
                                {expandedStop === stop.code ? 
                                    <span className="text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">Open</span> : 
                                    <span className="text-xs text-gray-400">▼</span>
                                }
                            </h3>
                            <div className="text-xs text-gray-400 font-mono">{stop.code}</div>
                        </div>
                        <div className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap flex items-center gap-1">
                            <span>📍</span> {formatDistance(stop.distance)}
                        </div>
                    </div>
                    
                    {/* Collapsed State: Chips */}
                    {expandedStop !== stop.code && (
                        <div className="px-4 pb-4 flex flex-wrap gap-2">
                            {stop.routes && stop.routes.map(route => (
                                <span key={route} className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">
                                    {route}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Expanded State: Arrival Table */}
                    {expandedStop === stop.code && (
                        <div className="bg-gray-50 border-t p-3 text-sm">
                            {loadingArrivals[stop.code] ? (
                                <div className="text-gray-500 flex items-center gap-2 justify-center py-2">
                                    <div className="animate-spin h-4 w-4 border-2 border-teal-500 border-t-transparent rounded-full"></div>
                                    Loading live data...
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {stop.routes.map(route => {
                                        const info = arrivalData[stop.code]?.[route] || "---";
                                        const active = info.includes("stops") || info.includes("Arriving");
                                        return (
                                            <div 
                                                key={route} 
                                                className="bg-white p-2 rounded border flex flex-col justify-between cursor-pointer hover:border-teal-300 transition"
                                                onClick={(e) => {
                                                    e.stopPropagation(); // prevent toggle
                                                    onSelectRoute(route);
                                                    onClose();
                                                }}
                                            >
                                                <div className="font-bold text-lg text-gray-700">{route}</div>
                                                <div className={`text-xs font-semibold ${active ? 'text-green-600' : 'text-gray-400'}`}>
                                                    {info}
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
    </div>
  );
};

export default NearbyStops;
