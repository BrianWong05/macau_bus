
import { useState, useEffect, useRef } from 'react';
import MapComponent from './components/MapComponent';
import BusList from './components/BusList';
import { fetchRouteDataApi, fetchTrafficApi, fetchBusListApi, fetchMapLocationApi } from './services/api';

function App() {
  const [routeNo, setRouteNo] = useState(''); // Input value
  const [activeRoute, setActiveRoute] = useState(''); // Actual confirmed route for fetching
  const [direction, setDirection] = useState('0'); // '0' or '1'
  const [busData, setBusData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasOppositeDirection, setHasOppositeDirection] = useState(true); // Default true until checked
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [mapBuses, setMapBuses] = useState([]); // Buses for Map View (lat/lon)
  const [trafficData, setTrafficData] = useState([]); // Traffic Info (Array of Segments)
  const [lastUpdated, setLastUpdated] = useState(null); // Last successful fetch time

  // Ref to track active route for preventing race conditions (async fetches returning after route switch)
  const activeRouteRef = useRef('');

  useEffect(() => {
      activeRouteRef.current = activeRoute;
  }, [activeRoute]);

  const handleSearch = async () => {
    if (!routeNo) return;
    setLoading(true);
    setError('');
    setActiveRoute(routeNo); // Set active route ONLY on search
    activeRouteRef.current = routeNo; // Sync ref immediately
    setBusData(null);
    setMapBuses([]); 
    setTrafficData([]);
    setHasOppositeDirection(false); 

    try {
        console.log(`Searching for Route: ${routeNo}, Dir: ${direction}`);
        
        // 1. Fetch Route Stops (JSON API)
        const data = await fetchRouteDataApi(routeNo, direction);
        
        // Guard: If user switched route while fetching, ignore result
        if (activeRouteRef.current !== routeNo) return;

        if (data && data.data && data.data.routeInfo && data.data.routeInfo.length > 0) {
             // Initialize stops with empty buses/traffic arrays
             const stops = data.data.routeInfo.map(stop => ({
                 ...stop,
                 buses: [],
                 trafficLevel: 0
             }));
             
             setBusData({
                 stops: stops,
                 buses: [], // Will be filled by realtime fetch
                 raw: data.data
             });
             
             // Initial bus load
             fetchRealtimeBus(routeNo, direction, stops);

             // 2. Probe Opposite Direction
             const oppositeDir = direction === '0' ? '1' : '0';
             try {
                  const oppositeData = await fetchRouteDataApi(routeNo, oppositeDir);
                  if (oppositeData && oppositeData.data && oppositeData.data.routeInfo && oppositeData.data.routeInfo.length > 0) {
                      if (activeRouteRef.current === routeNo) setHasOppositeDirection(true);
                  } else {
                      if (activeRouteRef.current === routeNo) setHasOppositeDirection(false);
                  }
             } catch (probeError) {
                  console.log("Opposite direction probe failed:", probeError);
                  if (activeRouteRef.current === routeNo) setHasOppositeDirection(false);
             }

        } else {
            setError("Route not found or empty data.");
        }


    } catch (err) {
        console.error("Search Error:", err);
        setError(err.message || "Failed to fetch route data");
    } finally {
        if (activeRouteRef.current === routeNo) setLoading(false);
    }
  };
  
  const fetchRealtimeBus = async (rNo, dir, currentStops) => {
      // routeType varies (N2=0, N3=2, 33=2). 
      const typesToProbe = ['0', '2'];
      
      // Parallel Probe for bus list data
      const promises = typesToProbe.map(type => fetchBusListApi(rNo, dir, type));

      // Also start Traffic Fetch
      const trafficPromise = fetchTrafficApi(rNo.replace(/^0+/, ''), dir);

      try {
          const results = await Promise.all([...promises, trafficPromise]);
          
          // Guard: Race Condition Check
          if (activeRouteRef.current !== rNo) {
             console.log(`Ignoring stale result for ${rNo} (Current: ${activeRouteRef.current})`);
             return; 
          }

          const trafficResult = results.pop(); // Last one is traffic

          // Find successful bus result...
          const validResult = results.find(r => r.data && r.data.header === '000');
          
          if (validResult && validResult.data && validResult.data.data && validResult.data.data.routeInfo) {
              console.log(`Found valid data with routeType=${validResult.type}`);
              const realtimeStops = validResult.data.data.routeInfo;
              
              // Merge bus info and traffic into currentStops
              const updatedStops = currentStops.map(stop => {
                   const matchingStop = realtimeStops.find(rs => rs.staCode === stop.staCode);
                   if (matchingStop) {
                       return {
                           ...stop,
                           // Update Buses
                           buses: (matchingStop.busInfo || []).map(b => ({
                               ...b,
                               status: b.status, // 0=Moving, 1=Arrived
                               speed: b.speed,
                               busPlate: b.busPlate,
                               busType: b.busType,
                               isFacilities: b.isFacilities,
                               passengerFlow: b.passengerFlow
                           })),
                           // If traffic data has a key for this stop?
                           // Traffic result is array of segments. 
                           // Actually trafficResult is segments array from new API logic.
                           // Need to map segments to stops if we want color? 
                           // Current implementation just passes trafficResult to MapComponent.
                           // Timeline uses stop.trafficLevel.
                           trafficLevel: 0 // Placeholder as traffic logic was simplified in extracted API
                       };
                   }
                   return { ...stop, buses: [], trafficLevel: 0 };
              });
              
              // Extract all active buses for summary
              const allBuses = updatedStops.flatMap(s => s.buses).map(b => ({
                  ...b,
                  plate: b.busPlate,
                  speed: b.speed
              }));

              setBusData(prev => ({
                  ...prev,
                  stops: updatedStops,
                  buses: allBuses
              }));
          } else {
             console.warn("No valid realtime data found in probes:", results);
          }
      } catch (e) {
          console.error("Realtime fetch failed", e);
      }
  };

  const fetchBusLocation = async (rNo, dir) => {
      try {
        const data = await fetchMapLocationApi(rNo, dir);

        // Guard: Race Condition Check
        if (activeRouteRef.current !== rNo) {
            console.log(`Ignoring stale Map result for ${rNo}`);
            return;
        }
        
        setLastUpdated(new Date()); // Update timestamp

        // Must match fixed logic: busInfoList might be at root
        const busList = data.busInfoList || (data.data && data.data.busInfoList);

        if (busList && busList.length > 0) {
            console.log("Map GPS Buses found:", busList.length);
            setMapBuses(busList);
        } else {
             // console.log("Location API empty (or no buses). Trying List API fallback...");
             const typesToProbe = ['0', '2'];
             
             // Try to fetch detailed list data for hydration
             let found = false;
             for (const type of typesToProbe) {
                 if (found) break;
                 const busRes = await fetchBusListApi(rNo, dir, type);
                 
                 if (activeRouteRef.current !== rNo) return; // Guard

                 if (busRes.data && busRes.data.data && busRes.data.data.routeInfo) {
                    let allBuses = [];
                    
                    busRes.data.data.routeInfo.forEach(stop => {
                        if (stop.busInfo) {
                            // Inject staCode so MapComponent can hydrate location
                            const busesAtStop = stop.busInfo.map(b => ({
                                ...b,
                                staCode: stop.staCode
                            }));
                            allBuses = [...allBuses, ...busesAtStop];
                        }
                    });

                    if (allBuses.length > 0) {
                        console.log("Fallback Buses found (with staCode):", allBuses);
                        setMapBuses(allBuses);
                        found = true;
                    }
                 }
             }
             if (!found && activeRouteRef.current === rNo) setMapBuses([]);
        }

        // Fetch Traffic INDEPENDENTLY of location success/fail
        try {
            const traffic = await fetchTrafficApi(rNo.replace(/^0+/, ''), dir);
            if (activeRouteRef.current === rNo) setTrafficData(traffic);
        } catch (tErr) {
            console.log("Traffic fetch failed:", tErr);
        }
      } catch (e) {
          console.error("Map Bus Fetch Error:", e);
          if (activeRouteRef.current === rNo) setMapBuses([]);
      }
  };

  const toggleDirection = async () => {
      const newDir = direction === '0' ? '1' : '0';
      setDirection(newDir);
      setMapBuses([]); // Clear map buses immediately
      setTrafficData([]); // Clear traffic immediately
      
      // Seamlessly fetch new direction data without clearing current view immediately
      if (activeRoute) {
          try {
             const data = await fetchRouteDataApi(activeRoute, newDir);
             
             if (activeRouteRef.current !== activeRoute) return; // Guard logic if route changed mid-toggle

             if (data && data.data && data.data.routeInfo && data.data.routeInfo.length > 0) {
                 const routeInfo = data.data.routeInfo;
                 const stops = routeInfo.map(stop => ({
                    ...stop,
                    buses: [] // Initialize empty buses array for each stop to prevent render error
                 }));

                 setBusData({
                    stops: stops,
                    buses: [], // Will be filled by auto-refresh or immediate trigger
                    raw: data.data
                 });
                 // Trigger immediate bus update for new stops
                 fetchRealtimeBus(activeRoute, newDir, stops);
             }
          } catch (e) {
              console.error("Failed to switch direction", e);
          }
      }
  };

  // Auto Refresh Interval
  useEffect(() => {
      let interval;
      // Depend on activeRoute!
      if (busData && activeRoute) {
          // Immediate fetch on switch
          if (viewMode === 'map') {
              fetchBusLocation(activeRoute, direction);
          } else {
             // list view update
             fetchRealtimeBus(activeRoute, direction, busData.stops);
          }

          interval = setInterval(() => {
               if (viewMode === 'map') {
                  fetchBusLocation(activeRoute, direction);
               } else {
                  // Pass current stops so we don't lose structure, but update content
                  fetchRealtimeBus(activeRoute, direction, busData.stops);
               }
          }, 3000); // 3-second refresh
      }
      return () => clearInterval(interval);
  }, [busData, activeRoute, direction, viewMode]); // Added activeRoute dependency

  // Debug: Monitor Map Buses
  useEffect(() => {
    if (viewMode === 'map' && mapBuses.length > 0) {
        // console.log("Current Map Buses State:", mapBuses);
        const coords = mapBuses.map(b => {
            if (b.latitude && b.longitude) {
                return `${b.busPlate}: ${b.latitude}, ${b.longitude} (Speed: ${b.speed})`;
            }
            return `${b.busPlate}: Station ${b.staCode} (Fallback)`;
        });
        console.log("Bus Locations Update:", coords);
    }
  }, [mapBuses, viewMode]);

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
        <h1 className="text-xl font-bold mb-4 text-center text-teal-600">Macau Bus Waiting</h1>
        
        {/* Search Input */}
        <div className="flex gap-2 mb-4">
          <input 
            type="text" 
            value={routeNo} 
            onChange={(e) => setRouteNo(e.target.value)} 
            placeholder="Route No. (e.g. 33, N2)"
            className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button 
            onClick={handleSearch}
            className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 transition"
          >
            Search
          </button>
        </div>

        {/* Direction Toggle - Hidden if no opposite direction or no data */}
        {busData && hasOppositeDirection && (
            <div className="flex justify-center mb-4 gap-4">
                <button 
                    onClick={toggleDirection}
                    className="text-sm text-teal-600 underline"
                >
                    Switch Direction (Current: {direction === '0' ? 'Forward' : 'Backward'})
                </button>
            </div>
        )}

        {/* View Toggle (List | Map) */}
        {busData && (
             <div className="flex justify-center mb-4">
                <div className="bg-gray-200 p-1 rounded-lg flex">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`px-4 py-1 rounded-md text-sm transition ${viewMode === 'list' ? 'bg-white shadow text-teal-600 font-bold' : 'text-gray-500'}`}
                    >
                        List
                    </button>
                    <button
                        onClick={() => setViewMode('map')}
                        className={`px-4 py-1 rounded-md text-sm transition ${viewMode === 'map' ? 'bg-white shadow text-teal-600 font-bold' : 'text-gray-500'}`}
                    >
                        Map
                    </button>
                </div>
             </div>
        )}

        {/* Refresh Button & Timestamp */}
        {busData && (
           <div className="flex justify-between items-center mb-2 px-2">
             <div className="text-xs text-gray-400">
                {lastUpdated ? `Updated: ${lastUpdated.toLocaleTimeString()}` : ''}
             </div>
             <button 
               onClick={() => {
                   if (viewMode === 'map') fetchBusLocation(activeRoute, direction);
                   else fetchRealtimeBus(activeRoute, direction, busData.stops);
               }}
               className="text-gray-500 text-sm flex items-center gap-1 hover:text-teal-600"
             >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
               </svg>
               Refresh
             </button>
           </div>
        )}

        {/* Loading / Error */}
        {loading && <p className="text-center text-gray-500">Loading...</p>}
        {error && <p className="text-center text-red-500 text-sm">{error}</p>}

        {/* Results */}
        {busData && (
          <div className="border-t pt-4">
             <h2 className="text-lg font-semibold mb-2">Route: {activeRoute}</h2>
             <div className="space-y-2">
                
                {/* Active Buses Summary */}
                {busData.buses.length > 0 ? (
                    <div className="bg-green-50 p-2 rounded mb-2 text-sm text-green-800">
                        {busData.buses.length} Active Buses Found.
                    </div>
                ) : (
                    <div className="bg-yellow-50 p-2 rounded mb-2 text-sm text-yellow-800">
                        {mapBuses.some(b => b.staCode) ? (
                            <span>⚠️ GPS Signal Weak. Tracking via Station Updates (Approximate Location).</span>
                        ) : (
                            <span>No active buses found (or GPS API restriction).</span>
                        )}
                    </div>
                )}

                {/* Stops List (Timeline) */}
                {busData && viewMode === 'list' && (
                    <BusList stops={busData.stops} />
                )}

                {/* Map View */}
                {viewMode === 'map' && (
                    <div className="mt-4 border rounded overflow-hidden">
                         <div style={{ height: '500px', width: '100%' }}>
                            <MapComponent 
                                stations={busData.stops} 
                                buses={mapBuses}
                                traffic={trafficData} // Pass traffic segments
                            />
                         </div>
                    </div>
                )}

             </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
