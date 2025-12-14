import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { fetchBusListApi, fetchMapLocationApi, fetchTrafficApi } from '../services/api';
import govData from '../data/gov_data.json';

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

// Helper component to auto-fit bounds
const NearbyFitBounds = ({ center, stops, buses, expandedStop }) => {
    const map = useMap();
    const lastExpandedStop = useRef(null);
    const hasCentered = useRef(false);

    useEffect(() => {
        if (!map) return;
        const bounds = L.latLngBounds();
        
        // Logical Check: Should we zoom?
        // 1. If expandedStop changed (User clicked a new stop)
        // 2. If initial load (User hasn't moved yet)
        
        const isNewSelection = expandedStop !== lastExpandedStop.current;
        
        if (expandedStop) {
            // Only zoom if this is a NEW selection. 
            // If it's the SAME stop updating (auto-refresh), DO NOT zoom.
             if (isNewSelection) {
                 const stop = stops.find(s => s.code === expandedStop);
                 if (stop) {
                     bounds.extend([stop.lat, stop.lon]);
                     // We can include buses here if we want initial fit to include them, 
                     // but if we want to be stable, maybe just focusing on the stop is safer?
                     // Or we include buses ONLY on first zoom.
                     if (buses && buses.length > 0) {
                         buses.forEach(b => {
                             if (b.latitude && b.longitude) bounds.extend([b.latitude, b.longitude]);
                         });
                     }
                     if (bounds.isValid()) {
                         map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
                     }
                     lastExpandedStop.current = expandedStop;
                 }
             }
        } else if (center && stops.length > 0 && !hasCentered.current) {
            // Initial center on user location
            bounds.extend([center.lat, center.lon]);
            stops.forEach(s => bounds.extend([s.lat, s.lon]));
            
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [50, 50] });
                hasCentered.current = true;
            }
        }
        
    }, [center, stops, map, expandedStop, buses]); // Dependencies kept, but logic gates execution
    return null;
};

const NearbyStops = ({ onClose, onSelectRoute }) => {
  const [nearbyStops, setNearbyStops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [expandedStop, setExpandedStop] = useState(null);
  const [arrivalData, setArrivalData] = useState({}); 
  const [loadingArrivals, setLoadingArrivals] = useState({});
  const [userLocation, setUserLocation] = useState(null);
  const [viewMode, setViewMode] = useState('list'); 
  const [stopBuses, setStopBuses] = useState([]); // Buses heading to expanded stop
  const [lastUpdated, setLastUpdated] = useState(null); // Timestamp of last data fetch

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

  // Haversine
  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    var R = 6371; 
    var dLat = deg2rad(lat2-lat1);  
    var dLon = deg2rad(lon2-lon1); 
    var a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c; 
    return d;
  }

  const deg2rad = (deg) => deg * (Math.PI/180);

  const formatDistance = (km) => {
      if (km < 1) return `${Math.round(km * 1000)}m`;
      return `${km.toFixed(1)}km`;
  }

  // New Fetch Logic (Separated from Event Handler)
  const fetchStopData = async (stopCode) => {
      // Fix: Normalize lookup because raw data might use underscores/hyphens while state uses slashes
      const stop = stopsData.find(s => {
          const raw = s.code || s.raw?.P_ALIAS || s.raw?.ALIAS || "";
          return raw.replace(/[_-]/g, '/') === stopCode;
      });
      
      if (!stop) {
          setLoadingArrivals(prev => ({...prev, [stopCode]: false}));
          return;
      }

      // Don't clear previous data immediately to avoid flash, just set loading overlay if needed
      // But we do want to show "updating..."? Maybe not necessary for auto-refresh.
      // For initial load, we do want loading state.
      // Let's rely on loadingArrivals for initial load only?
      // Or we can check if data exists.
      
      try {
           const newArrivals = {};
           let allIncomingBuses = [];

            // Fix warnings: Parse routes from raw string if they don't exist on the object
            let stopRoutes = stop.routes;
            if (!stopRoutes || stopRoutes.length === 0) {
                 if (stop.raw && stop.raw.ROUTE_NOS) {
                     stopRoutes = [...new Set(stop.raw.ROUTE_NOS.split(',').map(r => r.trim()))];
                 } else {
                     stopRoutes = [];
                 }
            }

           await Promise.all(stopRoutes.map(async (route) => {
               const checkDir = async (d) => {
                   try {
                     const [res2, res0] = await Promise.all([
                        fetchBusListApi(route, d, '2'),
                        fetchBusListApi(route, d, '0')
                     ]);
                     
                     // Helper Logic (Duplicated for brevity, could be refactored)
                     const isValid = (r) => r.data && r.data.data && r.data.data.routeInfo && r.data.data.routeInfo.length > 0;
                     const countBuses = (stops) => stops.flatMap(s => s.busInfo || []).length;
                     const findStopIndex = (stops) => {
                         return stops.findIndex(s => {
                             const sCode = (s.staCode || "").replace(/\//g, '-').replace(/_/g, '-');
                             // Fix: Use stopCode argument instead of stop.code from closure
                             const target = (stopCode || "").replace(/\//g, '-').replace(/_/g, '-');
                             const targetBase = target.split('-')[0];
                             if (sCode === target) return true;
                             if (sCode === targetBase || sCode.split('-')[0] === targetBase) return true;
                             return false;
                         });
                     };

                     let candidates = [];
                     if (isValid(res2)) candidates.push(res2.data.data.routeInfo);
                     if (isValid(res0)) candidates.push(res0.data.data.routeInfo);

                     let bestStops = null;
                     let bestIdx = -1;
                     for (const cStops of candidates) {
                         const idx = findStopIndex(cStops);
                         if (idx !== -1) {
                             if (!bestStops || countBuses(cStops) > countBuses(bestStops)) {
                                 bestStops = cStops;
                                 bestIdx = idx;
                             }
                         }
                     }

                     if (bestStops && bestIdx !== -1) {
                          // Found valid route direction!
                          
                          // Fetch traffic data for this route/direction
                          let routeTrafficData = [];
                          try {
                              const trafficSegments = await fetchTrafficApi(route, d);
                              routeTrafficData = trafficSegments || [];
                          } catch (trafficErr) {
                              console.log("Traffic fetch failed for NearbyStops, using default:", trafficErr);
                          }
                          
                                                   // 1. Calculate Arrival Info (Rich Data)
                          const stops = bestStops;
                          const stopIdx = bestIdx;
                          const totalStops = stops.length;
                          let incomingBuses = []; // Array of { plate, stopsAway, eta, distanceM }
                          let minStops = 999;
                          let minTimeEst = 999;

                          // Helper to find coords from local JSON data
                          // API staCode examples: "M11-1", "T308/3", "M11"
                          // Local JSON: raw.P_ALIAS = "M11_1", raw.ALIAS = "M11"
                          const getCoords = (s) => {
                              const staCode = (s.staCode || "").replace(/[-_]/g, '/').toUpperCase();
                              const staBase = staCode.split('/')[0];
                              
                              // Try to find matching stop in local data
                              let match = stopsData.find(local => {
                                  // Normalize P_ALIAS: "M11_1" -> "M11/1"
                                  const pAlias = (local.raw?.P_ALIAS || "").replace(/[-_]/g, '/').toUpperCase();
                                  // Normalize ALIAS: "M11"
                                  const alias = (local.raw?.ALIAS || "").toUpperCase();
                                  
                                  // Try exact match on P_ALIAS first
                                  if (pAlias === staCode) return true;
                                  // Try exact match on ALIAS
                                  if (alias === staCode) return true;
                                  // Try base match (e.g., M11 matches M11/1)
                                  if (alias === staBase) return true;
                                  if (pAlias.split('/')[0] === staBase) return true;
                                  
                                  return false;
                              });
                              
                              return match ? { lat: match.lat, lon: match.lon } : null;
                          };

                          // Calculate distance between two stop indices
                          const calcPathDistance = (fromIdx, toIdx) => {
                              let pathDistKm = 0;
                              for (let j = fromIdx; j < toIdx; j++) {
                                  const p1 = getCoords(stops[j]);
                                  const p2 = getCoords(stops[j+1]);
                                  if (p1 && p2) {
                                     pathDistKm += getDistanceFromLatLonInKm(p1.lat, p1.lon, p2.lat, p2.lon);
                                  }
                              }
                              return pathDistKm;
                          };
                          
                          // Calculate traffic-adjusted travel time segment by segment
                          // Each segment gets its own traffic multiplier
                          const calcTravelTime = (fromIdx, toIdx) => {
                              let totalTime = 0;
                              for (let j = fromIdx; j < toIdx; j++) {
                                  const p1 = getCoords(stops[j]);
                                  const p2 = getCoords(stops[j+1]);
                                  if (p1 && p2) {
                                      const segmentDistKm = getDistanceFromLatLonInKm(p1.lat, p1.lon, p2.lat, p2.lon);
                                      
                                      // Get traffic level for this segment
                                      // Traffic: 1=smooth(1x), 2=moderate(1.5x), 3+=congested(2x)
                                      let trafficMultiplier = 1.0;
                                      if (routeTrafficData && routeTrafficData[j]) {
                                          const traffic = routeTrafficData[j].traffic || 1;
                                          if (traffic >= 3) trafficMultiplier = 2.0;      // 🔴 Congested
                                          else if (traffic >= 2) trafficMultiplier = 1.5; // 🟡 Moderate
                                          // else 🟢 Smooth = 1.0
                                      }
                                      
                                      // Base: 1.5 min/km (~40 km/h), adjusted by traffic
                                      totalTime += segmentDistKm * 1.5 * trafficMultiplier;
                                  }
                              }
                              return totalTime;
                          };

                          // Collect ALL incoming buses with individual ETAs
                          for (let i = 0; i <= stopIdx; i++) {
                              if (stops[i].busInfo && stops[i].busInfo.length > 0) {
                                  const stopsAway = stopIdx - i;
                                  const pathDistKm = calcPathDistance(i, stopIdx);
                                  
                                  // Calculate traffic-adjusted ride time (per-segment)
                                  const rideTime = calcTravelTime(i, stopIdx);
                                  const dwellTime = stopsAway * 0.5;
                                  let eta = Math.round(rideTime + dwellTime);
                                  if (eta === 0 && stopsAway > 0 && pathDistKm > 0.1) eta = 1;
                                  
                                  // Helper to get stop name from local stopsData via staCode
                                  const getStopName = (s) => {
                                      const staCode = (s.staCode || "").replace(/[-_]/g, '/').toUpperCase();
                                      const staBase = staCode.split('/')[0];
                                      
                                      const match = stopsData.find(local => {
                                          const pAlias = (local.raw?.P_ALIAS || "").replace(/[-_]/g, '/').toUpperCase();
                                          const alias = (local.raw?.ALIAS || "").toUpperCase();
                                          if (pAlias === staCode) return true;
                                          if (alias === staCode) return true;
                                          if (alias === staBase) return true;
                                          if (pAlias.split('/')[0] === staBase) return true;
                                          return false;
                                      });
                                      
                                      return match ? match.name : s.staCode;
                                  };
                                  
                                  stops[i].busInfo.forEach(b => {
                                      incomingBuses.push({
                                          plate: b.busPlate,
                                          stopsAway: stopsAway,
                                          currentStop: getStopName(stops[i]),
                                          eta: eta,
                                          distanceM: Math.round(pathDistKm * 1000)
                                      });
                                  });

                                  // Track minimum for summary
                                  if (stopsAway < minStops) {
                                      minStops = stopsAway;
                                      minTimeEst = eta;
                                  }
                              }
                          }

                          // Sort buses by ETA (closest first), limit to 2
                          incomingBuses.sort((a, b) => a.eta - b.eta);
                          const topBuses = incomingBuses.slice(0, 2);
                          const incomingPlates = incomingBuses.map(b => b.plate);

                         const totalActiveBuses = incomingPlates.length; // Only count incoming? No, existing logic counted all. 
                         // Logic was: const totalActiveBuses = stops.flatMap(s => s.busInfo || []).length;
                         // Let's stick strictly to arrival text logic for text.
                         const actualTotal = stops.flatMap(s => s.busInfo || []).length;

                          // Get destination (last stop name)
                          const destination = stops[stops.length - 1]?.staName || '';

                          // Determine status
                          let status = 'no-service';
                          if (minStops === 0) status = 'arriving';
                          else if (minStops < 999) status = 'active';
                          else if (actualTotal > 0) status = 'no-approaching';

                          // Build rich info object
                          const info = {
                              buses: topBuses,
                              destination: destination,
                              totalStops: totalStops,
                              currentStopIdx: stopIdx,
                              status: status,
                              minStops: minStops,
                              minEta: minTimeEst,
                              direction: d  // Track which direction this stop was found in
                          };

                         // 2. Fetch GPS for Map (If there are incoming buses)
                         // User wants only the 2 closest buses per route
                         const targetPlates = incomingPlates.slice(-2);

                         if (targetPlates.length > 0) {
                             try {
                                 const gpsData = await fetchMapLocationApi(route, d);
                                 const busList = gpsData.busInfoList || (gpsData.data && gpsData.data.busInfoList) || [];
                                 
                                 // Filter GPS list by incoming plates
                                 const matchedBuses = busList
                                    .filter(b => targetPlates.includes(b.busPlate))
                                    .map(b => ({
                                        ...b,
                                        route: route,
                                        dir: d
                                    }));
                                 
                                 if (matchedBuses.length > 0) {
                                     allIncomingBuses.push(...matchedBuses);
                                 }
                             } catch (gpsErr) {
                                 console.warn("GPS fetch failed for nearby", gpsErr);
                             }
                         }

                         return info;
                     }
                   } catch (e) { console.warn(e); }
                   return null;
               };

               const info0 = await checkDir('0');
               if (info0) { newArrivals[route] = info0; return; }
               const info1 = await checkDir('1');
               if (info1) { newArrivals[route] = info1; } 
               else { newArrivals[route] = "No Service / Wrong Sta"; }
          }));

           // Update state with new data
           setArrivalData(prev => ({...prev, [stopCode]: newArrivals }));
           setStopBuses(allIncomingBuses);
           setLastUpdated(new Date());

      } catch (err) {
           console.error("Arrival fetch failed", err);
      } finally {
           setLoadingArrivals(prev => ({...prev, [stopCode]: false}));
      }
  };

  // Auto-Refresh Effect
  useEffect(() => {
      let intervalId;
      if (expandedStop) {
          // Initial Fetch
          // Only start loading spinner if we don't have data yet?
          setLoadingArrivals(prev => ({...prev, [expandedStop]: true}));
          fetchStopData(expandedStop);

          // Interval Fetch (every 5 seconds)
          intervalId = setInterval(() => {
              fetchStopData(expandedStop);
          }, 5000);
      } else {
          setStopBuses([]);
      }

      return () => {
          if (intervalId) clearInterval(intervalId);
      };
  }, [expandedStop]);

  const handleExpandStop = (stop) => {
      if (expandedStop === stop.code) {
          setExpandedStop(null);
      } else {
          setExpandedStop(stop.code);
          // State clearing is now handled by effect or assumed fresh
          // We can optionally clear old data here if we want fresh start visual
          setArrivalData(prev => ({...prev, [stop.code]: {} })); 
          setStopBuses([]);
      }
  };

  const handleManualRefresh = () => {
      if (expandedStop) {
          setLoadingArrivals(prev => ({...prev, [expandedStop]: true}));
          fetchStopData(expandedStop);
      } else if (userLocation) {
          setLoading(true);
          findNearby(userLocation.lat, userLocation.lon);
      }
  };

  return (
    <div className="flex flex-col h-full bg-white animate-fade-in-up">
        {/* ... Header ... */}
        {/* Same Header Code, just ensuring it's preserved */}
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 sticky top-0 z-10">
            <h2 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                📍 Nearby Stops
            </h2>
            <div className="flex gap-2 items-center">
                 <button 
                    onClick={handleManualRefresh}
                    className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors active:scale-95"
                    title="Refresh Data"
                 >
                    🔄
                 </button>
                 <div className="flex bg-gray-200 rounded-lg p-1 text-xs font-semibold">
                    <button 
                        className={`px-3 py-1 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setViewMode('list')}
                    >
                        List
                    </button>
                    <button 
                        className={`px-3 py-1 rounded-md transition-all ${viewMode === 'map' ? 'bg-white shadow text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setViewMode('map')}
                    >
                        Map
                    </button>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">✕</button>
            </div>
        </div>

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
                                                
                                                // Color coding based on ETA
                                                const getEtaColor = (eta) => {
                                                    if (eta <= 3) return 'bg-green-500';
                                                    if (eta <= 10) return 'bg-yellow-500';
                                                    return 'bg-orange-500';
                                                };
                                                
                                                const getEtaTextColor = (eta) => {
                                                    if (eta <= 3) return 'text-green-600';
                                                    if (eta <= 10) return 'text-yellow-600';
                                                    return 'text-orange-600';
                                                };

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
